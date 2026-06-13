import type { Browser } from "webdriverio"

import { log } from "./log"

/**
 * Browser safeguards for rendering untrusted Storybook bundles (issue #69).
 *
 * User uploads contain arbitrary HTML/CSS/JS that we execute in a headless
 * Chrome instance. This module hardens that execution against exfiltration and
 * abuse via two complementary layers:
 *
 *  1. Chrome launch flags ({@link hardenedChromeArgs}) that disable risky
 *     platform features (WebRTC, background networking, etc.) at the browser
 *     level. These are applied via `goog:chromeOptions.args` and cannot be
 *     undone by page script.
 *
 *  2. A page-level init script ({@link SAFEGUARD_INIT_SCRIPT}) installed before
 *     any story code runs. It neutralizes off-origin navigation and real-time
 *     transports, and blocks (or, in the future, meters) off-origin
 *     sub-resource requests.
 *
 * Defense-in-depth note: the init script runs inside the page and is therefore
 * not a hard security boundary on its own — a sufficiently adversarial bundle
 * could attempt to capture references before our script runs. We install it as
 * the very first script and also rely on the Chrome flags + the localhost-only
 * static server as the harder boundaries. Byte-accurate external asset metering
 * (issue #69, last bullet) requires CDP/BiDi network interception.
 */

/**
 * The hostname our local static server is bound to. All same-origin traffic is
 * served from here; everything else is considered "off-origin" and untrusted.
 */
export const ALLOWED_HOST = "localhost"

/**
 * Additional Chrome launch flags that harden the browser against untrusted
 * page content. Merged into the base `goog:chromeOptions.args`.
 *
 * Each flag is conservative: it disables a feature that legitimate Storybook
 * stories do not need for static visual rendering, so enabling them should not
 * destabilize screenshots.
 */
export const HARDENING_CHROME_ARGS: readonly string[] = [
  // Disable WebRTC entirely (STUN/TURN/data channels are a common exfil/peer
  // vector and are almost never needed to render a static story).
  "--disable-webrtc",
  "--enforce-webrtc-ip-permission-check",
  "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
  // Block all background networking Chrome itself initiates.
  "--disable-background-networking",
  "--disable-component-update",
  "--disable-domain-reliability",
  "--no-pings",
  // Disable speculative/preconnect networking that could reach arbitrary hosts.
  "--dns-prefetch-disable",
  // Reduce the feature surface: turn off a set of risky/experimental web
  // platform features that untrusted content might abuse.
  "--disable-features=WebRtcHideLocalIpsWithMdns,MediaRouter,DialMediaRouteProvider",
  // Do not allow the renderer to open external protocol handlers.
  "--disable-external-intent-requests",
]

/**
 * Returns the full Chrome args array: the existing base flags plus the
 * hardening flags, de-duplicated while preserving order.
 */
export function hardenedChromeArgs(baseArgs: readonly string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const arg of [...baseArgs, ...HARDENING_CHROME_ARGS]) {
    if (!seen.has(arg)) {
      seen.add(arg)
      result.push(arg)
    }
  }
  return result
}

/**
 * Page init-script source, evaluated in the page context before any story
 * script runs. It is intentionally written as a self-contained function with no
 * external references so it can be serialized via `addInitScript`.
 *
 * Behavior:
 *  - Blocks off-origin top-level navigation and `window.open` to non-same-origin
 *    URLs (same-origin == the local static server).
 *  - Disables real-time transports entirely: WebSocket, WebTransport, RTCPeer-
 *    Connection, EventSource.
 *  - Blocks off-origin `fetch` and `XMLHttpRequest`; same-origin requests pass
 *    through unchanged so legitimate Storybook assets still load.
 */
export function safeguardInitScript(): void {
  // Runs in the browser. `window`, `document`, `location` are page globals.
  /* eslint-disable */
  // @ts-nocheck
  try {
    // @ts-ignore
    const w: any = window
    // @ts-ignore
    const loc = w.location

    const sameOrigin = (url: any): boolean => {
      try {
        // Relative URLs and hash/query-only URLs resolve to the page origin.
        const resolved = new w.URL(String(url), loc.href)
        return resolved.origin === loc.origin
      } catch {
        // Unparseable URLs (e.g. "javascript:", "about:blank") are treated as
        // same-origin / harmless navigations and allowed.
        return true
      }
    }

    const noop = function () {}

    // --- Block off-origin top-level navigation ---
    try {
      const assign = loc.assign.bind(loc)
      const replace = loc.replace.bind(loc)
      // @ts-ignore
      w.location.assign = (url: any) => {
        if (sameOrigin(url)) assign(url)
      }
      // @ts-ignore
      w.location.replace = (url: any) => {
        if (sameOrigin(url)) replace(url)
      }
    } catch {
      /* location may be non-configurable; ignore */
    }

    const origOpen = w.open ? w.open.bind(w) : null
    // @ts-ignore
    w.open = (url?: any, ...rest: any[]) => {
      if (url == null || sameOrigin(url)) {
        return origOpen ? origOpen(url, ...rest) : null
      }
      return null
    }

    // --- Disable real-time transports ---
    const Blocked = function () {
      throw new w.DOMException(
        "Blocked by vizdiff rendering safeguards",
        "SecurityError",
      )
    }
    for (const name of ["WebSocket", "WebTransport", "RTCPeerConnection", "EventSource"]) {
      try {
        // @ts-ignore
        w[name] = Blocked
      } catch {
        /* ignore non-writable globals */
      }
    }
    try {
      // Some engines expose the webkit-prefixed variant.
      // @ts-ignore
      w.webkitRTCPeerConnection = Blocked
    } catch {
      /* ignore */
    }

    // --- Block off-origin fetch ---
    if (typeof w.fetch === "function") {
      const origFetch = w.fetch.bind(w)
      // @ts-ignore
      w.fetch = (input: any, init?: any) => {
        const url = typeof input === "string" ? input : input && input.url
        if (url == null || sameOrigin(url)) {
          return origFetch(input, init)
        }
        return w.Promise.reject(
          new w.DOMException("Blocked off-origin fetch by vizdiff safeguards", "SecurityError"),
        )
      }
    }

    // --- Block off-origin XMLHttpRequest ---
    if (w.XMLHttpRequest && w.XMLHttpRequest.prototype) {
      const origXhrOpen = w.XMLHttpRequest.prototype.open
      // @ts-ignore
      w.XMLHttpRequest.prototype.open = function (method: any, url: any, ...rest: any[]) {
        if (url != null && !sameOrigin(url)) {
          throw new w.DOMException(
            "Blocked off-origin XMLHttpRequest by vizdiff safeguards",
            "SecurityError",
          )
        }
        // @ts-ignore
        return origXhrOpen.call(this, method, url, ...rest)
      }
    }

    // --- Block sendBeacon (fire-and-forget exfil) entirely ---
    try {
      if (w.navigator && typeof w.navigator.sendBeacon === "function") {
        // @ts-ignore
        w.navigator.sendBeacon = () => false
      }
    } catch {
      /* ignore */
    }

    void noop
  } catch {
    // Never let safeguard installation crash the page.
  }
  /* eslint-enable */
}

/**
 * Installs the page-level safeguards on the given browser session. Must be
 * called once after the session is created and before navigating to any story.
 *
 * Uses WebDriver BiDi `addInitScript` so the guard is re-applied on every
 * document/navigation for the life of the session.
 */
export async function installBrowserSafeguards(browser: Browser): Promise<void> {
  try {
    await browser.addInitScript(safeguardInitScript)
    log.info("Installed page-level rendering safeguards (init script)")
  } catch (err) {
    // BiDi may be unavailable depending on the driver. Surface a warning but do
    // not fail rendering — the Chrome hardening flags and localhost-only server
    // remain in effect.
    log.warn(err, "Failed to install page-level rendering safeguards via init script")
  }
}

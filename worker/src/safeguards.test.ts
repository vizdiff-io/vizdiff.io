import { describe, expect, it, vi } from "vitest"
import type { Browser } from "webdriverio"

import {
  HARDENING_CHROME_ARGS,
  hardenedChromeArgs,
  installBrowserSafeguards,
  safeguardInitScript,
} from "./safeguards"

vi.mock("./log", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

describe("hardenedChromeArgs", () => {
  it("appends all hardening flags to the base args", () => {
    const base = ["--headless", "--no-sandbox"]
    const result = hardenedChromeArgs(base)
    expect(result.slice(0, 2)).toEqual(base)
    for (const flag of HARDENING_CHROME_ARGS) {
      expect(result).toContain(flag)
    }
  })

  it("disables WebRTC", () => {
    expect(hardenedChromeArgs([])).toContain("--disable-webrtc")
  })

  it("de-duplicates flags while preserving order", () => {
    const result = hardenedChromeArgs(["--headless", "--disable-webrtc"])
    expect(result.filter((a) => a === "--disable-webrtc")).toHaveLength(1)
    expect(result[0]).toBe("--headless")
  })
})

describe("installBrowserSafeguards", () => {
  it("installs the init script via addInitScript", async () => {
    const addInitScript = vi.fn().mockResolvedValue(undefined)
    const browser = { addInitScript } as unknown as Browser
    await installBrowserSafeguards(browser)
    expect(addInitScript).toHaveBeenCalledWith(safeguardInitScript)
  })

  it("does not throw if addInitScript fails (BiDi unavailable)", async () => {
    const addInitScript = vi.fn().mockRejectedValue(new Error("no BiDi"))
    const browser = { addInitScript } as unknown as Browser
    await expect(installBrowserSafeguards(browser)).resolves.toBeUndefined()
  })
})

/**
 * Exercises the page init script against a minimal fake `window`, simulating the
 * browser environment so we can assert the runtime safeguard behavior without a
 * real browser.
 */
describe("safeguardInitScript (page behavior)", () => {
  class FakeDOMException extends Error {
    constructor(
      message: string,
      public name: string,
    ) {
      super(message)
    }
  }

  function makeWindow(origin: string) {
    const calls = { assign: [] as string[], replace: [] as string[], open: [] as string[] }
    const fetchCalls: string[] = []
    const xhrOpenCalls: string[] = []

    const win: Record<string, unknown> = {
      URL,
      Promise,
      DOMException: FakeDOMException,
      location: {
        href: `${origin}/iframe.html`,
        origin,
        assign: (url: string) => calls.assign.push(url),
        replace: (url: string) => calls.replace.push(url),
      },
      open: (url?: string) => {
        calls.open.push(String(url))
        return null
      },
      WebSocket: class RealWS {
        connected = true
      },
      WebTransport: class RealWT {
        ready = true
      },
      RTCPeerConnection: class RealRTC {
        ready = true
      },
      EventSource: class RealES {
        open = true
      },
      fetch: (input: unknown) => {
        fetchCalls.push(typeof input === "string" ? input : String((input as { url?: string }).url))
        return Promise.resolve("ok")
      },
      XMLHttpRequest: class {
        open(_method: string, url: string) {
          xhrOpenCalls.push(url)
        }
      },
      navigator: { sendBeacon: () => true },
    }
    return { win, calls, fetchCalls, xhrOpenCalls }
  }

  function run(origin: string) {
    const ctx = makeWindow(origin)
    // Run the init script with our fake window installed as a global.
    const g = globalThis as unknown as { window?: unknown }
    const prev = g.window
    g.window = ctx.win
    try {
      safeguardInitScript()
    } finally {
      if (prev == undefined) {
        delete g.window
      } else {
        g.window = prev
      }
    }
    return ctx
  }

  const ORIGIN = "http://localhost:5000"

  it("allows same-origin navigation and blocks off-origin", () => {
    const ctx = run(ORIGIN)
    const loc = ctx.win.location as { assign: (u: string) => void; replace: (u: string) => void }
    loc.assign(`${ORIGIN}/foo`)
    loc.assign("https://evil.example.com/x")
    loc.replace("https://evil.example.com/y")
    loc.replace("/relative")
    expect(ctx.calls.assign).toEqual([`${ORIGIN}/foo`])
    expect(ctx.calls.replace).toEqual(["/relative"])
  })

  it("blocks window.open to off-origin URLs", () => {
    const ctx = run(ORIGIN)
    ;(ctx.win.open as (u: string) => unknown)("https://evil.example.com")
    ;(ctx.win.open as (u: string) => unknown)(`${ORIGIN}/ok`)
    expect(ctx.calls.open).toEqual([`${ORIGIN}/ok`])
  })

  it("disables real-time transports", () => {
    const ctx = run(ORIGIN)
    for (const name of ["WebSocket", "WebTransport", "RTCPeerConnection", "EventSource"]) {
      const Ctor = ctx.win[name] as new () => unknown
      expect(() => new Ctor()).toThrow(/safeguards/)
    }
  })

  it("blocks off-origin fetch but allows same-origin and relative", async () => {
    const ctx = run(ORIGIN)
    const f = ctx.win.fetch as (input: unknown) => Promise<unknown>
    await expect(f("https://evil.example.com/data")).rejects.toThrow(/off-origin fetch/)
    await expect(f(`${ORIGIN}/asset.js`)).resolves.toBe("ok")
    await expect(f("/relative.css")).resolves.toBe("ok")
    expect(ctx.fetchCalls).toEqual([`${ORIGIN}/asset.js`, "/relative.css"])
  })

  it("blocks off-origin XMLHttpRequest.open but allows same-origin", () => {
    const ctx = run(ORIGIN)
    const Xhr = ctx.win.XMLHttpRequest as new () => { open: (m: string, u: string) => void }
    const xhr = new Xhr()
    expect(() => xhr.open("GET", "https://evil.example.com/x")).toThrow(/off-origin XMLHttpRequest/)
    expect(() => xhr.open("GET", `${ORIGIN}/ok`)).not.toThrow()
    expect(ctx.xhrOpenCalls).toEqual([`${ORIGIN}/ok`])
  })

  it("neuters navigator.sendBeacon", () => {
    const ctx = run(ORIGIN)
    const nav = ctx.win.navigator as { sendBeacon: (url: string) => boolean }
    expect(nav.sendBeacon("https://evil.example.com")).toBe(false)
  })
})

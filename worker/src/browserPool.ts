import type { Browser } from "webdriverio"

import { log } from "./log"

/**
 * A fixed-size pool of independent WebdriverIO browser sessions used to render the stories of a
 * single ingest concurrently (issue #152, Phase 1b).
 *
 * Each session is a separate headless-Chrome process, so a story rendered against one session is
 * fully isolated from a story rendered against another (separate storage/cache/cookies and, just
 * as importantly for untrusted bundles, a separate OS process — see issue #69). Because a slot
 * holds a session for the entire render of one story and only ever runs one story against it at a
 * time, no cross-session locking is needed: the pool's checkout/checkin is the only coordination,
 * which is why the former process-wide `browserMutex` could be removed.
 */
export interface BrowserPool {
  /** Every session in the pool — for installing per-session safeguards and for teardown. */
  readonly browsers: readonly Browser[]
  /** Number of sessions in the pool. */
  readonly size: number
  /** Check out an available session, waiting if every session is currently in use. */
  acquire(): Promise<Browser>
  /** Return a session to the pool, handing it to the next waiter if one is queued. */
  release(browser: Browser): void
  /** Close every session, tolerating sessions that are already gone. */
  destroyAll(): Promise<void>
}

/**
 * Creates a pool of `size` sessions by invoking `createBrowser` that many times concurrently.
 * `size` is clamped to at least 1. If any session fails to initialize, the sessions that were
 * already created are torn down before the error is rethrown, so a partial pool is never leaked.
 */
export async function createBrowserPool(
  size: number,
  createBrowser: () => Promise<Browser>,
): Promise<BrowserPool> {
  const count = Math.max(1, Math.floor(size))
  const created: Browser[] = []
  try {
    await Promise.all(
      Array.from({ length: count }, async () => {
        const browser = await createBrowser()
        created.push(browser)
      }),
    )
  } catch (err) {
    // Tear down any sessions that did come up so a failed pool init doesn't leak Chrome processes.
    await Promise.all(created.map((browser) => browser.deleteSession().catch(() => undefined)))
    throw err
  }

  const browsers = created
  const available: Browser[] = [...browsers]
  const waiters: Array<(browser: Browser) => void> = []

  return {
    browsers,
    size: browsers.length,
    acquire(): Promise<Browser> {
      const next = available.shift()
      if (next != undefined) {
        return Promise.resolve(next)
      }
      return new Promise<Browser>((resolve) => waiters.push(resolve))
    },
    release(browser: Browser): void {
      const waiter = waiters.shift()
      if (waiter != undefined) {
        waiter(browser)
      } else {
        available.push(browser)
      }
    },
    async destroyAll(): Promise<void> {
      await Promise.all(
        browsers.map((browser) =>
          browser.deleteSession().catch((err: unknown) => {
            log.debug(
              err,
              "browserPool: deleteSession during teardown failed (may already be closed)",
            )
          }),
        ),
      )
    },
  }
}

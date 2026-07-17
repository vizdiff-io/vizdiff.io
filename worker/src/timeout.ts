/**
 * Error thrown when a build exceeds its configured maximum duration. Distinct from generic
 * failures so the task scheduler can treat it as non-retryable (a build that ran too long is
 * almost always stuck or pathologically large, and retrying would just burn another full
 * timeout window).
 */
export class BuildTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Build exceeded maximum duration of ${timeoutMs}ms`)
    this.name = "BuildTimeoutError"
  }
}

/**
 * How long, after the abort (`onTimeout`) has run, to wait for the original `work` promise to
 * actually settle before declaring the abort failed. Force-closing the browser sessions should
 * cause the in-flight WebDriver commands to reject almost immediately and unwind the stack
 * (running the render's `finally` blocks, which return each session to the browser pool). If it
 * doesn't settle within this grace period the work is genuinely wedged and we treat it as
 * unrecoverable in-process.
 */
const DEFAULT_ABORT_GRACE_MS = 10 * 1000

export interface WithTimeoutOptions {
  /**
   * Grace period (ms) to wait for `work` to settle after `onTimeout` runs. Defaults to
   * {@link DEFAULT_ABORT_GRACE_MS}.
   */
  abortGraceMs?: number
  /**
   * Invoked when the abort fails to make `work` settle within the grace period — i.e. the render
   * is wedged in a way that force-teardown could not unstick (a hung WebDriver op that never
   * rejects, leaving its browser-pool session checked out). Letting the worker continue would
   * let it accept a new build while the wedged render still holds process resources (Chrome
   * sessions, memory), poisoning the worker until restart. The default therefore exits the
   * process non-zero so the orchestrator restarts a clean worker. Overridable for testing.
   */
  onUnrecoverable?: (error: Error) => void
}

function defaultOnUnrecoverable(error: Error): void {
  process.stderr.write(
    `withTimeout: aborted work did not settle within the grace period; exiting worker so the ` +
      `orchestrator restarts a clean process. ${error.message}\n`,
  )
  process.exit(1)
}

/**
 * Race `work` against a timeout. If the timeout fires first, `onTimeout` is invoked to abort the
 * in-flight work (e.g. by force-closing the browser session so pending commands reject), and then
 * — crucially — we wait for the original `work` promise to actually settle before throwing
 * {@link BuildTimeoutError}.
 *
 * Why wait? The underlying `work` promise is not cancellable on its own; `onTimeout` is only the
 * mechanism that interrupts it. If we rejected immediately (as a naive timeout race would), the
 * caller would be free to start the next build while the previous render is still unwinding — and
 * in the scenario this guards against (a `processStory`/WebDriver op stuck mid-render), the
 * render's `finally` blocks would not yet have run, so its browser-pool sessions and other
 * resources would still be in use while a new build spins up more. Awaiting the render's
 * settlement guarantees its cleanup (returning sessions to the pool, tearing the pool down) has
 * run before we hand control back.
 *
 * If the work does not settle within `abortGraceMs` after the abort, the render is wedged beyond
 * in-process recovery; `onUnrecoverable` is invoked (by default, exit the process non-zero) so a
 * fresh worker is started rather than accepting work against poisoned shared state.
 */
export async function withTimeout<T>(
  work: Promise<T>,
  timeoutMs: number,
  onTimeout: () => void | Promise<void>,
  options: WithTimeoutOptions = {},
): Promise<T> {
  const abortGraceMs = options.abortGraceMs ?? DEFAULT_ABORT_GRACE_MS
  const onUnrecoverable = options.onUnrecoverable ?? defaultOnUnrecoverable

  // Never let the original work promise reject unhandled while we wait on the timeout branch.
  // We attach a catch that swallows the rejection for the race, but retain `work` itself so we
  // can await its settlement below.
  const workSettled = work.then(
    () => undefined,
    () => undefined,
  )

  let timer: NodeJS.Timeout | undefined
  const timeoutError = new BuildTimeoutError(timeoutMs)
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(timeoutError), timeoutMs)
    timer.unref()
  })

  try {
    return await Promise.race([work, timeout])
  } catch (error) {
    if (error !== timeoutError) {
      // `work` rejected on its own before the timeout fired; surface that error directly.
      throw error
    }

    // Timeout won. Fire the abort, then wait for the original work to settle so its cleanup
    // (returning sessions to the browser pool) runs before we hand control back to the caller.
    try {
      await onTimeout()
    } catch {
      // Swallow abort errors; the BuildTimeoutError below is the meaningful signal.
    }

    const settledInTime = await Promise.race([
      workSettled.then(() => true),
      new Promise<false>((resolve) => {
        const graceTimer = setTimeout(() => resolve(false), abortGraceMs)
        graceTimer.unref()
      }),
    ])

    if (!settledInTime) {
      // The abort did not unstick the render within the grace period. Treat as unrecoverable.
      onUnrecoverable(timeoutError)
      // If onUnrecoverable did not terminate the process (e.g. in tests), still wait for the
      // work to settle so we never resolve while it may hold shared state, then surface the
      // timeout. This await may hang if the work truly never settles, which is the correct
      // behavior: we must not free the worker while the render still holds its resources.
      await workSettled
    }

    throw timeoutError
  } finally {
    if (timer) {
      clearTimeout(timer)
    }
  }
}

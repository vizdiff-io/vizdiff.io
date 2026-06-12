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
 * Race `work` against a timeout. If the timeout fires first, `onTimeout` is invoked (to abort
 * the in-flight work, e.g. by force-closing the browser session so pending commands reject) and
 * a {@link BuildTimeoutError} is thrown.
 *
 * Note: the underlying `work` promise is not cancellable on its own; `onTimeout` is the
 * mechanism that interrupts it so the original promise eventually settles and its `finally`
 * cleanup runs.
 */
export async function withTimeout<T>(
  work: Promise<T>,
  timeoutMs: number,
  onTimeout: () => void | Promise<void>,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      void Promise.resolve()
        .then(() => onTimeout())
        .catch(() => {
          // Swallow abort errors; the BuildTimeoutError below is the meaningful signal.
        })
      reject(new BuildTimeoutError(timeoutMs))
    }, timeoutMs)
    timer.unref()
  })

  try {
    return await Promise.race([work, timeout])
  } finally {
    if (timer) {
      clearTimeout(timer)
    }
  }
}

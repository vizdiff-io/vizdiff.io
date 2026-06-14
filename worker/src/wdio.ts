/**
 * WebdriverIO compatibility helpers.
 *
 * Node 26 ships undici 7, which enforces the Fetch spec's forbidden-header
 * rules far more strictly than the undici bundled with older Node releases.
 * WebdriverIO v9's HTTP client (`webdriver` package) hard-codes a
 * `Connection: keep-alive` request header and sets `Content-Length` manually on
 * every request. Both are forbidden / auto-managed headers; undici 7 rejects
 * them with `UND_ERR_INVALID_ARG`, which makes the very first `POST /session`
 * request fail and breaks every `remote()` session.
 *
 * The `transformRequest` hook lets us strip those headers before the request is
 * dispatched, restoring compatibility without patching node_modules. This is a
 * no-op on Node versions whose undici tolerates the headers, so it is safe to
 * apply unconditionally.
 *
 * See: https://github.com/webdriverio/webdriverio (DEFAULT_HEADERS in the
 * `webdriver` request module).
 */

/**
 * Headers that undici 7 (Node 26+) refuses to let callers set explicitly on a
 * fetch request. WebdriverIO sets these itself; we remove them so the request
 * is accepted and undici manages them.
 */
const FORBIDDEN_REQUEST_HEADERS = ["connection", "content-length"] as const

/**
 * A WebdriverIO `transformRequest` hook that removes the forbidden headers
 * WebdriverIO injects, so sessions work under Node 26's undici 7.
 *
 * Pass as `transformRequest` in the `remote()` config.
 */
export function nodeCompatTransformRequest(requestOptions: RequestInit): RequestInit {
  const headers = new Headers(requestOptions.headers ?? undefined)
  for (const name of FORBIDDEN_REQUEST_HEADERS) {
    headers.delete(name)
  }
  return { ...requestOptions, headers }
}

export * from "./upload-storybook"

/**
 * Verify that a token is 12-24 hex characters.
 */
export function checkToken(token: string): boolean {
  return /^[0-9a-f]{12,24}$/.test(token)
}

export * from "./upload-storybook"

/**
 * Verify that a token is 26 characters and only contains characters from
 * Crockford's base32 alphabet.
 */
export function checkToken(token: string): boolean {
  return /^[0123456789abcdefghjkmnpqrstvwxyz]{26}$/.test(token)
}

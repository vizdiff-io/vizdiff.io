// Returns "s" if the count is not 1, otherwise an empty string
export function plural(count: number): string {
  return count === 1 ? "" : "s"
}

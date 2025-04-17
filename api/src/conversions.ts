/** Converts a Date to an integer number of seconds since the epoch */
export function toSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000)
}

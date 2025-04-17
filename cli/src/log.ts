import supportsColor from "./supportsColor"

export function info(message: unknown, ...args: unknown[]): void {
  console.log(message, ...args)
}

export function fatal(message: unknown, ...args: unknown[]): never {
  const errorPrefix = supportsColor.stderr ? `[\u001b[31mERROR\u001b[39m] ` : "[ERROR] "
  console.error(`${errorPrefix}${message}`, ...args)
  process.exit(1)
}

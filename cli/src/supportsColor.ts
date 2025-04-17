import os from "node:os"
import process from "node:process"
import tty from "node:tty"

// Define the structure for color support levels
interface ColorSupportLevel {
  level: 0 | 1 | 2 | 3
  hasBasic: boolean
  has256: boolean
  has16m: boolean
}

// Define the structure for the stream object expected (simplified)
interface StreamLike {
  isTTY?: boolean
}

// Define the options for createSupportsColor and _supportsColor
interface SupportsColorOptions {
  streamIsTTY?: boolean
  sniffFlags?: boolean
}

// Define the final export structure
interface SupportsColor {
  stdout: ColorSupportLevel | false
  stderr: ColorSupportLevel | false
}

// From: https://github.com/sindresorhus/has-flag/blob/main/index.js
function hasFlag(flag: string, argv: string[] = process.argv): boolean {
  const prefix = flag.startsWith("-") ? "" : flag.length === 1 ? "-" : "--"
  const position = argv.indexOf(prefix + flag)
  const terminatorPosition = argv.indexOf("--")
  return position !== -1 && (terminatorPosition === -1 || position < terminatorPosition)
}

const { env } = process

let flagForceColor: 0 | 1 | undefined
if (
  hasFlag("no-color") ||
  hasFlag("no-colors") ||
  hasFlag("color=false") ||
  hasFlag("color=never")
) {
  flagForceColor = 0
} else if (
  hasFlag("color") ||
  hasFlag("colors") ||
  hasFlag("color=true") ||
  hasFlag("color=always")
) {
  flagForceColor = 1
}

function envForceColor(): 0 | 1 | 2 | 3 | undefined {
  const forceColorEnv = env.FORCE_COLOR
  if (forceColorEnv == undefined) {
    return undefined
  }

  if (forceColorEnv === "true") {
    return 1
  }

  if (forceColorEnv === "false") {
    return 0
  }

  if (forceColorEnv.length === 0) {
    // `supports-color` returns 1 for empty string
    return 1
  }

  const parsedLevel = Number.parseInt(forceColorEnv, 10)
  if (!Number.isNaN(parsedLevel) && parsedLevel >= 0 && parsedLevel <= 3) {
    return parsedLevel as 0 | 1 | 2 | 3
  }

  return undefined
}

function translateLevel(level: 0 | 1 | 2 | 3): ColorSupportLevel | false {
  if (level === 0) {
    return false
  }

  return {
    level,
    hasBasic: true,
    has256: level >= 2,
    has16m: level >= 3,
  }
}

function supportsColorLevel(
  stream: StreamLike | undefined,
  { streamIsTTY, sniffFlags = true }: SupportsColorOptions = {},
): 0 | 1 | 2 | 3 {
  const envForced = envForceColor()
  // Use envForced if defined, otherwise use flagForceColor based on sniffFlags
  const forceColor = envForced ?? (sniffFlags ? flagForceColor : undefined)

  if (forceColor === 0) {
    return 0
  }

  if (sniffFlags) {
    if (hasFlag("color=16m") || hasFlag("color=full") || hasFlag("color=truecolor")) {
      return 3
    }

    if (hasFlag("color=256")) {
      return 2
    }
  }

  // Check for Azure DevOps pipelines - must be before !streamIsTTY check.
  if (env.TF_BUILD && env.AGENT_NAME) {
    return 1
  }

  // If the stream doesn't exist or isn't a TTY, and color isn't forced, disable colors
  if ((!stream || !streamIsTTY) && forceColor == undefined) {
    return 0
  }

  const min = forceColor ?? 0

  if (env.TERM === "dumb") {
    return min
  }

  if (process.platform === "win32") {
    const osRelease = os.release().split(".")
    const major = Number(osRelease[0])
    const build = Number(osRelease[2])

    if (major >= 10 && build >= 10586) {
      return build >= 14931 ? 3 : 2
    }

    return 1
  }

  if (env.CI) {
    if (["GITHUB_ACTIONS", "GITEA_ACTIONS", "CIRCLECI"].some((key) => key in env)) {
      return 3
    }

    if (
      ["TRAVIS", "APPVEYOR", "GITLAB_CI", "BUILDKITE", "DRONE"].some((sign) => sign in env) ||
      env.CI_NAME === "codeship"
    ) {
      return 1
    }

    return min
  }

  if (env.TEAMCITY_VERSION) {
    return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(env.TEAMCITY_VERSION) ? 1 : 0
  }

  if (env.COLORTERM === "truecolor") {
    return 3
  }

  if (env.TERM === "xterm-kitty") {
    return 3
  }

  if (env.TERM_PROGRAM) {
    const versionStr = env.TERM_PROGRAM_VERSION ?? ""
    const version = Number.parseInt(versionStr.split(".")[0] ?? "", 10)

    switch (env.TERM_PROGRAM) {
      case "iTerm.app":
        return version >= 3 ? 3 : 2
      case "Apple_Terminal":
        return 2
      // Add other specific terminals if needed
      default:
        break // Fall through to TERM check
    }
  }

  if (env.TERM && /-256(color)?$/i.test(env.TERM)) {
    return 2
  }

  if (env.TERM && /^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(env.TERM)) {
    return 1
  }

  if (env.COLORTERM) {
    return 1
  }

  return min
}

export function createSupportsColor(
  stream: StreamLike | undefined,
  options: SupportsColorOptions = {},
): ColorSupportLevel | false {
  const level = supportsColorLevel(stream, {
    streamIsTTY: stream?.isTTY,
    ...options,
  })

  return translateLevel(level)
}

const supportsColor: SupportsColor = {
  stdout: createSupportsColor({ isTTY: tty.isatty(1) }, { streamIsTTY: tty.isatty(1) }),
  stderr: createSupportsColor({ isTTY: tty.isatty(2) }, { streamIsTTY: tty.isatty(2) }),
}

export default supportsColor

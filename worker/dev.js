/**
 * Dev runner: esbuild-bundles a TypeScript entrypoint and runs it with Node.
 *
 * We cannot use `ts-node/esm` (broken under Node 26) or `tsx` (esbuild's
 * per-file transpile uses TC39 decorators and drops `emitDecoratorMetadata`,
 * which breaks the TypeORM entities in the `shared` workspace). A full esbuild
 * bundle — the same transform used for the production build — handles the
 * decorated entities correctly, so we reuse it here for local dev.
 *
 * Usage: node dev.js <entry.ts> [-- <args passed to the program>]
 */
import { spawn } from "node:child_process"
import { mkdirSync } from "node:fs"
import path from "node:path"

import * as esbuild from "esbuild"

async function main() {
  const argv = process.argv.slice(2)
  const sepIndex = argv.indexOf("--")
  const entry = argv[0]
  const programArgs = sepIndex >= 0 ? argv.slice(sepIndex + 1) : []
  if (!entry) {
    console.error("Usage: node dev.js <entry.ts> [-- <program args>]")
    process.exit(1)
  }

  // Build inside the package dir so the bundle's `external` packages resolve
  // against the local node_modules (esbuild uses `packages: "external"`).
  const outDir = path.resolve(".dev-build")
  mkdirSync(outDir, { recursive: true })
  const outfile = path.join(outDir, `${path.basename(entry, ".ts")}.mjs`)

  await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    platform: "node",
    target: "node22",
    outfile,
    format: "esm",
    packages: "external",
    sourcemap: "inline",
    minify: false,
  })

  const child = spawn(
    process.execPath,
    ["--no-warnings", "--enable-source-maps", outfile, ...programArgs],
    { stdio: "inherit" },
  )
  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal)
    } else {
      process.exit(code ?? 0)
    }
  })
}

main().catch((err) => {
  console.error("dev runner failed:", err)
  process.exit(1)
})

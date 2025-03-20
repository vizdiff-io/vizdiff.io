/* eslint-disable no-undef */
import * as esbuild from "esbuild"

async function build() {
  try {
    const result = await esbuild.build({
      entryPoints: ["src/worker.ts"],
      bundle: true,
      platform: "node",
      target: "node22",
      outfile: "dist/worker.mjs",
      format: "esm",
      packages: "external",
      sourcemap: true,
      minify: false,
      treeShaking: true,
      banner: {
        js: "#!/usr/bin/env node",
      },
    })

    if (result.errors.length > 0) {
      console.error(`Build failed with ${result.errors.length} error(s)`)
      process.exit(1)
    }

    console.log("Build succeeded")
  } catch (error) {
    console.error("Unexpected build failure:", error)
    process.exit(1)
  }
}

void build()

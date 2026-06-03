import * as esbuild from "esbuild"
import { glob } from "node:fs/promises"

async function build() {
  try {
    const result = await esbuild.build({
      entryPoints: ["src/index.ts"],
      bundle: true,
      platform: "node",
      target: "node22",
      outfile: "dist/index.mjs",
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

    // Compile migrations individually (not bundled) so TypeORM can discover them at runtime via
    // dist/migrations/*.js (referenced by migrations/migrationsRun in database.ts).
    const migrationEntryPoints = []
    for await (const file of glob("src/migrations/*.ts")) {
      migrationEntryPoints.push(file)
    }
    if (migrationEntryPoints.length > 0) {
      const migrationResult = await esbuild.build({
        entryPoints: migrationEntryPoints,
        bundle: false,
        platform: "node",
        target: "node22",
        outdir: "dist/migrations",
        format: "esm",
        outExtension: { ".js": ".js" },
        sourcemap: true,
        minify: false,
      })
      if (migrationResult.errors.length > 0) {
        console.error(`Migration build failed with ${migrationResult.errors.length} error(s)`)
        process.exit(1)
      }
    }

    console.log("Build succeeded")
  } catch (error) {
    console.error("Unexpected build failure:", error)
    process.exit(1)
  }
}

void build()

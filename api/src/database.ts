import "reflect-metadata" // For TypeORM
import * as path from "path"
import {
  Project,
  ScreenshotTest,
  TestResult,
  User,
  WorkTask,
  defineRelationships,
  GitHubInstallation,
} from "shared"
import { DataSource } from "typeorm"
import { fileURLToPath } from "url"

import {
  IS_PRODUCTION,
  IS_TEST,
  POSTGRES_DATABASE,
  POSTGRES_HOST,
  POSTGRES_PASS,
  POSTGRES_PORT,
  POSTGRES_USER,
} from "./environment"
import { log } from "./log"

// Absolute path to the compiled migrations, anchored to the api workspace root rather than the
// process CWD. esbuild emits the bundle at dist/index.mjs and the migrations at dist/migrations/*.js
// (see build.js), and this module always sits one level below the workspace root (dist/ in the
// shipped image, src/ under ts-node), so "<root>/dist/migrations/*.js" resolves correctly in both.
// The previous relative "dist/migrations/*.js" was resolved against process.cwd() — which is /app in
// the container, not /app/api — so it matched nothing and every migration was silently skipped on
// boot, leaving a fresh self-host database with no schema.
const apiWorkspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const migrationsGlob = path.join(apiWorkspaceRoot, "dist", "migrations", "*.js")

const database = new DataSource({
  type: "postgres",
  host: POSTGRES_HOST,
  port: POSTGRES_PORT,
  username: POSTGRES_USER,
  password: POSTGRES_PASS,
  database: POSTGRES_DATABASE,
  logger: IS_PRODUCTION ? undefined : "formatted-console",
  // The API is the sole schema owner. In tests we synchronize to spin up a throwaway schema; in
  // all other environments we use migrations (safer on managed RDS than `synchronize`).
  synchronize: IS_TEST,
  dropSchema: IS_TEST,
  logging: !IS_TEST,
  entities: [GitHubInstallation, Project, ScreenshotTest, TestResult, User, WorkTask],
  subscribers: [],
  // Compiled migrations live alongside the built sources; run automatically on boot.
  migrations: IS_TEST ? [] : [migrationsGlob],
  migrationsRun: !IS_TEST,
})

let databaseInitializationPromise: Promise<DataSource> | undefined

export async function Database(): Promise<DataSource> {
  if (database.isInitialized) {
    return database
  }

  databaseInitializationPromise ??= database.initialize().then((db) => {
    try {
      // Define relationships after database is initialized but before any queries
      defineRelationships()
    } catch (error) {
      log.error(error, "Failed to define relationships")
    }
    return db
  })

  await databaseInitializationPromise
  return database
}

export async function InitializeDatabase(): Promise<void> {
  try {
    const db = await Database()
    log.debug(`Database initialized: ${db.isInitialized}`)
  } catch (error) {
    log.error(error, "Database initialization failed")
    setTimeout(() => process.exit(1), 1000).unref()
  }
}

import "reflect-metadata" // For TypeORM
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

import {
  IS_TEST,
  POSTGRES_DATABASE,
  POSTGRES_HOST,
  POSTGRES_PASS,
  POSTGRES_PORT,
  POSTGRES_USER,
} from "./environment"
import { log } from "./log"

const database = new DataSource({
  type: "postgres",
  host: POSTGRES_HOST,
  port: POSTGRES_PORT,
  username: POSTGRES_USER,
  password: POSTGRES_PASS,
  database: POSTGRES_DATABASE,
  // Synchronize in dev and production. The plan is to either switch to
  // migrations or drop TypeORM
  synchronize: true,
  dropSchema: IS_TEST,
  logging: !IS_TEST,
  entities: [Project, ScreenshotTest, TestResult, User, WorkTask, GitHubInstallation],
  subscribers: [],
  migrations: [],
})

let databaseInitializationPromise: Promise<DataSource> | undefined

export async function Database(): Promise<DataSource> {
  if (database.isInitialized) {
    return database
  }

  if (!databaseInitializationPromise) {
    databaseInitializationPromise = database.initialize().then((db) => {
      try {
        // Define relationships after database is initialized but before any queries
        defineRelationships()
      } catch (error) {
        log.error(error, "Failed to define relationships")
      }
      return db
    })
  }

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

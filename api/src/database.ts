import { Project, ScreenshotTest, TestResult, User, WorkTask } from "shared"
import { DataSource } from "typeorm"

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

const database = new DataSource({
  type: "postgres",
  host: POSTGRES_HOST,
  port: POSTGRES_PORT,
  username: POSTGRES_USER,
  password: POSTGRES_PASS,
  database: POSTGRES_DATABASE,
  synchronize: !IS_PRODUCTION,
  dropSchema: IS_TEST,
  logging: !IS_TEST,
  entities: [Project, ScreenshotTest, TestResult, User, WorkTask],
  subscribers: [],
  migrations: [],
})

let databaseInitializationPromise: Promise<DataSource> | undefined

export async function Database(): Promise<DataSource> {
  if (database.isInitialized) {
    return database
  }

  if (!databaseInitializationPromise) {
    databaseInitializationPromise = database.initialize()
  }

  await databaseInitializationPromise
  return database
}

export async function InitializeDatabase(): Promise<void> {
  try {
    const db = await Database()
    log.debug(`Database initialized: ${db.isInitialized}`)
  } catch (err) {
    const errWithCode = err as { code?: string }
    log.error(`Database initialization failed: ${errWithCode.code ?? err}`)
    setTimeout(() => process.exit(1), 1000).unref()
  }
}

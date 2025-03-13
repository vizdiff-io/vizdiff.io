import pg from "pg"
import {
  GitHubInstallation,
  Project,
  ScreenshotTest,
  TestResult,
  User,
  WorkTask,
  defineRelationships,
} from "shared"
import { DataSource } from "typeorm"

import {
  POSTGRES_USER,
  POSTGRES_HOST,
  POSTGRES_DATABASE,
  POSTGRES_PASS,
  POSTGRES_PORT,
} from "./environment"

// TypeORM DataSource instance
let database: DataSource | undefined

// Postgres connection pool, used for raw SQL queries such as acquiring locks
const pool = new pg.Pool({
  host: POSTGRES_HOST,
  user: POSTGRES_USER,
  password: POSTGRES_PASS,
  database: POSTGRES_DATABASE,
  max: 3,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

export async function Database(): Promise<DataSource> {
  if (database?.isInitialized) {
    return database
  }

  database = new DataSource({
    type: "postgres",
    host: POSTGRES_HOST,
    port: POSTGRES_PORT,
    username: POSTGRES_USER,
    password: POSTGRES_PASS,
    database: POSTGRES_DATABASE,
    entities: [GitHubInstallation, Project, ScreenshotTest, TestResult, User, WorkTask],
    synchronize: false,
  })

  await database.initialize()
  // Define relationships after database is initialized but before any queries
  defineRelationships()
  return database
}

export async function DatabasePool(): Promise<pg.PoolClient> {
  // eslint-disable-next-line @typescript-eslint/return-await
  return pool.connect()
}

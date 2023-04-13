import { DataSource } from "typeorm"

import { Project } from "./entity/Project"
import { ScreenshotTest } from "./entity/ScreenshotTest"
import { TestResult } from "./entity/TestResult"
import { User } from "./entity/User"
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
  entities: [Project, ScreenshotTest, TestResult, User],
  subscribers: [],
  migrations: [],
})

if (!IS_TEST) {
  // Initialize the database on import so we catch any errors early
  database
    .initialize()
    .then(() => {
      log.info("Database initialized")
    })
    .catch((err) => {
      log.error(err, `Database failed to initialize: ${(err as Error).message}`)
      // process.exit(1)
    })
}

export async function Database(): Promise<DataSource> {
  return database.isInitialized ? database : await database.initialize()
}

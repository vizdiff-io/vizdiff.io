import { TestResult } from "shared"
import { DataSource } from "typeorm"

import {
  POSTGRES_USER,
  POSTGRES_HOST,
  POSTGRES_DATABASE,
  POSTGRES_PASS,
  POSTGRES_PORT,
} from "./environment"

let database: DataSource | undefined

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
    entities: [TestResult],
    synchronize: false,
  })

  await database.initialize()
  return database
}

// eslint-disable-next-line filenames/match-exported
import "reflect-metadata"
import { GitHubInstallation, Project, ScreenshotTest, TestResult, User, WorkTask } from "shared"
import { DataSource } from "typeorm"

import {
  POSTGRES_DATABASE,
  POSTGRES_HOST,
  POSTGRES_PASS,
  POSTGRES_PORT,
  POSTGRES_USER,
} from "./environment"

/**
 * Standalone TypeORM DataSource used by the migration CLI
 * (`yarn api migration:generate` / `yarn api migration:run`). It points at the TypeScript entity
 * and migration sources; the application boot path in `database.ts` runs the compiled migrations.
 */
export const AppDataSource = new DataSource({
  type: "postgres",
  host: POSTGRES_HOST,
  port: POSTGRES_PORT,
  username: POSTGRES_USER,
  password: POSTGRES_PASS,
  database: POSTGRES_DATABASE,
  synchronize: false,
  logging: true,
  entities: [GitHubInstallation, Project, ScreenshotTest, TestResult, User, WorkTask],
  migrations: ["src/migrations/*.ts"],
})

export default AppDataSource

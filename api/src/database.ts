import { DataSource } from "typeorm"
import { User } from "./entity/User"
import {
  POSTGRES_DATABASE,
  POSTGRES_HOST,
  POSTGRES_PASS,
  POSTGRES_PORT,
  POSTGRES_USER,
} from "./environment"

const database = new DataSource({
  type: "postgres",
  host: POSTGRES_HOST,
  port: POSTGRES_PORT,
  username: POSTGRES_USER,
  password: POSTGRES_PASS,
  database: POSTGRES_DATABASE,
  synchronize: true,
  logging: true,
  entities: [User],
  subscribers: [],
  migrations: [],
})

// Initialize the database on import so we catch any errors early
database
  .initialize()
  .then(() => {
    console.log("Database initialized")
  })
  .catch((err) => {
    console.error("Database failed to initialize", err)
  })

export async function Database(): Promise<DataSource> {
  return database.isInitialized ? database : database.initialize()
}

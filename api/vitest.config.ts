import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    // Several suites are integration tests that spin up a throwaway schema against a shared
    // Postgres database via `synchronize: true` + `dropSchema: true` (see src/database.ts). Running
    // those files in parallel races on the Postgres system catalogs (e.g. duplicate key on
    // pg_type_typname_nsp_index) and on each other's dropped schema. Disable cross-file parallelism
    // so each file gets the database to itself; tests within a file still run sequentially.
    fileParallelism: false,
  },
})

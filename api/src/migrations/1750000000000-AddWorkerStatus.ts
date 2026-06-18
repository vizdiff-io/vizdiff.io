import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Adds the `worker_status` table: one row per running worker, written by the worker on startup and
 * refreshed on each heartbeat. Lets `GET /api/version` report the worker's running version +
 * liveness (the worker's own health port is not reachable from the frontend).
 *
 * `CREATE TABLE IF NOT EXISTS` keeps it idempotent. The api is the sole schema owner and runs
 * migrations on boot, so the worker tolerates the table being briefly absent at first start (it
 * guards its write and retries on the next heartbeat).
 */
export class AddWorkerStatus1750000000000 implements MigrationInterface {
  name = "AddWorkerStatus1750000000000"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "worker_status" (
        "id" text NOT NULL,
        "version" text NOT NULL,
        "last_heartbeat_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "started_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        CONSTRAINT "PK_worker_status" PRIMARY KEY ("id")
      )`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "worker_status"`)
  }
}

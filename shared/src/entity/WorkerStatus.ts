import { Column, Entity, PrimaryColumn } from "typeorm"

/**
 * One row per running worker process, written by the worker on startup and refreshed on each
 * heartbeat. Lets the api surface the worker's running version + liveness via GET /api/version
 * (the worker's own health port is not reachable from the frontend).
 */
@Entity("worker_status")
export class WorkerStatus {
  // Worker identity (the worker uses os.hostname()), so multiple workers each keep their own row.
  @PrimaryColumn({ type: "text" })
  id!: string

  // Product version baked into the worker image (VIZDIFF_VERSION), or "dev".
  @Column({ type: "text", nullable: false })
  version!: string

  @Column({ name: "last_heartbeat_at", type: "timestamptz", nullable: false })
  lastHeartbeatAt!: Date

  @Column({ name: "started_at", type: "timestamptz", nullable: false })
  startedAt!: Date
}

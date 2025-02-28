import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm"

import type { ScreenshotTest } from "./ScreenshotTest"

@Entity("task_queue")
export class WorkTask {
  @PrimaryGeneratedColumn()
  id!: number

  @ManyToOne("ScreenshotTest", "workTasks", { onDelete: "CASCADE", nullable: false, eager: true })
  @JoinColumn({ name: "screenshot_test_id", referencedColumnName: "id" })
  screenshotTest!: ScreenshotTest

  @Column({ name: "task_type", type: "text", nullable: false })
  taskType!: string

  @Column({ type: "jsonb", nullable: false })
  data!: string

  @Column({ name: "locked_at", type: "timestamp", nullable: true })
  lockedAt?: Date

  @Column({ name: "locked_by", type: "text", nullable: true })
  lockedBy?: string

  @CreateDateColumn({ name: "created_at", type: "timestamp", nullable: false })
  createdAt!: Date

  @UpdateDateColumn({ name: "updated_at", type: "timestamp", nullable: false })
  updatedAt!: Date
}

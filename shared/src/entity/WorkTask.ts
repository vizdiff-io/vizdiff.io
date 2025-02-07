import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm"

import { ScreenshotTest } from "./ScreenshotTest"

@Entity("task_queue")
export class WorkTask {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ name: "screenshot_test_id", type: "integer" })
  screenshotTestId!: number

  @ManyToOne(() => ScreenshotTest, { onDelete: "CASCADE" })
  @JoinColumn({ name: "screenshot_test_id" })
  screenshotTest!: Promise<ScreenshotTest>

  @Column({ name: "task_type", type: "varchar", length: 255, nullable: false })
  taskType!: string

  @Column({ type: "jsonb", nullable: false })
  data!: string

  @Column({ name: "locked_at", type: "timestamp", nullable: true })
  lockedAt?: Date

  @Column({ name: "locked_by", type: "varchar", length: 255, nullable: true })
  lockedBy?: string

  @CreateDateColumn({ name: "created_at", type: "timestamp", nullable: false })
  createdAt!: Date

  @UpdateDateColumn({ name: "updated_at", type: "timestamp", nullable: false })
  updatedAt!: Date
}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm"

import type { ScreenshotTest } from "./ScreenshotTest"

export type TestResultStatus = "new" | "unchanged" | "changed" | "failed"

@Entity("test_results")
export class TestResult {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ type: "text", name: "name", nullable: false })
  name!: string

  @ManyToOne("ScreenshotTest", "testResults", {
    onDelete: "CASCADE",
    nullable: false,
    eager: true,
  })
  @JoinColumn({ name: "screenshot_test_id", referencedColumnName: "id" })
  screenshotTest!: ScreenshotTest

  @Column({ type: "text", name: "story_id", nullable: false })
  storyId!: string

  @Column({ type: "jsonb", name: "story", nullable: true })
  story!: object | null

  @Column({ type: "text", name: "baseline_image_url", nullable: true })
  baselineImageUrl!: string | null

  @Column({ type: "text", name: "new_image_url", nullable: false })
  newImageUrl!: string

  @Column({ type: "text", name: "diff_image_url", nullable: true })
  diffImageUrl!: string | null

  // NOTE: `diffRatio` is not following the snake_case naming convention, this is legacy
  @Column({ type: "double precision", name: "diffRatio", nullable: true })
  diffRatio!: number | null

  // Can be "new", "unchanged", "changed", or "failed"
  @Column({ type: "text", name: "change_status", nullable: false })
  changeStatus!: string

  @CreateDateColumn({ name: "created_at", type: "timestamptz", nullable: false })
  createdAt!: Date

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz", nullable: false })
  updatedAt!: Date
}

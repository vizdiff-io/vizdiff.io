import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm"

import { ScreenshotTest } from "./ScreenshotTest"

export type TestResultStatus = "new" | "unchanged" | "changed" | "failed"

@Entity("test_results")
export class TestResult {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ type: "varchar", length: 255, name: "name", nullable: false })
  name!: string

  @Column({ type: "integer", name: "screenshot_test_id" })
  screenshotTestId!: number

  @ManyToOne(() => ScreenshotTest, (screenshotTest) => screenshotTest.testResults, {
    onDelete: "CASCADE",
    nullable: false,
  })
  @JoinColumn({ name: "screenshot_test_id", referencedColumnName: "id" })
  screenshotTest!: Promise<ScreenshotTest>

  @Column({ type: "varchar", length: 255, name: "story_id", nullable: false })
  storyId!: string

  @Column({ type: "varchar", length: 2048, name: "baseline_image_url", nullable: false })
  baselineImageUrl!: string

  @Column({ type: "varchar", length: 2048, name: "new_image_url", nullable: false })
  newImageUrl!: string

  @Column({ nullable: true })
  diffImageUrl?: string

  @Column({ type: "double precision", nullable: true })
  diffRatio?: number

  // Can be "new", "unchanged", or "changed"
  @Column({ type: "varchar", length: 255, name: "change_status", nullable: false })
  changeStatus!: string

  @CreateDateColumn({ name: "created_at", nullable: false })
  createdAt!: Date

  @UpdateDateColumn({ name: "updated_at", nullable: false })
  updatedAt!: Date
}

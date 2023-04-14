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

@Entity("test_results")
export class TestResult {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ name: "screenshot_test_id" })
  screenshotTestId!: number

  @ManyToOne(() => ScreenshotTest, (screenshotTest) => screenshotTest.testResults, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "screenshot_test_id" })
  screenshotTest!: Promise<ScreenshotTest>

  @Column({ type: "varchar", length: 255, name: "story_id" })
  storyId!: string

  @Column({ type: "varchar", length: 2048, name: "baseline_image_url" })
  baselineImageUrl!: string

  @Column({ type: "varchar", length: 2048, name: "new_image_url" })
  newImageUrl!: string

  @Column({ type: "varchar", length: 2048, name: "diff_image_url" })
  diffImageUrl!: string

  @Column({ type: "varchar", length: 255, name: "change_status" })
  changeStatus!: string

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date
}

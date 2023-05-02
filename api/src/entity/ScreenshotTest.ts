import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  OneToMany,
} from "typeorm"

import { Project } from "./Project"
import { TestResult } from "./TestResult"

/**
 * Represents a test run associated with a commit. This test run is made up of any number of test
 * results, each of which represents a single screenshot.
 */
@Entity("screenshot_tests")
export class ScreenshotTest {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ name: "project_id", type: "integer" })
  projectId!: number

  @ManyToOne(() => Project, { onDelete: "CASCADE" })
  @JoinColumn({ name: "project_id" })
  project!: Promise<Project>

  @OneToMany(() => TestResult, (testResult) => testResult.screenshotTest)
  testResults!: Promise<TestResult[]>

  @Column({ name: "commit_sha", type: "varchar", length: 64 })
  commitSha!: string

  @Column({ type: "varchar", length: 255 })
  branch!: string

  @Column({ type: "varchar", length: 255 })
  status!: string

  @Column({ name: "total_changes", type: "integer", nullable: true })
  totalChanges!: number

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date
}

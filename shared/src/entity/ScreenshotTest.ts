import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from "typeorm"

import { Project } from "./Project"
import { TestResult } from "./TestResult"
import { WorkTask } from "./WorkTask"

@Entity("screenshot_tests")
@Unique("UQ_project_id_commit_sha", ["projectId", "commitSha"])
@Index("IDX_project_id_branch", ["projectId", "branch"])
export class ScreenshotTest {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ name: "project_id", type: "integer", nullable: false })
  projectId!: number

  @ManyToOne(() => Project, { onDelete: "CASCADE", nullable: false })
  @JoinColumn({ name: "project_id", referencedColumnName: "id" })
  project!: Promise<Project>

  @Column({ name: "build_number", type: "integer", nullable: false })
  buildNumber!: number

  @Column({ name: "build_duration_sec", type: "double precision", nullable: true })
  buildDurationSec!: number | undefined

  @OneToMany(() => TestResult, (testResult) => testResult.screenshotTest)
  testResults!: Promise<TestResult[]>

  @OneToMany(() => WorkTask, (workTask) => workTask.screenshotTest)
  workTasks!: Promise<WorkTask[]>

  @Column({ name: "commit_sha", type: "varchar", length: 64, nullable: false })
  commitSha!: string

  @Column({ type: "varchar", length: 1024, nullable: false })
  branch!: string

  @Column({ name: "base_commit_sha", type: "varchar", length: 64, nullable: true })
  baseCommitSha!: string | undefined

  @Column({ name: "base_branch", type: "varchar", length: 1024, nullable: true })
  baseBranch!: string | undefined

  @Column({ name: "upload_id", type: "varchar", length: 36, unique: true, nullable: false })
  uploadId!: string

  // "pending" | "running" | "no_changes" | "unapproved" | "approved" | "denied" | "failed"
  @Column({ type: "varchar", length: 255, nullable: false })
  status!: string

  @Column({ name: "total_changes", type: "integer", nullable: true })
  totalChanges!: number | undefined

  @CreateDateColumn({ name: "created_at", nullable: false })
  createdAt!: Date

  @UpdateDateColumn({ name: "updated_at", nullable: false })
  updatedAt!: Date
}

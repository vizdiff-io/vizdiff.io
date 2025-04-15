import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm"

import type { Project } from "./Project"
import type { TestResult } from "./TestResult"
import type { WorkTask } from "./WorkTask"

@Entity("screenshot_tests")
@Index("IDX_project_id_commit_sha", ["project.id", "commitSha"])
@Index("IDX_project_id_branch", ["project.id", "branch"])
export class ScreenshotTest {
  @PrimaryGeneratedColumn()
  id!: number

  @ManyToOne("Project", { onDelete: "CASCADE", nullable: false, eager: true })
  @JoinColumn({ name: "project_id", referencedColumnName: "id" })
  project!: Project

  @Column({ name: "build_number", type: "integer", nullable: false })
  buildNumber!: number

  @Column({ name: "build_duration_sec", type: "double precision", nullable: true })
  buildDurationSec!: number | null

  @OneToMany("TestResult", "screenshotTest")
  testResults!: Promise<TestResult[]>

  @OneToMany("WorkTask", "screenshotTest")
  workTasks!: Promise<WorkTask[]>

  @Column({ name: "commit_sha", type: "text", nullable: false, update: false })
  commitSha!: string

  @Column({ type: "text", nullable: false })
  branch!: string

  @Column({ name: "base_commit_sha", type: "text", nullable: true })
  baseCommitSha!: string | null

  @Column({ name: "base_branch", type: "text", nullable: true })
  baseBranch!: string | null

  @Column({ name: "pr_number", type: "integer", nullable: true })
  prNumber!: number | null

  @Column({ name: "upload_id", type: "text", unique: true, nullable: false })
  uploadId!: string

  // "pending" | "running" | "no_changes" | "unapproved" | "approved" | "denied" | "failed"
  @Column({ type: "text", nullable: false })
  status!: string

  @Column({ name: "github_check_run_id", type: "bigint", nullable: true })
  githubCheckRunId!: number | null

  @Column({ name: "tag", type: "text", nullable: true })
  tag!: string | null

  @Column({ name: "total_changes", type: "integer", nullable: true })
  totalChanges!: number | null

  @Column({ name: "browser_version", type: "text", nullable: true })
  browserVersion!: string | null

  @CreateDateColumn({ name: "created_at", type: "timestamptz", nullable: false })
  createdAt!: Date

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz", nullable: false })
  updatedAt!: Date

  toString(): string {
    return `[test_id=${this.id} ${this.project.githubRepoUrl}#${this.commitSha}]`
  }
}

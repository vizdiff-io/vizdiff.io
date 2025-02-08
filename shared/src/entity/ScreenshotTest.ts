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

  @Column({ name: "project_id", type: "integer" })
  projectId!: number

  @ManyToOne(() => Project, { onDelete: "CASCADE" })
  @JoinColumn({ name: "project_id" })
  project!: Promise<Project>

  @OneToMany(() => TestResult, (testResult) => testResult.screenshotTest)
  testResults!: Promise<TestResult[]>

  @OneToMany(() => WorkTask, (workTask) => workTask.screenshotTest)
  workTasks!: Promise<WorkTask[]>

  @Column({ name: "commit_sha", type: "varchar", length: 64 })
  commitSha!: string

  @Column({ type: "varchar", length: 255 })
  branch!: string

  @Column({ name: "upload_id", type: "varchar", length: 36, unique: true })
  uploadId!: string

  @Column({ type: "varchar", length: 255 })
  status!: string

  @Column({ name: "total_changes", type: "integer", nullable: true })
  totalChanges!: number | undefined

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date
}

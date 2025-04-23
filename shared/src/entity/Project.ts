import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  JoinColumn,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from "typeorm"

import type { ScreenshotTest } from "./ScreenshotTest"
import type { User } from "./User"

@Entity("projects")
export class Project {
  @PrimaryGeneratedColumn()
  id!: number

  @ManyToOne("User", "projects", { onDelete: "CASCADE", nullable: false, eager: true })
  @JoinColumn({ name: "user_id", referencedColumnName: "id" })
  user!: User

  @OneToMany("ScreenshotTest", "project")
  screenshotTests!: Promise<ScreenshotTest[]>

  @Column({ type: "text", nullable: false })
  name!: string

  @Column({ type: "text", unique: true, nullable: false })
  token!: string

  @Column({ name: "github_repo_id", type: "bigint", nullable: false })
  @Index("IDX_github_repo_id", ["githubRepoId"], { unique: false })
  githubRepoId!: number

  @Column({ name: "github_repo_url", type: "text", nullable: false })
  githubRepoUrl!: string

  @Column({ name: "storybook_config", type: "jsonb", nullable: true })
  storybookConfig!: object | null

  @CreateDateColumn({ name: "created_at", type: "timestamptz", nullable: false })
  createdAt!: Date

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz", nullable: false })
  updatedAt!: Date
}

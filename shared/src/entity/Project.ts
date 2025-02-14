import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  JoinColumn,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from "typeorm"

import type { ScreenshotTest } from "./ScreenshotTest"
import type { User } from "./User"

@Entity("projects")
export class Project {
  @PrimaryGeneratedColumn()
  id!: number

  @ManyToOne("User", "projects", { onDelete: "CASCADE", nullable: false })
  @JoinColumn({ name: "user_id", referencedColumnName: "id" })
  user!: User

  @OneToMany("ScreenshotTest", "project")
  screenshotTests!: Promise<ScreenshotTest[]>

  @Column({ type: "varchar", length: 255, nullable: false })
  name!: string

  @Column({ type: "char", length: 12, unique: true, nullable: false })
  token!: string

  @Column({ name: "github_repo_url", type: "varchar", length: 2048, nullable: false })
  githubRepoUrl!: string

  @Column({ name: "storybook_config", type: "jsonb", nullable: true })
  storybookConfig!: Record<string, unknown>

  @CreateDateColumn({ name: "created_at", nullable: false })
  createdAt!: Date

  @UpdateDateColumn({ name: "updated_at", nullable: false })
  updatedAt!: Date
}

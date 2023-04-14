import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from "typeorm"

import { ScreenshotTest } from "./ScreenshotTest"
import { User } from "./User"

@Entity("projects")
export class Project {
  @PrimaryGeneratedColumn()
  id!: number

  @ManyToOne(() => User, (user) => user.projects, { onDelete: "CASCADE" })
  user!: Promise<User>

  @OneToMany(() => ScreenshotTest, (screenshotTest) => screenshotTest.project)
  screenshotTests!: Promise<ScreenshotTest[]>

  @Column({ type: "varchar", length: 255 })
  name!: string

  @Column({ name: "github_repo_url", type: "varchar", length: 2048 })
  githubRepoUrl!: string

  @Column({ name: "storybook_config", type: "jsonb", nullable: true })
  storybookConfig!: Record<string, unknown>

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date
}

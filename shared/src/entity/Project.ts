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

import { ScreenshotTest } from "./ScreenshotTest"
import { User } from "./User"

@Entity("projects")
export class Project {
  @PrimaryGeneratedColumn()
  id!: number

  @ManyToOne(() => User, (user) => user.projects, { onDelete: "CASCADE", nullable: false })
  @JoinColumn({ name: "user_id", referencedColumnName: "id" })
  user!: User

  @OneToMany(() => ScreenshotTest, (screenshotTest) => screenshotTest.project)
  screenshotTests!: Promise<ScreenshotTest[]>

  @Column({ type: "varchar", length: 255 })
  name!: string

  @Column({ type: "char", length: 12, unique: true })
  token!: string

  @Column({ name: "github_repo_url", type: "varchar", length: 2048 })
  githubRepoUrl!: string

  @Column({ name: "storybook_config", type: "jsonb", nullable: true })
  storybookConfig!: Record<string, unknown>

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date
}

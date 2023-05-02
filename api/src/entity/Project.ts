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

/**
 * Represents a project that a user has registered with the screenshot testing service.
 * A project is associated with a GitHub repository.
 */
@Entity("projects")
export class Project {
  @PrimaryGeneratedColumn()
  id!: number

  @ManyToOne(() => User, (user) => user.projects, { onDelete: "CASCADE" })
  user!: Promise<User>

  @OneToMany(() => ScreenshotTest, (screenshotTest) => screenshotTest.project)
  screenshotTests!: Promise<ScreenshotTest[]>

  @Column({ name: "github_owner", type: "varchar", length: 255 })
  githubOwner!: string

  @Column({ type: "varchar", length: 255 })
  name!: string

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date
}

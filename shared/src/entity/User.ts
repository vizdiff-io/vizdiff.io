import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToMany,
} from "typeorm"

import type { GitHubInstallation } from "./GitHubInstallation"
import type { Project } from "./Project"

@Entity("users")
export class User {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ name: "github_id", type: "text", unique: true, nullable: false })
  githubId!: string

  @Column({ type: "text", unique: true, nullable: true })
  email!: string | null

  @Column({ name: "github_username", type: "text", unique: true, nullable: false })
  githubUsername!: string

  @Column({ name: "github_profile", type: "jsonb", nullable: false })
  githubProfile!: object

  @Column({ name: "github_access_token", type: "text", nullable: false })
  githubAccessToken!: string

  @OneToMany("Project", "user")
  projects!: Promise<Project[]>

  @ManyToMany("GitHubInstallation", "users")
  githubInstallations!: Promise<GitHubInstallation[]>

  @OneToMany("GitHubInstallation", "creator")
  createdInstallations!: Promise<GitHubInstallation[]>

  @CreateDateColumn({ name: "created_at", type: "timestamptz", nullable: false })
  createdAt!: Date

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz", nullable: false })
  updatedAt!: Date
}

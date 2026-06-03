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

  // Identity from the configured AuthProvider (OIDC/MSAL or dev). The subject is the stable,
  // provider-issued unique identifier used to upsert users on login.
  @Column({ name: "auth_subject", type: "text", unique: true, nullable: false })
  authSubject!: string

  // Name of the auth provider that issued this identity (e.g. "oidc", "dev").
  @Column({ name: "auth_provider", type: "text", nullable: true })
  authProvider!: string | null

  // Human-readable display name from the identity provider, if available.
  @Column({ name: "display_name", type: "text", nullable: true })
  displayName!: string | null

  @Column({ type: "text", unique: true, nullable: true })
  email!: string | null

  // GitHub OAuth/identity fields (retained behind the GITHUB_ENABLED gate).
  @Column({ name: "github_id", type: "text", unique: true, nullable: true })
  githubId!: string | null

  @Column({ name: "github_username", type: "text", unique: true, nullable: true })
  githubUsername!: string | null

  @Column({ name: "github_profile", type: "jsonb", nullable: true })
  githubProfile!: object | null

  @Column({ name: "github_access_token", type: "text", nullable: true })
  githubAccessToken!: string | null

  @OneToMany("Project", "user")
  projects!: Promise<Project[]>

  // GitHub relationships (retained behind the GITHUB_ENABLED gate).
  @ManyToMany("GitHubInstallation", "users")
  githubInstallations!: Promise<GitHubInstallation[]>

  @OneToMany("GitHubInstallation", "creator")
  createdInstallations!: Promise<GitHubInstallation[]>

  @CreateDateColumn({ name: "created_at", type: "timestamptz", nullable: false })
  createdAt!: Date

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz", nullable: false })
  updatedAt!: Date
}

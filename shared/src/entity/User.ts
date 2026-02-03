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
import type { GitLabGroup } from "./GitLabGroup"
import type { Project } from "./Project"
import type { UserGithubRepoAccess } from "./UserGithubRepoAccess"
import type { UserGitlabProjectAccess } from "./UserGitlabProjectAccess"

@Entity("users")
export class User {
  @PrimaryGeneratedColumn()
  id!: number

  // GitHub OAuth fields (nullable for GitLab-only users)
  @Column({ name: "github_id", type: "text", unique: true, nullable: true })
  githubId!: string | null

  @Column({ type: "text", unique: true, nullable: true })
  email!: string | null

  @Column({ name: "github_username", type: "text", unique: true, nullable: true })
  githubUsername!: string | null

  @Column({ name: "github_profile", type: "jsonb", nullable: true })
  githubProfile!: object | null

  @Column({ name: "github_access_token", type: "text", nullable: true })
  githubAccessToken!: string | null

  // GitLab OAuth fields
  @Column({ name: "gitlab_id", type: "text", unique: true, nullable: true })
  gitlabId!: string | null

  @Column({ name: "gitlab_username", type: "text", unique: true, nullable: true })
  gitlabUsername!: string | null

  @Column({ name: "gitlab_profile", type: "jsonb", nullable: true })
  gitlabProfile!: object | null

  @Column({ name: "gitlab_access_token", type: "text", nullable: true })
  gitlabAccessToken!: string | null

  @Column({ name: "gitlab_refresh_token", type: "text", nullable: true })
  gitlabRefreshToken!: string | null

  @Column({ name: "gitlab_host", type: "text", nullable: true })
  gitlabHost!: string | null // For self-hosted GitLab instances

  @OneToMany("Project", "user")
  projects!: Promise<Project[]>

  // GitHub relationships
  @ManyToMany("GitHubInstallation", "users")
  githubInstallations!: Promise<GitHubInstallation[]>

  @OneToMany("GitHubInstallation", "creator")
  createdInstallations!: Promise<GitHubInstallation[]>

  @OneToMany("UserGithubRepoAccess", "user")
  githubRepoAccesses!: Promise<UserGithubRepoAccess[]>

  // GitLab relationships
  @ManyToMany("GitLabGroup", "users")
  gitlabGroups!: Promise<GitLabGroup[]>

  @OneToMany("UserGitlabProjectAccess", "user")
  gitlabProjectAccesses!: Promise<UserGitlabProjectAccess[]>

  @Column({ name: "stripe_customer_id", type: "text", nullable: true })
  stripeCustomerId!: string | null

  @Column({ name: "stripe_subscription_id", type: "text", nullable: true })
  stripeSubscriptionId!: string | null

  @Column({ name: "subscription_plan", type: "text", nullable: true })
  subscriptionPlan!: string | null

  @Column({ name: "subscription_interval", type: "text", nullable: true })
  subscriptionInterval!: string | null

  @Column({ name: "trial_ends_at", type: "timestamptz", nullable: true })
  trialEndsAt!: Date | null

  @CreateDateColumn({ name: "created_at", type: "timestamptz", nullable: false })
  createdAt!: Date

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz", nullable: false })
  updatedAt!: Date
}

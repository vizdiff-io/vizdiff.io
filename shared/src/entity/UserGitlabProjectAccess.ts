import {
  Entity,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  PrimaryColumn,
  Index,
  Column,
} from "typeorm"

import type { User } from "./User"

/**
 * Represents a user's access to a GitLab project.
 * This is analogous to UserGithubRepoAccess for GitHub repositories.
 */
@Entity("user_gitlab_project_access")
export class UserGitlabProjectAccess {
  @PrimaryColumn({ name: "user_id", type: "int", nullable: false })
  userId!: number

  @PrimaryColumn({ name: "gitlab_project_id", type: "bigint", nullable: false })
  @Index("IDX_user_gitlab_project_access_project_id", ["gitlabProjectId"], { unique: false })
  gitlabProjectId!: number

  // GitLab host URL (for self-hosted instances)
  // Part of the composite primary key to prevent conflicts when users switch GitLab instances
  @PrimaryColumn({ name: "gitlab_host", type: "text", nullable: false, default: "https://gitlab.com" })
  gitlabHost!: string

  @ManyToOne("User", { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id", referencedColumnName: "id" })
  user?: Promise<User>

  @CreateDateColumn({ name: "created_at", type: "timestamptz", nullable: false })
  createdAt!: Date
}

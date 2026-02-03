import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  JoinTable,
} from "typeorm"

import type { User } from "./User"

/**
 * Represents a GitLab group that users have access to.
 * This is analogous to GitHubInstallation for GitHub App installations.
 */
@Entity("gitlab_groups")
export class GitLabGroup {
  @PrimaryGeneratedColumn()
  id!: number

  // GitLab group ID
  @Column({ name: "gitlab_group_id", type: "bigint", nullable: false })
  gitlabGroupId!: number

  // GitLab group path (e.g., "my-company" or "my-company/sub-group")
  @Column({ name: "group_path", type: "text", nullable: false })
  groupPath!: string

  // GitLab group name (display name)
  @Column({ name: "group_name", type: "text", nullable: false })
  groupName!: string

  // Full path including parent groups
  @Column({ name: "full_path", type: "text", nullable: false })
  fullPath!: string

  // GitLab host URL (for self-hosted instances)
  @Column({ name: "gitlab_host", type: "text", nullable: false, default: "https://gitlab.com" })
  gitlabHost!: string

  // Avatar URL for the group
  @Column({ name: "avatar_url", type: "text", nullable: true })
  avatarUrl!: string | null

  // Web URL to the group
  @Column({ name: "web_url", type: "text", nullable: false })
  webUrl!: string

  // Users who have access to this group
  @ManyToMany("User")
  @JoinTable({
    name: "user_gitlab_groups",
    joinColumn: { name: "group_id", referencedColumnName: "id" },
    inverseJoinColumn: { name: "user_id", referencedColumnName: "id" },
  })
  users!: User[]

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date
}

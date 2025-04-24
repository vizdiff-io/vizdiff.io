import { Entity, CreateDateColumn, ManyToOne, JoinColumn, PrimaryColumn } from "typeorm"

import type { User } from "./User"

@Entity("user_github_repo_access")
export class UserGithubRepoAccess {
  @PrimaryColumn({ name: "user_id", type: "int", nullable: false })
  userId!: number

  @PrimaryColumn({ name: "github_repo_id", type: "bigint", nullable: false })
  githubRepoId!: number

  @ManyToOne("User", { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id", referencedColumnName: "id" })
  user?: Promise<User>

  @CreateDateColumn({ name: "created_at", type: "timestamptz", nullable: false })
  createdAt!: Date
}

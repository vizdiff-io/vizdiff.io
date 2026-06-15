import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  JoinTable,
  ManyToOne,
  JoinColumn,
} from "typeorm"

import type { User } from "./User"

@Entity("github_installations")
export class GitHubInstallation {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ name: "installation_id", type: "bigint", nullable: false })
  installationId!: number

  @Column({ name: "account_id", type: "text", nullable: false })
  accountId!: string // GitHub account/org ID where app is installed

  @Column({ name: "account_name", type: "text", nullable: false })
  accountName!: string // GitHub account/org login name

  @Column({ name: "account_type", type: "text", nullable: false })
  accountType!: string // 'Organization' or 'User'

  // `creatorId` is the authoritative, writable scalar for the `creator_id` FK column (it is what
  // application code reads/writes). The `creator` relation is the owning side of the bidirectional
  // relation whose inverse is `User.createdInstallations`; it exists to declare the FK and its
  // ON DELETE CASCADE. See `relationships.ts` for why its prototype default must be left unset.
  @Column({ name: "creator_id", type: "integer", nullable: false })
  creatorId!: number

  @ManyToOne("User", { onDelete: "CASCADE" })
  @JoinColumn({ name: "creator_id", referencedColumnName: "id" })
  creator?: Promise<User>

  @ManyToMany("User", "githubInstallations")
  @JoinTable({
    name: "user_github_installations",
    joinColumn: { name: "installation_id", referencedColumnName: "id" },
    inverseJoinColumn: { name: "user_id", referencedColumnName: "id" },
  })
  users!: User[]

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date
}

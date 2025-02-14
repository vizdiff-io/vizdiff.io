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

  @Column({ name: "installation_id", type: "integer", nullable: false })
  installationId!: number

  @Column({ name: "account_id", type: "varchar", length: 255, nullable: false })
  accountId!: string // GitHub account/org ID where app is installed

  @Column({ name: "account_name", type: "varchar", length: 255, nullable: false })
  accountName!: string // GitHub account/org login name

  @Column({ name: "account_type", type: "varchar", length: 255, nullable: false })
  accountType!: string // 'Organization' or 'User'

  @Column({ name: "creator_id", type: "integer", nullable: false, update: false })
  creatorId!: number

  @ManyToOne("User", { onDelete: "CASCADE", nullable: false })
  @JoinColumn({ name: "creator_id", referencedColumnName: "id" })
  creator!: Promise<User>

  @ManyToMany("User")
  @JoinTable({
    name: "user_github_installations",
    joinColumn: { name: "installation_id", referencedColumnName: "id" },
    inverseJoinColumn: { name: "user_id", referencedColumnName: "id" },
  })
  users!: User[]

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date
}

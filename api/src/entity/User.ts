import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  OneToMany,
} from "typeorm"
import { Project } from "./Project"

@Entity("users")
@Unique(["github_id", "email", "github_username"])
export class User {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ name: "github_id", type: "bigint", unique: true, nullable: false })
  githubId!: bigint

  @Column({ type: "varchar", length: 255, nullable: true })
  email!: string | null

  @Column({ name: "github_username", type: "varchar", length: 255, unique: true, nullable: false })
  githubUsername!: string

  @Column({ name: "github_profile", type: "jsonb", nullable: false })
  githubProfile!: string

  @Column({ name: "github_access_token", type: "varchar", length: 255, nullable: false })
  githubAccessToken!: string

  @OneToMany(() => Project, (project) => project.user)
  projects!: Promise<Project[]>

  @CreateDateColumn({ name: "created_at", type: "timestamp", nullable: false })
  createdAt!: Date

  @UpdateDateColumn({ name: "updated_at", type: "timestamp", nullable: false })
  updatedAt!: Date
}

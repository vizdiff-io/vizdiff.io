import { GitHubInstallation } from "./GitHubInstallation"
import { Project } from "./Project"
import { ScreenshotTest } from "./ScreenshotTest"
import { TestResult } from "./TestResult"
import { User } from "./User"
import { WorkTask } from "./WorkTask"

// Define relationships after all entities are loaded
export function defineRelationships(): void {
  // These type assertions are safe because the entities are already loaded
  const UserEntity = User as unknown as typeof User
  const ProjectEntity = Project as unknown as typeof Project
  const ScreenshotTestEntity = ScreenshotTest as unknown as typeof ScreenshotTest
  const TestResultEntity = TestResult as unknown as typeof TestResult
  const WorkTaskEntity = WorkTask as unknown as typeof WorkTask
  const GitHubInstallationEntity = GitHubInstallation as unknown as typeof GitHubInstallation

  // User <-> Project
  UserEntity.prototype.projects = Promise.resolve([] as Project[])
  ProjectEntity.prototype.user = null as unknown as User

  // Project <-> ScreenshotTest
  ProjectEntity.prototype.screenshotTests = Promise.resolve([] as ScreenshotTest[])
  ScreenshotTestEntity.prototype.project = null as unknown as Project

  // ScreenshotTest <-> TestResult
  ScreenshotTestEntity.prototype.testResults = Promise.resolve([] as TestResult[])
  TestResultEntity.prototype.screenshotTest = null as unknown as ScreenshotTest

  // ScreenshotTest <-> WorkTask
  ScreenshotTestEntity.prototype.workTasks = Promise.resolve([] as WorkTask[])
  WorkTaskEntity.prototype.screenshotTest = null as unknown as ScreenshotTest

  // User <-> GitHubInstallation (ManyToMany for access)
  UserEntity.prototype.githubInstallations = Promise.resolve([] as GitHubInstallation[])
  GitHubInstallationEntity.prototype.users = [] as User[]

  // User <-> GitHubInstallation (OneToMany for creator)
  UserEntity.prototype.createdInstallations = Promise.resolve([] as GitHubInstallation[])
  GitHubInstallationEntity.prototype.creator = Promise.resolve({} as User)
}

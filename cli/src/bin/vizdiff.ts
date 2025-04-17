#!/usr/bin/env node

import { program } from "commander"
import fs from "fs"
import path from "path"
import { simpleGit } from "simple-git"

import { checkToken, uploadStorybook } from ".."
import { fatal } from "../log"

type CommandArgs = {
  token?: string
  commit?: string
  branch?: string
  baseBranch?: string
  baseCommit?: string
  pr?: string | number
}

function main(): void {
  program.usage("<command> [options]").enablePositionalOptions()

  program
    .command("upload <storybook-directory>")
    .description("Upload a storybook build folder to vizdiff.io")
    .option("-t, --token <token>", "Project token (defaults to VIZDIFF_PROJECT_TOKEN)")
    .option("-c, --commit <commit-sha>", "Git commit SHA (defaults to the latest commit)")
    .option("-b, --branch <branch-name>", "Git branch name (defaults to the current branch)")
    .option(
      "--base-branch <base-branch-name>",
      "Base branch name for comparison (defaults to the default branch)",
    )
    .option(
      "--base-commit <base-commit-sha>",
      "Base commit SHA for comparison (defaults to the merge base commit)",
    )
    .option("--pr <pr-number>", "GitHub pull request number associated with this commit (optional)")
    .action((storybookDir: string, options: CommandArgs) => {
      vizdiff(storybookDir, options).catch(fatal)
    })

  program.on("command:*", ([_cmd]: string) => {
    program.outputHelp({ error: true })
    process.exit(1)
  })

  program.parse(process.argv)
}

async function vizdiff(storybookDir: string, options: CommandArgs): Promise<void> {
  const projectToken = getToken(options)
  const commitSha = await getCommitSha(storybookDir, options)
  const branch = await getBranch(storybookDir, options)
  const [baseCommitSha, baseBranch] =
    options.baseCommit && options.baseBranch
      ? [options.baseCommit, options.baseBranch]
      : await getBaseCommitShaAndBranch(storybookDir, commitSha, branch, options.baseBranch)
  const prNumber = getPrNumber(options)

  try {
    await uploadStorybook({
      storybookDir,
      commitSha,
      branch,
      projectToken,
      baseCommitSha,
      baseBranch,
      prNumber,
    })
  } catch (err: unknown) {
    const statusCode =
      typeof err === "object" && err != null && "statusCode" in err
        ? (err as { statusCode?: number }).statusCode
        : undefined
    const errMessage = err instanceof Error ? err.message : String(err)
    if (statusCode === 401) {
      fatal("Invalid project token. Please check that the token is correct.")
    } else if (statusCode === 402) {
      fatal(errMessage)
    } else if (errMessage === "fetch failed") {
      fatal("Storybook upload failed")
    } else {
      fatal(`Storybook upload failed: ${errMessage}`)
    }
  }
}

function getToken(options: { token?: string }) {
  const token = options.token ?? process.env.VIZDIFF_PROJECT_TOKEN ?? process.env.VIZDIFF_TOKEN
  if (!token) {
    fatal(
      "Missing project token. Please set the VIZDIFF_PROJECT_TOKEN environment variable or use the --token option.",
    )
  }
  if (!checkToken(token)) {
    fatal("Invalid project token. Please check that the token is correct.")
  }
  return token
}

async function getCommitSha(storybookDir: string, options: { commit?: string }): Promise<string> {
  const commitSha = options.commit
  if (commitSha) {
    return commitSha
  }

  const gitDir = findGitRoot(storybookDir)
  if (!gitDir) {
    throw new Error("Could not find a git repository for the storybook directory.")
  }

  const git = simpleGit(gitDir)
  const log = await git.log()
  if (!log.latest) {
    throw new Error("Could not find the latest commit in the git log")
  }

  return log.latest.hash
}

async function getBranch(storybookDir: string, options: { branch?: string }): Promise<string> {
  if (options.branch) {
    return options.branch
  }

  const gitDir = findGitRoot(storybookDir)
  if (!gitDir) {
    throw new Error("Could not find a git repository for the storybook directory.")
  }

  const git = simpleGit(gitDir)
  const status = await git.status()
  if (!status.current) {
    throw new Error("Could not find the current branch in the git status")
  }

  return status.current
}

/**
 * Returns the base commit SHA and base branch name for the given commit and branch.
 * If the base commit SHA is not found, it returns [undefined, undefined].
 */
async function getBaseCommitShaAndBranch(
  storybookDir: string,
  commitSha: string,
  branch: string,
  baseBranch?: string,
): Promise<[string | undefined, string | undefined]> {
  const gitDir = findGitRoot(storybookDir)
  if (!gitDir) {
    return [undefined, undefined]
  }

  const git = simpleGit(gitDir)
  const log = await git.log()
  if (!log.latest) {
    return [undefined, undefined]
  }

  // Get the default branch (usually main or master)
  const remotes = await git.getRemotes(true)
  const defaultRemote = remotes.find((r) => r.name === "origin")
  if (!defaultRemote) {
    return [undefined, undefined]
  }

  // Get the default branch name
  const defaultBranch = await git.revparse(["--abbrev-ref", `${defaultRemote.name}/HEAD`])
  const actualBaseBranch =
    baseBranch != undefined && baseBranch !== "" ? baseBranch : defaultBranch.replace("origin/", "")

  if (branch === actualBaseBranch) {
    // If we're on the default branch, use the previous commit as the base commit
    const baseCommit = await git.revparse([`${commitSha}~1`])
    return [baseCommit, actualBaseBranch]
  }

  // Find merge base between current branch and default branch
  try {
    const mergeBase = await git.raw(["merge-base", branch, actualBaseBranch])
    return [mergeBase.trim(), actualBaseBranch]
  } catch (err: unknown) {
    throw new Error(
      `Failed to find merge base between "${branch}" and "${actualBaseBranch}": ${err}`,
    )
  }
}

// Search for the first parent directory that contains a `.git` folder
function findGitRoot(dir: string): string | undefined {
  const gitPath = path.join(dir, ".git")
  if (fs.existsSync(gitPath)) {
    return dir
  }

  const parentDir = path.dirname(dir)
  if (parentDir === dir) {
    // Reached the root directory
    return undefined
  }

  return findGitRoot(parentDir)
}

// Returns the pull request number if it is a valid number, otherwise undefined
function getPrNumber(options: { pr?: string | number }): number | undefined {
  const prNumber = options.pr ? parseInt(options.pr.toString()) : undefined
  if (prNumber == undefined || isNaN(prNumber) || prNumber < 1) {
    return undefined
  }
  return prNumber
}

main()

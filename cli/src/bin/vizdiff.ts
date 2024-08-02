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
}

function main(): void {
  program.usage("<command> [options]").enablePositionalOptions()

  program
    .command("upload <storybook-directory>")
    .description("Upload a storybook build folder to vizdiff.io")
    .option("-t, --token <token>", "Project token")
    .option("-c, --commit <commit-sha>", "Git commit SHA")
    .option("-b, --branch <branch-name>", "Git branch name")
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
  const branchName = await getBranchName(storybookDir, options)

  await uploadStorybook({ storybookDir, commitSha, branchName, projectToken })
}

function getToken(options: { token?: string }) {
  const token = options.token ?? process.env.VIZDIFF_TOKEN
  if (!token) {
    fatal(
      "Missing project token. Please set the VIZDIFF_TOKEN environment variable or use the --token option.",
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

async function getBranchName(storybookDir: string, options: { branch?: string }): Promise<string> {
  const branchName = options.branch
  if (branchName) {
    return branchName
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

main()

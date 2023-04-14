#!/usr/bin/env node
import { program } from "commander"

import { checkToken, uploadStorybook } from ".."
import { fatal } from "../log"

function main(task: Promise<void>): void {
  task.catch(fatal)
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

program.usage("<command> [options]").enablePositionalOptions()

program
  .command("upload <storybook-directory>")
  .description("Upload a storybook build folder to vizdiff.io")
  .option("-t, --token <token>", "Project token")
  .action((storybookDir: string, options: { token: string | undefined }) => {
    main(uploadStorybook(storybookDir, getToken(options)))
  })

program.on("command:*", ([_cmd]: string) => {
  program.outputHelp({ error: true })
  process.exit(1)
})

program.parse(process.argv)

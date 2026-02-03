import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2"
import type { ScreenshotTest } from "shared"

import { APP_URL, SES_FROM_EMAIL, SES_REGION } from "./environment"
import { log } from "./log"

let gSesClient: SESv2Client | undefined

function getSesClient(): SESv2Client | undefined {
  if (!SES_REGION || !SES_FROM_EMAIL) {
    return undefined
  }

  if (!gSesClient) {
    gSesClient = new SESv2Client({ region: SES_REGION })
  }

  return gSesClient
}

export async function sendBuildCompletedEmail(screenshotTest: ScreenshotTest): Promise<void> {
  const ses = getSesClient()
  if (!ses) {
    log.info("SES_REGION or SES_FROM_EMAIL not set; skipping build completion email")
    return
  }

  const ownerEmail = screenshotTest.project.user.email
  if (!ownerEmail) {
    log.info(
      { userId: screenshotTest.project.user.id },
      "Project owner has no email; skipping build completion email",
    )
    return
  }

  const statusLabel = screenshotTest.status === "no_changes" ? "no changes" : screenshotTest.status
  const subject = `VizDiff build #${screenshotTest.buildNumber} ${statusLabel}`
  const detailsUrl = new URL(`/tests/${screenshotTest.id}`, APP_URL).toString()
  const bodyText = [
    `Project: ${screenshotTest.project.name}`,
    `Repo: ${screenshotTest.project.githubRepoUrl}`,
    `Status: ${statusLabel}`,
    `Total changes: ${screenshotTest.totalChanges ?? 0}`,
    `View details: ${detailsUrl}`,
  ].join("\n")

  try {
    await ses.send(
      new SendEmailCommand({
        FromEmailAddress: SES_FROM_EMAIL,
        Destination: { ToAddresses: [ownerEmail] },
        Content: {
          Simple: {
            Subject: { Data: subject, Charset: "UTF-8" },
            Body: {
              Text: { Data: bodyText, Charset: "UTF-8" },
            },
          },
        },
      }),
    )
    log.info({ ownerEmail, buildId: screenshotTest.id }, "Sent build completion email")
  } catch (error) {
    log.error(error, "Failed to send build completion email")
  }
}

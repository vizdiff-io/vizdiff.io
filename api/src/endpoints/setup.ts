import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3"
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2"
import { createAppAuth } from "@octokit/auth-app"
import { Octokit } from "@octokit/rest"
import type { Readable } from "node:stream"

import {
  APP_URL,
  GITHUB_APP_ID,
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  GITHUB_PRIVATE_KEY,
  GITHUB_WEBHOOK_SECRET,
  S3_BUCKET_NAME,
  SES_FROM_EMAIL,
  SES_REGION,
  SETUP_TOKEN,
} from "../environment"
import { log } from "../log"
import type { DefaultRequest, DefaultResponse } from "../types"

type SetupStatus = {
  missing: string[]
  placeholders: string[]
}

function hasPlaceholder(value: string | undefined): boolean {
  if (!value) {
    return false
  }
  const lower = value.toLowerCase()
  return lower.includes("your_") || lower.includes("change-me") || lower.includes("example")
}

function requireSetupToken(req: DefaultRequest, res: DefaultResponse): boolean {
  if (!SETUP_TOKEN) {
    return true
  }
  const token = req.headers["x-setup-token"]
  if (token !== SETUP_TOKEN) {
    res.status(401).json({ error: "Invalid setup token" })
    return false
  }
  return true
}

export async function status(req: DefaultRequest, res: DefaultResponse): Promise<void> {
  if (!requireSetupToken(req, res)) {
    return
  }

  const required = {
    APP_URL,
    GITHUB_APP_ID,
    GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET,
    GITHUB_PRIVATE_KEY,
    GITHUB_WEBHOOK_SECRET,
    S3_BUCKET_NAME,
  }

  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([key]) => key)
  const placeholders = Object.entries(required)
    .filter(([, value]) => hasPlaceholder(value))
    .map(([key]) => key)

  const response: SetupStatus = { missing, placeholders }
  res.json(response)
}

export async function validateGithub(req: DefaultRequest, res: DefaultResponse): Promise<void> {
  if (!requireSetupToken(req, res)) {
    return
  }

  if (!GITHUB_APP_ID || !GITHUB_PRIVATE_KEY || !GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
    res.status(400).json({ error: "GitHub App environment variables are not fully configured" })
    return
  }

  try {
    const auth = createAppAuth({
      appId: GITHUB_APP_ID,
      privateKey: GITHUB_PRIVATE_KEY,
      clientId: GITHUB_CLIENT_ID,
      clientSecret: GITHUB_CLIENT_SECRET,
    })
    const appAuth = await auth({ type: "app" })
    const octokit = new Octokit({ auth: appAuth.token })
    const app = await octokit.rest.apps.getAuthenticated()
    res.json({ ok: true, app: { id: app.data.id, slug: app.data.slug } })
  } catch (error) {
    log.error(error, "GitHub App validation failed")
    res.status(500).json({ ok: false, error: "GitHub App validation failed" })
  }
}

export async function validateS3(req: DefaultRequest, res: DefaultResponse): Promise<void> {
  if (!requireSetupToken(req, res)) {
    return
  }
  if (!S3_BUCKET_NAME) {
    res.status(400).json({ error: "S3_BUCKET_NAME is not set" })
    return
  }

  const s3 = new S3Client()
  const testKey = `setup/validate-${Date.now()}.txt`
  const testBody = `vizdiff-setup-${Date.now()}`

  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET_NAME,
        Key: testKey,
        Body: testBody,
      }),
    )
    const getResponse = await s3.send(
      new GetObjectCommand({
        Bucket: S3_BUCKET_NAME,
        Key: testKey,
      }),
    )
    const body = getResponse.Body as Readable | undefined
    if (!body) {
      throw new Error("S3 get returned empty body")
    }
    await s3.send(
      new DeleteObjectCommand({
        Bucket: S3_BUCKET_NAME,
        Key: testKey,
      }),
    )

    res.json({ ok: true })
  } catch (error) {
    log.error(error, "S3 validation failed")
    res.status(500).json({ ok: false, error: "S3 validation failed" })
  }
}

export async function testEmail(req: DefaultRequest, res: DefaultResponse): Promise<void> {
  if (!requireSetupToken(req, res)) {
    return
  }
  if (!SES_REGION || !SES_FROM_EMAIL) {
    res.status(400).json({ error: "SES_REGION or SES_FROM_EMAIL is not configured" })
    return
  }

  const { email } = req.body as { email?: string }
  if (!email) {
    res.status(400).json({ error: "Missing email" })
    return
  }

  const ses = new SESv2Client({ region: SES_REGION })

  try {
    await ses.send(
      new SendEmailCommand({
        FromEmailAddress: SES_FROM_EMAIL,
        Destination: { ToAddresses: [email] },
        Content: {
          Simple: {
            Subject: { Data: "VizDiff setup test email", Charset: "UTF-8" },
            Body: {
              Text: {
                Data: `VizDiff self-contained install test email for ${APP_URL}.`,
                Charset: "UTF-8",
              },
            },
          },
        },
      }),
    )
    res.json({ ok: true })
  } catch (error) {
    log.error(error, "SES test email failed")
    res.status(500).json({ ok: false, error: "SES test email failed" })
  }
}

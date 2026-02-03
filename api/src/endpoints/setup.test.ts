/**
 * Unit tests for the setup validation endpoints.
 *
 * These endpoints allow users to validate their configuration for:
 * 1. Environment variable status - checks for missing/placeholder values
 * 2. GitHub App credentials - validates authentication via Octokit
 * 3. S3 bucket access - tests put/get/delete operations
 * 4. SES email - sends a test email
 *
 * All external dependencies (AWS SDK, Octokit) are mocked.
 */

/* eslint-disable import/first, import/order */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

import type { DefaultRequest, DefaultResponse } from "../types"

// Use vi.hoisted to define mock env before hoisting happens
// Note: Avoid "example", "your_", "change-me" in values as they trigger placeholder detection
const mockEnv = vi.hoisted(() => ({
  APP_URL: "https://vizdiff.acme.com",
  GITHUB_APP_ID: "123456",
  GITHUB_CLIENT_ID: "Iv1.abc123",
  GITHUB_CLIENT_SECRET: "secret123",
  GITHUB_PRIVATE_KEY: "-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----",
  GITHUB_WEBHOOK_SECRET: "webhook-secret",
  S3_BUCKET_NAME: "vizdiff-test-bucket",
  SES_REGION: "us-east-1",
  SES_FROM_EMAIL: "noreply@vizdiff.acme.com",
  SETUP_TOKEN: "test-setup-token",
}))

const DEFAULT_SETUP_TOKEN = "test-setup-token"

// Mock AWS SDK clients
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn().mockImplementation(() => ({
    send: vi.fn(),
  })),
  PutObjectCommand: vi.fn(),
  GetObjectCommand: vi.fn(),
  DeleteObjectCommand: vi.fn(),
}))

vi.mock("@aws-sdk/client-sesv2", () => ({
  SESv2Client: vi.fn().mockImplementation(() => ({
    send: vi.fn(),
  })),
  SendEmailCommand: vi.fn(),
}))

// Mock Octokit
vi.mock("@octokit/auth-app", () => ({
  createAppAuth: vi.fn(),
}))

vi.mock("@octokit/rest", () => ({
  Octokit: vi.fn(),
}))

// Mock environment - references the hoisted mockEnv
vi.mock("../environment", () => mockEnv)

vi.mock("../log", () => ({
  log: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}))

// Import mocked modules after vi.mock calls
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3"
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2"
import { createAppAuth } from "@octokit/auth-app"
import { Octokit } from "@octokit/rest"
import { status, validateGithub, validateS3, testEmail } from "./setup"

// Helper to create mock request/response objects
function createMockReqRes(options: {
  headers?: Record<string, string>
  body?: Record<string, unknown>
  skipDefaultToken?: boolean
}): {
  req: DefaultRequest
  res: DefaultResponse
  resJson: ReturnType<typeof vi.fn>
  resStatus: ReturnType<typeof vi.fn>
} {
  const resJson = vi.fn()
  const resStatus = vi.fn().mockReturnThis()

  // Include setup token by default unless explicitly skipped
  const defaultHeaders = options.skipDefaultToken ? {} : { "x-setup-token": DEFAULT_SETUP_TOKEN }

  const req = {
    headers: { ...defaultHeaders, ...options.headers },
    body: options.body ?? {},
  } as unknown as DefaultRequest

  const res = {
    json: resJson,
    status: resStatus,
  } as unknown as DefaultResponse

  // Make status().json() chainable
  resStatus.mockImplementation(() => ({ json: resJson }))

  return { req, res, resJson, resStatus }
}

describe("setup endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Reset environment mocks to default valid values
    // Note: Avoid "example", "your_", "change-me" in values as they trigger placeholder detection
    Object.assign(mockEnv, {
      APP_URL: "https://vizdiff.acme.com",
      GITHUB_APP_ID: "123456",
      GITHUB_CLIENT_ID: "Iv1.abc123",
      GITHUB_CLIENT_SECRET: "secret123",
      GITHUB_PRIVATE_KEY: "-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----",
      GITHUB_WEBHOOK_SECRET: "webhook-secret",
      S3_BUCKET_NAME: "vizdiff-test-bucket",
      SES_REGION: "us-east-1",
      SES_FROM_EMAIL: "noreply@vizdiff.acme.com",
      SETUP_TOKEN: DEFAULT_SETUP_TOKEN,
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe("status", () => {
    it("should return empty arrays when all required vars are set", async () => {
      const { req, res, resJson } = createMockReqRes({})

      await status(req, res)

      expect(resJson).toHaveBeenCalledWith({
        missing: [],
        placeholders: [],
      })
    })

    it("should report missing environment variables", async () => {
      mockEnv.GITHUB_APP_ID = ""
      mockEnv.S3_BUCKET_NAME = ""

      const { req, res, resJson } = createMockReqRes({})

      await status(req, res)

      expect(resJson).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          missing: expect.arrayContaining(["GITHUB_APP_ID", "S3_BUCKET_NAME"]),
        }),
      )
    })

    it("should detect placeholder values", async () => {
      mockEnv.GITHUB_APP_ID = "your_github_app_id"
      mockEnv.GITHUB_CLIENT_SECRET = "change-me"

      const { req, res, resJson } = createMockReqRes({})

      await status(req, res)

      expect(resJson).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          placeholders: expect.arrayContaining(["GITHUB_APP_ID", "GITHUB_CLIENT_SECRET"]),
        }),
      )
    })

    it("should deny access when SETUP_TOKEN is not configured", async () => {
      mockEnv.SETUP_TOKEN = ""

      const { req, res, resJson, resStatus } = createMockReqRes({ skipDefaultToken: true })

      await status(req, res)

      expect(resStatus).toHaveBeenCalledWith(403)
      expect(resJson).toHaveBeenCalledWith({
        error: "Setup endpoints are disabled. Set SETUP_TOKEN to enable.",
      })
    })

    it("should require valid setup token when configured", async () => {
      const { req, res, resJson, resStatus } = createMockReqRes({
        headers: { "x-setup-token": "wrong-token" },
      })

      await status(req, res)

      expect(resStatus).toHaveBeenCalledWith(401)
      expect(resJson).toHaveBeenCalledWith({ error: "Invalid setup token" })
    })

    it("should allow access with valid setup token", async () => {
      const { req, res, resJson, resStatus } = createMockReqRes({})

      await status(req, res)

      expect(resStatus).not.toHaveBeenCalled()
      expect(resJson).toHaveBeenCalledWith(
        expect.objectContaining({
          missing: [],
          placeholders: [],
        }),
      )
    })
  })

  describe("validateGithub", () => {
    it("should return error when GitHub vars are missing", async () => {
      mockEnv.GITHUB_APP_ID = ""

      const { req, res, resJson, resStatus } = createMockReqRes({})

      await validateGithub(req, res)

      expect(resStatus).toHaveBeenCalledWith(400)
      expect(resJson).toHaveBeenCalledWith({
        error: "GitHub App environment variables are not fully configured",
      })
    })

    it("should validate GitHub App credentials successfully", async () => {
      const mockAuth = vi.fn().mockResolvedValue({ token: "test-token" })
      vi.mocked(createAppAuth).mockReturnValue(
        mockAuth as unknown as ReturnType<typeof createAppAuth>,
      )
      vi.mocked(Octokit).mockImplementation(
        () =>
          ({
            rest: {
              apps: {
                getAuthenticated: vi.fn().mockResolvedValue({
                  data: { id: 123456, slug: "vizdiff-app" },
                }),
              },
            },
          }) as unknown as Octokit,
      )

      const { req, res, resJson, resStatus } = createMockReqRes({})

      await validateGithub(req, res)

      expect(resStatus).not.toHaveBeenCalled()
      expect(resJson).toHaveBeenCalledWith({
        ok: true,
        app: { id: 123456, slug: "vizdiff-app" },
      })
    })

    it("should handle GitHub API errors", async () => {
      const mockAuth = vi.fn().mockRejectedValue(new Error("Invalid private key"))
      vi.mocked(createAppAuth).mockReturnValue(
        mockAuth as unknown as ReturnType<typeof createAppAuth>,
      )

      const { req, res, resJson, resStatus } = createMockReqRes({})

      await validateGithub(req, res)

      expect(resStatus).toHaveBeenCalledWith(500)
      expect(resJson).toHaveBeenCalledWith({
        ok: false,
        error: "GitHub App validation failed",
      })
    })
  })

  describe("validateS3", () => {
    it("should return error when S3_BUCKET_NAME is not set", async () => {
      mockEnv.S3_BUCKET_NAME = ""

      const { req, res, resJson, resStatus } = createMockReqRes({})

      await validateS3(req, res)

      expect(resStatus).toHaveBeenCalledWith(400)
      expect(resJson).toHaveBeenCalledWith({ error: "S3_BUCKET_NAME is not set" })
    })

    it("should validate S3 access successfully", async () => {
      const mockSend = vi.fn().mockResolvedValue({ Body: { pipe: vi.fn() } })
      vi.mocked(S3Client).mockImplementation(() => ({ send: mockSend }) as unknown as S3Client)

      const { req, res, resJson, resStatus } = createMockReqRes({})

      await validateS3(req, res)

      expect(resStatus).not.toHaveBeenCalled()
      expect(resJson).toHaveBeenCalledWith({ ok: true })

      // Verify all three operations were called
      expect(mockSend).toHaveBeenCalledTimes(3)
      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: "vizdiff-test-bucket",
        }),
      )
      expect(GetObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: "vizdiff-test-bucket",
        }),
      )
      expect(DeleteObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: "vizdiff-test-bucket",
        }),
      )
    })

    it("should handle S3 errors", async () => {
      const mockSend = vi.fn().mockRejectedValue(new Error("Access Denied"))
      vi.mocked(S3Client).mockImplementation(() => ({ send: mockSend }) as unknown as S3Client)

      const { req, res, resJson, resStatus } = createMockReqRes({})

      await validateS3(req, res)

      expect(resStatus).toHaveBeenCalledWith(500)
      expect(resJson).toHaveBeenCalledWith({
        ok: false,
        error: "S3 validation failed",
      })
    })
  })

  describe("testEmail", () => {
    it("should deny access when SETUP_TOKEN is not configured", async () => {
      mockEnv.SETUP_TOKEN = ""

      const { req, res, resJson, resStatus } = createMockReqRes({
        body: { email: "test@example.com" },
        skipDefaultToken: true,
      })

      await testEmail(req, res)

      expect(resStatus).toHaveBeenCalledWith(403)
      expect(resJson).toHaveBeenCalledWith({
        error: "Setup endpoints are disabled. Set SETUP_TOKEN to enable.",
      })
    })

    it("should return error when SES is not configured", async () => {
      mockEnv.SES_REGION = ""

      const { req, res, resJson, resStatus } = createMockReqRes({
        body: { email: "test@example.com" },
      })

      await testEmail(req, res)

      expect(resStatus).toHaveBeenCalledWith(400)
      expect(resJson).toHaveBeenCalledWith({
        error: "SES_REGION or SES_FROM_EMAIL is not configured",
      })
    })

    it("should return error when email is missing from request", async () => {
      const { req, res, resJson, resStatus } = createMockReqRes({
        body: {},
      })

      await testEmail(req, res)

      expect(resStatus).toHaveBeenCalledWith(400)
      expect(resJson).toHaveBeenCalledWith({ error: "Missing email" })
    })

    it("should send test email successfully", async () => {
      const mockSend = vi.fn().mockResolvedValue({ MessageId: "test-message-id" })
      vi.mocked(SESv2Client).mockImplementation(
        () => ({ send: mockSend }) as unknown as SESv2Client,
      )

      const { req, res, resJson, resStatus } = createMockReqRes({
        body: { email: "recipient@test.com" },
      })

      await testEmail(req, res)

      expect(resStatus).not.toHaveBeenCalled()
      expect(resJson).toHaveBeenCalledWith({ ok: true })

      expect(SendEmailCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          FromEmailAddress: "noreply@vizdiff.acme.com",
          Destination: { ToAddresses: ["recipient@test.com"] },
        }),
      )
    })

    it("should handle SES errors", async () => {
      const mockSend = vi.fn().mockRejectedValue(new Error("Email address not verified"))
      vi.mocked(SESv2Client).mockImplementation(
        () => ({ send: mockSend }) as unknown as SESv2Client,
      )

      const { req, res, resJson, resStatus } = createMockReqRes({
        body: { email: "recipient@test.com" },
      })

      await testEmail(req, res)

      expect(resStatus).toHaveBeenCalledWith(500)
      expect(resJson).toHaveBeenCalledWith({
        ok: false,
        error: "SES test email failed",
      })
    })
  })
})

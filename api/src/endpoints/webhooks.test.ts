import crypto from "crypto"
import { describe, expect, it } from "vitest"

import { verifyWebhookSignature } from "./webhooks"

describe("verifyWebhookSignature", () => {
  const testSecret = "test_webhook_secret"
  const testPayload = Buffer.from(JSON.stringify({ test: "payload" }))

  // Helper function to generate signatures the same way GitHub does
  function generateSignature(
    payload: Buffer,
    secret: string,
    algorithm: "sha1" | "sha256",
  ): string {
    const hmac = crypto.createHmac(algorithm, secret)
    const digest = hmac.update(payload).digest("hex")
    return `${algorithm}=${digest}`
  }

  it("should return false if signature is undefined", () => {
    expect(verifyWebhookSignature(testPayload, undefined, testSecret)).toBe(false)
  })

  it("should return false if signature is an empty string", () => {
    expect(verifyWebhookSignature(testPayload, "", testSecret)).toBe(false)
  })

  it("should verify SHA-1 signatures correctly", () => {
    const signature = generateSignature(testPayload, testSecret, "sha1")
    expect(verifyWebhookSignature(testPayload, signature, testSecret)).toBe(true)
  })

  it("should verify SHA-256 signatures correctly", () => {
    const signature = generateSignature(testPayload, testSecret, "sha256")
    expect(verifyWebhookSignature(testPayload, signature, testSecret)).toBe(true)
  })

  it("should prioritize SHA-256 when both signatures are provided", () => {
    const sha1Signature = generateSignature(testPayload, testSecret, "sha1")
    const sha256Signature = generateSignature(testPayload, testSecret, "sha256")
    const combinedSignature = `${sha1Signature}, ${sha256Signature}`

    expect(verifyWebhookSignature(testPayload, combinedSignature, testSecret)).toBe(true)
  })

  it("should return false for invalid SHA-1 signatures", () => {
    // Tamper with the payload
    const tamperedPayload = Buffer.from(JSON.stringify({ test: "tampered" }))
    const signature = generateSignature(testPayload, testSecret, "sha1")

    expect(verifyWebhookSignature(tamperedPayload, signature, testSecret)).toBe(false)
  })

  it("should return false for invalid SHA-256 signatures", () => {
    // Tamper with the payload
    const tamperedPayload = Buffer.from(JSON.stringify({ test: "tampered" }))
    const signature = generateSignature(testPayload, testSecret, "sha256")

    expect(verifyWebhookSignature(tamperedPayload, signature, testSecret)).toBe(false)
  })

  it("should return false if the secret is incorrect", () => {
    const signature = generateSignature(testPayload, testSecret, "sha256")
    const wrongSecret = "wrong_secret"

    expect(verifyWebhookSignature(testPayload, signature, wrongSecret)).toBe(false)
  })

  it("should handle malformed signature strings", () => {
    // Signature without algorithm prefix
    const malformedSignature = "abcdef1234567890"
    expect(verifyWebhookSignature(testPayload, malformedSignature, testSecret)).toBe(false)

    // Signature with wrong format
    const wrongFormatSignature = "sha256:abcdef1234567890"
    expect(verifyWebhookSignature(testPayload, wrongFormatSignature, testSecret)).toBe(false)
  })

  it("should handle GitHub's actual signature format with multiple algorithms", () => {
    // GitHub might send both sha1 and sha256 in the same header
    const sha1Sig = generateSignature(testPayload, testSecret, "sha1").split("=")[1]
    const sha256Sig = generateSignature(testPayload, testSecret, "sha256").split("=")[1]

    // Format like GitHub's actual X-Hub-Signature header
    const githubStyleSignature = `sha1=${sha1Sig},sha256=${sha256Sig}`

    expect(verifyWebhookSignature(testPayload, githubStyleSignature, testSecret)).toBe(true)
  })
})

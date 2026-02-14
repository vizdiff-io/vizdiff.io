import crypto from "crypto"
import { describe, expect, it } from "vitest"

import { verifyWebhookSignature, verifyGitLabWebhookToken, escapeRegex } from "./webhooks"

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

describe("verifyGitLabWebhookToken", () => {
  const testSecret = "gitlab_webhook_secret_token"

  it("should return true for valid matching token", () => {
    expect(verifyGitLabWebhookToken(testSecret, testSecret)).toBe(true)
  })

  it("should return false for invalid token", () => {
    expect(verifyGitLabWebhookToken("wrong_token", testSecret)).toBe(false)
  })

  it("should return false for undefined received token", () => {
    expect(verifyGitLabWebhookToken(undefined, testSecret)).toBe(false)
  })

  it("should return false for empty received token", () => {
    expect(verifyGitLabWebhookToken("", testSecret)).toBe(false)
  })

  it("should return false for empty expected token", () => {
    expect(verifyGitLabWebhookToken(testSecret, "")).toBe(false)
  })

  it("should handle token array (first element)", () => {
    expect(verifyGitLabWebhookToken([testSecret, "other"], testSecret)).toBe(true)
  })

  it("should return false for empty array", () => {
    expect(verifyGitLabWebhookToken([], testSecret)).toBe(false)
  })

  it("should return false for array with wrong token", () => {
    expect(verifyGitLabWebhookToken(["wrong_token"], testSecret)).toBe(false)
  })

  it("should return false for tokens of different lengths", () => {
    expect(verifyGitLabWebhookToken("short", "much_longer_token")).toBe(false)
    expect(verifyGitLabWebhookToken("much_longer_token", "short")).toBe(false)
  })

  it("should be case sensitive", () => {
    expect(verifyGitLabWebhookToken("Secret", "secret")).toBe(false)
    expect(verifyGitLabWebhookToken("SECRET", "secret")).toBe(false)
  })

  it("should handle special characters in tokens", () => {
    const specialToken = "token!@#$%^&*()_+-=[]{}|;':\",./<>?"
    expect(verifyGitLabWebhookToken(specialToken, specialToken)).toBe(true)
  })

  it("should handle unicode in tokens", () => {
    const unicodeToken = "token_中文_🔐"
    expect(verifyGitLabWebhookToken(unicodeToken, unicodeToken)).toBe(true)
  })
})

describe("escapeRegex", () => {
  it("should escape dot (.) character", () => {
    expect(escapeRegex("my.project")).toBe("my\\.project")
    const regex = new RegExp(`^${escapeRegex("my.project")}$`)
    expect(regex.test("my.project")).toBe(true)
    expect(regex.test("myXproject")).toBe(false)
  })

  it("should escape plus (+) character", () => {
    expect(escapeRegex("repo+name")).toBe("repo\\+name")
    const regex = new RegExp(`^${escapeRegex("repo+name")}$`)
    expect(regex.test("repo+name")).toBe(true)
    expect(regex.test("reponame")).toBe(false)
  })

  it("should escape asterisk (*) character", () => {
    expect(escapeRegex("repo*name")).toBe("repo\\*name")
    const regex = new RegExp(`^${escapeRegex("repo*name")}$`)
    expect(regex.test("repo*name")).toBe(true)
    expect(regex.test("reponame")).toBe(false)
  })

  it("should escape question mark (?) character", () => {
    expect(escapeRegex("repo?name")).toBe("repo\\?name")
    const regex = new RegExp(`^${escapeRegex("repo?name")}$`)
    expect(regex.test("repo?name")).toBe(true)
    expect(regex.test("reponame")).toBe(false)
  })

  it("should escape caret (^) character", () => {
    expect(escapeRegex("^repo")).toBe("\\^repo")
    const regex = new RegExp(`${escapeRegex("^repo")}$`)
    expect(regex.test("^repo")).toBe(true)
  })

  it("should escape dollar ($) character", () => {
    expect(escapeRegex("repo$")).toBe("repo\\$")
    const regex = new RegExp(`^${escapeRegex("repo$")}`)
    expect(regex.test("repo$")).toBe(true)
  })

  it("should escape curly braces ({})", () => {
    expect(escapeRegex("repo{name}")).toBe("repo\\{name\\}")
    const regex = new RegExp(`^${escapeRegex("repo{name}")}$`)
    expect(regex.test("repo{name}")).toBe(true)
    expect(regex.test("reponame")).toBe(false)
  })

  it("should escape parentheses (())", () => {
    expect(escapeRegex("repo(name)")).toBe("repo\\(name\\)")
    const regex = new RegExp(`^${escapeRegex("repo(name)")}$`)
    expect(regex.test("repo(name)")).toBe(true)
    expect(regex.test("reponame")).toBe(false)
  })

  it("should escape pipe (|) character", () => {
    expect(escapeRegex("repo|name")).toBe("repo\\|name")
    const regex = new RegExp(`^${escapeRegex("repo|name")}$`)
    expect(regex.test("repo|name")).toBe(true)
    expect(regex.test("reponame")).toBe(false)
  })

  it("should escape square brackets ([])", () => {
    expect(escapeRegex("repo[name]")).toBe("repo\\[name\\]")
    const regex = new RegExp(`^${escapeRegex("repo[name]")}$`)
    expect(regex.test("repo[name]")).toBe(true)
    expect(regex.test("reponame")).toBe(false)
  })

  it("should escape backslash (\\) character", () => {
    expect(escapeRegex("repo\\name")).toBe("repo\\\\name")
    const regex = new RegExp(`^${escapeRegex("repo\\name")}$`)
    expect(regex.test("repo\\name")).toBe(true)
  })

  it("should handle multiple special characters", () => {
    const input = "my.repo+name*test?value"
    const escaped = escapeRegex(input)
    expect(escaped).toBe("my\\.repo\\+name\\*test\\?value")
    const regex = new RegExp(`^${escaped}$`)
    expect(regex.test(input)).toBe(true)
    expect(regex.test("myXrepo+name*test?value")).toBe(false)
  })

  it("should handle normal repository names without special characters", () => {
    expect(escapeRegex("myrepo")).toBe("myrepo")
    const regex = new RegExp(`^${escapeRegex("myrepo")}$`)
    expect(regex.test("myrepo")).toBe(true)
    expect(regex.test("myrepos")).toBe(false)
  })

  it("should handle empty string", () => {
    expect(escapeRegex("")).toBe("")
  })

  it("should handle repository names that would cause regex injection", () => {
    // Test case from the issue: repo named "my.project" should not match "myXproject"
    const repoName = "my.project"
    const escaped = escapeRegex(repoName)
    expect(escaped).toBe("my\\.project")

    // Create a regex pattern similar to findProjectByRepo
    const pattern = new RegExp(`github[^/]*[/:]owner/${escaped}(\\.git)?$`, "i")

    // Should match the correct repo
    expect(pattern.test("https://github.com/owner/my.project")).toBe(true)
    expect(pattern.test("https://github.com/owner/my.project.git")).toBe(true)

    // Should NOT match incorrect repos (regex injection attempt)
    expect(pattern.test("https://github.com/owner/myXproject")).toBe(false)
    expect(pattern.test("https://github.com/owner/myAproject")).toBe(false)
    expect(pattern.test("https://github.com/owner/my123project")).toBe(false)
  })
})

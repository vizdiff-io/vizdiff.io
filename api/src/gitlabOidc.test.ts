import { generateKeyPair, SignJWT } from "jose"
import { describe, it, expect } from "vitest"

import { verifyGitLabIdToken, authorizeGitLabUpload, parseAutoCreate } from "./gitlabOidc"

const sha = "a".repeat(40)
const claims = {
  project_id: "42",
  project_path: "example/website",
  ref: "feature",
  ref_type: "branch",
  sha,
  ref_protected: "false",
  pipeline_source: "merge_request_event",
}
const upload = {
  commitSha: sha,
  branch: "feature",
  prNumber: 7,
  baseCommitSha: "b".repeat(40),
  baseBranch: "main",
}

describe("GitLab upload trust", () => {
  it("validates RSA signatures, issuer, audience, and required expiration", async () => {
    const { privateKey, publicKey } = await generateKeyPair("RS256")
    const sign = (
      aud = "https://vizdiff.example.com",
      iss = "https://gitlab.com",
      exp: number | undefined = Math.floor(Date.now() / 1000) + 60,
    ) => {
      const jwt = new SignJWT(claims)
        .setProtectedHeader({ alg: "RS256" })
        .setIssuer(iss)
        .setAudience(aud)
        .setIssuedAt()
      return jwt.setExpirationTime(exp).sign(privateKey)
    }
    expect(
      (await verifyGitLabIdToken(await sign(), "https://vizdiff.example.com", publicKey))
        .project_id,
    ).toBe("42")
    await expect(
      verifyGitLabIdToken(await sign("elsewhere"), "https://vizdiff.example.com", publicKey),
    ).rejects.toThrow()
    await expect(
      verifyGitLabIdToken(
        await sign(undefined, "https://evil.example"),
        "https://vizdiff.example.com",
        publicKey,
      ),
    ).rejects.toThrow()
    await expect(
      verifyGitLabIdToken(
        await sign(undefined, undefined, 1),
        "https://vizdiff.example.com",
        publicKey,
      ),
    ).rejects.toThrow()
    const unsignedExpiry = await new SignJWT(claims)
      .setProtectedHeader({ alg: "RS256" })
      .setIssuer("https://gitlab.com")
      .setAudience("https://vizdiff.example.com")
      .setIssuedAt()
      .sign(privateKey)
    await expect(
      verifyGitLabIdToken(unsignedExpiry, "https://vizdiff.example.com", publicKey),
    ).rejects.toThrow()
    const other = await generateKeyPair("RS256")
    await expect(
      verifyGitLabIdToken(await sign(), "https://vizdiff.example.com", other.publicKey),
    ).rejects.toThrow()
  })
  it("rejects missing, malformed, and attacker-controlled claims and algorithms", async () => {
    const { privateKey, publicKey } = await generateKeyPair("RS256")
    const verify = async (payload: Record<string, unknown>, algorithm = "RS256") => {
      const token = await new SignJWT(payload)
        .setProtectedHeader({ alg: algorithm })
        .setIssuer("https://gitlab.com")
        .setAudience("https://vizdiff.example.com")
        .setIssuedAt()
        .setExpirationTime("1m")
        .sign(privateKey)
      return await verifyGitLabIdToken(token, "https://vizdiff.example.com", publicKey)
    }
    for (const key of Object.keys(claims)) {
      const copy: Record<string, unknown> = { ...claims }
      delete copy[key]
      await expect(verify(copy)).rejects.toThrow()
    }
    for (const patch of [
      { project_id: ["42"] },
      { project_id: "0" },
      { project_path: "../site" },
      { sha: "x" },
      { ref_protected: "yes" },
    ]) {
      await expect(verify({ ...claims, ...patch })).rejects.toThrow()
    }
    const hs = await new SignJWT(claims)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("https://gitlab.com")
      .setAudience("https://vizdiff.example.com")
      .setIssuedAt()
      .setExpirationTime("1m")
      .sign(new TextEncoder().encode("a".repeat(32)))
    await expect(
      verifyGitLabIdToken(hs, "https://vizdiff.example.com", publicKey),
    ).rejects.toThrow()
  })
  it("binds uploads to signed refs and commits", () => {
    expect(() => authorizeGitLabUpload(claims, upload)).not.toThrow()
    for (const forged of [
      { branch: "main" },
      { commitSha: "c".repeat(40) },
      { prNumber: undefined },
      { baseCommitSha: undefined },
    ]) {
      expect(() => authorizeGitLabUpload(claims, { ...upload, ...forged })).toThrow()
    }
  })
  it("only allows protected branch pipelines to upload baselines", () => {
    for (const ref_protected of [true, "true"]) {
      expect(() =>
        authorizeGitLabUpload(
          { ...claims, ref: "main", ref_protected, pipeline_source: "push" },
          { commitSha: sha, branch: "main" },
        ),
      ).not.toThrow()
    }
    for (const ref_protected of [false, "false", "yes", undefined]) {
      expect(() =>
        authorizeGitLabUpload(
          { ...claims, ref: "main", ref_protected },
          { commitSha: sha, branch: "main" },
        ),
      ).toThrow()
    }
    expect(() =>
      authorizeGitLabUpload(
        { ...claims, ref: "main", ref_protected: true },
        { commitSha: sha, branch: "main" },
      ),
    ).toThrow()
    expect(() =>
      authorizeGitLabUpload({ ...claims, ref_type: "tag", ref_protected: true }, upload),
    ).toThrow()
  })
  it("parses exact per-repository owner mappings and refuses ambiguous configuration", () => {
    expect(parseAutoCreate("example/website=owner@example.com").get("example/website")).toBe(
      "owner@example.com",
    )
    for (const value of [
      "example/website",
      "example/website=",
      "example/website=a@example.com,example/website=b@example.com",
      "*=a@example.com",
    ]) {
      expect(() => parseAutoCreate(value)).toThrow("GITLAB_OIDC_AUTO_CREATE")
    }
  })
})

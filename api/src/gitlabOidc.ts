import { createRemoteJWKSet, jwtVerify } from "jose"
import type { JWTVerifyGetKey, JWTPayload } from "jose"

const keys = createRemoteJWKSet(new URL("https://gitlab.com/oauth/discovery/keys"), {
  timeoutDuration: 5000,
})
const SETTING = "GITLAB_OIDC_AUTO_CREATE"
export class UploadAuthError extends Error {
  constructor(
    message: string,
    readonly status = 403,
  ) {
    super(message)
  }
}
export function parseAutoCreate(value: string): Map<string, string> {
  const result = new Map<string, string>()
  for (const entry of value
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)) {
    const [repo, email, extra] = entry.split("=")
    if (
      !repo ||
      !/^[\w][\w.-]*(?:\/[\w][\w.-]*)+$/.test(repo) ||
      !email ||
      !/^[^\s@]+@[^\s@]+$/.test(email) ||
      extra != undefined ||
      result.has(repo)
    ) {
      throw new UploadAuthError(`Invalid ${SETTING}: expected unique repository=owner-email pairs`)
    }
    result.set(repo, email)
  }
  return result
}
export async function verifyGitLabIdToken(
  token: string,
  audience: string,
  key: JWTVerifyGetKey | CryptoKey = keys,
): Promise<JWTPayload> {
  const options = {
    issuer: "https://gitlab.com",
    audience,
    algorithms: ["RS256"],
    requiredClaims: [
      "exp",
      "iat",
      "project_id",
      "project_path",
      "sha",
      "ref",
      "ref_type",
      "ref_protected",
      "pipeline_source",
    ],
  }
  // Overloads distinguish a JWKS resolver from a concrete key.
  const result =
    typeof key === "function"
      ? await jwtVerify(token, key, options)
      : await jwtVerify(token, key, options)
  const c = result.payload
  if (
    (typeof c.project_id !== "string" && typeof c.project_id !== "number") ||
    !/^\d+$/.test(String(c.project_id)) ||
    !Number.isSafeInteger(Number(c.project_id)) ||
    Number(c.project_id) < 1 ||
    typeof c.project_path !== "string" ||
    !/^[\w][\w.-]*(?:\/[\w][\w.-]*)+$/.test(c.project_path) ||
    typeof c.sha !== "string" ||
    !/^[a-f0-9]{40}$/.test(c.sha) ||
    typeof c.pipeline_source !== "string" ||
    typeof c.iat !== "number" ||
    c.iat > Math.floor(Date.now() / 1000) ||
    typeof c.ref !== "string" ||
    !c.ref ||
    (c.ref_protected !== true &&
      c.ref_protected !== false &&
      c.ref_protected !== "true" &&
      c.ref_protected !== "false")
  ) {
    throw new UploadAuthError("Invalid GitLab CI claims", 401)
  }
  return c
}
export type UploadIdentity = {
  commitSha: string
  branch: string
  prNumber?: number
  baseCommitSha?: string
  baseBranch?: string
}
export function authorizeGitLabUpload(c: JWTPayload, upload: UploadIdentity): void {
  if (c.ref_type !== "branch" || c.sha !== upload.commitSha || c.ref !== upload.branch) {
    throw new UploadAuthError("Upload branch and commit must match GitLab CI token")
  }
  const baseline =
    !upload.prNumber ||
    !upload.baseCommitSha ||
    !upload.baseBranch ||
    upload.branch === upload.baseBranch
  if (baseline && !isProtectedBranchUpload(c)) {
    throw new UploadAuthError("Baseline uploads require a protected branch pipeline")
  }
}

export function isProtectedBranchUpload(c: JWTPayload): boolean {
  return (
    c.ref_type === "branch" &&
    (c.ref_protected === true || c.ref_protected === "true") &&
    c.pipeline_source !== "merge_request_event" &&
    c.pipeline_source !== "external_pull_request_event"
  )
}

import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

import { S3_BUCKET_NAME, S3_CLIENT_CONFIG, VCS_IMAGE_URL_TTL_SECONDS } from "./environment"

// Lazily constructed so importing this module has no side effects (presigning is a local signing
// operation, so one shared client is fine).
let s3ClientInstance: S3Client | undefined
function s3Client(): S3Client {
  return (s3ClientInstance ??= new S3Client(S3_CLIENT_CONFIG))
}

interface ImageRefs {
  newImageUrl: string | null
  baselineImageUrl: string | null
  diffImageUrl: string | null
}

/**
 * TestResult image columns store an S3 object key. Legacy rows may hold a full public S3 URL;
 * extract the key from its path so presigning keeps working against those rows too.
 */
function toObjectKey(stored: string): string {
  if (/^https?:\/\//i.test(stored)) {
    try {
      return new URL(stored).pathname.replace(/^\/+/, "")
    } catch {
      return stored
    }
  }
  return stored
}

/** Generate a presigned GET URL for a stored image key (works with private buckets / MinIO). */
export async function presignImageUrl(
  stored: string,
  expiresIn: number = VCS_IMAGE_URL_TTL_SECONDS,
): Promise<string> {
  const command = new GetObjectCommand({ Bucket: S3_BUCKET_NAME, Key: toObjectKey(stored) })
  return await getSignedUrl(s3Client(), command, { expiresIn })
}

/**
 * Pre-resolve every image key referenced by `testResults` into a presigned URL and return a
 * synchronous resolver for the markdown helpers. Uses a long TTL (S3 SigV4 caps presigned URLs at
 * 7 days) because these URLs are embedded in persisted PR/MR comments.
 */
export async function buildImageUrlResolver(
  testResults: ImageRefs[],
  expiresIn: number = VCS_IMAGE_URL_TTL_SECONDS,
): Promise<(stored: string | null) => string | null> {
  const keys = new Set<string>()
  for (const r of testResults) {
    for (const v of [r.newImageUrl, r.baselineImageUrl, r.diffImageUrl]) {
      if (v) {
        keys.add(v)
      }
    }
  }
  const map = new Map<string, string>()
  await Promise.all(
    [...keys].map(async (key) => {
      map.set(key, await presignImageUrl(key, expiresIn))
    }),
  )
  return (stored) => (stored ? (map.get(stored) ?? stored) : stored)
}

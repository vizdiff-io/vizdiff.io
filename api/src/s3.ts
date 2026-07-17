import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

import {
  IMAGE_URL_TTL_SECONDS,
  S3_BUCKET_NAME,
  S3_CLIENT_CONFIG,
  VCS_IMAGE_URL_TTL_SECONDS,
} from "./environment"
import { log } from "./log"

// Lazily constructed so importing this module has no side effects (presigning is a local signing
// operation, so one shared client is fine). Shared with the upload proxy so we don't build a new
// client (and connection pool) per request.
let s3ClientInstance: S3Client | undefined
export function s3Client(): S3Client {
  return (s3ClientInstance ??= new S3Client(S3_CLIENT_CONFIG))
}

// S3 DeleteObjects accepts at most 1000 keys per request.
const DELETE_BATCH_SIZE = 1000

export interface DeletePrefixResult {
  deleted: number
  errors: number
}

/**
 * Delete every object under one or more key prefixes (see `shared/src/s3Keys.ts`). Used to reclaim
 * screenshot storage when a project's owning account is deleted (#132).
 *
 * Lists with {@link ListObjectsV2Command} and removes in batched {@link DeleteObjectsCommand} calls
 * (1000 keys max per request). The operation is best-effort and idempotent: re-running over an
 * already-empty prefix is a no-op, and per-object delete errors are counted and logged rather than
 * thrown, so a partial S3 failure never blocks the caller (account deletion must still succeed).
 *
 * @returns counts of objects successfully deleted and objects that reported a delete error.
 */
export async function deleteObjectsByPrefixes(
  prefixes: readonly string[],
  client: S3Client = s3Client(),
  bucket: string = S3_BUCKET_NAME,
): Promise<DeletePrefixResult> {
  const result: DeletePrefixResult = { deleted: 0, errors: 0 }

  for (const prefix of prefixes) {
    if (!prefix) {
      // Refuse empty prefixes outright: an empty prefix matches the entire bucket.
      log.warn("deleteObjectsByPrefixes: refusing to delete an empty prefix")
      continue
    }

    let continuationToken: string | undefined
    do {
      const listed = await client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      )

      const keys = (listed.Contents ?? [])
        .map((obj) => obj.Key)
        .filter((key): key is string => typeof key === "string")

      for (let i = 0; i < keys.length; i += DELETE_BATCH_SIZE) {
        const batch = keys.slice(i, i + DELETE_BATCH_SIZE)
        const deleteResult = await client.send(
          new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
          }),
        )
        const batchErrors = deleteResult.Errors ?? []
        result.deleted += batch.length - batchErrors.length
        result.errors += batchErrors.length
        for (const err of batchErrors) {
          log.warn(`Failed to delete S3 object ${err.Key ?? "?"}: ${err.Message ?? err.Code ?? ""}`)
        }
      }

      continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined
    } while (continuationToken)
  }

  return result
}

interface ImageRefs {
  newImageUrl: string | null
  baselineImageUrl: string | null
  diffImageUrl: string | null
}

/**
 * TestResult image columns store an S3 object key (see `shared/src/s3Keys.ts` for the layout).
 * Legacy rows may instead hold a full public S3 URL; extract the key from its path so presigning
 * keeps working against those rows too.
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

/**
 * Generate a presigned GET URL for a stored image key. Works with private buckets (and MinIO via
 * S3_ENDPOINT). The default TTL suits short-lived, interactive use (the frontend build viewer).
 */
export async function presignImageUrl(
  stored: string,
  expiresIn: number = IMAGE_URL_TTL_SECONDS,
): Promise<string> {
  const command = new GetObjectCommand({ Bucket: S3_BUCKET_NAME, Key: toObjectKey(stored) })
  return await getSignedUrl(s3Client(), command, { expiresIn })
}

/** Null-safe variant of {@link presignImageUrl}. */
export async function presignImageUrlOrNull(
  stored: string | null,
  expiresIn?: number,
): Promise<string | null> {
  return stored ? await presignImageUrl(stored, expiresIn) : null
}

/**
 * Pre-resolve every image key referenced by `testResults` into a presigned URL and return a
 * synchronous resolver suitable for the markdown helpers (which must stay sync / aws-sdk-free).
 * Uses a long TTL by default (S3 SigV4 caps presigned URLs at 7 days) because these URLs are
 * embedded in persisted PR/MR comments rather than fetched fresh on each view.
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

import { createReadStream, createWriteStream, promises as fs } from "node:fs"
import { dirname, isAbsolute, relative, resolve } from "node:path"
import { tmpdir } from "node:os"
import { pipeline } from "node:stream/promises"
import { Readable } from "node:stream"
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"

export type ObjectStorageBucket = "sessions" | "artifacts"

const BUCKET_ENV: Record<ObjectStorageBucket, string> = {
  sessions: "FLEET_PI_SESSIONS_BUCKET",
  artifacts: "FLEET_PI_ARTIFACTS_BUCKET",
}

let client: S3Client | null = null

export function isObjectStorageEnabled() {
  return Boolean(
    process.env.AWS_ENDPOINT_URL_S3?.trim() &&
    process.env.AWS_ACCESS_KEY_ID?.trim() &&
    process.env.AWS_SECRET_ACCESS_KEY?.trim()
  )
}

function resolveBucketName(bucket: ObjectStorageBucket) {
  const explicit = process.env[BUCKET_ENV[bucket]]?.trim()
  if (explicit) {
    return explicit
  }

  return bucket
}

function getObjectStorageClient() {
  if (!isObjectStorageEnabled()) {
    throw new Error("Object storage is not configured.")
  }

  if (!client) {
    client = new S3Client({
      region: process.env.AWS_REGION?.trim() || "us-east-1",
      endpoint: process.env.AWS_ENDPOINT_URL_S3,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
      forcePathStyle: true,
    })
  }

  return client
}

export function buildSessionObjectKey(userId: string, sessionId: string) {
  return `users/${userId}/sessions/${sessionId}.jsonl`
}

function assertDurableDestinationPath(destinationPath: string) {
  const resolved = resolve(destinationPath)
  const tempRoot = resolve(tmpdir())
  const relativeToTemp = relative(tempRoot, resolved)
  if (
    relativeToTemp === "" ||
    (!relativeToTemp.startsWith("..") && !isAbsolute(relativeToTemp))
  ) {
    throw new Error("Refusing to write object storage downloads under OS temp.")
  }
}

export async function downloadObjectToFile(input: {
  bucket: ObjectStorageBucket
  key: string
  destinationPath: string
}) {
  if (!isObjectStorageEnabled()) {
    return false
  }

  assertDurableDestinationPath(input.destinationPath)

  const response = await getObjectStorageClient().send(
    new GetObjectCommand({
      Bucket: resolveBucketName(input.bucket),
      Key: input.key,
    })
  )

  if (!response.Body) {
    return false
  }

  await fs.mkdir(dirname(input.destinationPath), { recursive: true })

  const body = response.Body
  if (body instanceof Readable) {
    await pipeline(body, createWriteStream(input.destinationPath))
    return true
  }

  const bytes = await body.transformToByteArray()
  await fs.writeFile(input.destinationPath, bytes)
  return true
}

export async function uploadFileToObjectStorage(input: {
  bucket: ObjectStorageBucket
  key: string
  sourcePath: string
  contentType?: string
}) {
  if (!isObjectStorageEnabled()) {
    return false
  }

  await getObjectStorageClient().send(
    new PutObjectCommand({
      Bucket: resolveBucketName(input.bucket),
      Key: input.key,
      Body: createReadStream(input.sourcePath),
      ContentType: input.contentType ?? "application/x-ndjson",
    })
  )

  return true
}

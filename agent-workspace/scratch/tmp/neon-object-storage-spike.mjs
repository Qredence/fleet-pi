/**
 * Proof for private bucket fleet-pi-spike. Not imported by apps/web.
 * Uses Node crypto + fetch (SigV4); no AWS SDK / files-sdk.
 *
 *   node --env-file=.env --env-file=.env.local agent-workspace/scratch/tmp/neon-object-storage-spike.mjs
 */
import { createHash, createHmac } from "node:crypto"

const BUCKET = "fleet-pi-spike"
const KEY = "spike/hello.txt"
const BODY = "fleet-pi neon object storage spike ok\n"

for (const name of [
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_ENDPOINT_URL_S3",
  "AWS_REGION",
]) {
  if (!process.env[name]?.trim()) {
    throw new Error(
      `Missing ${name}. Run neon deploy / neon env pull on fleet-pi-pg18.`
    )
  }
}

const accessKeyId = process.env.AWS_ACCESS_KEY_ID.trim()
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY.trim()
const endpoint = process.env.AWS_ENDPOINT_URL_S3.trim().replace(/\/$/, "")
const region = process.env.AWS_REGION.trim()

function sha256Hex(data) {
  return createHash("sha256").update(data).digest("hex")
}

function hmac(key, data) {
  return createHmac("sha256", key).update(data).digest()
}

function signingKey(dateStamp) {
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp)
  const kRegion = hmac(kDate, region)
  const kService = hmac(kRegion, "s3")
  return hmac(kService, "aws4_request")
}

/**
 * @param {string} method
 * @param {string} path
 * @param {string | Buffer} [body]
 * @param {Record<string, string>} [extraHeaders]
 * @param {Record<string, string>} [query]
 */
async function s3Request(method, path, body = "", extraHeaders = {}, query = {}) {
  const payload =
    typeof body === "string" || Buffer.isBuffer(body) ? body : String(body)
  const payloadHash = sha256Hex(payload)
  const url = new URL(endpoint)
  const host = url.host
  const amzDate = new Date()
    .toISOString()
    .replace(/[:-]|\.\d{3}/g, "")
  const dateStamp = amzDate.slice(0, 8)

  const queryEntries = Object.entries(query)
    .map(([k, v]) => [encodeURIComponent(k), encodeURIComponent(v)])
    .sort(([a], [b]) => a.localeCompare(b))
  const canonicalQuery = queryEntries.map(([k, v]) => `${k}=${v}`).join("&")

  const headers = {
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    ...extraHeaders,
  }
  if (payload && method !== "GET" && method !== "HEAD") {
    headers["content-length"] = String(
      Buffer.byteLength(payload)
    )
  }

  const signedHeaderNames = Object.keys(headers)
    .map((name) => name.toLowerCase())
    .sort()
  const canonicalHeaders = signedHeaderNames
    .map((name) => `${name}:${headers[name].trim()}\n`)
    .join("")
  const signedHeaders = signedHeaderNames.join(";")

  const canonicalRequest = [
    method,
    path,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n")

  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n")

  const signature = createHmac("sha256", signingKey(dateStamp))
    .update(stringToSign)
    .digest("hex")

  const authorization = [
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`,
  ].join(", ")

  const requestUrl = `${endpoint}${path}${canonicalQuery ? `?${canonicalQuery}` : ""}`
  const response = await fetch(requestUrl, {
    method,
    headers: {
      ...headers,
      authorization,
    },
    body: method === "GET" || method === "HEAD" ? undefined : payload,
  })

  const text = await response.text()
  if (!response.ok) {
    throw new Error(
      `S3 ${method} ${path} failed: ${response.status} ${text.slice(0, 500)}`
    )
  }
  return text
}

const objectPath = `/${BUCKET}/${KEY}`

await s3Request("PUT", objectPath, BODY, {
  "content-type": "text/plain; charset=utf-8",
})

const listXml = await s3Request(
  "GET",
  `/${BUCKET}`,
  "",
  {},
  { "list-type": "2", prefix: "spike/" }
)
if (!listXml.includes(`<Key>${KEY}</Key>`) && !listXml.includes(KEY)) {
  throw new Error(`ListObjects did not include uploaded key ${KEY}.`)
}

const downloaded = await s3Request("GET", objectPath)
if (downloaded !== BODY) {
  throw new Error("Downloaded contents did not match upload payload.")
}

console.log("bucket:", BUCKET)
console.log("listed_key:", KEY)
console.log("downloaded_contents:")
console.log(downloaded)
console.log("spike: ok")

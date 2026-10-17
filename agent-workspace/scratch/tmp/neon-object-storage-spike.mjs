/**
 * Proof for private bucket fleet-pi-spike. Not imported by apps/web.
 *
 *   node --env-file=.env --env-file=.env.local agent-workspace/scratch/tmp/neon-object-storage-spike.mjs
 */
import { Files } from "files-sdk"
import { neon } from "files-sdk/neon"

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

const files = new Files({ adapter: neon({ bucket: BUCKET }) })

await files.upload(KEY, BODY, { contentType: "text/plain; charset=utf-8" })

const listed = await files.list({ prefix: "spike/" })
const entries = Array.isArray(listed) ? listed : (listed?.objects ?? [])
const keys = entries
  .map((entry) =>
    typeof entry === "string" ? entry : (entry?.key ?? entry?.Key ?? "")
  )
  .filter(Boolean)

const downloaded = await files.download(KEY)
const text =
  typeof downloaded === "string"
    ? downloaded
    : typeof downloaded?.text === "function"
      ? await downloaded.text()
      : String(downloaded)

console.log("bucket:", BUCKET)
console.log("listed_keys:", keys.join(", ") || "(none)")
console.log("downloaded_contents:")
console.log(text)
if (!text.includes("fleet-pi neon object storage spike ok")) {
  throw new Error("Downloaded contents did not match upload payload.")
}
console.log("spike: ok")

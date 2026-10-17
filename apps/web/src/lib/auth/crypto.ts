import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
} from "node:crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 16
const SALT_LENGTH = 16
const KEY_LENGTH = 32
const MAX_DERIVED_KEYS = 256
const derivedKeyCache = new Map<string, Buffer>()

function getDerivedKey(password: string, salt: Buffer): Buffer {
  const cacheKey = `${salt.toString("hex")}:${createHash("sha256").update(password).digest("hex")}`
  const cached = derivedKeyCache.get(cacheKey)
  if (cached) {
    derivedKeyCache.delete(cacheKey)
    derivedKeyCache.set(cacheKey, cached)
    return cached
  }
  const derived = scryptSync(password, salt, KEY_LENGTH)
  if (derivedKeyCache.size >= MAX_DERIVED_KEYS) {
    const oldest = derivedKeyCache.keys().next().value
    if (oldest !== undefined) derivedKeyCache.delete(oldest)
  }
  derivedKeyCache.set(cacheKey, derived)
  return derived
}

export function encryptString(text: string, secret: string): string {
  if (!text) return text

  const iv = randomBytes(IV_LENGTH)
  const salt = randomBytes(SALT_LENGTH)
  const key = getDerivedKey(secret, salt)

  const cipher = createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(text, "utf8", "hex")
  encrypted += cipher.final("hex")

  const tag = cipher.getAuthTag()

  // Format: salt:iv:tag:encryptedData
  return `${salt.toString("hex")}:${iv.toString("hex")}:${tag.toString("hex")}:${encrypted}`
}

export function decryptString(
  encryptedText: string,
  secret: string
): string | null {
  if (!encryptedText) return null

  try {
    const parts = encryptedText.split(":")
    if (parts.length !== 4) return null

    const [saltHex, ivHex, tagHex, dataHex] = parts
    if (!saltHex || !ivHex || !tagHex || !dataHex) return null

    const salt = Buffer.from(saltHex, "hex")
    const iv = Buffer.from(ivHex, "hex")
    const tag = Buffer.from(tagHex, "hex")
    const key = getDerivedKey(secret, salt)

    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)

    let decrypted = decipher.update(dataHex, "hex", "utf8")
    decrypted += decipher.final("utf8")

    return decrypted
  } catch (error) {
    // Return null if decryption fails (e.g., wrong secret or corrupted data)
    return null
  }
}

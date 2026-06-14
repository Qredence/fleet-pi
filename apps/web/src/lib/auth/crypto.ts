import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 16
const SALT_LENGTH = 16
const KEY_LENGTH = 32

function getDerivedKey(password: string, salt: Buffer): Buffer {
  return scryptSync(password, salt, KEY_LENGTH)
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

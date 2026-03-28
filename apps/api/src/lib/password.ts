// PBKDF2 password hashing using Web Crypto API (available in Cloudflare Workers)

const ITERATIONS = 100_000
const HASH = 'SHA-256'
const KEY_LENGTH = 32 // 256 bits

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes
}

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const salt = crypto.getRandomValues(new Uint8Array(16))

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )

  const hashBuffer = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: HASH },
    keyMaterial,
    KEY_LENGTH * 8,
  )

  return `${toHex(salt.buffer as ArrayBuffer)}:${toHex(hashBuffer)}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':')
  if (!saltHex || !hashHex) return false

  const encoder = new TextEncoder()
  const salt = fromHex(saltHex)

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )

  const hashBuffer = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: HASH },
    keyMaterial,
    KEY_LENGTH * 8,
  )

  const candidateHex = toHex(hashBuffer)

  // Constant-time comparison
  if (candidateHex.length !== hashHex.length) return false
  let diff = 0
  for (let i = 0; i < candidateHex.length; i++) {
    diff |= candidateHex.charCodeAt(i) ^ hashHex.charCodeAt(i)
  }
  return diff === 0
}

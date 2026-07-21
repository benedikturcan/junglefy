import { createHash, randomBytes } from 'crypto'

const API_KEY_PREFIX = 'jfy'
const API_KEY_ENV = 'live'
const API_KEY_LENGTH = 32

/**
 * Generate a new API key
 * Format: jfy_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 */
export function generateApiKey(): { key: string; prefix: string; hash: string } {
  // Generate random bytes and convert to base62
  const randomPart = randomBytes(API_KEY_LENGTH)
    .toString('base64')
    .replace(/[+/=]/g, '')
    .substring(0, API_KEY_LENGTH)

  const key = `${API_KEY_PREFIX}_${API_KEY_ENV}_${randomPart}`
  const prefix = `${API_KEY_PREFIX}_${API_KEY_ENV}_${randomPart.substring(0, 8)}`
  const hash = hashApiKey(key)

  return { key, prefix, hash }
}

/**
 * Hash an API key using SHA-256
 */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

/**
 * Verify an API key against a stored hash
 */
export function verifyApiKey(key: string, storedHash: string): boolean {
  const keyHash = hashApiKey(key)
  // Constant-time comparison to prevent timing attacks
  if (keyHash.length !== storedHash.length) return false
  
  let result = 0
  for (let i = 0; i < keyHash.length; i++) {
    result |= keyHash.charCodeAt(i) ^ storedHash.charCodeAt(i)
  }
  return result === 0
}

/**
 * Extract prefix from a full API key
 */
export function extractKeyPrefix(key: string): string {
  const parts = key.split('_')
  if (parts.length < 3 || !parts[2]) return ''
  // Return first 8 chars of the random part
  return `${parts[0]}_${parts[1]}_${parts[2].substring(0, 8)}`
}

/**
 * Validate API key format
 */
export function isValidApiKeyFormat(key: string): boolean {
  const pattern = new RegExp(`^${API_KEY_PREFIX}_${API_KEY_ENV}_[a-zA-Z0-9]{${API_KEY_LENGTH}}$`)
  return pattern.test(key)
}

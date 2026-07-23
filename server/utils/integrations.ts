import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16

export interface IntegrationRecord {
  id: string
  organization_id: string
  provider_code: string
  status: 'active' | 'paused' | 'error'
  config: Record<string, unknown>
  encrypted_credentials: string | null
  scopes_granted: string[]
  last_used_at: string | null
  error_message: string | null
}

export interface IntegrationProvider {
  code: string
  name: string
  authType: 'api_key' | 'oauth2' | 'webhook_only'
  capabilities: string[]
  configSchema: Record<string, unknown>
}

export interface IntegrationEventContext {
  integration: IntegrationRecord
  provider: IntegrationProvider
  eventType: string
  payload: unknown
  serviceClient: SupabaseClient
}

export interface IntegrationHandler {
  code: string
  validateConfig?(config: unknown, credentials: unknown): { success: boolean; error?: string }
  handleEvent(ctx: IntegrationEventContext): Promise<{ success: boolean; error?: string; data?: unknown }>
}

const handlers = new Map<string, IntegrationHandler>()

export function registerIntegrationHandler(handler: IntegrationHandler): void {
  handlers.set(handler.code, handler)
}

export function getIntegrationHandler(code: string): IntegrationHandler | undefined {
  return handlers.get(code)
}

export function getEncryptionKey(): string {
  const key = process.env.INTEGRATION_ENCRYPTION_KEY
  if (!key) {
    throw new Error('INTEGRATION_ENCRYPTION_KEY environment variable is not set')
  }
  const buf = Buffer.from(key, 'hex')
  if (buf.length !== 32) {
    throw new Error('INTEGRATION_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)')
  }
  return key
}

export function encryptCredentials(plainText: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, Buffer.from(key, 'hex'), iv)

  let encrypted = cipher.update(plainText, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag()

  const payload = {
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    data: encrypted,
  }

  return Buffer.from(JSON.stringify(payload)).toString('base64')
}

export function decryptCredentials(cipherText: string): string {
  const key = getEncryptionKey()
  const payload = JSON.parse(Buffer.from(cipherText, 'base64').toString('utf8')) as {
    iv: string
    authTag: string
    data: string
  }

  const iv = Buffer.from(payload.iv, 'hex')
  const authTag = Buffer.from(payload.authTag, 'hex')

  const decipher = createDecipheriv(ALGORITHM, Buffer.from(key, 'hex'), iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(payload.data, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

export function maskCredentials(value: string | null | undefined): string | undefined {
  if (!value) return undefined
  return '••••••••'
}

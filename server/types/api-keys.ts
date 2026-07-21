import { z } from 'zod'

// ============================================
// API KEY PERMISSIONS
// ============================================

export const ApiKeyPermissionSchema = z.enum([
  'read:products',
  'write:products',
  'read:categories',
  'write:categories',
  'read:orders',
  'write:orders',
  'read:customers',
  'write:customers',
  'read:inventory',
  'write:inventory',
  'read:users',
  'write:users',
  'full_access',
])

export type ApiKeyPermission = z.infer<typeof ApiKeyPermissionSchema>

// Permissions that location_owner can assign
export const LOCATION_OWNER_ALLOWED_PERMISSIONS: ApiKeyPermission[] = [
  'read:products',
  'write:products',
  'read:orders',
  'write:orders',
  'read:inventory',
  'write:inventory',
  'read:users',
]

// ============================================
// EXPIRATION OPTIONS
// ============================================

export const ExpirationOptionSchema = z.enum([
  '30_days',
  '90_days',
  '1_year',
  'unlimited',
])

export type ExpirationOption = z.infer<typeof ExpirationOptionSchema>

export function getExpirationDate(option: ExpirationOption): Date | null {
  const now = new Date()
  switch (option) {
    case '30_days':
      return new Date(now.setDate(now.getDate() + 30))
    case '90_days':
      return new Date(now.setDate(now.getDate() + 90))
    case '1_year':
      return new Date(now.setFullYear(now.getFullYear() + 1))
    case 'unlimited':
      return null
  }
}

// ============================================
// API KEY SCHEMA
// ============================================

export const ApiKeySchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  keyPrefix: z.string(),
  permissions: z.array(ApiKeyPermissionSchema),
  locationIds: z.array(z.string().uuid()).nullable().optional(),
  ipWhitelist: z.array(z.string()).nullable().optional(),
  lastUsedAt: z.string().datetime().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  isActive: z.boolean(),
  createdBy: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type ApiKey = z.infer<typeof ApiKeySchema>

// Response when creating a key (includes the actual key, shown only once)
export interface ApiKeyCreateResponse {
  apiKey: ApiKey
  key: string // The actual key - only shown once!
}

// ============================================
// CREATE API KEY
// ============================================

export const CreateApiKeySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  permissions: z.array(ApiKeyPermissionSchema).min(1),
  locationIds: z.array(z.string().uuid()).optional(),
  ipWhitelist: z.array(z.string()).optional(),
  expiration: ExpirationOptionSchema,
})

export type CreateApiKey = z.infer<typeof CreateApiKeySchema>

// ============================================
// UPDATE API KEY
// ============================================

export const UpdateApiKeySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  permissions: z.array(ApiKeyPermissionSchema).min(1).optional(),
  locationIds: z.array(z.string().uuid()).nullable().optional(),
  ipWhitelist: z.array(z.string()).nullable().optional(),
  isActive: z.boolean().optional(),
})

export type UpdateApiKey = z.infer<typeof UpdateApiKeySchema>

// ============================================
// API KEY CONTEXT (set by middleware)
// ============================================

export interface ApiKeyContext {
  keyId: string
  organizationId: string
  permissions: ApiKeyPermission[]
  locationIds: string[] | null
}

// ============================================
// CONSTANTS
// ============================================

export const API_KEY_PREFIX = 'jfy'
export const API_KEY_ENV = 'live' // Could be 'test' for sandbox
export const API_KEY_LENGTH = 32
export const MAX_API_KEYS_PER_ORG = 20

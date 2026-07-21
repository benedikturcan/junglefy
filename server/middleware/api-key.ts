import { serverSupabaseServiceRole } from '#supabase/server'
import { extractKeyPrefix, verifyApiKey, isValidApiKeyFormat } from '#server/utils/api-key'
import type { ApiKeyPermission } from '#server/types/api-keys'

export interface ApiKeyAuthContext {
  keyId: string
  organizationId: string
  permissions: ApiKeyPermission[]
  locationIds: string[] | null
}

declare module 'h3' {
  interface H3EventContext {
    apiKey?: ApiKeyAuthContext
  }
}

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname

  // Only apply to /api/v1/* routes (not /api/health, /api/auth, etc.)
  if (!path.startsWith('/api/v1/')) {
    return
  }

  // Skip if already authenticated via JWT (Supabase session)
  // JWT auth is handled by Supabase middleware
  const authHeader = getHeader(event, 'authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return
  }

  // Check for API key
  const apiKey = getHeader(event, 'x-api-key')
  
  if (!apiKey) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'Missing authentication. Provide either Authorization header or X-API-Key header.',
    })
  }

  // Validate format
  if (!isValidApiKeyFormat(apiKey)) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'Invalid API key format.',
    })
  }

  // Get Supabase service client (bypasses RLS)
  const supabase = await serverSupabaseServiceRole(event)

  // Find key by prefix
  const keyPrefix = extractKeyPrefix(apiKey)
  
  const { data: keyData, error } = await supabase
    .from('api_keys')
    .select('id, organization_id, key_hash, permissions, location_ids, ip_whitelist, expires_at, is_active')
    .eq('key_prefix', keyPrefix)
    .eq('is_active', true)
    .single()

  if (error || !keyData) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'Invalid API key.',
    })
  }

  // Verify hash
  if (!verifyApiKey(apiKey, keyData.key_hash)) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'Invalid API key.',
    })
  }

  // Check expiration
  if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'API key has expired.',
    })
  }

  // Check IP whitelist
  if (keyData.ip_whitelist && keyData.ip_whitelist.length > 0) {
    const clientIp = getHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim() 
      || getHeader(event, 'x-real-ip')
      || '0.0.0.0'

    // Use database function to validate IP
    const { data: ipValid } = await supabase
      .rpc('validate_api_key_ip', { key_id: keyData.id, client_ip: clientIp })

    if (!ipValid) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden',
        message: 'IP address not allowed for this API key.',
      })
    }
  }

  // Set context for route handlers
  event.context.apiKey = {
    keyId: keyData.id,
    organizationId: keyData.organization_id,
    permissions: keyData.permissions as ApiKeyPermission[],
    locationIds: keyData.location_ids,
  }

  // Update last_used_at (fire and forget)
  supabase.rpc('update_api_key_last_used', { key_id: keyData.id }).then()
})

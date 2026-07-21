import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { generateApiKey } from '#server/utils/api-key'
import { CreateApiKeySchema, getExpirationDate, LOCATION_OWNER_ALLOWED_PERMISSIONS } from '#server/types/api-keys'
import type { ApiKeyPermission } from '#server/types/api-keys'

defineRouteMeta({
  openAPI: {
    tags: ['API Keys'],
    summary: 'Create a new API key',
    description: 'Creates a new API key for the specified organization. The key is only shown once in the response. Requires JWT authentication and organization_owner or location_owner role.',
    security: [{ bearerAuth: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['name', 'permissions', 'expiration', 'organizationId'],
            properties: {
              organizationId: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
              description: { type: 'string' },
              permissions: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['read:products', 'write:products', 'read:categories', 'write:categories', 'read:orders', 'write:orders', 'read:customers', 'write:customers', 'read:inventory', 'write:inventory', 'full_access'],
                },
              },
              locationIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
              ipWhitelist: { type: 'array', items: { type: 'string' } },
              expiration: { type: 'string', enum: ['30_days', '90_days', '1_year', 'unlimited'] },
            },
          },
        },
      },
    },
    responses: {
      200: {
        description: 'API key created successfully. The key is only shown once!',
      },
      400: {
        description: 'Bad request - invalid input or API key limit reached',
      },
      401: {
        description: 'Unauthorized - JWT authentication required',
      },
      403: {
        description: 'Forbidden - insufficient permissions',
      },
    },
  },
})

export default defineEventHandler(async (event) => {
  // Require JWT authentication
  const user = await serverSupabaseUser(event)
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'Authentication required. Please login.',
    })
  }

  const body = await readBody(event)

  // Validate input
  const result = CreateApiKeySchema.safeParse(body)
  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Invalid request body.',
      data: result.error.flatten(),
    })
  }

  const { name, description, permissions, locationIds, ipWhitelist, expiration } = result.data

  // Get organization_id from query or body
  const organizationId = getQuery(event).organization_id as string || body.organizationId
  if (!organizationId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'organization_id is required.',
    })
  }

  const client = await serverSupabaseClient(event)

  // Check user's role in this organization
  const { data: membership } = await client
    .from('organization_members')
    .select('role, location_id')
    .eq('user_id', user.id)
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .single()

  if (!membership) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      message: 'You do not have access to this organization.',
    })
  }

  const isOrgOwner = membership.role === 'organization_owner'
  const isLocationOwner = membership.role === 'location_owner'

  if (!isOrgOwner && !isLocationOwner) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      message: 'Only organization owners and location owners can create API keys.',
    })
  }

  // Location owners can only assign certain permissions
  if (isLocationOwner) {
    const invalidPermissions = permissions.filter(
      (p: ApiKeyPermission) => !LOCATION_OWNER_ALLOWED_PERMISSIONS.includes(p)
    )
    if (invalidPermissions.length > 0) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden',
        message: `Location owners cannot assign these permissions: ${invalidPermissions.join(', ')}`,
      })
    }

    // Location owners must specify their own location
    if (!locationIds || locationIds.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: 'Location owners must specify location_ids for the API key.',
      })
    }
  }

  // Generate the key
  const { key, prefix, hash } = generateApiKey()
  const expiresAt = getExpirationDate(expiration)

  // Insert into database
  const { data: apiKey, error } = await client
    .from('api_keys')
    .insert({
      organization_id: organizationId,
      name,
      description: description || null,
      key_hash: hash,
      key_prefix: prefix,
      permissions,
      location_ids: locationIds || null,
      ip_whitelist: ipWhitelist || null,
      expires_at: expiresAt?.toISOString() || null,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) {
    // Check for limit error
    if (error.message?.includes('API key limit reached')) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: 'API key limit reached. Maximum 20 keys per organization.',
      })
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Failed to create API key.',
    })
  }

  // Return the key (only shown once!)
  return {
    success: true,
    data: {
      apiKey: {
        id: apiKey.id,
        organizationId: apiKey.organization_id,
        name: apiKey.name,
        description: apiKey.description,
        keyPrefix: apiKey.key_prefix,
        permissions: apiKey.permissions,
        locationIds: apiKey.location_ids,
        ipWhitelist: apiKey.ip_whitelist,
        expiresAt: apiKey.expires_at,
        isActive: apiKey.is_active,
        createdBy: apiKey.created_by,
        createdAt: apiKey.created_at,
        updatedAt: apiKey.updated_at,
      },
      key, // The actual key - ONLY SHOWN ONCE!
    },
    message: 'API key created successfully. Please save the key now - it will not be shown again.',
  }
})

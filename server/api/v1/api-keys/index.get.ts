import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'

defineRouteMeta({
  openAPI: {
    tags: ['API Keys'],
    summary: 'List all API keys',
    description: 'Returns all API keys for the authenticated user\'s organizations. Requires JWT authentication.',
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        description: 'List of API keys',
      },
      401: {
        description: 'Unauthorized - JWT authentication required',
      },
    },
  },
})

export default defineEventHandler(async (event) => {
  // Require JWT authentication (not API key)
  const user = await serverSupabaseUser(event)
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'Authentication required. Please login.',
    })
  }

  const client = await serverSupabaseClient(event)

  // Get API keys for user's organizations (RLS handles filtering)
  const { data: apiKeys, error } = await client
    .from('api_keys')
    .select(`
      id,
      organization_id,
      name,
      description,
      key_prefix,
      permissions,
      location_ids,
      ip_whitelist,
      last_used_at,
      expires_at,
      is_active,
      created_by,
      created_at,
      updated_at
    `)
    .order('created_at', { ascending: false })

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Failed to fetch API keys.',
    })
  }

  return {
    success: true,
    data: apiKeys,
  }
})

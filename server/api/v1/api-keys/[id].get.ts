import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'

defineRouteMeta({
  openAPI: {
    tags: ['API Keys'],
    summary: 'Get API key details',
    description: 'Returns details of a specific API key. Requires JWT authentication.',
    security: [{ bearerAuth: [] }],
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
        description: 'API key ID',
      },
    ],
    responses: {
      200: { description: 'API key details' },
      401: { description: 'Unauthorized' },
      404: { description: 'API key not found' },
    },
  },
})

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'Authentication required. Please login.',
    })
  }

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'API key ID is required.',
    })
  }

  const client = await serverSupabaseClient(event)

  const { data: apiKey, error } = await client
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
    .eq('id', id)
    .single()

  if (error || !apiKey) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'API key not found.',
    })
  }

  return {
    success: true,
    data: apiKey,
  }
})

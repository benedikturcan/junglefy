import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { UpdateApiKeySchema } from '#server/types/api-keys'

defineRouteMeta({
  openAPI: {
    tags: ['API Keys'],
    summary: 'Update an API key',
    description: 'Updates an existing API key. Requires JWT authentication.',
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
    requestBody: {
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              description: { type: 'string' },
              permissions: { type: 'array', items: { type: 'string' } },
              locationIds: { type: 'array', items: { type: 'string' } },
              ipWhitelist: { type: 'array', items: { type: 'string' } },
              isActive: { type: 'boolean' },
            },
          },
        },
      },
    },
    responses: {
      200: { description: 'API key updated successfully' },
      400: { description: 'Bad request' },
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

  const body = await readBody(event)

  const result = UpdateApiKeySchema.safeParse(body)
  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Invalid request body.',
      data: result.error.flatten(),
    })
  }

  const updates = result.data
  const client = await serverSupabaseClient(event)

  // Build update object (convert camelCase to snake_case)
  const updateData: Record<string, unknown> = {}
  if (updates.name !== undefined) updateData.name = updates.name
  if (updates.description !== undefined) updateData.description = updates.description
  if (updates.permissions !== undefined) updateData.permissions = updates.permissions
  if (updates.locationIds !== undefined) updateData.location_ids = updates.locationIds
  if (updates.ipWhitelist !== undefined) updateData.ip_whitelist = updates.ipWhitelist
  if (updates.isActive !== undefined) updateData.is_active = updates.isActive

  const { data: apiKey, error } = await client
    .from('api_keys')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Failed to update API key.',
    })
  }

  if (!apiKey) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'API key not found or you do not have permission to update it.',
    })
  }

  return {
    success: true,
    data: apiKey,
  }
})

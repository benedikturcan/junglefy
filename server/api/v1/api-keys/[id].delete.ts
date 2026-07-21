import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'

defineRouteMeta({
  openAPI: {
    tags: ['API Keys'],
    summary: 'Delete an API key',
    description: 'Permanently deletes an API key. This action cannot be undone. Requires JWT authentication.',
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
      200: { description: 'API key deleted successfully' },
      401: { description: 'Unauthorized' },
      404: { description: 'API key not found' },
      500: { description: 'Internal server error' },
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

  // Delete the API key (RLS ensures user has permission)
  const { error } = await client
    .from('api_keys')
    .delete()
    .eq('id', id)

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Failed to delete API key.',
    })
  }

  return {
    success: true,
    message: 'API key deleted successfully.',
  }
})

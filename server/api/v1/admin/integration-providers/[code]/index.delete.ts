import { serverSupabaseClient } from '#supabase/server'
import { requirePlatformAdmin } from '#server/utils/auth-guards'

defineRouteMeta({
  openAPI: {
    tags: ['Admin'],
    summary: 'Delete integration provider',
    description:
      'Removes an integration provider from the marketplace. Platform admin only — API keys and regular users are not allowed.',
    security: [{ bearerAuth: [] }],
    parameters: [
      {
        name: 'code',
        in: 'path',
        required: true,
        schema: { type: 'string' },
      },
    ],
    responses: {
      200: { description: 'Provider deleted' },
      401: { description: 'Unauthorized' },
      403: { description: 'Forbidden' },
      404: { description: 'Not found' },
    },
  },
})

export default defineEventHandler(async (event) => {
  await requirePlatformAdmin(event)

  const code = getRouterParam(event, 'code')
  if (!code) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Provider code is required.',
    })
  }

  const client = await serverSupabaseClient(event)
  const { error } = await client.from('integration_providers').delete().eq('code', code)

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Failed to delete provider.',
    })
  }

  return {
    success: true,
    data: { deleted: true },
  }
})

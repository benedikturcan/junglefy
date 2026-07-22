import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import type { ApiKeyContext } from '#server/types/api-keys'

defineRouteMeta({
  openAPI: {
    tags: ['Integrations'],
    summary: 'List integration providers',
    description: 'Returns the marketplace of available third-party integrations.',
    security: [{ bearerAuth: [] }, { apiKey: [] }],
    responses: {
      200: { description: 'List of providers' },
      401: { description: 'Unauthorized' },
    },
  },
})

export default defineEventHandler(async (event) => {
  const apiKey = event.context.apiKey as ApiKeyContext | undefined
  const user = await serverSupabaseUser(event)

  if (!apiKey && !user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'Authentication required.',
    })
  }

  const client = await serverSupabaseClient(event)

  const { data: providers, error } = await client
    .from('integration_providers')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Failed to fetch integration providers.',
    })
  }

  return {
    success: true,
    data: providers || [],
  }
})

import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import type { ApiKeyContext } from '#server/types/api-keys'
import { maskCredentials } from '#server/utils/integrations'

defineRouteMeta({
  openAPI: {
    tags: ['Integrations'],
    summary: 'Get integration',
    description: 'Returns a single integration configuration.',
    security: [{ bearerAuth: [] }, { apiKey: [] }],
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
    ],
    responses: {
      200: { description: 'Integration details' },
      401: { description: 'Unauthorized' },
      403: { description: 'Forbidden' },
      404: { description: 'Not found' },
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

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Integration ID is required.',
    })
  }

  const client = await serverSupabaseClient(event)
  let organizationId: string

  if (apiKey) {
    if (!apiKey.permissions.includes('full_access')) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden',
        message: 'Missing required permission: full_access',
      })
    }
    organizationId = apiKey.organizationId
  } else {
    const { data: member, error: memberError } = await client
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user!.id)
      .single()

    if (memberError || !member) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden',
        message: 'Organization membership required.',
      })
    }

    organizationId = (member as { organization_id: string }).organization_id
  }

  const { data: integration, error } = await client
    .from('integrations')
    .select('*, integration_providers(*)')
    .eq('id', id)
    .eq('organization_id', organizationId)
    .single()

  if (error || !integration) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'Integration not found.',
    })
  }

  const row = integration as Record<string, unknown>
  row.encrypted_credentials = maskCredentials(row.encrypted_credentials as string | null | undefined)

  return {
    success: true,
    data: row,
  }
})

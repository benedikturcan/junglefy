import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import type { ApiKeyContext } from '#server/types/api-keys'
import { maskCredentials } from '#server/utils/integrations'

defineRouteMeta({
  openAPI: {
    tags: ['Integrations'],
    summary: 'List organization integrations',
    description: 'Returns all configured integrations for the current organization.',
    security: [{ bearerAuth: [] }, { apiKey: [] }],
    responses: {
      200: { description: 'List of integrations' },
      401: { description: 'Unauthorized' },
      403: { description: 'Forbidden' },
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

  const { data: integrations, error } = await client
    .from('integrations')
    .select('*, integration_providers(*)')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Failed to fetch integrations.',
    })
  }

  return {
    success: true,
    data: (integrations || []).map((row: Record<string, unknown>) => ({
      ...row,
      encrypted_credentials: maskCredentials(row.encrypted_credentials as string | null | undefined),
    })),
  }
})

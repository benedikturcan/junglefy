import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { UpdateIntegrationSchema } from '#server/types/integrations'
import { encryptCredentials, maskCredentials } from '#server/utils/integrations'
import type { ApiKeyContext } from '#server/types/api-keys'

defineRouteMeta({
  openAPI: {
    tags: ['Integrations'],
    summary: 'Update integration',
    description: 'Updates an integration configuration.',
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
      200: { description: 'Integration updated' },
      400: { description: 'Bad request' },
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

  const body = await readBody(event)
  const parse = UpdateIntegrationSchema.safeParse(body)
  if (!parse.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: parse.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', '),
    })
  }

  const data = parse.data
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
      .select('role, organization_id')
      .eq('user_id', user!.id)
      .single()

    if (memberError || !member) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden',
        message: 'Organization membership required.',
      })
    }

    const role = (member as { role: string }).role
    if (role !== 'organization_owner' && role !== 'location_owner') {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden',
        message: 'Insufficient permissions.',
      })
    }

    organizationId = (member as { organization_id: string }).organization_id
  }

  const updateData: Record<string, unknown> = {}
  if (data.status !== undefined) updateData.status = data.status
  if (data.config !== undefined) updateData.config = data.config
  if (data.credentials !== undefined) {
    updateData.encrypted_credentials = encryptCredentials(JSON.stringify(data.credentials))
  }
  if (data.scopesGranted !== undefined) updateData.scopes_granted = data.scopesGranted

  if (Object.keys(updateData).length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'No fields to update.',
    })
  }

  const { data: integration, error } = await client
    .from('integrations')
    .update(updateData as never)
    .eq('id', id)
    .eq('organization_id', organizationId)
    .select('*, integration_providers(*)')
    .single()

  if (error || !integration) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'Integration not found or update failed.',
    })
  }

  const row = integration as Record<string, unknown>
  row.encrypted_credentials = maskCredentials(row.encrypted_credentials as string | null | undefined)

  return {
    success: true,
    data: row,
  }
})

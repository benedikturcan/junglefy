import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { CreateIntegrationSchema } from '#server/types/integrations'
import { encryptCredentials, getIntegrationHandler } from '#server/utils/integrations'
import type { ApiKeyContext } from '#server/types/api-keys'

defineRouteMeta({
  openAPI: {
    tags: ['Integrations'],
    summary: 'Create integration',
    description: 'Activates a third-party integration for the organization.',
    security: [{ bearerAuth: [] }, { apiKey: [] }],
    responses: {
      201: { description: 'Integration created' },
      400: { description: 'Bad request' },
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

  const body = await readBody(event)
  const parse = CreateIntegrationSchema.safeParse(body)
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

  const { data: provider, error: providerError } = await client
    .from('integration_providers')
    .select('*')
    .eq('code', data.providerCode)
    .eq('is_active', true)
    .single()

  if (providerError || !provider) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Unknown or inactive integration provider.',
    })
  }

  const handler = getIntegrationHandler(data.providerCode)
  if (handler?.validateConfig) {
    const validation = handler.validateConfig(data.config, data.credentials)
    if (!validation.success) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: validation.error || 'Invalid integration configuration',
      })
    }
  }

  const encryptedCredentials = data.credentials
    ? encryptCredentials(JSON.stringify(data.credentials))
    : null

  const insertData = {
    organization_id: organizationId,
    provider_code: data.providerCode,
    status: data.status,
    config: data.config,
    encrypted_credentials: encryptedCredentials,
    scopes_granted: data.scopesGranted,
  }

  const { data: integration, error } = await client
    .from('integrations')
    .insert(insertData as never)
    .select('*, integration_providers(*)')
    .single()

  if (error || !integration) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Failed to create integration.',
    })
  }

  const integrationRow = integration as Record<string, unknown>
  delete integrationRow.encrypted_credentials

  setResponseStatus(event, 201)
  return {
    success: true,
    data: integrationRow,
  }
})

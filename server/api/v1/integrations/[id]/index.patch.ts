import { UpdateIntegrationSchema } from '#server/types/integrations'
import { decryptCredentials, encryptCredentials, getIntegrationHandler, maskCredentials } from '#server/utils/integrations'
import { requireOrganizationOwner } from '#server/utils/auth-guards'

defineRouteMeta({
  openAPI: {
    tags: ['Integrations'],
    summary: 'Update integration',
    description: 'Updates an integration configuration.',
    security: [{ bearerAuth: [] }],
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
  const { client, organizationId } = await requireOrganizationOwner(event)

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

  const { data: existing, error: existingError } = await client
    .from('integrations')
    .select('*')
    .eq('id', id)
    .eq('organization_id', organizationId)
    .single()

  if (existingError || !existing) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'Integration not found.',
    })
  }

  const existingRow = existing as Record<string, unknown>

  const handler = getIntegrationHandler(existingRow.provider_code as string)
  if (handler?.validateConfig) {
    const mergedConfig = data.config !== undefined ? data.config : (existingRow.config as Record<string, unknown>)
    let mergedCredentials: unknown
    if (data.credentials !== undefined) {
      mergedCredentials = data.credentials
    } else if (existingRow.encrypted_credentials) {
      try {
        mergedCredentials = JSON.parse(decryptCredentials(existingRow.encrypted_credentials as string))
      } catch {
        mergedCredentials = undefined
      }
    }

    const validation = handler.validateConfig(mergedConfig, mergedCredentials)
    if (!validation.success) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: validation.error || 'Invalid integration configuration',
      })
    }
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

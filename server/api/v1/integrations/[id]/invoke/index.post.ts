import { serverSupabaseServiceRole } from '#supabase/server'
import { InvokeIntegrationSchema } from '#server/types/integrations'
import { getIntegrationHandler } from '#server/utils/integrations'
import { requireOrganizationMember } from '#server/utils/auth-guards'
import type { IntegrationEventContext, IntegrationRecord } from '#server/utils/integrations'

defineRouteMeta({
  openAPI: {
    tags: ['Integrations'],
    summary: 'Invoke integration',
    description: 'Sends an event payload to the configured integration handler.',
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
      200: { description: 'Invocation result' },
      400: { description: 'Bad request' },
      401: { description: 'Unauthorized' },
      403: { description: 'Forbidden' },
      404: { description: 'Not found' },
      500: { description: 'Handler error' },
    },
  },
})

export default defineEventHandler(async (event) => {
  const { client, organizationId } = await requireOrganizationMember(event, [
    'organization_owner',
    'location_owner',
  ])

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Integration ID is required.',
    })
  }

  const body = await readBody(event)
  const parse = InvokeIntegrationSchema.safeParse(body)
  if (!parse.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: parse.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', '),
    })
  }

  const data = parse.data

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

  const integrationRow = integration as unknown as IntegrationRecord
  if (integrationRow.status !== 'active') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Integration is not active.',
    })
  }

  const { data: provider, error: providerError } = await client
    .from('integration_providers')
    .select('*')
    .eq('code', integrationRow.provider_code)
    .single()

  if (providerError || !provider) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Integration provider not found.',
    })
  }

  const handler = getIntegrationHandler(integrationRow.provider_code)
  if (!handler) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: `No handler registered for provider ${integrationRow.provider_code}.`,
    })
  }

  const serviceClient = await serverSupabaseServiceRole(event)

  const ctx: IntegrationEventContext = {
    integration: integrationRow,
    provider: provider as unknown as IntegrationEventContext['provider'],
    eventType: data.eventType,
    payload: data.payload,
    serviceClient,
  }

  const { data: job, error: jobError } = await serviceClient
    .from('integration_jobs')
    .insert({
      organization_id: organizationId,
      integration_id: integrationRow.id,
      event_type: data.eventType,
      payload: data.payload,
      status: 'running',
      attempts: 1,
      next_run_at: null,
    } as never)
    .select('id')
    .single()

  if (jobError || !job) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Failed to create integration job.',
    })
  }

  const result = await handler.handleEvent(ctx)

  await serviceClient
    .from('integrations')
    .update({
      last_used_at: new Date().toISOString(),
      error_message: result.error || null,
    } as never)
    .eq('id', integrationRow.id)

  await serviceClient
    .from('integration_jobs')
    .update({
      status: result.success ? 'completed' : 'failed',
      last_error: result.error || null,
      next_run_at: null,
    } as never)
    .eq('id', (job as { id: string }).id)

  if (!result.success) {
    throw createError({
      statusCode: 502,
      statusMessage: 'Bad Gateway',
      message: result.error || 'Integration handler failed.',
    })
  }

  return {
    success: true,
    data: {
      invoked: true,
      job_id: (job as { id: string }).id,
      result: result.data,
    },
  }
})

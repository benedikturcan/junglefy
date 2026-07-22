import { serverSupabaseServiceRole } from '#supabase/server'

defineRouteMeta({
  openAPI: {
    tags: ['Integrations'],
    summary: 'Receive integration webhook',
    description:
      'Public endpoint for third-party webhooks. The provider code is part of the URL.\n\n' +
      'The organization can be supplied via `organization_id` query parameter or `X-Organization-Id` header.',
    security: [],
    parameters: [
      {
        name: 'code',
        in: 'path',
        required: true,
        schema: { type: 'string' },
      },
      {
        name: 'organization_id',
        in: 'query',
        schema: { type: 'string', format: 'uuid' },
      },
    ],
    responses: {
      200: { description: 'Webhook received' },
      400: { description: 'Bad request' },
      404: { description: 'No matching integration' },
    },
  },
})

export default defineEventHandler(async (event) => {
  const code = getRouterParam(event, 'code')
  if (!code) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Provider code is required.',
    })
  }

  const query = getQuery(event)
  const organizationId = (query.organization_id as string) || getHeader(event, 'x-organization-id')
  if (!organizationId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'organization_id is required.',
    })
  }

  const body = await readBody(event)
  const serviceClient = await serverSupabaseServiceRole(event)

  const { data: integrations, error: integrationError } = await serviceClient
    .from('integrations')
    .select('id')
    .eq('provider_code', code)
    .eq('organization_id', organizationId)
    .eq('status', 'active')

  if (integrationError || !integrations || integrations.length === 0) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'No active integration found for this provider and organization.',
    })
  }

  const headers: Record<string, string | undefined> = {}
  for (const name of ['x-signature', 'x-webhook-signature', 'x-hub-signature-256', 'stripe-signature']) {
    const value = getHeader(event, name)
    if (value) headers[name] = value
  }

  await serviceClient.from('integration_webhook_logs').insert({
    organization_id: organizationId,
    integration_id: (integrations[0] as unknown as { id: string }).id,
    provider_code: code,
    signature_valid: null,
    payload: body,
    headers,
  } as never)

  return {
    success: true,
    data: { received: true },
  }
})

import { serverSupabaseClient } from '#supabase/server'
import { CreateIntegrationProviderSchema } from '#server/types/integration-providers'
import { requirePlatformAdmin } from '#server/utils/auth-guards'

defineRouteMeta({
  openAPI: {
    tags: ['Admin'],
    summary: 'Create integration provider',
    description:
      'Adds a new integration provider to the marketplace. Platform admin only — API keys and regular users are not allowed.',
    security: [{ bearerAuth: [] }],
    responses: {
      201: { description: 'Provider created' },
      400: { description: 'Bad request' },
      401: { description: 'Unauthorized' },
      403: { description: 'Forbidden' },
    },
  },
})

export default defineEventHandler(async (event) => {
  await requirePlatformAdmin(event)

  const body = await readBody(event)
  const parse = CreateIntegrationProviderSchema.safeParse(body)
  if (!parse.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: parse.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', '),
    })
  }

  const data = parse.data
  const client = await serverSupabaseClient(event)

  const { data: provider, error } = await client
    .from('integration_providers')
    .insert({
      code: data.code,
      name: data.name,
      description: data.description,
      auth_type: data.authType,
      capabilities: data.capabilities,
      config_schema: data.configSchema,
      is_active: data.isActive,
    } as never)
    .select('*')
    .single()

  if (error || !provider) {
    const message = error?.code === '23505' ? 'Provider code already exists.' : 'Failed to create provider.'
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message,
    })
  }

  setResponseStatus(event, 201)
  return {
    success: true,
    data: provider,
  }
})

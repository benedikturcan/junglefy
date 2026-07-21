import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { CreatePaymentProviderSchema } from '#server/types/payment'
import type { ApiKeyContext } from '#server/types/api-keys'

defineRouteMeta({
  openAPI: {
    tags: ['Payments'],
    summary: 'Create payment provider',
    description: 'Creates a new payment provider configuration for the organization.',
    security: [{ bearerAuth: [] }, { apiKey: [] }],
    responses: {
      201: { description: 'Payment provider created' },
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
  const parse = CreatePaymentProviderSchema.safeParse(body)
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
    if (role !== 'organization_owner') {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden',
        message: 'Only organization owners can manage payment providers.',
      })
    }

    organizationId = (member as { organization_id: string }).organization_id
  }

  const { data: provider, error } = await client
    .from('payment_providers')
    .insert({
      organization_id: organizationId,
      code: data.code,
      name: data.name,
      is_active: data.isActive,
      config: data.config,
      sort_order: data.sortOrder,
    })
    .select('*')
    .single()

  if (error || !provider) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Failed to create payment provider.',
    })
  }

  setResponseStatus(event, 201)
  return {
    success: true,
    data: provider,
  }
})

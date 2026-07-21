import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { CreateTaxRateSchema } from '#server/types/tax'
import type { ApiKeyContext } from '#server/types/api-keys'

defineRouteMeta({
  openAPI: {
    tags: ['Taxes'],
    summary: 'Create tax rate',
    description: 'Creates a new tax rate for the organization.',
    security: [{ bearerAuth: [] }, { apiKey: [] }],
    responses: {
      201: { description: 'Tax rate created' },
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
  const parse = CreateTaxRateSchema.safeParse(body)
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

  const { data: rate, error } = await client
    .from('tax_rates')
    .insert({
      organization_id: organizationId,
      name: data.name,
      rate_percent: data.ratePercent,
      country: data.country,
      region: data.region,
      applies_to_all: data.appliesToAll,
      product_ids: data.productIds,
      is_active: data.isActive,
      priority: data.priority,
    })
    .select('*')
    .single()

  if (error || !rate) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Failed to create tax rate.',
    })
  }

  setResponseStatus(event, 201)
  return {
    success: true,
    data: rate,
  }
})

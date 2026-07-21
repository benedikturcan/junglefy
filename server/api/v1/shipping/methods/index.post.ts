import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { CreateShippingMethodSchema } from '#server/types/shipping'
import type { ApiKeyContext } from '#server/types/api-keys'

defineRouteMeta({
  openAPI: {
    tags: ['Shipping'],
    summary: 'Create shipping method',
    description:
      'Creates a new shipping method for the organization.\n\n' +
      '**Authorization:** JWT Bearer Token or API Key with `full_access`.',
    security: [{ bearerAuth: [] }, { apiKey: [] }],
    responses: {
      201: { description: 'Shipping method created' },
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
  const parse = CreateShippingMethodSchema.safeParse(body)
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

  const { data: method, error } = await client
    .from('shipping_methods')
    .insert({
      organization_id: organizationId,
      name: data.name,
      provider: data.provider,
      base_cost: data.baseCost,
      free_threshold: data.freeThreshold,
      zones: data.zones,
      is_active: data.isActive,
      sort_order: data.sortOrder,
    })
    .select('*')
    .single()

  if (error || !method) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Failed to create shipping method.',
    })
  }

  setResponseStatus(event, 201)
  return {
    success: true,
    data: method,
  }
})

import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import type { ApiKeyContext } from '#server/types/api-keys'

defineRouteMeta({
  openAPI: {
    tags: ['Orders'],
    summary: 'List orders',
    description:
      'Returns orders for the authenticated organization. Supports filtering by status.\n\n' +
      '**Authorization:** JWT Bearer Token or API Key with `read:orders` or `full_access`.',
    security: [{ bearerAuth: [] }, { apiKey: [] }],
    parameters: [
      {
        name: 'status',
        in: 'query',
        required: false,
        schema: { type: 'string', enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'] },
      },
      {
        name: 'limit',
        in: 'query',
        required: false,
        schema: { type: 'integer', default: 50 },
      },
      {
        name: 'offset',
        in: 'query',
        required: false,
        schema: { type: 'integer', default: 0 },
      },
    ],
    responses: {
      200: { description: 'List of orders' },
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
    const hasPermission = apiKey.permissions.includes('full_access') || apiKey.permissions.includes('read:orders')
    if (!hasPermission) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden',
        message: 'Missing required permission: read:orders',
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

    organizationId = (member as { organization_id: string }).organization_id
  }

  const query = getQuery(event)
  const limit = Math.min(Number(query.limit) || 50, 100)
  const offset = Number(query.offset) || 0

  let dbQuery = client
    .from('orders')
    .select('*, order_items(*)')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (query.status) {
    dbQuery = dbQuery.eq('status', query.status as string)
  }

  const { data: orders, error, count } = await dbQuery

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Failed to fetch orders.',
    })
  }

  return {
    success: true,
    data: orders || [],
    meta: { limit, offset, count },
  }
})

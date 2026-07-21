import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import type { ApiKeyContext } from '#server/types/api-keys'

defineRouteMeta({
  openAPI: {
    tags: ['Inventory'],
    summary: 'List inventory',
    description:
      'Returns inventory levels for products within the organization. Optionally filtered by location.\n\n' +
      '**Authorization:** JWT Bearer Token or API Key with `read:inventory` or `full_access`.',
    security: [{ bearerAuth: [] }, { apiKey: [] }],
    parameters: [
      {
        name: 'location_id',
        in: 'query',
        required: false,
        schema: { type: 'string', format: 'uuid' },
        description: 'Filter by location ID',
      },
      {
        name: 'include_unavailable',
        in: 'query',
        required: false,
        schema: { type: 'boolean', default: false },
        description: 'Include products with zero available quantity',
      },
    ],
    responses: {
      200: {
        description: 'List of inventory records',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: true },
                data: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', format: 'uuid' },
                      organizationId: { type: 'string', format: 'uuid' },
                      locationId: { type: 'string', format: 'uuid', nullable: true },
                      productId: { type: 'string', format: 'uuid' },
                      productName: { type: 'string', nullable: true },
                      quantity: { type: 'integer' },
                      reservedQuantity: { type: 'integer' },
                      availableQuantity: { type: 'integer' },
                      reorderLevel: { type: 'integer' },
                      allowBackorder: { type: 'boolean' },
                      updatedAt: { type: 'string', format: 'date-time' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      401: { description: 'Unauthorized' },
      403: { description: 'Forbidden - insufficient permissions' },
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
      message: 'Authentication required. Provide API key or JWT token.',
    })
  }

  const client = await serverSupabaseClient(event)
  let organizationId: string
  let allowedLocationIds: string[] | null = null

  if (apiKey) {
    const hasPermission = apiKey.permissions.includes('full_access') || apiKey.permissions.includes('read:inventory')
    if (!hasPermission) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden',
        message: 'Missing required permission: read:inventory',
      })
    }
    organizationId = apiKey.organizationId
    allowedLocationIds = apiKey.locationIds
  } else {
    if (!user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized',
        message: 'Authentication required.',
      })
    }

    const { data: member, error: memberError } = await client
      .from('organization_members')
      .select('role, organization_id, location_id')
      .eq('user_id', user.id)
      .single()

    if (memberError || !member) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden',
        message: 'You must be a member of an organization to view inventory.',
      })
    }

    const userRole = (member as { role: string }).role
    organizationId = (member as { organization_id: string }).organization_id
    const userLocationId = (member as { location_id: string | null }).location_id

    if (userRole === 'customer' || userRole === 'location_member') {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden',
        message: 'Insufficient permissions to view inventory.',
      })
    }

    if (userRole === 'location_owner' && userLocationId) {
      allowedLocationIds = [userLocationId]
    }
  }

  const query = getQuery(event)
  const locationFilter = query.location_id as string | undefined
  const includeUnavailable = query.include_unavailable === 'true'

  let dbQuery = client
    .from('product_inventory')
    .select(`
      id,
      organization_id,
      location_id,
      product_id,
      quantity,
      reserved_quantity,
      available_quantity,
      reorder_level,
      allow_backorder,
      updated_at,
      products!inner (
        name
      )
    `)
    .eq('organization_id', organizationId)

  if (allowedLocationIds && allowedLocationIds.length > 0) {
    dbQuery = dbQuery.in('location_id', allowedLocationIds)
  }

  if (locationFilter) {
    dbQuery = dbQuery.eq('location_id', locationFilter)
  }

  if (!includeUnavailable) {
    dbQuery = dbQuery.or('available_quantity.gt.0,allow_backorder.eq.true')
  }

  const { data: inventory, error } = await dbQuery.order('updated_at', { ascending: false })

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Failed to fetch inventory.',
    })
  }

  const transformed = inventory?.map((item) => ({
    id: item.id,
    organizationId: item.organization_id,
    locationId: item.location_id,
    productId: item.product_id,
    productName: (item.products as { name: string | null } | null)?.name || null,
    quantity: item.quantity,
    reservedQuantity: item.reserved_quantity,
    availableQuantity: item.available_quantity,
    reorderLevel: item.reorder_level,
    allowBackorder: item.allow_backorder,
    updatedAt: item.updated_at,
  })) || []

  return {
    success: true,
    data: transformed,
  }
})

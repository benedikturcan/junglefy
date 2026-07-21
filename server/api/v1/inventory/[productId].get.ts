import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import type { ApiKeyContext } from '#server/types/api-keys'

defineRouteMeta({
  openAPI: {
    tags: ['Inventory'],
    summary: 'Get product inventory',
    description:
      'Returns inventory levels for a specific product across all locations of the organization.\n\n' +
      '**Authorization:** JWT Bearer Token or API Key with `read:inventory` or `full_access`.',
    security: [{ bearerAuth: [] }, { apiKey: [] }],
    parameters: [
      {
        name: 'productId',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
        description: 'Product ID',
      },
    ],
    responses: {
      200: {
        description: 'Inventory record(s) for the product',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: true },
                data: {
                  type: 'object',
                  properties: {
                    productId: { type: 'string', format: 'uuid' },
                    productName: { type: 'string', nullable: true },
                    totalQuantity: { type: 'integer' },
                    totalReservedQuantity: { type: 'integer' },
                    totalAvailableQuantity: { type: 'integer' },
                    allowBackorder: { type: 'boolean' },
                    locations: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          inventoryId: { type: 'string', format: 'uuid' },
                          locationId: { type: 'string', format: 'uuid', nullable: true },
                          quantity: { type: 'integer' },
                          reservedQuantity: { type: 'integer' },
                          availableQuantity: { type: 'integer' },
                          reorderLevel: { type: 'integer' },
                          updatedAt: { type: 'string', format: 'date-time' },
                        },
                      },
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
      404: { description: 'Product not found or no inventory' },
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

  const productId = getRouterParam(event, 'productId')
  if (!productId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Product ID is required.',
    })
  }

  // Verify product exists in organization
  const { data: product, error: productError } = await client
    .from('products')
    .select('id, name')
    .eq('id', productId)
    .eq('organization_id', organizationId)
    .single()

  if (productError || !product) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'Product not found.',
    })
  }

  let dbQuery = client
    .from('product_inventory')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('product_id', productId)

  if (allowedLocationIds && allowedLocationIds.length > 0) {
    dbQuery = dbQuery.in('location_id', allowedLocationIds)
  }

  const { data: inventory, error } = await dbQuery.order('updated_at', { ascending: false })

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Failed to fetch inventory.',
    })
  }

  if (!inventory || inventory.length === 0) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'No inventory record found for this product.',
    })
  }

  const locations = inventory.map((item) => ({
    inventoryId: item.id,
    locationId: item.location_id,
    quantity: item.quantity,
    reservedQuantity: item.reserved_quantity,
    availableQuantity: item.available_quantity,
    reorderLevel: item.reorder_level,
    updatedAt: item.updated_at,
  }))

  const totalQuantity = locations.reduce((sum, loc) => sum + loc.quantity, 0)
  const totalReservedQuantity = locations.reduce((sum, loc) => sum + loc.reservedQuantity, 0)
  const totalAvailableQuantity = locations.reduce((sum, loc) => sum + loc.availableQuantity, 0)
  const allowBackorder = inventory.some((item) => item.allow_backorder)

  return {
    success: true,
    data: {
      productId,
      productName: (product as { name: string | null }).name,
      totalQuantity,
      totalReservedQuantity,
      totalAvailableQuantity,
      allowBackorder,
      locations,
    },
  }
})

import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import type { ApiKeyContext } from '#server/types/api-keys'

defineRouteMeta({
  openAPI: {
    tags: ['Products'],
    summary: 'Get product',
    description:
      'Returns a single product including optional aggregated inventory data.\n\n' +
      '**Authorization:** JWT Bearer Token or API Key with `read:products` or `full_access`.',
    security: [{ bearerAuth: [] }, { apiKey: [] }],
    parameters: [
      {
        name: 'productId',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
      {
        name: 'include_inventory',
        in: 'query',
        required: false,
        schema: { type: 'boolean', default: false },
      },
    ],
    responses: {
      200: {
        description: 'Product details',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                data: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    organizationId: { type: 'string', format: 'uuid' },
                    categoryId: { type: 'string', format: 'uuid', nullable: true },
                    plantCatalogId: { type: 'string', format: 'uuid', nullable: true },
                    sku: { type: 'string' },
                    name: { type: 'string' },
                    slug: { type: 'string' },
                    description: { type: 'string', nullable: true },
                    shortDescription: { type: 'string', nullable: true },
                    images: { type: 'array' },
                    price: { type: 'number' },
                    comparePrice: { type: 'number', nullable: true },
                    costPrice: { type: 'number', nullable: true },
                    trackInventory: { type: 'boolean' },
                    inventoryQuantity: { type: 'integer' },
                    weight: { type: 'number', nullable: true },
                    dimensions: { type: 'object' },
                    tags: { type: 'array' },
                    metadata: { type: 'object' },
                    status: { type: 'string', enum: ['draft', 'active', 'archived'] },
                    isActive: { type: 'boolean' },
                    totalAvailableQuantity: { type: 'integer', nullable: true },
                    allowBackorder: { type: 'boolean', nullable: true },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
      401: { description: 'Unauthorized' },
      403: { description: 'Forbidden' },
      404: { description: 'Product not found' },
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

  const productId = getRouterParam(event, 'productId')
  if (!productId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Product ID is required.',
    })
  }

  const client = await serverSupabaseClient(event)
  let organizationId: string
  let allowedLocationIds: string[] | null = null

  if (apiKey) {
    const hasPermission = apiKey.permissions.includes('full_access') || apiKey.permissions.includes('read:products')
    if (!hasPermission) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden',
        message: 'Missing required permission: read:products',
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
        message: 'Organization membership required.',
      })
    }

    const userRole = (member as { role: string }).role
    organizationId = (member as { organization_id: string }).organization_id
    const userLocationId = (member as { location_id: string | null }).location_id

    if (userRole === 'customer') {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden',
        message: 'Insufficient permissions.',
      })
    }

    if ((userRole === 'location_member' || userRole === 'location_owner') && userLocationId) {
      allowedLocationIds = [userLocationId]
    }
  }

  const query = getQuery(event)
  const includeInventory = query.include_inventory === 'true'

  const { data: product, error } = await client
    .from('products')
    .select('*')
    .eq('id', productId)
    .eq('organization_id', organizationId)
    .single()

  if (error || !product) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'Product not found.',
    })
  }

  let inventorySummary: { totalAvailable: number; allowBackorder: boolean } | null = null

  if (includeInventory) {
    let inventoryQuery = client
      .from('product_inventory')
      .select('available_quantity, allow_backorder')
      .eq('organization_id', organizationId)
      .eq('product_id', productId)

    if (allowedLocationIds && allowedLocationIds.length > 0) {
      inventoryQuery = inventoryQuery.in('location_id', allowedLocationIds)
    }

    const { data: inventory, error: inventoryError } = await inventoryQuery

    if (!inventoryError && inventory) {
      inventorySummary = {
        totalAvailable: inventory.reduce((sum, item) => sum + item.available_quantity, 0),
        allowBackorder: inventory.some((item) => item.allow_backorder),
      }
    }
  }

  return {
    success: true,
    data: {
      id: product.id,
      organizationId: product.organization_id,
      categoryId: product.category_id,
      plantCatalogId: product.plant_catalog_id,
      sku: product.sku,
      name: product.name,
      slug: product.slug,
      description: product.description,
      shortDescription: product.short_description,
      images: product.images,
      price: product.price,
      comparePrice: product.compare_price,
      costPrice: product.cost_price,
      trackInventory: product.track_inventory,
      inventoryQuantity: product.inventory_quantity,
      weight: product.weight,
      dimensions: product.dimensions,
      tags: product.tags,
      metadata: product.metadata,
      status: product.status,
      isActive: product.is_active,
      totalAvailableQuantity: inventorySummary ? inventorySummary.totalAvailable : null,
      allowBackorder: inventorySummary ? inventorySummary.allowBackorder : null,
      createdAt: product.created_at,
      updatedAt: product.updated_at,
    },
  }
})

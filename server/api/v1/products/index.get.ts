import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import type { ApiKeyContext } from '#server/types/api-keys'

defineRouteMeta({
  openAPI: {
    tags: ['Products'],
    summary: 'List products',
    description:
      'Returns products for the authenticated organization. Supports filtering by category, status, availability and search.\n\n' +
      '**Authorization:** JWT Bearer Token or API Key with `read:products` or `full_access`.',
    security: [{ bearerAuth: [] }, { apiKey: [] }],
    parameters: [
      {
        name: 'category_id',
        in: 'query',
        required: false,
        schema: { type: 'string', format: 'uuid' },
        description: 'Filter by category ID',
      },
      {
        name: 'status',
        in: 'query',
        required: false,
        schema: { type: 'string', enum: ['draft', 'active', 'archived'] },
      },
      {
        name: 'is_active',
        in: 'query',
        required: false,
        schema: { type: 'boolean' },
      },
      {
        name: 'search',
        in: 'query',
        required: false,
        schema: { type: 'string' },
        description: 'Search by name or SKU (case-insensitive)',
      },
      {
        name: 'include_inventory',
        in: 'query',
        required: false,
        schema: { type: 'boolean', default: false },
        description: 'Include aggregated inventory data',
      },
    ],
    responses: {
      200: {
        description: 'List of products',
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
                      categoryId: { type: 'string', format: 'uuid', nullable: true },
                      plantCatalogId: { type: 'string', format: 'uuid', nullable: true },
                      sku: { type: 'string' },
                      name: { type: 'string' },
                      slug: { type: 'string' },
                      description: { type: 'string', nullable: true },
                      shortDescription: { type: 'string', nullable: true },
                      primaryImage: {
                        type: 'object',
                        nullable: true,
                        properties: {
                          id: { type: 'string', format: 'uuid' },
                          url: { type: 'string' },
                          altText: { type: 'string', nullable: true },
                          position: { type: 'integer' },
                          isPrimary: { type: 'boolean' },
                        },
                      },
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
      },
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

    if (userRole === 'location_member' || userRole === 'location_owner') {
      if (userLocationId) allowedLocationIds = [userLocationId]
    }
  }

  const query = getQuery(event)
  const includeInventory = query.include_inventory === 'true'
  const supabaseUrl = process.env.SUPABASE_URL || ''

  let dbQuery = client
    .from('products')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })

  if (query.category_id) {
    dbQuery = dbQuery.eq('category_id', query.category_id as string)
  }
  if (query.status) {
    dbQuery = dbQuery.eq('status', query.status as string)
  }
  if (query.is_active !== undefined) {
    dbQuery = dbQuery.eq('is_active', query.is_active === 'true')
  }
  if (query.search) {
    const term = `%${query.search}%`
    dbQuery = dbQuery.or(`name.ilike.${term},sku.ilike.${term}`)
  }

  const { data: products, error } = await dbQuery

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Failed to fetch products.',
    })
  }

  const inventoryMap: Map<string, { totalAvailable: number; allowBackorder: boolean }> = new Map()
  const primaryImageMap: Map<string, { id: string; storagePath: string; altText: string | null; position: number; isPrimary: boolean }> = new Map()

  if (products && products.length > 0) {
    const productIds = products.map((p) => p.id)
    const { data: images, error: imagesError } = await client
      .from('product_images')
      .select('id, product_id, storage_path, alt_text, position, is_primary')
      .eq('organization_id', organizationId)
      .eq('is_primary', true)
      .in('product_id', productIds)

    if (!imagesError && images) {
      for (const image of images) {
        primaryImageMap.set(image.product_id, {
          id: image.id,
          storagePath: image.storage_path,
          altText: image.alt_text,
          position: image.position,
          isPrimary: image.is_primary,
        })
      }
    }
  }

  if (includeInventory && products && products.length > 0) {
    const productIds = products.map((p) => p.id)
    const { data: inventory, error: inventoryError } = await client
      .from('product_inventory')
      .select('product_id, available_quantity, allow_backorder')
      .eq('organization_id', organizationId)
      .in('product_id', productIds)
      .in('location_id', allowedLocationIds || [])

    if (!inventoryError && inventory) {
      for (const item of inventory) {
        const existing = inventoryMap.get(item.product_id)
        if (existing) {
          existing.totalAvailable += item.available_quantity
          existing.allowBackorder = existing.allowBackorder || item.allow_backorder
        } else {
          inventoryMap.set(item.product_id, {
            totalAvailable: item.available_quantity,
            allowBackorder: item.allow_backorder,
          })
        }
      }
    }
  }

  const transformed = products?.map((product) => {
    const inventory = includeInventory ? inventoryMap.get(product.id) : null
    const primaryImage = primaryImageMap.get(product.id)
    return {
      id: product.id,
      organizationId: product.organization_id,
      categoryId: product.category_id,
      plantCatalogId: product.plant_catalog_id,
      sku: product.sku,
      name: product.name,
      slug: product.slug,
      description: product.description,
      shortDescription: product.short_description,
      primaryImage: primaryImage
        ? {
            id: primaryImage.id,
            url: supabaseUrl
              ? `${supabaseUrl}/storage/v1/object/public/product-images/${primaryImage.storagePath}`
              : null,
            altText: primaryImage.altText,
            position: primaryImage.position,
            isPrimary: primaryImage.isPrimary,
          }
        : null,
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
      totalAvailableQuantity: inventory ? inventory.totalAvailable : null,
      allowBackorder: inventory ? inventory.allowBackorder : null,
      createdAt: product.created_at,
      updatedAt: product.updated_at,
    }
  }) || []

  return {
    success: true,
    data: transformed,
  }
})

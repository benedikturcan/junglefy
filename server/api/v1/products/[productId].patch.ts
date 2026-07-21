import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { UpdateProductSchema } from '#server/types/products'
import type { ApiKeyContext } from '#server/types/api-keys'

function generateSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .substring(0, 100)
}

defineRouteMeta({
  openAPI: {
    tags: ['Products'],
    summary: 'Update product',
    description:
      'Updates an existing product. SKU cannot be changed.\n\n' +
      '**Authorization:** JWT Bearer Token or API Key with `write:products` or `full_access`.',
    security: [{ bearerAuth: [] }, { apiKey: [] }],
    parameters: [
      {
        name: 'productId',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
    ],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              categoryId: { type: 'string', format: 'uuid', nullable: true },
              plantCatalogId: { type: 'string', format: 'uuid', nullable: true },
              name: { type: 'string' },
              slug: { type: 'string' },
              description: { type: 'string', nullable: true },
              shortDescription: { type: 'string', nullable: true },
              images: { type: 'array' },
              price: { type: 'number' },
              comparePrice: { type: 'number', nullable: true },
              costPrice: { type: 'number', nullable: true },
              trackInventory: { type: 'boolean' },
              weight: { type: 'number', nullable: true },
              dimensions: { type: 'object' },
              tags: { type: 'array' },
              metadata: { type: 'object' },
              status: { type: 'string', enum: ['draft', 'active', 'archived'] },
              isActive: { type: 'boolean' },
            },
          },
        },
      },
    },
    responses: {
      200: { description: 'Product updated' },
      400: { description: 'Bad request' },
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

  const body = await readBody(event)
  const result = UpdateProductSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Invalid request body.',
      data: result.error.flatten(),
    })
  }

  const data = result.data
  const client = await serverSupabaseClient(event)
  let organizationId: string

  if (apiKey) {
    const hasPermission = apiKey.permissions.includes('full_access') || apiKey.permissions.includes('write:products')
    if (!hasPermission) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden',
        message: 'Missing required permission: write:products',
      })
    }
    organizationId = apiKey.organizationId
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
      .select('role, organization_id')
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

    if (userRole !== 'organization_owner' && userRole !== 'location_owner') {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden',
        message: 'Insufficient permissions.',
      })
    }
  }

  const { data: existing, error: existingError } = await client
    .from('products')
    .select('id')
    .eq('id', productId)
    .eq('organization_id', organizationId)
    .single()

  if (existingError || !existing) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'Product not found.',
    })
  }

  const updateData: Record<string, unknown> = {}
  if (data.categoryId !== undefined) updateData.category_id = data.categoryId
  if (data.plantCatalogId !== undefined) updateData.plant_catalog_id = data.plantCatalogId
  if (data.name !== undefined) {
    updateData.name = data.name
    if (!data.slug) updateData.slug = generateSlug(data.name)
  }
  if (data.slug !== undefined) updateData.slug = data.slug
  if (data.description !== undefined) updateData.description = data.description
  if (data.shortDescription !== undefined) updateData.short_description = data.shortDescription
  if (data.images !== undefined) updateData.images = data.images
  if (data.price !== undefined) updateData.price = data.price
  if (data.comparePrice !== undefined) updateData.compare_price = data.comparePrice
  if (data.costPrice !== undefined) updateData.cost_price = data.costPrice
  if (data.trackInventory !== undefined) updateData.track_inventory = data.trackInventory
  if (data.weight !== undefined) updateData.weight = data.weight
  if (data.dimensions !== undefined) updateData.dimensions = data.dimensions
  if (data.tags !== undefined) updateData.tags = data.tags
  if (data.metadata !== undefined) updateData.metadata = data.metadata
  if (data.status !== undefined) updateData.status = data.status
  if (data.isActive !== undefined) updateData.is_active = data.isActive

  if (Object.keys(updateData).length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'No fields to update.',
    })
  }

  const { data: product, error } = await client
    .from('products')
    .update(updateData)
    .eq('id', productId)
    .select('id, sku, name, slug, status, is_active')
    .single()

  if (error) {
    if (error.code === '23505') {
      throw createError({
        statusCode: 409,
        statusMessage: 'Conflict',
        message: 'Slug already exists in this organization.',
      })
    }
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Failed to update product.',
    })
  }

  return {
    success: true,
    data: product,
  }
})

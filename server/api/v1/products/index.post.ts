import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { CreateProductSchema } from '#server/types/products'
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
    summary: 'Create product',
    description:
      'Creates a new sellable product within an organization. Optionally links to the global plant catalog and a category.\n\n' +
      '**Authorization:** JWT Bearer Token or API Key with `write:products` or `full_access`.',
    security: [{ bearerAuth: [] }, { apiKey: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['sku', 'name', 'price'],
            properties: {
              categoryId: { type: 'string', format: 'uuid' },
              plantCatalogId: { type: 'string', format: 'uuid' },
              sku: { type: 'string', example: 'PLANT-001' },
              name: { type: 'string', example: 'Monstera Deliciosa - 21 cm Topf' },
              slug: { type: 'string', example: 'monstera-deliciosa-21cm' },
              description: { type: 'string' },
              shortDescription: { type: 'string' },
              images: { type: 'array' },
              price: { type: 'number' },
              comparePrice: { type: 'number' },
              costPrice: { type: 'number' },
              trackInventory: { type: 'boolean', default: true },
              weight: { type: 'number' },
              dimensions: { type: 'object' },
              tags: { type: 'array' },
              metadata: { type: 'object' },
              status: { type: 'string', enum: ['draft', 'active', 'archived'], default: 'draft' },
              isActive: { type: 'boolean', default: true },
            },
          },
        },
      },
    },
    responses: {
      201: { description: 'Product created' },
      400: { description: 'Bad request - invalid data or duplicate SKU/slug' },
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
  const result = CreateProductSchema.safeParse(body)

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

  const slug = data.slug || generateSlug(data.name)

  const { data: product, error } = await client
    .from('products')
    .insert({
      organization_id: organizationId,
      category_id: data.categoryId,
      plant_catalog_id: data.plantCatalogId,
      sku: data.sku,
      name: data.name,
      slug,
      description: data.description,
      short_description: data.shortDescription,
      images: data.images,
      price: data.price,
      compare_price: data.comparePrice,
      cost_price: data.costPrice,
      track_inventory: data.trackInventory,
      weight: data.weight,
      dimensions: data.dimensions,
      tags: data.tags,
      metadata: data.metadata,
      status: data.status,
      is_active: data.isActive,
    })
    .select('id, sku, name, slug')
    .single()

  if (error) {
    if (error.code === '23505') {
      throw createError({
        statusCode: 409,
        statusMessage: 'Conflict',
        message: 'SKU or slug already exists in this organization.',
      })
    }
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Failed to create product.',
    })
  }

  setResponseStatus(event, 201)
  return {
    success: true,
    data: product,
  }
})

import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import type { ApiKeyContext } from '#server/types/api-keys'

defineRouteMeta({
  openAPI: {
    tags: ['Products'],
    summary: 'Delete product',
    description:
      'Permanently deletes a product and its inventory records from the organization.\n\n' +
      '**Authorization:** JWT Bearer Token or API Key with `write:products` or `full_access`. Only organization owners are allowed.',
    security: [{ bearerAuth: [] }, { apiKey: [] }],
    parameters: [
      {
        name: 'productId',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
    ],
    responses: {
      200: { description: 'Product deleted' },
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

    if (userRole !== 'organization_owner') {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden',
        message: 'Only organization owners can delete products.',
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

  const { error } = await client
    .from('products')
    .delete()
    .eq('id', productId)
    .eq('organization_id', organizationId)

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Failed to delete product.',
    })
  }

  return {
    success: true,
    data: { deleted: true },
  }
})

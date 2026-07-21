import { serverSupabaseClient, serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import type { ApiKeyContext } from '#server/types/api-keys'

defineRouteMeta({
  openAPI: {
    tags: ['Products'],
    summary: 'Delete product image',
    description:
      'Removes a product image record and deletes the underlying object from Supabase Storage.\n\n' +
      '**Authorization:** JWT Bearer Token or API Key with `write:products` or `full_access`. Only organization owners can delete images.',
    security: [{ bearerAuth: [] }, { apiKey: [] }],
    parameters: [
      {
        name: 'productId',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
      {
        name: 'imageId',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
    ],
    responses: {
      200: { description: 'Image deleted' },
      401: { description: 'Unauthorized' },
      403: { description: 'Forbidden' },
      404: { description: 'Image not found' },
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
  const imageId = getRouterParam(event, 'imageId')
  if (!productId || !imageId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Product ID and image ID are required.',
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
        message: 'Only organization owners can delete images.',
      })
    }
  }

  const { data: image, error: imageError } = await client
    .from('product_images')
    .select('id, storage_path')
    .eq('id', imageId)
    .eq('product_id', productId)
    .eq('organization_id', organizationId)
    .single()

  if (imageError || !image) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'Image not found.',
    })
  }

  const { error: deleteError } = await client
    .from('product_images')
    .delete()
    .eq('id', imageId)
    .eq('organization_id', organizationId)

  if (deleteError) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Failed to delete image record.',
    })
  }

  const serviceClient = await serverSupabaseServiceRole(event)
  await serviceClient.storage.from('product-images').remove([image.storage_path])

  return {
    success: true,
    data: { deleted: true },
  }
})

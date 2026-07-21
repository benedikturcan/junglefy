import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import type { ApiKeyContext } from '#server/types/api-keys'

defineRouteMeta({
  openAPI: {
    tags: ['Products'],
    summary: 'Update product image',
    description:
      'Updates image metadata such as alt text, position, or primary flag. Only one image per product can be primary.\n\n' +
      '**Authorization:** JWT Bearer Token or API Key with `write:products` or `full_access`.',
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
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              altText: { type: 'string', nullable: true },
              position: { type: 'integer' },
              isPrimary: { type: 'boolean' },
            },
          },
        },
      },
    },
    responses: {
      200: { description: 'Image updated' },
      400: { description: 'Bad request' },
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

  const body = await readBody(event)
  const altText = body.altText !== undefined ? (body.altText as string | null) : undefined
  const position = body.position !== undefined ? parseInt(body.position as string, 10) : undefined
  const isPrimary = body.isPrimary !== undefined ? Boolean(body.isPrimary) : undefined

  if (position !== undefined && Number.isNaN(position)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Position must be a number.',
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

    if (userRole !== 'organization_owner' && userRole !== 'location_owner') {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden',
        message: 'Insufficient permissions.',
      })
    }
  }

  const { data: existing, error: existingError } = await client
    .from('product_images')
    .select('id')
    .eq('id', imageId)
    .eq('product_id', productId)
    .eq('organization_id', organizationId)
    .single()

  if (existingError || !existing) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'Image not found.',
    })
  }

  if (isPrimary === true) {
    await client
      .from('product_images')
      .update({ is_primary: false })
      .eq('organization_id', organizationId)
      .eq('product_id', productId)
      .eq('is_primary', true)
  }

  const updateData: Record<string, unknown> = {}
  if (altText !== undefined) updateData.alt_text = altText
  if (position !== undefined) updateData.position = position
  if (isPrimary !== undefined) updateData.is_primary = isPrimary

  if (Object.keys(updateData).length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'No fields to update.',
    })
  }

  const { data: image, error } = await client
    .from('product_images')
    .update(updateData)
    .eq('id', imageId)
    .eq('organization_id', organizationId)
    .select('id, storage_path, alt_text, position, is_primary, created_at')
    .single()

  if (error || !image) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Failed to update image.',
    })
  }

  const supabaseUrl = process.env.SUPABASE_URL || ''

  return {
    success: true,
    data: {
      id: image.id,
      url: supabaseUrl
        ? `${supabaseUrl}/storage/v1/object/public/product-images/${image.storage_path}`
        : null,
      storagePath: image.storage_path,
      altText: image.alt_text,
      position: image.position,
      isPrimary: image.is_primary,
      createdAt: image.created_at,
    },
  }
})

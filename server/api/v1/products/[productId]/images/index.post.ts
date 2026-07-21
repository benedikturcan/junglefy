import { readMultipartFormData } from 'h3'
import { serverSupabaseClient, serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { randomUUID } from 'crypto'
import type { ApiKeyContext } from '#server/types/api-keys'

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
const EXTENSION_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
}

defineRouteMeta({
  openAPI: {
    tags: ['Products'],
    summary: 'Upload product image',
    description:
      'Uploads an image for a product and stores it in the tenant-scoped Supabase Storage bucket.\n\n' +
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
        'multipart/form-data': {
          schema: {
            type: 'object',
            properties: {
              file: { type: 'string', format: 'binary' },
              altText: { type: 'string' },
              position: { type: 'integer', default: 0 },
              isPrimary: { type: 'boolean', default: false },
            },
            required: ['file'],
          },
        },
      },
    },
    responses: {
      201: { description: 'Image uploaded' },
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

  const { data: product, error: productError } = await client
    .from('products')
    .select('id')
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

  const formData = await readMultipartFormData(event)
  if (!formData) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'No multipart form data received.',
    })
  }

  const filePart = formData.find((part) => part.name === 'file')
  if (!filePart || !filePart.data || filePart.data.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Image file is required.',
    })
  }

  if (!ALLOWED_IMAGE_TYPES.includes(filePart.type || '')) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: `Unsupported image type. Allowed: ${ALLOWED_IMAGE_TYPES.join(', ')}.`,
    })
  }

  const altTextPart = formData.find((part) => part.name === 'altText')
  const positionPart = formData.find((part) => part.name === 'position')
  const isPrimaryPart = formData.find((part) => part.name === 'isPrimary')

  const altText = altTextPart?.data ? altTextPart.data.toString('utf-8') : null
  const position = positionPart?.data ? parseInt(positionPart.data.toString('utf-8'), 10) : 0
  let isPrimary = false
  if (isPrimaryPart?.data) {
    const raw = isPrimaryPart.data.toString('utf-8').toLowerCase()
    isPrimary = raw === 'true' || raw === '1' || raw === 'on'
  }

  const extension = EXTENSION_BY_TYPE[filePart.type || ''] || 'jpg'
  const imageId = randomUUID()
  const storagePath = `${organizationId}/${productId}/${imageId}.${extension}`

  const serviceClient = await serverSupabaseServiceRole(event)
  const { error: uploadError } = await serviceClient.storage
    .from('product-images')
    .upload(storagePath, filePart.data, {
      contentType: filePart.type,
      upsert: false,
    })

  if (uploadError) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Failed to upload image to storage.',
    })
  }

  if (isPrimary) {
    await client
      .from('product_images')
      .update({ is_primary: false })
      .eq('organization_id', organizationId)
      .eq('product_id', productId)
      .eq('is_primary', true)
  }

  const { data: image, error: insertError } = await client
    .from('product_images')
    .insert({
      id: imageId,
      organization_id: organizationId,
      product_id: productId,
      storage_path: storagePath,
      alt_text: altText,
      position,
      is_primary: isPrimary,
    })
    .select('id, storage_path, alt_text, position, is_primary, created_at')
    .single()

  if (insertError) {
    await serviceClient.storage.from('product-images').remove([storagePath])
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Failed to save image record.',
    })
  }

  const supabaseUrl = process.env.SUPABASE_URL || ''

  setResponseStatus(event, 201)
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

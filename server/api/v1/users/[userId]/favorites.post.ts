import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { z } from 'zod'

const AddFavoriteSchema = z.object({
  productId: z.string().uuid(),
})

defineRouteMeta({
  openAPI: {
    tags: ['Favorites'],
    summary: 'Add favorites',
    description: 'Adds a product to a users favorites list with validation and organization checks.\n\n' +
    '**Authorization:** \n\n' + 
    'JWT Bearer Token only',
    security: [{ bearerAuth: [] }],
    parameters: [
      {
        name: 'userId',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
        description: 'User ID to add favorite for',
      },
    ],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['productId'],
            properties: {
              productId: {
                type: 'string',
                format: 'uuid',
                description: 'Product ID to add to favorites',
              },
            },
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Product added to favorites',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: true },
                data: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    userId: { type: 'string', format: 'uuid' },
                    productId: { type: 'string', format: 'uuid' },
                    createdAt: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
      400: {
        description: 'Bad request - invalid input',
      },
      401: {
        description: 'Unauthorized - login required',
      },
      403: {
        description: 'Forbidden - insufficient permissions',
      },
      404: {
        description: 'User or product not found',
      },
      409: {
        description: 'Product already in favorites',
      },
    },
  },
})

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)

  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'Login required. Please authenticate with JWT.',
    })
  }

  const userId = getRouterParam(event, 'userId')
  if (!userId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'User ID is required.',
    })
  }

  const body = await readBody(event)
  const result = AddFavoriteSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Invalid request body.',
      data: result.error.flatten(),
    })
  }

  const { productId } = result.data
  const client = await serverSupabaseClient(event)

  // Check permissions
  let canAccess = false
  let organizationId: string | null = null

  // User can add to their own favorites
  if (user.id === userId) {
    canAccess = true
  } else {
    // Check if current user is org owner or location owner
    const { data: member } = await client
      .from('organization_members')
      .select('role, organization_id')
      .eq('user_id', user.id)
      .single()

    if (member && ['organization_owner', 'location_owner'].includes((member as { role: string }).role)) {
      // Check if target user is in same organization
      const { data: targetMember } = await client
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', userId)
        .eq('organization_id', (member as { organization_id: string }).organization_id)
        .single()

      if (targetMember) {
        canAccess = true
        organizationId = (member as { organization_id: string }).organization_id
      }
    }
  }

  if (!canAccess) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      message: 'You do not have permission to add favorites for this user.',
    })
  }

  // If not self-access, get organization ID from target user
  if (!organizationId && user.id !== userId) {
    const { data: targetMember } = await client
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId)
      .single()

    if (!targetMember) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Not Found',
        message: 'User not found in any organization.',
      })
    }

    organizationId = (targetMember as { organization_id: string }).organization_id
  }

  // Check if product exists and is active
  const { data: product, error: productError } = await client
    .from('products')
    .select('id, organization_id')
    .eq('id', productId)
    .eq('status', 'active')
    .single()

  if (productError || !product) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'Product not found or not available.',
    })
  }

  // Check if user has access to this product's organization
  if (organizationId && organizationId !== (product as { organization_id: string }).organization_id) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      message: 'Product is not in the same organization as the user.',
    })
  }

  // Add to favorites
  const { data: favorite, error: insertError } = await client
    .from('favorites')
    .upsert({
      user_id: userId,
      product_id: productId,
      organization_id: (product as { organization_id: string }).organization_id,
    }, {
      onConflict: 'user_id,product_id',
      ignoreDuplicates: false,
    })
    .select()
    .single()

  if (insertError) {
    if (insertError.code === '23505') {
      throw createError({
        statusCode: 409,
        statusMessage: 'Conflict',
        message: 'Product already in favorites.',
      })
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Failed to add product to favorites.',
    })
  }

  return {
    success: true,
    data: {
      id: favorite.id,
      userId: favorite.user_id,
      productId: favorite.product_id,
      createdAt: favorite.created_at,
    },
  }
})

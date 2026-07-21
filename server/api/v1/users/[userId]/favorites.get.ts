import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'

defineRouteMeta({
  openAPI: {
    tags: ['Favorites'],
    summary: 'Get user favorites',
    description: 
      'Retrieves all favorite products for a specific user with detailed product information.\n\n' +
      '**Authorization:** \n\n' + 
      'JWT Bearer Token only',
    security: [{ bearerAuth: [] }],
    parameters: [
      {
        name: 'userId',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
        description: 'User ID whose favorites to retrieve',
      },
    ],
    responses: {
      200: {
        description: 'List of user favorites',
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
                      productId: { type: 'string', format: 'uuid' },
                      product: {
                        type: 'object',
                        properties: {
                          id: { type: 'string', format: 'uuid' },
                          name: { type: 'string' },
                          slug: { type: 'string' },
                          price: { type: 'number' },
                          images: { type: 'array', items: { type: 'string' } },
                        },
                      },
                      createdAt: { type: 'string', format: 'date-time' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      401: {
        description: 'Unauthorized - login required',
      },
      403: {
        description: 'Forbidden - insufficient permissions',
      },
      404: {
        description: 'User not found',
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

  const client = await serverSupabaseClient(event)

  // Check permissions
  let canAccess = false

  // User can access their own favorites
  if (user.id === userId) {
    canAccess = true
  } else {
    // Check if current user can access other user's favorites
    const { data: member } = await client
      .from('organization_members')
      .select('role, organization_id')
      .eq('user_id', user.id)
      .single()

    if (!member || !['organization_owner', 'location_owner'].includes((member as { role: string }).role)) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden',
        message: 'Only organization owners and location owners can view other users\' favorites.',
      })
    }

    // Check if target user is in same organization
    const { data: targetMember } = await client
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId)
      .eq('organization_id', (member as { organization_id: string }).organization_id)
      .single()

    if (!targetMember) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Not Found',
        message: 'User not found in your organization.',
      })
    }

    canAccess = true
  }

  const { data: favorites, error } = await client
    .from('favorites')
    .select(`
      id,
      product_id,
      created_at,
      products!inner (
        id,
        name,
        slug,
        price,
        images,
        status
      )
    `)
    .eq('user_id', userId)
    .eq('products.status', 'active')
    .order('created_at', { ascending: false })

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Failed to fetch user favorites.',
    })
  }

  const transformedFavorites = favorites?.map((fav) => ({
    id: fav.id,
    productId: fav.product_id,
    product: (fav.products as {
      id: string
      name: string
      slug: string
      price: number
      images: string[]
    }),
    createdAt: fav.created_at,
  })) || []

  return {
    success: true,
    data: transformedFavorites,
  }
})

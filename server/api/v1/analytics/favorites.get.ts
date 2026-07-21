import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'

defineRouteMeta({
  openAPI: {
    tags: ['Analytics', "Favorites"],
    summary: 'Get all favorites',
    description: 
  'Retrieves aggregated analytics data of all customer favorites within the organization scope.\n\n' +
  '**Authorization:** \n\n' + 
  'JWT Bearer Token or API Key authentication.',
    security: [{ bearerAuth: [] }, { apiKey: [] }],
    responses: {
      200: {
        description: 'Aggregated favorites analytics data',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: true },
                data: {
                  type: 'object',
                  properties: {
                    totalFavorites: { type: 'integer', example: 1250 },
                    totalUsers: { type: 'integer', example: 450 },
                    totalProducts: { type: 'integer', example: 89 },
                    averageFavoritesPerUser: { type: 'number', example: 2.78 },
                    products: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          productId: { type: 'string', format: 'uuid' },
                          productName: { type: 'string' },
                          favoriteCount: { type: 'integer' },
                        },
                      },
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
    },
  },
})

export default defineEventHandler(async (event) => {
  const apiKey = event.context.apiKey
  const user = await serverSupabaseUser(event)

  // Check if either API key or JWT is provided
  if (!apiKey && !user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'Authentication required. Please provide either API key or JWT token.',
    })
  }

  const client = await serverSupabaseClient(event)
  let organizationId: string
  let userLocationId: string | null = null
  let isLocationOwner = false

  // Handle API Key authentication
  if (apiKey) {
    const hasPermission = apiKey.permissions.includes('full_access') || apiKey.permissions.includes('read:users')
    if (!hasPermission) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden',
        message: 'Missing required permission: read:users or full_access',
      })
    }
    organizationId = apiKey.organizationId
    userLocationId = apiKey.locationIds?.[0] || null
    isLocationOwner = !!(apiKey.locationIds && apiKey.locationIds.length > 0)
  } 
  // Handle JWT authentication
  else if (user) {
    const { data: member, error: memberError } = await client
      .from('organization_members')
      .select('role, organization_id, location_id')
      .eq('user_id', user.id)
      .single()

    if (memberError || !member) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden',
        message: 'You must be a member of an organization to view customer favorites.',
      })
    }

    const userRole = (member as { role: string }).role
    organizationId = (member as { organization_id: string }).organization_id
    userLocationId = (member as { location_id: string | null }).location_id
    isLocationOwner = userRole === 'location_owner'

    if (!['organization_owner', 'location_owner'].includes(userRole)) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden',
        message: 'Only organization owners and location owners can view customer favorites.',
      })
    }
  } else {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'Authentication required.',
    })
  }

  // Get total favorites count
  const { count: totalFavorites, error: countError } = await client
    .from('favorites')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId)

  if (countError) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Failed to fetch favorites count.',
    })
  }

  // Get unique users count
  const { data: uniqueUsers, error: usersError } = await client
    .from('favorites')
    .select('user_id')
    .eq('organization_id', organizationId)

  if (usersError) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Failed to fetch unique users count.',
    })
  }

  const totalUsers = new Set(uniqueUsers?.map(fav => fav.user_id)).size

  // Get unique products count
  const { data: uniqueProducts, error: productsError } = await client
    .from('favorites')
    .select('product_id')
    .eq('organization_id', organizationId)

  if (productsError) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Failed to fetch unique products count.',
    })
  }

  const totalProducts = new Set(uniqueProducts?.map(fav => fav.product_id)).size

  // Get top products
  const { data: topProductsData, error: topProductsError } = await client
    .from('favorites')
    .select(`
      product_id,
      products!inner (
        id,
        name
      )
    `)
    .eq('organization_id', organizationId)
    .eq('products.status', 'active')

  if (topProductsError) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Failed to fetch top products.',
    })
  }

  // Count favorites per product
  const productCounts = topProductsData?.reduce((acc, fav) => {
    const productId = fav.product_id
    const productName = (fav.products as { name: string }).name
    acc[productId] = acc[productId] || { productId, productName, count: 0 }
    acc[productId].count++
    return acc
  }, {} as Record<string, { productId: string; productName: string; count: number }>) || {}

  const products = Object.values(productCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  
  const averageFavoritesPerUser = totalUsers > 0 ? (totalFavorites || 0) / totalUsers : 0

  return {
    success: true,
    data: {
      totalFavorites: totalFavorites || 0,
      totalUsers,
      totalProducts,
      averageFavoritesPerUser: Math.round(averageFavoritesPerUser * 100) / 100,
      products,
    },
  }
})

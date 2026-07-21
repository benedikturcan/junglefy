import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'

defineRouteMeta({
  openAPI: {
    tags: ['Favorites'],
    summary: 'Remove favorite',
    description: 
      'Removes a specific favorite from a user\'s favorites list with security validation.\n\n' +
      '**Authorization:** \n\n' + 
      'JWT Bearer Token only',
    security: [{ bearerAuth: [] }],
    parameters: [
      {
        name: 'userId',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
        description: 'User ID to remove favorite from',
      },
      {
        name: 'favoriteId',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
        description: 'Favorite ID to remove',
      },
    ],
    responses: {
      200: {
        description: 'Favorite removed successfully',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: true },
                message: { type: 'string', example: 'Favorite removed successfully.' },
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
        description: 'Favorite not found',
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
  const favoriteId = getRouterParam(event, 'favoriteId')

  if (!userId || !favoriteId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'User ID and Favorite ID are required.',
    })
  }

  const client = await serverSupabaseClient(event)

  // Check permissions
  let canAccess = false

  // User can remove their own favorites
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
      }
    }
  }

  if (!canAccess) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      message: 'You do not have permission to remove favorites from this user.',
    })
  }

  // Verify the favorite belongs to the user
  const { data: favorite, error: favoriteError } = await client
    .from('favorites')
    .select('id, user_id')
    .eq('id', favoriteId)
    .eq('user_id', userId)
    .single()

  if (favoriteError || !favorite) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'Favorite not found or does not belong to this user.',
    })
  }

  // Remove the favorite
  const { error } = await client
    .from('favorites')
    .delete()
    .eq('id', favoriteId)
    .eq('user_id', userId)

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Failed to remove favorite.',
    })
  }

  return {
    success: true,
    message: 'Favorite removed successfully.',
  }
})

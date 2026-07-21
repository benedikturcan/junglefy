import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import type { ApiKeyContext } from '#server/types/api-keys'

defineRouteMeta({
  openAPI: {
    tags: ['Users'],
    summary: 'Delete user',
    description: 'Deletes a user from the organization. Requires `write:users` or `full_access` permission.',

    security: [{ apiKey: [] }],
    parameters: [
      {
        name: 'userId',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
        description: 'User ID',
      },
    ],
    responses: {
      200: { 
        description: 'User deleted successfully',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: true },
                message: { type: 'string', example: 'User removed from organization.' },
              },
            },
          },
        },
      },
      401: { 
        description: 'Unauthorized',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: false },
                error: { type: 'string', example: 'API key required.' },
              },
            },
          },
        },
      },
      403: { 
        description: 'Forbidden',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: false },
                error: { type: 'string', example: 'Missing required permission: write:users' },
              },
            },
          },
        },
      },
      404: { 
        description: 'User not found',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: false },
                error: { type: 'string', example: 'User not found in this organization.' },
              },
            },
          },
        },
      },
    },
  },
})

export default defineEventHandler(async (event) => {
  const apiKey = event.context.apiKey as ApiKeyContext | undefined

  if (!apiKey) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'API key required.',
    })
  }

  const hasPermission = apiKey.permissions.includes('full_access') || apiKey.permissions.includes('write:users')
  if (!hasPermission) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      message: 'Missing required permission: write:users',
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

  // Check if user exists in organization
  const { data: member, error: memberError } = await client
    .from('organization_members')
    .select('id, role')
    .eq('organization_id', apiKey.organizationId)
    .eq('user_id', userId)
    .single()

  if (memberError || !member) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'User not found in this organization.',
    })
  }

  // Prevent removing organization_owner via API key
  if ((member as { role: string }).role === 'organization_owner') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      message: 'Cannot remove organization owner via API key.',
    })
  }

  // Remove from organization
  const adminClient = serverSupabaseServiceRole(event)
  const { error: deleteError } = await adminClient
    .from('organization_members')
    .delete()
    .eq('id', (member as { id: string }).id)

  if (deleteError) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Failed to remove user from organization.',
    })
  }

  return {
    success: true,
    message: 'User removed from organization.',
  }
})

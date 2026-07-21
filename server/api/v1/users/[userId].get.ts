import { serverSupabaseClient } from '#supabase/server'
import type { ApiKeyContext } from '#server/types/api-keys'

defineRouteMeta({
  openAPI: {
    tags: ['Users'],
    summary: 'Get user details',
    description: 'Returns details of a specific user. Requires `read:users` or `full_access` permission.',
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
        description: 'User details',
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
                    memberId: { type: 'string', format: 'uuid' },
                    role: { type: 'string', enum: ['organization_owner', 'location_owner', 'location_member', 'customer'] },
                    locationId: { type: 'string', format: 'uuid', nullable: true },
                    email: { type: 'string', format: 'email' },
                    fullName: { type: 'string', nullable: true },
                    avatarUrl: { type: 'string', nullable: true },
                    joinedAt: { type: 'string', format: 'date-time' },
                    createdAt: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
      401: { description: 'Unauthorized' },
      403: { description: 'Forbidden' },
      404: { description: 'User not found' },
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

  const hasPermission = apiKey.permissions.includes('full_access') || apiKey.permissions.includes('read:users')
  if (!hasPermission) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      message: 'Missing required permission: read:users',
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

  const { data: member, error } = await client
    .from('organization_members')
    .select(`
      id,
      role,
      location_id,
      created_at,
      user_id,
      user_profiles!inner (
        id,
        email,
        full_name,
        avatar_url,
        created_at
      )
    `)
    .eq('organization_id', apiKey.organizationId)
    .eq('user_id', userId)
    .single()

  if (error || !member) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'User not found in this organization.',
    })
  }

  const profile = member.user_profiles as { email: string; full_name: string | null; avatar_url: string | null; created_at: string }

  return {
    success: true,
    data: {
      id: member.user_id,
      memberId: member.id,
      role: member.role,
      locationId: member.location_id,
      email: profile.email,
      fullName: profile.full_name,
      avatarUrl: profile.avatar_url,
      joinedAt: member.created_at,
      createdAt: profile.created_at,
    },
  }
})

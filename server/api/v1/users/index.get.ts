import { serverSupabaseClient } from '#supabase/server'
import type { ApiKeyContext } from '#server/types/api-keys'

defineRouteMeta({
  openAPI: {
    tags: ['Users'],
    summary: 'List users',
    description: 'Returns all users of the organization. Requires `read:users` or `full_access` permission.',
    security: [{ apiKey: [] }],
    responses: {
      200: {
        description: 'List of users',
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
                      id: { type: 'string', format: 'uuid', description: 'User ID' },
                      memberId: { type: 'string', format: 'uuid', description: 'Membership ID' },
                      role: { type: 'string', enum: ['organization_owner', 'location_owner', 'location_member', 'customer'] },
                      email: { type: 'string', format: 'email' },
                      fullName: { type: 'string', nullable: true },
                      avatarUrl: { type: 'string', nullable: true },
                      joinedAt: { type: 'string', format: 'date-time' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      401: {
        description: 'Unauthorized - API key required',
      },
      403: {
        description: 'Forbidden - insufficient permissions',
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
      message: 'API key required. Include X-API-Key header.',
    })
  }

  // Check permission
  const hasPermission = apiKey.permissions.includes('full_access') || apiKey.permissions.includes('read:users')
  if (!hasPermission) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      message: 'Missing required permission: read:users',
    })
  }

  const client = await serverSupabaseClient(event)

  // Get organization members with their profiles
  const { data: members, error } = await client
    .from('organization_members')
    .select(`
      id,
      role,
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

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Failed to fetch users.',
    })
  }

  // Transform response
  const users = members?.map((member) => ({
    id: member.user_id,
    memberId: member.id,
    role: member.role,
    email: (member.user_profiles as { email: string })?.email,
    fullName: (member.user_profiles as { full_name: string | null })?.full_name,
    avatarUrl: (member.user_profiles as { avatar_url: string | null })?.avatar_url,
    joinedAt: member.created_at,
  })) || []

  return {
    success: true,
    data: users,
  }
})

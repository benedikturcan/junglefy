import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import type { ApiKeyContext } from '#server/types/api-keys'
import { z } from 'zod'

const UpdateUserSchema = z.object({
  fullName: z.string().min(1).max(255).optional(),
  role: z.enum(['location_owner', 'location_member', 'customer']).optional(),
  locationId: z.string().uuid().nullable().optional(),
})

defineRouteMeta({
  openAPI: {
    tags: ['Users'],
    summary: 'Update a user',
    description: 'Updates a user in the organization. Requires `write:users` or `full_access` permission.',
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
    requestBody: {
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              fullName: { type: 'string', description: 'User full name' },
              role: { 
                type: 'string', 
                enum: ['location_owner', 'location_member', 'customer'],
                description: 'User role in the organization',
              },
              locationId: { type: 'string', format: 'uuid', nullable: true, description: 'Assign user to specific location' },
            },
          },
        },
      },
    },
    responses: {
      200: { 
        description: 'User updated successfully',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: true },
                message: { type: 'string', example: 'User updated successfully.' },
              },
            },
          },
        },
      },
      400: { description: 'Bad request' },
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

  const body = await readBody(event)
  const result = UpdateUserSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Invalid request body.',
      data: result.error.flatten(),
    })
  }

  const { fullName, role, locationId } = result.data
  const client = await serverSupabaseClient(event)

  // Check if user exists in organization
  const { data: member, error: memberError } = await client
    .from('organization_members')
    .select('id, user_id')
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

  // Update profile if fullName provided
  if (fullName !== undefined) {
    const adminClient = serverSupabaseServiceRole(event)
    const { error: profileError } = await adminClient
      .from('user_profiles')
      .update({ full_name: fullName })
      .eq('id', userId)

    if (profileError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Internal Server Error',
        message: 'Failed to update user profile.',
      })
    }
  }

  // Update membership if role or locationId provided
  if (role !== undefined || locationId !== undefined) {
    const updateData: Record<string, unknown> = {}
    if (role !== undefined) updateData.role = role
    if (locationId !== undefined) updateData.location_id = locationId

    const { error: updateError } = await client
      .from('organization_members')
      .update(updateData)
      .eq('id', (member as { id: string }).id)

    if (updateError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Internal Server Error',
        message: 'Failed to update user membership.',
      })
    }
  }

  return {
    success: true,
    message: 'User updated successfully.',
  }
})

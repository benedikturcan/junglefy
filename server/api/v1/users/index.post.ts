import { serverSupabaseServiceRole } from '#supabase/server'
import type { ApiKeyContext } from '#server/types/api-keys'
import { z } from 'zod'

const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).optional(),
  fullName: z.string().min(1).max(255).optional(),
  role: z.enum(['location_owner', 'location_member', 'customer']).default('customer'),
  locationId: z.string().uuid().optional(),
  sendInvite: z.boolean().default(true),
})

defineRouteMeta({
  openAPI: {
    tags: ['Users'],
    summary: 'Create a new user',
    description: 
  'Creates a new user in the organization. Requires `write:users` or `full_access` permission.\n\n' +
  'Options:\n' +
  '- If `password` is provided: User is created with that password.\n' +
  '- If `sendInvite` is true (default): User receives an email invitation.\n\n' +
  '`Role` determines the users permissions within the organization.',
    security: [{ apiKey: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['email'],
            properties: {
              email: { type: 'string', format: 'email', description: 'User email address' },
              password: { type: 'string', description: 'Optional password (min 8 chars). If not provided, user must set via invite.' },
              fullName: { type: 'string', description: 'User full name' },
              role: { 
                type: 'string', 
                enum: ['location_owner', 'location_member', 'customer'],
                default: 'customer',
                description: 'User role in the organization',
              },
              locationId: { type: 'string', format: 'uuid', description: 'Assign user to specific location' },
              sendInvite: { type: 'boolean', default: true, description: 'Send email invitation to user' },
            },
          },
        },
      },
    },
    responses: {
      201: {
        description: 'User created successfully',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: true },
                data: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', format: 'uuid', description: 'User ID' },
                    email: { type: 'string', format: 'email' },
                    fullName: { type: 'string', nullable: true },
                    role: { type: 'string', enum: ['location_owner', 'location_member', 'customer'] },
                    locationId: { type: 'string', format: 'uuid', nullable: true },
                    inviteSent: { type: 'boolean', description: 'Whether an invitation email was sent' },
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
        description: 'Unauthorized - API key required',
      },
      403: {
        description: 'Forbidden - insufficient permissions',
      },
      409: {
        description: 'Conflict - user already exists',
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
  const hasPermission = apiKey.permissions.includes('full_access') || apiKey.permissions.includes('write:users')
  if (!hasPermission) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      message: 'Missing required permission: write:users',
    })
  }

  const body = await readBody(event)
  const result = CreateUserSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Invalid request body.',
      data: result.error.flatten(),
    })
  }

  const { email, password, fullName, role, locationId, sendInvite } = result.data

  // Check location restriction
  if (apiKey.locationIds && locationId && !apiKey.locationIds.includes(locationId)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      message: 'API key does not have access to this location.',
    })
  }

  // Use service role client for admin operations
  const adminClient = serverSupabaseServiceRole(event)

  // Check if user already exists
  const { data: existingUser } = await adminClient.auth.admin.listUsers()
  const userExists = existingUser?.users?.some(u => u.email === email)

  if (userExists) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Conflict',
      message: 'A user with this email already exists.',
    })
  }

  // Create user in Supabase Auth
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password: password || undefined,
    email_confirm: !sendInvite, // Auto-confirm if not sending invite
    user_metadata: {
      full_name: fullName,
    },
  })

  if (authError || !authData.user) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: authError?.message || 'Failed to create user.',
    })
  }

  const userId = authData.user.id

  // Create user profile
  const { error: profileError } = await adminClient
    .from('user_profiles')
    .insert({
      id: userId,
      email,
      full_name: fullName || null,
    })

  if (profileError) {
    // Rollback: delete auth user
    await adminClient.auth.admin.deleteUser(userId)
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Failed to create user profile.',
    })
  }

  // Add user to organization
  const { error: memberError } = await adminClient
    .from('organization_members')
    .insert({
      organization_id: apiKey.organizationId,
      user_id: userId,
      location_id: locationId || null,
      role,
    })

  if (memberError) {
    // Rollback
    await adminClient.from('user_profiles').delete().eq('id', userId)
    await adminClient.auth.admin.deleteUser(userId)
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Failed to add user to organization.',
    })
  }

  // Send invite email if requested
  if (sendInvite && !password) {
    await adminClient.auth.admin.inviteUserByEmail(email)
  }

  return {
    success: true,
    data: {
      id: userId,
      email,
      fullName: fullName || null,
      role,
      locationId: locationId || null,
      inviteSent: sendInvite && !password,
    },
  }
})

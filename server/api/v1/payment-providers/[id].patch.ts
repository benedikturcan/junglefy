import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { UpdatePaymentProviderSchema } from '#server/types/payment'
import type { ApiKeyContext } from '#server/types/api-keys'

defineRouteMeta({
  openAPI: {
    tags: ['Payments'],
    summary: 'Update payment provider',
    description: 'Updates an existing payment provider configuration.',
    security: [{ bearerAuth: [] }, { apiKey: [] }],
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
    ],
    responses: {
      200: { description: 'Payment provider updated' },
      400: { description: 'Bad request' },
      401: { description: 'Unauthorized' },
      403: { description: 'Forbidden' },
      404: { description: 'Not found' },
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

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Payment provider ID is required.',
    })
  }

  const body = await readBody(event)
  const parse = UpdatePaymentProviderSchema.safeParse(body)
  if (!parse.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: parse.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', '),
    })
  }

  const data = parse.data
  const client = await serverSupabaseClient(event)
  let organizationId: string

  if (apiKey) {
    if (!apiKey.permissions.includes('full_access')) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden',
        message: 'Missing required permission: full_access',
      })
    }
    organizationId = apiKey.organizationId
  } else {
    const { data: member, error: memberError } = await client
      .from('organization_members')
      .select('role, organization_id')
      .eq('user_id', user!.id)
      .single()

    if (memberError || !member) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden',
        message: 'Organization membership required.',
      })
    }

    const role = (member as { role: string }).role
    if (role !== 'organization_owner') {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden',
        message: 'Only organization owners can manage payment providers.',
      })
    }

    organizationId = (member as { organization_id: string }).organization_id
  }

  const updateData: Record<string, unknown> = {}
  if (data.code !== undefined) updateData.code = data.code
  if (data.name !== undefined) updateData.name = data.name
  if (data.isActive !== undefined) updateData.is_active = data.isActive
  if (data.config !== undefined) updateData.config = data.config
  if (data.sortOrder !== undefined) updateData.sort_order = data.sortOrder

  if (Object.keys(updateData).length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'No fields to update.',
    })
  }

  const { data: provider, error } = await client
    .from('payment_providers')
    .update(updateData)
    .eq('id', id)
    .eq('organization_id', organizationId)
    .select('*')
    .single()

  if (error || !provider) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'Payment provider not found or update failed.',
    })
  }

  return {
    success: true,
    data: provider,
  }
})

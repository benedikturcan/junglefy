import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { UpdateTaxRateSchema } from '#server/types/tax'
import type { ApiKeyContext } from '#server/types/api-keys'

defineRouteMeta({
  openAPI: {
    tags: ['Taxes'],
    summary: 'Update tax rate',
    description: 'Updates an existing tax rate.',
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
      200: { description: 'Tax rate updated' },
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
      message: 'Tax rate ID is required.',
    })
  }

  const body = await readBody(event)
  const parse = UpdateTaxRateSchema.safeParse(body)
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
    if (role !== 'organization_owner' && role !== 'location_owner') {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden',
        message: 'Insufficient permissions.',
      })
    }

    organizationId = (member as { organization_id: string }).organization_id
  }

  const updateData: Record<string, unknown> = {}
  if (data.name !== undefined) updateData.name = data.name
  if (data.ratePercent !== undefined) updateData.rate_percent = data.ratePercent
  if (data.country !== undefined) updateData.country = data.country
  if (data.region !== undefined) updateData.region = data.region
  if (data.appliesToAll !== undefined) updateData.applies_to_all = data.appliesToAll
  if (data.productIds !== undefined) updateData.product_ids = data.productIds
  if (data.isActive !== undefined) updateData.is_active = data.isActive
  if (data.priority !== undefined) updateData.priority = data.priority

  if (Object.keys(updateData).length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'No fields to update.',
    })
  }

  const { data: rate, error } = await client
    .from('tax_rates')
    .update(updateData)
    .eq('id', id)
    .eq('organization_id', organizationId)
    .select('*')
    .single()

  if (error || !rate) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'Tax rate not found or update failed.',
    })
  }

  return {
    success: true,
    data: rate,
  }
})

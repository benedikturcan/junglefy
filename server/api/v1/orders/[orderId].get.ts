import { serverSupabaseClient, serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import type { ApiKeyContext } from '#server/types/api-keys'

defineRouteMeta({
  openAPI: {
    tags: ['Orders'],
    summary: 'Get order',
    description:
      'Returns a single order including its items. Accessible by organization staff, the authenticated customer, or via the guest token.',
    security: [{ bearerAuth: [] }, { apiKey: [] }],
    parameters: [
      {
        name: 'orderId',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
    ],
    responses: {
      200: { description: 'Order details' },
      401: { description: 'Unauthorized' },
      403: { description: 'Forbidden' },
      404: { description: 'Order not found' },
    },
  },
})

export default defineEventHandler(async (event) => {
  const apiKey = event.context.apiKey as ApiKeyContext | undefined
  const user = await serverSupabaseUser(event)
  const guestToken = getHeader(event, 'x-guest-token')

  const orderId = getRouterParam(event, 'orderId')
  if (!orderId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Order ID is required.',
    })
  }

  const serviceClient = await serverSupabaseServiceRole(event)

  const { data: order, error } = await serviceClient
    .from('orders')
    .select('*, order_items(*)')
    .eq('id', orderId)
    .single()

  if (error || !order) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'Order not found.',
    })
  }

  const orderRow = order as {
    id: string
    organization_id: string
    user_id: string | null
    guest_token: string | null
  }

  // Authorization checks
  let hasAccess = false

  if (apiKey) {
    hasAccess =
      apiKey.organizationId === orderRow.organization_id &&
      (apiKey.permissions.includes('full_access') || apiKey.permissions.includes('read:orders'))
  } else if (user) {
    const userClient = await serverSupabaseClient(event)
    const { data: member } = await userClient
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('organization_id', orderRow.organization_id)
      .maybeSingle()

    hasAccess = !!member || orderRow.user_id === user.id
  } else if (guestToken && orderRow.guest_token === guestToken) {
    hasAccess = true
  }

  if (!hasAccess) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      message: 'You do not have access to this order.',
    })
  }

  return {
    success: true,
    data: order,
  }
})

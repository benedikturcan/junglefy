import { serverSupabaseClient, serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { releaseInventory } from '#server/utils/orders'
import { UpdateOrderSchema } from '#server/types/orders'
import type { ApiKeyContext } from '#server/types/api-keys'

defineRouteMeta({
  openAPI: {
    tags: ['Orders'],
    summary: 'Update order',
    description:
      'Updates order status and metadata. Cancelling or refunding an order releases reserved inventory.\n\n' +
      '**Authorization:** JWT Bearer Token or API Key with `write:orders` or `full_access`.',
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
      200: { description: 'Order updated' },
      400: { description: 'Bad request' },
      401: { description: 'Unauthorized' },
      403: { description: 'Forbidden' },
      404: { description: 'Order not found' },
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

  const orderId = getRouterParam(event, 'orderId')
  if (!orderId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Order ID is required.',
    })
  }

  const body = await readBody(event)
  const parse = UpdateOrderSchema.safeParse(body)
  if (!parse.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: parse.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', '),
    })
  }

  const data = parse.data
  const serviceClient = await serverSupabaseServiceRole(event)

  const { data: order, error: orderError } = await serviceClient
    .from('orders')
    .select('id, organization_id, location_id, status, order_items(product_id, quantity)')
    .eq('id', orderId)
    .single()

  if (orderError || !order) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'Order not found.',
    })
  }

  const orderRow = order as {
    id: string
    organization_id: string
    location_id: string | null
    status: string
    order_items: { product_id: string; quantity: number }[]
  }

  // Authorization
  if (apiKey) {
    const hasPermission = apiKey.permissions.includes('full_access') || apiKey.permissions.includes('write:orders')
    if (!hasPermission || apiKey.organizationId !== orderRow.organization_id) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden',
        message: 'Missing required permission: write:orders',
      })
    }
  } else {
    const userClient = await serverSupabaseClient(event)
    const { data: member, error: memberError } = await userClient
      .from('organization_members')
      .select('role')
      .eq('user_id', user!.id)
      .eq('organization_id', orderRow.organization_id)
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
  }

  const updateData: Record<string, unknown> = {}
  if (data.status !== undefined) updateData.status = data.status
  if (data.notes !== undefined) updateData.notes = data.notes
  if (data.metadata !== undefined) updateData.metadata = data.metadata
  if (data.locationId !== undefined) updateData.location_id = data.locationId

  if (Object.keys(updateData).length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'No fields to update.',
    })
  }

  // Release inventory when cancelling or refunding
  const releasingStatuses = ['cancelled', 'refunded']
  const currentReleasable = releasingStatuses.includes(orderRow.status)
  const nextReleasable = data.status !== undefined && releasingStatuses.includes(data.status)

  if (!currentReleasable && nextReleasable && orderRow.location_id) {
    await releaseInventory(
      serviceClient,
      orderRow.organization_id,
      orderRow.location_id,
      orderRow.order_items.map((item) => ({ productId: item.product_id, quantity: item.quantity })),
    )
  }

  const { data: updatedOrder, error } = await serviceClient
    .from('orders')
    .update(updateData)
    .eq('id', orderId)
    .select('*')
    .single()

  if (error || !updatedOrder) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Failed to update order.',
    })
  }

  return {
    success: true,
    data: updatedOrder,
  }
})

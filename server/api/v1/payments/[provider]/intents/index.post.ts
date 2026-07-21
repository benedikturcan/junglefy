import { randomUUID } from 'crypto'
import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'

defineRouteMeta({
  openAPI: {
    tags: ['Payments'],
    summary: 'Create payment intent',
    description:
      'Creates a pending payment transaction for an order and returns a client secret.\n\n' +
      'Authorization: JWT Bearer Token or `x-guest-token` header.',
    parameters: [
      {
        name: 'provider',
        in: 'path',
        required: true,
        schema: { type: 'string', enum: ['stripe', 'mollie', 'paypal'] },
      },
    ],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['orderId'],
            properties: {
              orderId: { type: 'string', format: 'uuid' },
            },
          },
        },
      },
    },
    responses: {
      200: { description: 'Payment intent created' },
      400: { description: 'Bad request' },
      401: { description: 'Unauthorized' },
      404: { description: 'Order not found' },
    },
  },
})

export default defineEventHandler(async (event) => {
  const provider = getRouterParam(event, 'provider')
  if (!provider) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Payment provider is required.',
    })
  }

  const user = await serverSupabaseUser(event)
  const guestToken = getHeader(event, 'x-guest-token')
  const body = await readBody(event)
  const orderId = body.orderId as string

  if (!orderId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'orderId is required.',
    })
  }

  const serviceClient = await serverSupabaseServiceRole(event)

  const { data: order, error: orderError } = await serviceClient
    .from('orders')
    .select('id, organization_id, user_id, guest_token, total, currency, status')
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
    user_id: string | null
    guest_token: string | null
    total: number
    currency: string
    status: string
  }

  // Access control
  if (orderRow.user_id && user && orderRow.user_id === user.id) {
    // ok
  } else if (orderRow.guest_token && guestToken && orderRow.guest_token === guestToken) {
    // ok
  } else {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      message: 'You do not have access to this order.',
    })
  }

  if (orderRow.status !== 'pending') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: `Payment intent can only be created for orders in status 'pending'. Current status: ${orderRow.status}`,
    })
  }

  const providerTransactionId = randomUUID()

  const { data: transaction, error: insertError } = await serviceClient
    .from('payment_transactions')
    .insert({
      organization_id: orderRow.organization_id,
      order_id: orderRow.id,
      provider_code: provider,
      provider_transaction_id: providerTransactionId,
      amount: orderRow.total,
      currency: orderRow.currency,
      status: 'pending',
    })
    .select('id, provider_transaction_id, amount, currency, status')
    .single()

  if (insertError || !transaction) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Failed to create payment transaction.',
    })
  }

  const tx = transaction as {
    id: string
    provider_transaction_id: string
    amount: number
    currency: string
    status: string
  }

  return {
    success: true,
    data: {
      transactionId: tx.id,
      clientSecret: tx.provider_transaction_id, // placeholder until real provider SDK is wired
      amount: tx.amount,
      currency: tx.currency,
      status: tx.status,
    },
  }
})

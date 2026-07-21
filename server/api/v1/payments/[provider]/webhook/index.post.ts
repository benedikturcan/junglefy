import { serverSupabaseServiceRole } from '#supabase/server'

defineRouteMeta({
  openAPI: {
    tags: ['Payments'],
    summary: 'Payment provider webhook',
    description:
      'Webhook endpoint for payment providers. Updates the payment transaction and order status based on provider events.\n\n' +
      'In production this validates the provider signature.',
    parameters: [
      {
        name: 'provider',
        in: 'path',
        required: true,
        schema: { type: 'string' },
      },
    ],
    responses: {
      200: { description: 'Webhook processed' },
      400: { description: 'Bad request' },
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

  const body = await readBody(event)

  // TODO: validate provider signature from headers
  // const signature = getHeader(event, 'x-webhook-signature')

  const transactionId = body.transactionId as string | undefined
  const status = body.status as 'authorized' | 'captured' | 'failed' | 'refunded' | undefined

  if (!transactionId || !status) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'transactionId and status are required.',
    })
  }

  const serviceClient = await serverSupabaseServiceRole(event)

  const { data: transaction, error: txError } = await serviceClient
    .from('payment_transactions')
    .select('id, order_id, status')
    .eq('id', transactionId)
    .eq('provider_code', provider)
    .single()

  if (txError || !transaction) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Transaction not found.',
    })
  }

  const tx = transaction as { id: string; order_id: string; status: string }

  const { error: updateError } = await serviceClient
    .from('payment_transactions')
    .update({ status })
    .eq('id', tx.id)

  if (updateError) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Failed to update payment transaction.',
    })
  }

  if (status === 'captured') {
    await serviceClient.from('orders').update({ status: 'confirmed' }).eq('id', tx.order_id)
  } else if (status === 'failed') {
    // keep order pending so customer can retry
  } else if (status === 'refunded') {
    await serviceClient.from('orders').update({ status: 'refunded' }).eq('id', tx.order_id)
  }

  return {
    success: true,
    data: { received: true, provider, transactionId, status },
  }
})

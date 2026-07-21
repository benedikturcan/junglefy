import { randomUUID } from 'crypto'
import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { CreateOrderSchema } from '#server/types/orders'
import { calculateOrderTotals, reserveInventory } from '#server/utils/orders'
import type { ApiKeyContext } from '#server/types/api-keys'

defineRouteMeta({
  openAPI: {
    tags: ['Orders'],
    summary: 'Create order',
    description:
      'Creates a new order (guest or authenticated customer). Inventory is reserved immediately.\n\n' +
      '**Authorization:** Optional. If omitted, a `guestToken` is returned for tracking.',
    security: [{ bearerAuth: [] }, { apiKey: [] }],
    responses: {
      201: { description: 'Order created' },
      400: { description: 'Bad request' },
      401: { description: 'Unauthorized' },
      500: { description: 'Internal server error' },
    },
  },
})

export default defineEventHandler(async (event) => {
  const apiKey = event.context.apiKey as ApiKeyContext | undefined
  const user = await serverSupabaseUser(event)

  if (apiKey) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      message: 'Orders cannot be created via API key.',
    })
  }

  const body = await readBody(event)
  const parse = CreateOrderSchema.safeParse(body)
  if (!parse.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: parse.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', '),
    })
  }

  const data = parse.data

  // Use service role for order creation (guests have no auth)
  const serviceClient = await serverSupabaseServiceRole(event)

  const productIds = data.items.map((item) => item.productId)
  const { data: products, error: productsError } = await serviceClient
    .from('products')
    .select('id, organization_id, is_active')
    .in('id', productIds)

  if (productsError || !products || products.length !== productIds.length) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'One or more products not found.',
    })
  }

  const productRows = products as { id: string; organization_id: string; is_active: boolean }[]
  const organizationIds = new Set(productRows.map((p) => p.organization_id))
  if (organizationIds.size !== 1) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'All items must belong to the same organization.',
    })
  }
  if (productRows.some((p) => !p.is_active)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'One or more products are not active.',
    })
  }

  const organizationId = productRows[0]!.organization_id

  // Resolve location
  let locationId = data.locationId
  if (!locationId) {
    const { data: locations, error: locError } = await serviceClient
      .from('locations')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)

    if (locError || !locations || locations.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: 'No active location found for this organization.',
      })
    }
    locationId = (locations[0] as unknown as { id: string }).id
  }

  // Verify provided location belongs to org
  if (data.locationId) {
    const { data: locCheck, error: locCheckError } = await serviceClient
      .from('locations')
      .select('id')
      .eq('id', data.locationId)
      .eq('organization_id', organizationId)
      .single()

    if (locCheckError || !locCheck) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: 'Selected location does not belong to the organization.',
      })
    }
  }

  const totals = await calculateOrderTotals(
    serviceClient,
    organizationId,
    data.items,
    data.shippingAddress,
    data.shippingMethodId,
  )

  await reserveInventory(
    serviceClient,
    organizationId,
    locationId,
    data.items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
  )

  const guestToken = user ? null : randomUUID()

  const { data: order, error: orderError } = await serviceClient
    .from('orders')
    .insert({
      organization_id: organizationId,
      location_id: locationId,
      user_id: user ? user.id : null,
      guest_token: guestToken,
      customer_email: data.customerEmail,
      customer_phone: data.customerPhone || null,
      customer_name: data.customerName || null,
      shipping_address: data.shippingAddress,
      billing_address: data.billingAddress || data.shippingAddress,
      fulfillment_type: data.fulfillmentType,
      shipping_method_id: data.shippingMethodId || null,
      shipping_cost: totals.shippingCost,
      subtotal: totals.subtotal,
      tax_total: totals.taxTotal,
      discount_total: totals.discountTotal,
      total: totals.total,
      status: 'pending',
      currency: data.currency,
      notes: data.notes || null,
      metadata: data.metadata || {},
    })
    .select('id, guest_token, status, total, currency, created_at')
    .single()

  if (orderError || !order) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Failed to create order.',
    })
  }

  const orderItems = totals.items.map((item) => ({
    order_id: (order as { id: string }).id,
    organization_id: organizationId,
    product_id: item.productId,
    plant_catalog_id: item.plantCatalogId,
    sku: item.sku,
    name: item.name,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    total_price: item.totalPrice,
    tax_rate_percent: item.taxRatePercent,
    tax_amount: item.taxAmount,
    metadata: {},
  }))

  const { error: itemsError } = await serviceClient.from('order_items').insert(orderItems)

  if (itemsError) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Failed to create order items.',
    })
  }

  setResponseStatus(event, 201)
  return {
    success: true,
    data: {
      id: (order as { id: string }).id,
      guestToken: (order as { guest_token: string | null }).guest_token,
      status: (order as { status: string }).status,
      total: (order as { total: number }).total,
      currency: (order as { currency: string }).currency,
      createdAt: (order as { created_at: string }).created_at,
    },
  }
})

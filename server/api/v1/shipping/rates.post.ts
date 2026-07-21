import { serverSupabaseServiceRole } from '#supabase/server'

defineRouteMeta({
  openAPI: {
    tags: ['Shipping'],
    summary: 'Calculate shipping rates',
    description:
      'Calculates available shipping rates for a cart. The organization is inferred from the products.\n\n' +
      'No authentication required for public checkout previews.',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['items', 'shippingAddress'],
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['productId', 'quantity'],
                  properties: {
                    productId: { type: 'string', format: 'uuid' },
                    quantity: { type: 'integer', minimum: 1 },
                  },
                },
              },
              shippingAddress: {
                type: 'object',
                required: ['country'],
                properties: {
                  country: { type: 'string', example: 'DE' },
                  zip: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    responses: {
      200: { description: 'Shipping rates' },
      400: { description: 'Bad request' },
      500: { description: 'Internal server error' },
    },
  },
})

interface ShippingMethodRow {
  id: string
  name: string
  provider: string | null
  base_cost: number
  free_threshold: number | null
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const items = body.items as { productId: string; quantity: number }[] | undefined
  const _shippingAddress = body.shippingAddress as { country: string; zip?: string } | undefined

  if (!items || items.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'At least one item is required.',
    })
  }

  const client = await serverSupabaseServiceRole(event)
  const productIds = items.map((i) => i.productId)

  const { data: products, error: productsError } = await client
    .from('products')
    .select('id, price, organization_id, is_active')
    .in('id', productIds)

  if (productsError || !products || products.length !== productIds.length) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'One or more products not found.',
    })
  }

  const productRows = products as { id: string; price: number; organization_id: string; is_active: boolean }[]
  const orgSet = new Set(productRows.map((p) => p.organization_id))
  if (orgSet.size !== 1) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'All products must belong to the same organization.',
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
  const productMap = new Map(productRows.map((p) => [p.id, p]))

  const subtotal = roundMoney(
    items.reduce((sum, item) => {
      const product = productMap.get(item.productId)
      return sum + (product ? Number(product.price) * item.quantity : 0)
    }, 0),
  )

  const { data: methods, error: methodsError } = await client
    .from('shipping_methods')
    .select('id, name, provider, base_cost, free_threshold')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (methodsError) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Failed to fetch shipping methods.',
    })
  }

  const rates = (methods as ShippingMethodRow[] || []).map((method) => {
    const baseCost = Number(method.base_cost) || 0
    const freeThreshold = method.free_threshold ? Number(method.free_threshold) : null
    const cost = freeThreshold !== null && subtotal >= freeThreshold ? 0 : baseCost
    return {
      id: method.id,
      name: method.name,
      provider: method.provider,
      cost: roundMoney(cost),
      freeThreshold,
    }
  })

  return {
    success: true,
    data: {
      subtotal,
      currency: 'EUR',
      rates,
    },
  }
})

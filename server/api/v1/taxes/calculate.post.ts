import { serverSupabaseServiceRole } from '#supabase/server'

defineRouteMeta({
  openAPI: {
    tags: ['Taxes'],
    summary: 'Calculate taxes',
    description:
      'Calculates taxes for a cart based on the shipping address. The organization is inferred from the products.',
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
                  required: ['productId', 'quantity', 'unitPrice'],
                  properties: {
                    productId: { type: 'string', format: 'uuid' },
                    quantity: { type: 'integer', minimum: 1 },
                    unitPrice: { type: 'number' },
                  },
                },
              },
              shippingAddress: {
                type: 'object',
                required: ['country'],
                properties: {
                  country: { type: 'string', example: 'DE' },
                  region: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    responses: {
      200: { description: 'Tax calculation result' },
      400: { description: 'Bad request' },
      500: { description: 'Internal server error' },
    },
  },
})

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

interface TaxRateRow {
  id: string
  name: string
  rate_percent: number
  country: string | null
  region: string | null
  applies_to_all: boolean
  product_ids: string[] | null
  priority: number
}

interface TaxLine {
  taxRateId: string
  name: string
  ratePercent: number
  taxableAmount: number
  taxAmount: number
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const items = body.items as { productId: string; quantity: number; unitPrice: number }[] | undefined
  const shippingAddress = body.shippingAddress as { country: string; region?: string } | undefined

  if (!items || items.length === 0 || !shippingAddress) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Items and shippingAddress are required.',
    })
  }

  const client = await serverSupabaseServiceRole(event)
  const productIds = items.map((i) => i.productId)

  const { data: products, error: productsError } = await client
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
  const orgSet = new Set(productRows.map((p) => p.organization_id))
  if (orgSet.size !== 1) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'All products must belong to the same organization.',
    })
  }

  const organizationId = productRows[0]!.organization_id
  const country = shippingAddress.country.toUpperCase()
  const region = (shippingAddress.region || '').toLowerCase()

  const { data: taxRates, error: taxError } = await client
    .from('tax_rates')
    .select('id, name, rate_percent, country, region, applies_to_all, product_ids, priority')
    .eq('organization_id', organizationId)
    .eq('is_active', true)

  if (taxError) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Failed to fetch tax rates.',
    })
  }

  const rates = (taxRates || []) as TaxRateRow[]
  const lines: TaxLine[] = []

  for (const item of items) {
    const taxableAmount = roundMoney(item.unitPrice * item.quantity)
    const matching = rates
      .filter((rate) => {
        const countryMatch = !rate.country || rate.country.toUpperCase() === country
        const regionMatch = !rate.region || rate.region.toLowerCase() === region
        const productMatch = rate.applies_to_all || (rate.product_ids || []).includes(item.productId)
        return countryMatch && regionMatch && productMatch
      })
      .sort((a, b) => (b.priority || 0) - (a.priority || 0))

    const bestRate = matching[0]
    if (bestRate) {
      const taxAmount = roundMoney((taxableAmount * Number(bestRate.rate_percent)) / 100)
      lines.push({
        taxRateId: bestRate.id,
        name: bestRate.name,
        ratePercent: Number(bestRate.rate_percent),
        taxableAmount,
        taxAmount,
      })
    }
  }

  const totalTax = roundMoney(lines.reduce((sum, line) => sum + line.taxAmount, 0))
  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0))

  return {
    success: true,
    data: {
      subtotal,
      totalTax,
      total: roundMoney(subtotal + totalTax),
      currency: 'EUR',
      lines,
    },
  }
})

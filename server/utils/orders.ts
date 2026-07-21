import type { SupabaseClient } from '@supabase/supabase-js'

export interface OrderItemInput {
  productId: string
  quantity: number
}

export interface AddressInput {
  country: string
  region?: string | null
  zip?: string | null
}

export interface CalculatedOrderItem {
  productId: string
  sku: string
  name: string
  plantCatalogId: string | null
  quantity: number
  unitPrice: number
  totalPrice: number
  taxRatePercent: number
  taxAmount: number
}

export interface CalculatedOrderTotals {
  items: CalculatedOrderItem[]
  subtotal: number
  shippingCost: number
  taxTotal: number
  discountTotal: number
  total: number
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

interface ProductRow {
  id: string
  sku: string
  name: string
  plant_catalog_id: string | null
  price: string | number
}

interface TaxRateRow {
  rate_percent: string | number
  country: string | null
  region: string | null
  applies_to_all: boolean
  product_ids: string[] | null
  priority: number
}

interface ShippingMethodRow {
  base_cost: string | number
  free_threshold: string | number | null
}

interface InventoryRow {
  id: string
  quantity: string | number
  reserved_quantity: string | number
}

export async function calculateOrderTotals(
  client: SupabaseClient,
  organizationId: string,
  items: OrderItemInput[],
  shippingAddress: AddressInput,
  shippingMethodId?: string | null,
): Promise<CalculatedOrderTotals> {
  const productIds = items.map((i) => i.productId)

  const { data: products, error: productsError } = await client
    .from('products')
    .select('id, sku, name, plant_catalog_id, price')
    .eq('organization_id', organizationId)
    .in('id', productIds)

  if (productsError || !products) {
    throw new Error('Failed to fetch products for order calculation')
  }

  const productMap = new Map((products as ProductRow[]).map((p) => [p.id, p]))

  const calculatedItems: CalculatedOrderItem[] = []
  let subtotal = 0

  for (const item of items) {
    const product = productMap.get(item.productId)
    if (!product) {
      throw new Error(`Product ${item.productId} not found`)
    }
    const unitPrice = Number(product.price) || 0
    const totalPrice = roundMoney(unitPrice * item.quantity)
    calculatedItems.push({
      productId: item.productId,
      sku: product.sku,
      name: product.name,
      plantCatalogId: product.plant_catalog_id,
      quantity: item.quantity,
      unitPrice,
      totalPrice,
      taxRatePercent: 0,
      taxAmount: 0,
    })
    subtotal += totalPrice
  }

  // Fetch active tax rates for organization
  const { data: taxRates, error: taxError } = await client
    .from('tax_rates')
    .select('rate_percent, country, region, applies_to_all, product_ids, priority')
    .eq('organization_id', organizationId)
    .eq('is_active', true)

  if (!taxError && taxRates) {
    const country = (shippingAddress.country || '').toUpperCase()
    const region = (shippingAddress.region || '').toLowerCase()

    for (const item of calculatedItems) {
      const matching = (taxRates as TaxRateRow[])
        .filter((rate: TaxRateRow) => {
          const rateCountry = (rate.country || '').toUpperCase()
          const rateRegion = (rate.region || '').toLowerCase()
          const countryMatch = !rate.country || rateCountry === country
          const regionMatch = !rate.region || rateRegion === region
          const productMatch = rate.applies_to_all || (rate.product_ids || []).includes(item.productId)
          return countryMatch && regionMatch && productMatch
        })
        .sort((a: TaxRateRow, b: TaxRateRow) => (b.priority || 0) - (a.priority || 0))

      const bestRate = matching[0]
      if (bestRate) {
        item.taxRatePercent = Number(bestRate.rate_percent) || 0
        item.taxAmount = roundMoney((item.totalPrice * item.taxRatePercent) / 100)
      }
    }
  }

  const taxTotal = roundMoney(calculatedItems.reduce((sum, item) => sum + item.taxAmount, 0))

  let shippingCost = 0
  if (shippingMethodId) {
    const { data: method, error: methodError } = await client
      .from('shipping_methods')
      .select('base_cost, free_threshold')
      .eq('id', shippingMethodId)
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .single()

    if (!methodError && method) {
      const m = method as ShippingMethodRow
      const freeThreshold = m.free_threshold ? Number(m.free_threshold) : null
      if (freeThreshold === null || subtotal < freeThreshold) {
        shippingCost = Number(m.base_cost) || 0
      }
    }
  }

  const discountTotal = 0
  const total = roundMoney(subtotal + shippingCost + taxTotal - discountTotal)

  return {
    items: calculatedItems,
    subtotal: roundMoney(subtotal),
    shippingCost: roundMoney(shippingCost),
    taxTotal,
    discountTotal,
    total,
  }
}

export async function reserveInventory(
  client: SupabaseClient,
  organizationId: string,
  locationId: string,
  items: { productId: string; quantity: number }[],
): Promise<void> {
  for (const item of items) {
    const { data: inventory, error } = await client
      .from('product_inventory')
      .select('id, quantity, reserved_quantity')
      .eq('organization_id', organizationId)
      .eq('location_id', locationId)
      .eq('product_id', item.productId)
      .single()

    if (error || !inventory) {
      throw new Error(`No inventory record found for product ${item.productId} at location ${locationId}`)
    }

    const inv = inventory as InventoryRow
    const available = Number(inv.quantity) - Number(inv.reserved_quantity)
    if (available < item.quantity) {
      throw new Error(`Insufficient stock for product ${item.productId}: available ${available}, requested ${item.quantity}`)
    }

    const { error: updateError } = await client
      .from('product_inventory')
      .update({ reserved_quantity: Number(inv.reserved_quantity) + item.quantity })
      .eq('id', inv.id)

    if (updateError) {
      throw new Error(`Failed to reserve inventory for product ${item.productId}`)
    }
  }
}

export async function releaseInventory(
  client: SupabaseClient,
  organizationId: string,
  locationId: string,
  items: { productId: string; quantity: number }[],
): Promise<void> {
  for (const item of items) {
    const { data: inventory, error } = await client
      .from('product_inventory')
      .select('id, reserved_quantity')
      .eq('organization_id', organizationId)
      .eq('location_id', locationId)
      .eq('product_id', item.productId)
      .single()

    if (error || !inventory) continue

    const inv = inventory as InventoryRow
    const newReserved = Math.max(0, Number(inv.reserved_quantity) - item.quantity)

    await client
      .from('product_inventory')
      .update({ reserved_quantity: newReserved })
      .eq('id', inv.id)
  }
}

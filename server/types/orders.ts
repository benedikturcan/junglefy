import { z } from 'zod'

export const OrderAddressSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  street: z.string().min(1),
  additional: z.string().optional().nullable(),
  zip: z.string().min(1),
  city: z.string().min(1),
  country: z.string().length(2),
  phone: z.string().optional().nullable(),
})

export const OrderItemInputSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
})

export const CreateOrderSchema = z.object({
  locationId: z.string().uuid().optional().nullable(),
  customerEmail: z.string().email(),
  customerPhone: z.string().optional().nullable(),
  customerName: z.string().optional().nullable(),
  shippingAddress: OrderAddressSchema,
  billingAddress: OrderAddressSchema.optional().nullable(),
  fulfillmentType: z.enum(['shipping', 'pickup']).default('shipping'),
  shippingMethodId: z.string().uuid().optional().nullable(),
  currency: z.string().length(3).default('EUR'),
  notes: z.string().optional().nullable(),
  metadata: z.any().default({}).optional(),
  items: z.array(OrderItemInputSchema).min(1),
})

export const UpdateOrderSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']).optional(),
  locationId: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
  metadata: z.any().optional(),
})

export type CreateOrder = z.infer<typeof CreateOrderSchema>
export type UpdateOrder = z.infer<typeof UpdateOrderSchema>

export interface OrderItemResponse {
  id: string
  orderId: string
  organizationId: string
  productId: string
  plantCatalogId: string | null
  sku: string
  name: string
  quantity: number
  unitPrice: number
  totalPrice: number
  taxRatePercent: number
  taxAmount: number
}

export interface OrderResponse {
  id: string
  organizationId: string
  locationId: string | null
  userId: string | null
  guestToken: string | null
  customerEmail: string
  customerPhone: string | null
  customerName: string | null
  shippingAddress: Record<string, unknown>
  billingAddress: Record<string, unknown> | null
  fulfillmentType: 'shipping' | 'pickup'
  shippingMethodId: string | null
  shippingCost: number
  subtotal: number
  taxTotal: number
  discountTotal: number
  total: number
  status: string
  currency: string
  notes: string | null
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
  items?: OrderItemResponse[]
}

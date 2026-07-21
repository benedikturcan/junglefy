import { z } from 'zod'

// Product Category Schema
export const CategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  parentId: z.string().uuid().nullable().optional(),
  imageUrl: z.string().url().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type Category = z.infer<typeof CategorySchema>

// Plant Care Level
export const CareLevelSchema = z.enum(['easy', 'moderate', 'expert'])
export type CareLevel = z.infer<typeof CareLevelSchema>

// Light Requirements
export const LightRequirementSchema = z.enum(['low', 'medium', 'bright', 'direct'])
export type LightRequirement = z.infer<typeof LightRequirementSchema>

// Water Frequency
export const WaterFrequencySchema = z.enum(['daily', 'twice-weekly', 'weekly', 'bi-weekly', 'monthly'])
export type WaterFrequency = z.infer<typeof WaterFrequencySchema>

// Plant Attributes
export const PlantAttributesSchema = z.object({
  careLevel: CareLevelSchema,
  lightRequirement: LightRequirementSchema,
  waterFrequency: WaterFrequencySchema,
  petFriendly: z.boolean(),
  airPurifying: z.boolean(),
  height: z.object({
    min: z.number().positive(),
    max: z.number().positive(),
    unit: z.enum(['cm', 'inch']),
  }).optional(),
  bloomingSeason: z.array(z.enum(['spring', 'summer', 'autumn', 'winter'])).optional(),
  origin: z.string().optional(),
  scientificName: z.string().optional(),
})

export type PlantAttributes = z.infer<typeof PlantAttributesSchema>

// Product Image
export const ProductImageSchema = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  alt: z.string(),
  isPrimary: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
})

export type ProductImage = z.infer<typeof ProductImageSchema>

// Product Variant (different pot sizes, etc.)
export const ProductVariantSchema = z.object({
  id: z.string().uuid(),
  sku: z.string().min(1),
  name: z.string().min(1),
  price: z.number().positive(),
  compareAtPrice: z.number().positive().optional(),
  stock: z.number().int().min(0),
  potSize: z.string().optional(),
  potColor: z.string().optional(),
  weight: z.number().positive().optional(),
  isDefault: z.boolean().default(false),
})

export type ProductVariant = z.infer<typeof ProductVariantSchema>

// Main Product Schema
export const ProductSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string(),
  shortDescription: z.string().optional(),
  categoryId: z.string().uuid(),
  images: z.array(ProductImageSchema),
  variants: z.array(ProductVariantSchema).min(1),
  attributes: PlantAttributesSchema,
  tags: z.array(z.string()),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type Product = z.infer<typeof ProductSchema>

// Cart Item
export const CartItemSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  variantId: z.string().uuid(),
  quantity: z.number().int().positive(),
  price: z.number().positive(),
})

export type CartItem = z.infer<typeof CartItemSchema>

// Cart
export const CartSchema = z.object({
  id: z.string().uuid(),
  items: z.array(CartItemSchema),
  subtotal: z.number().min(0),
  tax: z.number().min(0),
  shipping: z.number().min(0),
  total: z.number().min(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type Cart = z.infer<typeof CartSchema>

// Customer Address
export const AddressSchema = z.object({
  id: z.string().uuid(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  company: z.string().optional(),
  street: z.string().min(1),
  street2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().optional(),
  postalCode: z.string().min(1),
  country: z.string().min(2).max(2),
  phone: z.string().optional(),
  isDefault: z.boolean().default(false),
})

export type Address = z.infer<typeof AddressSchema>

// Customer
export const CustomerSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  addresses: z.array(AddressSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type Customer = z.infer<typeof CustomerSchema>

// Order Status
export const OrderStatusSchema = z.enum([
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
])

export type OrderStatus = z.infer<typeof OrderStatusSchema>

// Order Item
export const OrderItemSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  variantId: z.string().uuid(),
  productName: z.string(),
  variantName: z.string(),
  sku: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().positive(),
  totalPrice: z.number().positive(),
})

export type OrderItem = z.infer<typeof OrderItemSchema>

// Order
export const OrderSchema = z.object({
  id: z.string().uuid(),
  orderNumber: z.string(),
  customerId: z.string().uuid(),
  items: z.array(OrderItemSchema),
  status: OrderStatusSchema,
  shippingAddress: AddressSchema,
  billingAddress: AddressSchema,
  subtotal: z.number().min(0),
  tax: z.number().min(0),
  shipping: z.number().min(0),
  discount: z.number().min(0).default(0),
  total: z.number().min(0),
  notes: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type Order = z.infer<typeof OrderSchema>

// API Response Types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: Record<string, string[]>
  }
  meta?: {
    page?: number
    perPage?: number
    total?: number
    totalPages?: number
  }
}

export interface PaginationParams {
  page?: number
  perPage?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface ProductFilters extends PaginationParams {
  categoryId?: string
  careLevel?: CareLevel
  lightRequirement?: LightRequirement
  petFriendly?: boolean
  airPurifying?: boolean
  minPrice?: number
  maxPrice?: number
  search?: string
  tags?: string[]
}

import { z } from 'zod'

// ============================================
// PRODUCT SCHEMAS
// ============================================

export const CreateProductSchema = z.object({
  categoryId: z.string().uuid().optional().nullable(),
  plantCatalogId: z.string().uuid().optional().nullable(),
  sku: z.string().min(1).max(100),
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100).optional(),
  description: z.string().optional().nullable(),
  shortDescription: z.string().optional().nullable(),
  price: z.number().positive(),
  comparePrice: z.number().positive().optional().nullable(),
  costPrice: z.number().positive().optional().nullable(),
  trackInventory: z.boolean().default(true),
  weight: z.number().positive().optional().nullable(),
  dimensions: z.any().default({}).optional(),
  tags: z.any().default([]).optional(),
  metadata: z.any().default({}).optional(),
  status: z.enum(['draft', 'active', 'archived']).default('draft'),
  isActive: z.boolean().default(true),
})

export const UpdateProductSchema = CreateProductSchema.partial().omit({ sku: true })

export type CreateProduct = z.infer<typeof CreateProductSchema>
export type UpdateProduct = z.infer<typeof UpdateProductSchema>

export interface ProductImageResponse {
  id: string
  productId: string
  storagePath: string
  url: string
  altText: string | null
  position: number
  isPrimary: boolean
  createdAt: string
}

export interface ProductResponse {
  id: string
  organizationId: string
  categoryId: string | null
  plantCatalogId: string | null
  sku: string
  name: string
  slug: string
  description: string | null
  shortDescription: string | null
  primaryImage: ProductImageResponse | null
  images?: ProductImageResponse[]
  price: number
  comparePrice: number | null
  costPrice: number | null
  trackInventory: boolean
  inventoryQuantity: number
  weight: number | null
  dimensions: Record<string, unknown>
  tags: unknown[]
  metadata: Record<string, unknown>
  status: 'draft' | 'active' | 'archived'
  isActive: boolean
  createdAt: string
  updatedAt: string
}

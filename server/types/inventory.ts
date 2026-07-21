import { z } from 'zod'

// ============================================
// INVENTORY SCHEMAS
// ============================================

export const UpdateInventorySchema = z.object({
  quantity: z.number().int().min(0).optional(),
  reservedQuantity: z.number().int().min(0).optional(),
  reorderLevel: z.number().int().min(0).optional(),
  allowBackorder: z.boolean().optional(),
})

export type UpdateInventory = z.infer<typeof UpdateInventorySchema>

export interface InventoryContext {
  id: string
  organizationId: string
  locationId: string | null
  productId: string
  quantity: number
  reservedQuantity: number
  availableQuantity: number
  reorderLevel: number
  allowBackorder: boolean
  updatedAt: string
}

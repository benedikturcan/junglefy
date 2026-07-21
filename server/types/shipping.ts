import { z } from 'zod'

export const ShippingZoneSchema = z.object({
  country: z.string().length(2),
  region: z.string().optional().nullable(),
})

export const CreateShippingMethodSchema = z.object({
  name: z.string().min(1).max(255),
  provider: z.string().max(100).optional().nullable(),
  baseCost: z.number().min(0),
  freeThreshold: z.number().min(0).optional().nullable(),
  zones: z.array(ShippingZoneSchema).default([]).optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
})

export const UpdateShippingMethodSchema = CreateShippingMethodSchema.partial()

export type CreateShippingMethod = z.infer<typeof CreateShippingMethodSchema>
export type UpdateShippingMethod = z.infer<typeof UpdateShippingMethodSchema>

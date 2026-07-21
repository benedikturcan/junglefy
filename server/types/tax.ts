import { z } from 'zod'

export const CreateTaxRateSchema = z.object({
  name: z.string().min(1).max(255),
  ratePercent: z.number().min(0).max(100),
  country: z.string().length(2).optional().nullable(),
  region: z.string().max(100).optional().nullable(),
  appliesToAll: z.boolean().default(true),
  productIds: z.array(z.string().uuid()).default([]).optional(),
  isActive: z.boolean().default(true),
  priority: z.number().int().default(0),
})

export const UpdateTaxRateSchema = CreateTaxRateSchema.partial()

export type CreateTaxRate = z.infer<typeof CreateTaxRateSchema>
export type UpdateTaxRate = z.infer<typeof UpdateTaxRateSchema>

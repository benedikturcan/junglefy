import { z } from 'zod'

const TaxRateBaseSchema = z.object({
  name: z.string().min(1).max(255),
  ratePercent: z.number().min(0).max(100),
  country: z.string().length(2).optional().nullable(),
  region: z.string().max(100).optional().nullable(),
  isActive: z.boolean().default(true),
  priority: z.number().int().default(0),
})

export const CreateTaxRateSchema = TaxRateBaseSchema
  .extend({
    appliesToAll: z.boolean().default(true),
    productId: z.string().uuid().optional().nullable(),
    categoryId: z.string().uuid().optional().nullable(),
  })
  .refine(
    (data) => {
      const scopes = [
        data.appliesToAll,
        Boolean(data.productId),
        Boolean(data.categoryId),
      ].filter(Boolean).length
      return scopes === 1
    },
    {
      message:
        'Exactly one scope must be selected: appliesToAll=true, productId or categoryId.',
      path: ['appliesToAll'],
    },
  )

export const UpdateTaxRateSchema = TaxRateBaseSchema.partial()
  .extend({
    appliesToAll: z.boolean().optional(),
    productId: z.string().uuid().optional().nullable(),
    categoryId: z.string().uuid().optional().nullable(),
  })
  .refine(
    (data) => {
      const scopes = [
        data.appliesToAll,
        Boolean(data.productId),
        Boolean(data.categoryId),
      ].filter(Boolean).length
      return scopes === 0 || scopes === 1
    },
    {
      message:
        'At most one scope must be selected: appliesToAll, productId or categoryId.',
      path: ['appliesToAll'],
    },
  )

export type CreateTaxRate = z.infer<typeof CreateTaxRateSchema>
export type UpdateTaxRate = z.infer<typeof UpdateTaxRateSchema>

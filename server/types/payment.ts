import { z } from 'zod'

export const CreatePaymentProviderSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(255),
  isActive: z.boolean().default(true),
  config: z.any().default({}).optional(),
  sortOrder: z.number().int().default(0),
})

export const UpdatePaymentProviderSchema = CreatePaymentProviderSchema.partial()

export type CreatePaymentProvider = z.infer<typeof CreatePaymentProviderSchema>
export type UpdatePaymentProvider = z.infer<typeof UpdatePaymentProviderSchema>

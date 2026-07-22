import { z } from 'zod'

export const CreateIntegrationSchema = z.object({
  providerCode: z.string().min(1).max(50),
  status: z.enum(['active', 'paused']).default('active'),
  config: z.record(z.string(), z.unknown()).default({}),
  credentials: z.record(z.string(), z.unknown()).optional(),
  scopesGranted: z.array(z.string()).default([]),
})

export const UpdateIntegrationSchema = CreateIntegrationSchema.partial()

export const InvokeIntegrationSchema = z.object({
  eventType: z.string().min(1).max(100),
  payload: z.record(z.string(), z.unknown()).default({}),
})

export type CreateIntegration = z.infer<typeof CreateIntegrationSchema>
export type UpdateIntegration = z.infer<typeof UpdateIntegrationSchema>
export type InvokeIntegration = z.infer<typeof InvokeIntegrationSchema>

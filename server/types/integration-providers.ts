import { z } from 'zod'

export const CreateIntegrationProviderSchema = z.object({
  code: z.string().min(1).max(50).regex(/^[a-z0-9_-]+$/),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  authType: z.enum(['api_key', 'oauth2', 'webhook_only']),
  capabilities: z.array(z.string()).default([]),
  configSchema: z.record(z.string(), z.unknown()).default({}),
  isActive: z.boolean().default(true),
})

export const UpdateIntegrationProviderSchema = CreateIntegrationProviderSchema.partial().omit({ code: true })

export type CreateIntegrationProvider = z.infer<typeof CreateIntegrationProviderSchema>
export type UpdateIntegrationProvider = z.infer<typeof UpdateIntegrationProviderSchema>

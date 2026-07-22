import { createHmac } from 'node:crypto'
import type { IntegrationEventContext, IntegrationHandler, IntegrationProvider } from '#server/utils/integrations'
import { decryptCredentials } from '#server/utils/integrations'

export const outgoingWebhookProvider: IntegrationProvider = {
  code: 'outgoing_webhook',
  name: 'Outgoing Webhook',
  authType: 'webhook_only',
  capabilities: ['outgoing_webhook'],
  configSchema: {
    type: 'object',
    required: ['url'],
    properties: {
      url: { type: 'string', format: 'uri' },
      secret: { type: 'string' },
      headers: { type: 'object' },
    },
  },
}

export const outgoingWebhookHandler: IntegrationHandler = {
  code: 'outgoing_webhook',
  async handleEvent(ctx: IntegrationEventContext): Promise<{ success: boolean; error?: string }> {
    const config = ctx.integration.config as {
      url?: string
      secret?: string
      headers?: Record<string, string>
    }

    const url = config.url
    if (!url) {
      return { success: false, error: 'Missing webhook URL in integration config' }
    }

    const payload = JSON.stringify({
      event: ctx.eventType,
      data: ctx.payload,
      integration_id: ctx.integration.id,
      organization_id: ctx.integration.organization_id,
      timestamp: new Date().toISOString(),
    })

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...config.headers,
    }

    if (config.secret) {
      let secret = config.secret
      if (ctx.integration.encrypted_credentials) {
        try {
          secret = decryptCredentials(ctx.integration.encrypted_credentials)
        } catch {
          return { success: false, error: 'Failed to decrypt webhook secret' }
        }
      }
      const signature = createHmac('sha256', secret).update(payload).digest('hex')
      headers['X-Webhook-Signature'] = `sha256=${signature}`
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: payload,
      })

      if (!response.ok) {
        return { success: false, error: `Webhook returned status ${response.status}` }
      }

      return { success: true }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Webhook request failed'
      return { success: false, error: message }
    }
  },
}

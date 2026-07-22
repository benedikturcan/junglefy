import { registerIntegrationHandler } from '#server/utils/integrations'
import { outgoingWebhookHandler } from '#server/integrations/providers/outgoing-webhook'

export default defineNitroPlugin(() => {
  registerIntegrationHandler(outgoingWebhookHandler)
})

import { registerIntegrationHandler } from '#server/utils/integrations'
import { outgoingWebhookHandler } from '#server/integrations/providers/outgoing-webhook'
import { openweatherHandler } from '#server/integrations/providers/openweather'

export default defineNitroPlugin(() => {
  registerIntegrationHandler(outgoingWebhookHandler)
  registerIntegrationHandler(openweatherHandler)
})

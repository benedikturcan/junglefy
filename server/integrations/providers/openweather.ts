import { decryptCredentials } from '#server/utils/integrations'
import type { IntegrationEventContext, IntegrationHandler, IntegrationProvider } from '#server/utils/integrations'

const API_BASE = 'https://api.openweathermap.org/data/2.5'

interface OpenWeatherConfig {
  q?: string
  lat?: number
  lon?: number
  units?: 'standard' | 'metric' | 'imperial'
  lang?: string
}

interface OpenWeatherCredentials {
  apiKey: string
}

export const openweatherProvider: IntegrationProvider = {
  code: 'openweather',
  name: 'OpenWeather',
  authType: 'api_key',
  capabilities: ['weather'],
  configSchema: {
    type: 'object',
    required: [],
    properties: {
      q: {
        type: 'string',
        description: 'City name, state code (US only) and country code divided by comma, e.g. London,GB',
      },
      lat: {
        type: 'number',
        description: 'Latitude (required if q is not provided)',
      },
      lon: {
        type: 'number',
        description: 'Longitude (required if q is not provided)',
      },
      units: {
        type: 'string',
        enum: ['standard', 'metric', 'imperial'],
        default: 'metric',
        description: 'Units of measurement',
      },
      lang: {
        type: 'string',
        default: 'en',
        description: 'Language code for output, e.g. de, en',
      },
    },
    oneOf: [{ required: ['q'] }, { required: ['lat', 'lon'] }],
  },
}

function parseConfig(config: unknown): { valid: false; error: string } | { valid: true; config: OpenWeatherConfig } {
  if (typeof config !== 'object' || config === null || Array.isArray(config)) {
    return { valid: false, error: 'Config must be an object' }
  }

  const c = config as Record<string, unknown>

  const hasCity = typeof c.q === 'string' && c.q.length > 0
  const hasCoords = typeof c.lat === 'number' && typeof c.lon === 'number'

  if (!hasCity && !hasCoords) {
    return { valid: false, error: 'Config must contain either "q" (city) or "lat" and "lon"' }
  }

  const units = c.units
  if (units !== undefined && units !== 'standard' && units !== 'metric' && units !== 'imperial') {
    return { valid: false, error: 'units must be one of standard, metric, imperial' }
  }

  return {
    valid: true,
    config: {
      q: hasCity ? (c.q as string) : undefined,
      lat: hasCoords ? (c.lat as number) : undefined,
      lon: hasCoords ? (c.lon as number) : undefined,
      units: (units as OpenWeatherConfig['units']) || 'metric',
      lang: typeof c.lang === 'string' ? c.lang : 'en',
    },
  }
}

function parseCredentials(credentials: unknown): { valid: false; error: string } | { valid: true; creds: OpenWeatherCredentials } {
  if (typeof credentials !== 'object' || credentials === null || Array.isArray(credentials)) {
    return { valid: false, error: 'Credentials must be an object' }
  }

  const apiKey = (credentials as Record<string, unknown>).apiKey
  if (typeof apiKey !== 'string' || apiKey.length === 0) {
    return { valid: false, error: 'Credentials must contain a non-empty apiKey' }
  }

  return { valid: true, creds: { apiKey } }
}

export const openweatherHandler: IntegrationHandler = {
  code: 'openweather',
  validateConfig(config: unknown, credentials: unknown): { success: boolean; error?: string } {
    const configResult = parseConfig(config)
    if (!configResult.valid) {
      return { success: false, error: configResult.error }
    }

    const credsResult = parseCredentials(credentials)
    if (!credsResult.valid) {
      return { success: false, error: credsResult.error }
    }

    return { success: true }
  },
  async handleEvent(ctx: IntegrationEventContext): Promise<{ success: boolean; error?: string; data?: unknown }> {
    const configResult = parseConfig(ctx.integration.config)
    if (!configResult.valid) {
      return { success: false, error: configResult.error }
    }

    let rawCredentials: string
    if (!ctx.integration.encrypted_credentials) {
      return { success: false, error: 'Missing OpenWeather API key' }
    }

    try {
      rawCredentials = decryptCredentials(ctx.integration.encrypted_credentials)
    } catch {
      return { success: false, error: 'Failed to decrypt OpenWeather API key' }
    }

    const parsedCredentials = parseCredentials(JSON.parse(rawCredentials))
    if (!parsedCredentials.valid) {
      return { success: false, error: parsedCredentials.error }
    }

    const { apiKey } = parsedCredentials.creds
    const { q, lat, lon, units, lang } = configResult.config

    let url: string
    if (q) {
      url = `${API_BASE}/weather?q=${encodeURIComponent(q)}&appid=${apiKey}&units=${units}&lang=${lang}`
    } else {
      url = `${API_BASE}/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=${units}&lang=${lang}`
    }

    try {
      const response = await fetch(url)
      const data = await response.json()

      if (!response.ok) {
        const message = (data as { message?: string })?.message || `OpenWeather returned ${response.status}`
        return { success: false, error: message }
      }

      return { success: true, data }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'OpenWeather request failed'
      return { success: false, error: message }
    }
  },
}

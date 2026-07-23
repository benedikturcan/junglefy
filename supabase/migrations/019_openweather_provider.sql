INSERT INTO integration_providers (code, name, description, auth_type, capabilities, config_schema)
VALUES (
  'openweather',
  'OpenWeather',
  'Fetch current weather data from OpenWeatherMap.',
  'api_key',
  '["weather"]',
  '{
    "type": "object",
    "required": [],
    "properties": {
      "q": {
        "type": "string",
        "description": "City name, state code (US only) and country code divided by comma, e.g. London,GB"
      },
      "lat": {
        "type": "number",
        "description": "Latitude (required if q is not provided)"
      },
      "lon": {
        "type": "number",
        "description": "Longitude (required if q is not provided)"
      },
      "units": {
        "type": "string",
        "enum": ["standard", "metric", "imperial"],
        "default": "metric",
        "description": "Units of measurement"
      },
      "lang": {
        "type": "string",
        "default": "en",
        "description": "Language code for output, e.g. de, en"
      }
    },
    "oneOf": [
      { "required": ["q"] },
      { "required": ["lat", "lon"] }
    ]
  }'::jsonb
)
ON CONFLICT (code) DO NOTHING;

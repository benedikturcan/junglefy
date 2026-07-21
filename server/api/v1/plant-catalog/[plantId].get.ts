import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import type { ApiKeyContext } from '#server/types/api-keys'

defineRouteMeta({
  openAPI: {
    tags: ['Plant Catalog'],
    summary: 'Get plant details',
    description: 
      'Returns detailed information about a specific plant from the global catalog.\n\n' +
      '**Authorization:** \n\n' +
      'JWT Bearer Token or API Key authentication.',
    security: [{ bearerAuth: [] }, { apiKey: [] }],
    parameters: [
      {
        name: 'plantId',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
        description: 'Plant catalog entry ID',
      },
    ],
    responses: {
      200: {
        description: 'Plant details',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: true },
                data: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    botanicalName: { type: 'string' },
                    commonNames: { type: 'array', items: { type: 'string' } },
                    plantType: { type: 'string' },
                    lightRequirement: { type: 'string' },
                    waterFrequency: { type: 'string' },
                    difficultyLevel: { type: 'string' },
                    petFriendly: { type: 'boolean' },
                    airPurifying: { type: 'boolean' },
                    growthRate: { type: 'string' },
                    maxHeightCm: { type: 'integer' },
                    bloomSeason: { type: 'array', items: { type: 'string' } },
                    fragrant: { type: 'boolean' },
                    origin: { type: 'string' },
                    originCountry: { type: 'string' },
                    species: { type: 'string' },
                    category: { type: 'string' },
                    isHybrid: { type: 'boolean' },
                    hasIridescentLeaves: { type: 'boolean' },
                    careInstructions: { type: 'string' },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
      401: { description: 'Unauthorized - authentication required' },
      404: { description: 'Plant not found' },
    },
  },
})

export default defineEventHandler(async (event) => {
  const apiKey = event.context.apiKey as ApiKeyContext | undefined
  let client

  if (apiKey) {
    client = await serverSupabaseClient(event)
  } else {
    const user = await serverSupabaseUser(event)
    if (!user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized',
        message: 'Authentication required.',
      })
    }
    client = await serverSupabaseClient(event)
  }

  const plantId = getRouterParam(event, 'plantId')
  if (!plantId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Plant ID is required.',
    })
  }

  const { data: plant, error } = await client
    .from('plant_catalog')
    .select('*')
    .eq('id', plantId)
    .single()

  if (error || !plant) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'Plant not found in catalog.',
    })
  }

  return {
    success: true,
    data: {
      id: plant.id,
      botanicalName: plant.botanical_name,
      commonNames: plant.common_names,
      plantType: plant.plant_type,
      lightRequirement: plant.light_requirement,
      waterFrequency: plant.water_frequency,
      difficultyLevel: plant.difficulty_level,
      petFriendly: plant.pet_friendly,
      airPurifying: plant.air_purifying,
      growthRate: plant.growth_rate,
      maxHeightCm: plant.max_height_cm,
      bloomSeason: plant.bloom_season,
      fragrant: plant.fragrant,
      origin: plant.origin,
      originCountry: plant.origin_country,
      species: plant.species,
      category: plant.category,
      isHybrid: plant.is_hybrid,
      hasIridescentLeaves: plant.has_iridescent_leaves,
      careInstructions: plant.care_instructions,
      createdAt: plant.created_at,
      updatedAt: plant.updated_at,
    },
  }
})

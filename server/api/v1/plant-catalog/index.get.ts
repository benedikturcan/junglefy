import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import type { ApiKeyContext } from '#server/types/api-keys'

defineRouteMeta({
  openAPI: {
    tags: ['Plant Catalog'],
    summary: 'List plants',
    description: 
      'Returns all plants from the global plant catalog with optional filters.\n\n' +
      '**Authorization:** \n\n' +
      'JWT Bearer Token or API Key authentication.',
    security: [{ bearerAuth: [] }, { apiKey: [] }],
    parameters: [
      {
        name: 'plant_type',
        in: 'query',
        required: false,
        schema: { type: 'string', enum: ['indoor', 'outdoor', 'both'] },
        description: 'Filter by plant type',
      },
      {
        name: 'light_requirement',
        in: 'query',
        required: false,
        schema: { type: 'string', enum: ['low', 'medium', 'bright_indirect', 'direct_sun'] },
        description: 'Filter by light requirement',
      },
      {
        name: 'difficulty_level',
        in: 'query',
        required: false,
        schema: { type: 'string', enum: ['beginner', 'intermediate', 'expert'] },
        description: 'Filter by difficulty level',
      },
      {
        name: 'pet_friendly',
        in: 'query',
        required: false,
        schema: { type: 'boolean' },
        description: 'Filter by pet friendliness',
      },
      {
        name: 'search',
        in: 'query',
        required: false,
        schema: { type: 'string' },
        description: 'Search by botanical name or common names',
      },
    ],
    responses: {
      200: {
        description: 'List of plants',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: true },
                data: {
                  type: 'array',
                  items: {
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
                      origin: { type: 'string' },
                      originCountry: { type: 'string' },
                      species: { type: 'string' },
                      category: { type: 'string' },
                      isHybrid: { type: 'boolean' },
                      hasIridescentLeaves: { type: 'boolean' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      401: { description: 'Unauthorized - authentication required' },
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

  const query = getQuery(event)

  let dbQuery = client
    .from('plant_catalog')
    .select('*')
    .order('botanical_name', { ascending: true })

  // Apply filters
  if (query.plant_type) {
    dbQuery = dbQuery.eq('plant_type', query.plant_type as string)
  }
  if (query.light_requirement) {
    dbQuery = dbQuery.eq('light_requirement', query.light_requirement as string)
  }
  if (query.difficulty_level) {
    dbQuery = dbQuery.eq('difficulty_level', query.difficulty_level as string)
  }
  if (query.pet_friendly !== undefined) {
    dbQuery = dbQuery.eq('pet_friendly', query.pet_friendly === 'true')
  }
  if (query.search) {
    dbQuery = dbQuery.ilike('botanical_name', `%${query.search}%`)
  }

  const { data: plants, error } = await dbQuery

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Failed to fetch plant catalog.',
    })
  }

  const transformed = plants?.map((plant) => ({
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
    origin: plant.origin,
    originCountry: plant.origin_country,
    species: plant.species,
    category: plant.category,
    isHybrid: plant.is_hybrid,
    hasIridescentLeaves: plant.has_iridescent_leaves,
  })) || []

  return {
    success: true,
    data: transformed,
  }
})

import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'
import { z } from 'zod'

const CreatePlantSchema = z.object({
  botanicalName: z.string().min(1).max(255),
  commonNames: z.array(z.string()).default([]),
  plantType: z.enum(['indoor', 'outdoor', 'both']).optional(),
  lightRequirement: z.enum(['low', 'medium', 'bright_indirect', 'direct_sun']).optional(),
  waterFrequency: z.enum(['rare', 'weekly', 'frequent', 'daily']).optional(),
  difficultyLevel: z.enum(['beginner', 'intermediate', 'expert']).optional(),
  petFriendly: z.boolean().default(false),
  airPurifying: z.boolean().default(false),
  growthRate: z.enum(['slow', 'moderate', 'fast']).optional(),
  maxHeightCm: z.number().int().positive().optional(),
  bloomSeason: z.array(z.enum(['spring', 'summer', 'autumn', 'winter'])).default([]),
  fragrant: z.boolean().default(false),
  origin: z.string().max(255).optional(),
  originCountry: z.string().max(100).optional(),
  species: z.string().max(255).optional(),
  category: z.string().max(100).optional(),
  isHybrid: z.boolean().default(false),
  hasIridescentLeaves: z.boolean().default(false),
  careInstructions: z.string().optional(),
})

defineRouteMeta({
  openAPI: {
    tags: ['Plant Catalog'],
    summary: 'Create plant entry',
    description: 
      'Creates a new plant entry in the global catalog. Only organization owners can create entries.\n\n' +
      '**Authorization:** \n\n' +
      'JWT Bearer Token only (organization owner).',
    security: [{ bearerAuth: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['botanicalName'],
            properties: {
              botanicalName: { type: 'string', description: 'Scientific plant name', example: 'Monstera deliciosa' },
              commonNames: { type: 'array', items: { type: 'string' }, example: ['Fensterblatt', 'Swiss Cheese Plant'] },
              plantType: { type: 'string', enum: ['indoor', 'outdoor', 'both'] },
              lightRequirement: { type: 'string', enum: ['low', 'medium', 'bright_indirect', 'direct_sun'] },
              waterFrequency: { type: 'string', enum: ['rare', 'weekly', 'frequent', 'daily'] },
              difficultyLevel: { type: 'string', enum: ['beginner', 'intermediate', 'expert'] },
              petFriendly: { type: 'boolean', default: false },
              airPurifying: { type: 'boolean', default: false },
              growthRate: { type: 'string', enum: ['slow', 'moderate', 'fast'] },
              maxHeightCm: { type: 'integer', example: 200 },
              bloomSeason: { type: 'array', items: { type: 'string', enum: ['spring', 'summer', 'autumn', 'winter'] } },
              fragrant: { type: 'boolean', default: false },
              origin: { type: 'string', example: 'Central America' },
              originCountry: { type: 'string', example: 'Costa Rica' },
              species: { type: 'string', example: 'Monstera deliciosa' },
              category: { type: 'string', example: 'Foliage Plant' },
              isHybrid: { type: 'boolean', default: false },
              hasIridescentLeaves: { type: 'boolean', default: false },
              careInstructions: { type: 'string' },
            },
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Plant entry created successfully',
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
                  },
                },
              },
            },
          },
        },
      },
      400: { description: 'Bad request - invalid data or plant already exists' },
      401: { description: 'Unauthorized - JWT required' },
      403: { description: 'Forbidden - organization owner required' },
    },
  },
})

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'JWT authentication required.',
    })
  }

  // Use service role to check if user is an organization owner
  const adminClient = serverSupabaseServiceRole(event)

  const { data: membership } = await adminClient
    .from('organization_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'organization_owner')
    .limit(1)
    .single()

  if (!membership) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      message: 'Only organization owners can create plant catalog entries.',
    })
  }

  const body = await readBody(event)
  const result = CreatePlantSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Invalid request body.',
      data: result.error.flatten(),
    })
  }

  const data = result.data

  const { data: plant, error } = await adminClient
    .from('plant_catalog')
    .insert({
      botanical_name: data.botanicalName,
      common_names: data.commonNames,
      plant_type: data.plantType,
      light_requirement: data.lightRequirement,
      water_frequency: data.waterFrequency,
      difficulty_level: data.difficultyLevel,
      pet_friendly: data.petFriendly,
      air_purifying: data.airPurifying,
      growth_rate: data.growthRate,
      max_height_cm: data.maxHeightCm,
      bloom_season: data.bloomSeason,
      fragrant: data.fragrant,
      origin: data.origin,
      origin_country: data.originCountry,
      species: data.species,
      category: data.category,
      is_hybrid: data.isHybrid,
      has_iridescent_leaves: data.hasIridescentLeaves,
      care_instructions: data.careInstructions,
    })
    .select('id, botanical_name')
    .single()

  if (error) {
    if (error.code === '23505') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: `Plant with botanical name "${data.botanicalName}" already exists.`,
      })
    }
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Failed to create plant catalog entry.',
    })
  }

  setResponseStatus(event, 201)
  return {
    success: true,
    data: {
      id: (plant as { id: string }).id,
      botanicalName: (plant as { botanical_name: string }).botanical_name,
    },
  }
})

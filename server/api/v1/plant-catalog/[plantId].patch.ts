import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'
import { z } from 'zod'

const UpdatePlantSchema = z.object({
  botanicalName: z.string().min(1).max(255).optional(),
  commonNames: z.array(z.string()).optional(),
  plantType: z.enum(['indoor', 'outdoor', 'both']).optional(),
  lightRequirement: z.enum(['low', 'medium', 'bright_indirect', 'direct_sun']).optional(),
  waterFrequency: z.enum(['rare', 'weekly', 'frequent', 'daily']).optional(),
  difficultyLevel: z.enum(['beginner', 'intermediate', 'expert']).optional(),
  petFriendly: z.boolean().optional(),
  airPurifying: z.boolean().optional(),
  growthRate: z.enum(['slow', 'moderate', 'fast']).optional(),
  maxHeightCm: z.number().int().positive().optional(),
  bloomSeason: z.array(z.enum(['spring', 'summer', 'autumn', 'winter'])).optional(),
  fragrant: z.boolean().optional(),
  origin: z.string().max(255).optional(),
  originCountry: z.string().max(100).optional(),
  species: z.string().max(255).optional(),
  category: z.string().max(100).optional(),
  isHybrid: z.boolean().optional(),
  hasIridescentLeaves: z.boolean().optional(),
  careInstructions: z.string().optional(),
})

defineRouteMeta({
  openAPI: {
    tags: ['Plant Catalog'],
    summary: 'Update plant entry',
    description: 
      'Updates an existing plant entry in the global catalog.\n\n' +
      '**Authorization:** \n\n' +
      'JWT Bearer Token only (organization owner).',
    security: [{ bearerAuth: [] }],
    parameters: [
      {
        name: 'plantId',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
        description: 'Plant catalog entry ID',
      },
    ],
    requestBody: {
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              botanicalName: { type: 'string' },
              commonNames: { type: 'array', items: { type: 'string' } },
              plantType: { type: 'string', enum: ['indoor', 'outdoor', 'both'] },
              lightRequirement: { type: 'string', enum: ['low', 'medium', 'bright_indirect', 'direct_sun'] },
              waterFrequency: { type: 'string', enum: ['rare', 'weekly', 'frequent', 'daily'] },
              difficultyLevel: { type: 'string', enum: ['beginner', 'intermediate', 'expert'] },
              petFriendly: { type: 'boolean' },
              airPurifying: { type: 'boolean' },
              growthRate: { type: 'string', enum: ['slow', 'moderate', 'fast'] },
              maxHeightCm: { type: 'integer' },
              bloomSeason: { type: 'array', items: { type: 'string', enum: ['spring', 'summer', 'autumn', 'winter'] } },
              fragrant: { type: 'boolean' },
              origin: { type: 'string' },
              originCountry: { type: 'string' },
              species: { type: 'string' },
              category: { type: 'string' },
              isHybrid: { type: 'boolean' },
              hasIridescentLeaves: { type: 'boolean' },
              careInstructions: { type: 'string' },
            },
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Plant entry updated successfully',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: true },
                message: { type: 'string', example: 'Plant catalog entry updated successfully.' },
              },
            },
          },
        },
      },
      400: { description: 'Bad request - invalid data' },
      401: { description: 'Unauthorized - JWT required' },
      403: { description: 'Forbidden - organization owner required' },
      404: { description: 'Plant not found' },
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
      message: 'Only organization owners can update plant catalog entries.',
    })
  }

  const plantId = getRouterParam(event, 'plantId')
  if (!plantId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Plant ID is required.',
    })
  }

  const body = await readBody(event)
  const result = UpdatePlantSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Invalid request body.',
      data: result.error.flatten(),
    })
  }

  const data = result.data
  const updateData: Record<string, unknown> = {}

  if (data.botanicalName !== undefined) updateData.botanical_name = data.botanicalName
  if (data.commonNames !== undefined) updateData.common_names = data.commonNames
  if (data.plantType !== undefined) updateData.plant_type = data.plantType
  if (data.lightRequirement !== undefined) updateData.light_requirement = data.lightRequirement
  if (data.waterFrequency !== undefined) updateData.water_frequency = data.waterFrequency
  if (data.difficultyLevel !== undefined) updateData.difficulty_level = data.difficultyLevel
  if (data.petFriendly !== undefined) updateData.pet_friendly = data.petFriendly
  if (data.airPurifying !== undefined) updateData.air_purifying = data.airPurifying
  if (data.growthRate !== undefined) updateData.growth_rate = data.growthRate
  if (data.maxHeightCm !== undefined) updateData.max_height_cm = data.maxHeightCm
  if (data.bloomSeason !== undefined) updateData.bloom_season = data.bloomSeason
  if (data.fragrant !== undefined) updateData.fragrant = data.fragrant
  if (data.origin !== undefined) updateData.origin = data.origin
  if (data.originCountry !== undefined) updateData.origin_country = data.originCountry
  if (data.species !== undefined) updateData.species = data.species
  if (data.category !== undefined) updateData.category = data.category
  if (data.isHybrid !== undefined) updateData.is_hybrid = data.isHybrid
  if (data.hasIridescentLeaves !== undefined) updateData.has_iridescent_leaves = data.hasIridescentLeaves
  if (data.careInstructions !== undefined) updateData.care_instructions = data.careInstructions

  if (Object.keys(updateData).length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'No fields to update.',
    })
  }

  const { error } = await adminClient
    .from('plant_catalog')
    .update(updateData)
    .eq('id', plantId)

  if (error) {
    if (error.code === '23505') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: 'A plant with this botanical name already exists.',
      })
    }
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Failed to update plant catalog entry.',
    })
  }

  return {
    success: true,
    message: 'Plant catalog entry updated successfully.',
  }
})

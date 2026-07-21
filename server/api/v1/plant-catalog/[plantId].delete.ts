import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'

defineRouteMeta({
  openAPI: {
    tags: ['Plant Catalog'],
    summary: 'Delete plant entry',
    description: 
      'Deletes a plant entry from the global catalog.\n\n' +
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
    responses: {
      200: {
        description: 'Plant entry deleted successfully',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: true },
                message: { type: 'string', example: 'Plant catalog entry deleted successfully.' },
              },
            },
          },
        },
      },
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
      message: 'Only organization owners can delete plant catalog entries.',
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

  // Check if plant exists
  const { data: existing } = await adminClient
    .from('plant_catalog')
    .select('id')
    .eq('id', plantId)
    .single()

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'Plant not found in catalog.',
    })
  }

  const { error } = await adminClient
    .from('plant_catalog')
    .delete()
    .eq('id', plantId)

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Failed to delete plant catalog entry.',
    })
  }

  return {
    success: true,
    message: 'Plant catalog entry deleted successfully.',
  }
})

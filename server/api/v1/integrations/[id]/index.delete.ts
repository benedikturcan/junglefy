import { requireOrganizationOwner } from '#server/utils/auth-guards'

defineRouteMeta({
  openAPI: {
    tags: ['Integrations'],
    summary: 'Delete integration',
    description: 'Deletes an integration. Only organization owners can delete.',
    security: [{ bearerAuth: [] }],
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
    ],
    responses: {
      200: { description: 'Integration deleted' },
      401: { description: 'Unauthorized' },
      403: { description: 'Forbidden' },
      404: { description: 'Not found' },
    },
  },
})

export default defineEventHandler(async (event) => {
  const { client, organizationId } = await requireOrganizationOwner(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Integration ID is required.',
    })
  }

  const { error } = await client
    .from('integrations')
    .delete()
    .eq('id', id)
    .eq('organization_id', organizationId)

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Failed to delete integration.',
    })
  }

  return {
    success: true,
    data: { deleted: true },
  }
})

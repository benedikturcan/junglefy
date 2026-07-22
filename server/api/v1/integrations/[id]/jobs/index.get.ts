import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import type { ApiKeyContext } from '#server/types/api-keys'

defineRouteMeta({
  openAPI: {
    tags: ['Integrations'],
    summary: 'List integration jobs',
    description: 'Returns the job history for a specific integration.',
    security: [{ bearerAuth: [] }, { apiKey: [] }],
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
    ],
    responses: {
      200: { description: 'List of jobs' },
      401: { description: 'Unauthorized' },
      403: { description: 'Forbidden' },
      404: { description: 'Not found' },
    },
  },
})

export default defineEventHandler(async (event) => {
  const apiKey = event.context.apiKey as ApiKeyContext | undefined
  const user = await serverSupabaseUser(event)

  if (!apiKey && !user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'Authentication required.',
    })
  }

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Integration ID is required.',
    })
  }

  const client = await serverSupabaseClient(event)
  let organizationId: string

  if (apiKey) {
    if (!apiKey.permissions.includes('full_access')) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden',
        message: 'Missing required permission: full_access',
      })
    }
    organizationId = apiKey.organizationId
  } else {
    const { data: member, error: memberError } = await client
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user!.id)
      .single()

    if (memberError || !member) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden',
        message: 'Organization membership required.',
      })
    }

    organizationId = (member as { organization_id: string }).organization_id
  }

  const { data: integration, error: integrationError } = await client
    .from('integrations')
    .select('id')
    .eq('id', id)
    .eq('organization_id', organizationId)
    .single()

  if (integrationError || !integration) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'Integration not found.',
    })
  }

  const query = getQuery(event)
  const status = query.status as string | undefined
  const limit = Math.min(Number(query.limit) || 50, 100)
  const offset = Number(query.offset) || 0

  let builder = client
    .from('integration_jobs')
    .select('*')
    .eq('integration_id', id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) {
    builder = builder.eq('status', status)
  }

  const { data: jobs, error } = await builder

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Failed to fetch integration jobs.',
    })
  }

  return {
    success: true,
    data: jobs || [],
    meta: { limit, offset },
  }
})

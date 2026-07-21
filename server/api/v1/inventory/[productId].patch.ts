import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { UpdateInventorySchema } from '#server/types/inventory'
import type { ApiKeyContext } from '#server/types/api-keys'

defineRouteMeta({
  openAPI: {
    tags: ['Inventory'],
    summary: 'Update product inventory',
    description:
      'Updates stock levels and availability settings for a product.\n\n' +
      '**Authorization:** JWT Bearer Token or API Key with `write:inventory` or `full_access`.',
    security: [{ bearerAuth: [] }, { apiKey: [] }],
    parameters: [
      {
        name: 'productId',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
        description: 'Product ID',
      },
    ],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              quantity: { type: 'integer', minimum: 0 },
              reservedQuantity: { type: 'integer', minimum: 0 },
              reorderLevel: { type: 'integer', minimum: 0 },
              allowBackorder: { type: 'boolean' },
            },
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Inventory updated successfully',
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
                    productId: { type: 'string', format: 'uuid' },
                    locationId: { type: 'string', format: 'uuid', nullable: true },
                    quantity: { type: 'integer' },
                    reservedQuantity: { type: 'integer' },
                    availableQuantity: { type: 'integer' },
                    reorderLevel: { type: 'integer' },
                    allowBackorder: { type: 'boolean' },
                    updatedAt: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
      400: { description: 'Bad request - invalid data' },
      401: { description: 'Unauthorized' },
      403: { description: 'Forbidden - insufficient permissions' },
      404: { description: 'Product or inventory not found' },
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
      message: 'Authentication required. Provide API key or JWT token.',
    })
  }

  const client = await serverSupabaseClient(event)
  let organizationId: string
  let allowedLocationIds: string[] | null = null

  if (apiKey) {
    const hasPermission = apiKey.permissions.includes('full_access') || apiKey.permissions.includes('write:inventory')
    if (!hasPermission) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden',
        message: 'Missing required permission: write:inventory',
      })
    }
    organizationId = apiKey.organizationId
    allowedLocationIds = apiKey.locationIds
  } else {
    if (!user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized',
        message: 'Authentication required.',
      })
    }

    const { data: member, error: memberError } = await client
      .from('organization_members')
      .select('role, organization_id, location_id')
      .eq('user_id', user.id)
      .single()

    if (memberError || !member) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden',
        message: 'You must be a member of an organization to update inventory.',
      })
    }

    const userRole = (member as { role: string }).role
    organizationId = (member as { organization_id: string }).organization_id
    const userLocationId = (member as { location_id: string | null }).location_id

    if (userRole === 'customer' || userRole === 'location_member') {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden',
        message: 'Insufficient permissions to update inventory.',
      })
    }

    if (userRole === 'location_owner' && userLocationId) {
      allowedLocationIds = [userLocationId]
    }
  }

  const productId = getRouterParam(event, 'productId')
  if (!productId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Product ID is required.',
    })
  }

  const body = await readBody(event)
  const result = UpdateInventorySchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Invalid request body.',
      data: result.error.flatten(),
    })
  }

  const data = result.data

  // Verify product exists in organization
  const { data: product, error: productError } = await client
    .from('products')
    .select('id')
    .eq('id', productId)
    .eq('organization_id', organizationId)
    .single()

  if (productError || !product) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'Product not found.',
    })
  }

  // Determine which inventory record to update
  const query = client
    .from('product_inventory')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('product_id', productId)

  if (allowedLocationIds && allowedLocationIds.length > 0) {
    query.in('location_id', allowedLocationIds)
  } else if (allowedLocationIds) {
    query.is('location_id', null)
  }

  const { data: existing, error: existingError } = await query.single()

  if (existingError && existingError.code !== 'PGRST116') {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Failed to fetch inventory.',
    })
  }

  let record

  if (!existing) {
    // Create new inventory record for organization-level inventory
    const insertData: Record<string, unknown> = {
      organization_id: organizationId,
      product_id: productId,
      location_id: allowedLocationIds?.[0] || null,
      quantity: data.quantity ?? 0,
      reserved_quantity: data.reservedQuantity ?? 0,
      reorder_level: data.reorderLevel ?? 0,
      allow_backorder: data.allowBackorder ?? false,
    }

    const { data: inserted, error: insertError } = await client
      .from('product_inventory')
      .insert(insertData)
      .select()
      .single()

    if (insertError || !inserted) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Internal Server Error',
        message: 'Failed to create inventory record.',
      })
    }

    record = inserted
  } else {
    const updateData: Record<string, unknown> = {}
    if (data.quantity !== undefined) updateData.quantity = data.quantity
    if (data.reservedQuantity !== undefined) updateData.reserved_quantity = data.reservedQuantity
    if (data.reorderLevel !== undefined) updateData.reorder_level = data.reorderLevel
    if (data.allowBackorder !== undefined) updateData.allow_backorder = data.allowBackorder

    if (Object.keys(updateData).length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: 'No fields to update.',
      })
    }

    const { data: updated, error: updateError } = await client
      .from('product_inventory')
      .update(updateData)
      .eq('id', existing.id)
      .select()
      .single()

    if (updateError || !updated) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Internal Server Error',
        message: 'Failed to update inventory.',
      })
    }

    record = updated
  }

  return {
    success: true,
    data: {
      id: record.id,
      productId: record.product_id,
      locationId: record.location_id,
      quantity: record.quantity,
      reservedQuantity: record.reserved_quantity,
      availableQuantity: record.available_quantity,
      reorderLevel: record.reorder_level,
      allowBackorder: record.allow_backorder,
      updatedAt: record.updated_at,
    },
  }
})

import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ApiKeyContext } from '#server/types/api-keys'

import type { H3Event } from 'h3'

type SupabaseUser = NonNullable<Awaited<ReturnType<typeof serverSupabaseUser>>>

export async function requirePlatformAdmin(event: H3Event): Promise<SupabaseUser> {
  const apiKey = event.context.apiKey as ApiKeyContext | undefined
  if (apiKey) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      message: 'API keys cannot perform platform admin actions.',
    })
  }

  const user = await serverSupabaseUser(event)
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'Authentication required.',
    })
  }

  const client = await serverSupabaseClient(event)
  const { data: adminRow, error } = await client
    .from('platform_admins')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (error || !adminRow) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      message: 'Platform admin access required.',
    })
  }

  return user
}

export interface OrganizationOwnerContext {
  user: SupabaseUser
  organizationId: string
  client: SupabaseClient
}

export async function requireOrganizationOwner(event: H3Event): Promise<OrganizationOwnerContext> {
  const apiKey = event.context.apiKey as ApiKeyContext | undefined
  if (apiKey) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      message: 'API keys cannot manage integrations.',
    })
  }

  const user = await serverSupabaseUser(event)
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'Authentication required.',
    })
  }

  const client = await serverSupabaseClient(event)
  const { data: member, error } = await client
    .from('organization_members')
    .select('role, organization_id')
    .eq('user_id', user.id)
    .single()

  if (error || !member) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      message: 'Organization membership required.',
    })
  }

  const { role, organization_id: organizationId } = member as { role: string; organization_id: string }
  if (role !== 'organization_owner') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      message: 'Organization owner required.',
    })
  }

  return { user: user as SupabaseUser, organizationId, client }
}

export interface OrganizationMemberContext {
  user?: SupabaseUser
  organizationId: string
  client: SupabaseClient
  apiKey: boolean
}

export async function requireOrganizationMember(
  event: H3Event,
  allowedRoles: string[] = ['organization_owner', 'location_owner', 'location_member', 'customer'],
): Promise<OrganizationMemberContext> {
  const apiKey = event.context.apiKey as ApiKeyContext | undefined
  const client = await serverSupabaseClient(event)

  if (apiKey) {
    if (!apiKey.permissions.includes('full_access')) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden',
        message: 'Missing required permission: full_access',
      })
    }
    return { organizationId: apiKey.organizationId, client, apiKey: true }
  }

  const user = await serverSupabaseUser(event)
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'Authentication required.',
    })
  }

  const { data: member, error } = await client
    .from('organization_members')
    .select('role, organization_id')
    .eq('user_id', user.id)
    .single()

  if (error || !member || !allowedRoles.includes((member as { role: string }).role)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      message: 'Insufficient permissions.',
    })
  }

  return {
    user: user as SupabaseUser,
    organizationId: (member as { organization_id: string }).organization_id,
    client,
    apiKey: false,
  }
}

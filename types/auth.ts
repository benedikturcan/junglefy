import { z } from 'zod'

// ============================================
// USER ROLES
// ============================================

export const UserRoleSchema = z.enum([
  'organization_owner',
  'location_owner',
  'location_member',
  'customer',
])

export type UserRole = z.infer<typeof UserRoleSchema>

// ============================================
// INVITATION STATUS
// ============================================

export const InvitationStatusSchema = z.enum([
  'pending',
  'accepted',
  'expired',
  'revoked',
])

export type InvitationStatus = z.infer<typeof InvitationStatusSchema>

// ============================================
// ORGANIZATION
// ============================================

export const OrganizationSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100),
  logoUrl: z.string().url().nullable().optional(),
  settings: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type Organization = z.infer<typeof OrganizationSchema>

export const CreateOrganizationSchema = OrganizationSchema.pick({
  name: true,
  slug: true,
  logoUrl: true,
  settings: true,
}).partial({ logoUrl: true, settings: true })

export type CreateOrganization = z.infer<typeof CreateOrganizationSchema>

// ============================================
// LOCATION
// ============================================

export const LocationSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100),
  addressStreet: z.string().max(255).nullable().optional(),
  addressCity: z.string().max(100).nullable().optional(),
  addressPostalCode: z.string().max(20).nullable().optional(),
  addressCountry: z.string().length(2).default('DE'),
  phone: z.string().max(50).nullable().optional(),
  email: z.string().email().nullable().optional(),
  settings: z.record(z.string(), z.unknown()).default({}),
  isActive: z.boolean().default(true),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type Location = z.infer<typeof LocationSchema>

export const CreateLocationSchema = LocationSchema.pick({
  name: true,
  slug: true,
  addressStreet: true,
  addressCity: true,
  addressPostalCode: true,
  addressCountry: true,
  phone: true,
  email: true,
  settings: true,
}).partial({
  addressStreet: true,
  addressCity: true,
  addressPostalCode: true,
  addressCountry: true,
  phone: true,
  email: true,
  settings: true,
})

export type CreateLocation = z.infer<typeof CreateLocationSchema>

// ============================================
// ORGANIZATION MEMBER
// ============================================

export const OrganizationMemberSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  organizationId: z.string().uuid(),
  role: UserRoleSchema,
  locationId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().default(true),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type OrganizationMember = z.infer<typeof OrganizationMemberSchema>

// ============================================
// USER PROFILE
// ============================================

export const UserProfileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  firstName: z.string().max(100).nullable().optional(),
  lastName: z.string().max(100).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type UserProfile = z.infer<typeof UserProfileSchema>

export const UpdateUserProfileSchema = UserProfileSchema.pick({
  firstName: true,
  lastName: true,
  phone: true,
  avatarUrl: true,
}).partial()

export type UpdateUserProfile = z.infer<typeof UpdateUserProfileSchema>

// ============================================
// INVITATION
// ============================================

export const InvitationSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  locationId: z.string().uuid().nullable().optional(),
  email: z.string().email(),
  role: UserRoleSchema,
  token: z.string(),
  status: InvitationStatusSchema,
  invitedBy: z.string().uuid(),
  expiresAt: z.string().datetime(),
  acceptedAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
})

export type Invitation = z.infer<typeof InvitationSchema>

export const CreateInvitationSchema = z.object({
  email: z.string().email(),
  role: UserRoleSchema,
  locationId: z.string().uuid().optional(),
})

export type CreateInvitation = z.infer<typeof CreateInvitationSchema>

// ============================================
// AUTH CONTEXT (for API requests)
// ============================================

export interface AuthContext {
  userId: string
  email: string
  organizationId: string
  role: UserRole
  locationId: string | null
}

// ============================================
// ROLE PERMISSIONS
// ============================================

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  organization_owner: 100,
  location_owner: 75,
  location_member: 50,
  customer: 25,
}

export function hasMinimumRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole]
}

export function canManageRole(managerRole: UserRole, targetRole: UserRole): boolean {
  // Can only manage roles below your own level
  return ROLE_HIERARCHY[managerRole] > ROLE_HIERARCHY[targetRole]
}

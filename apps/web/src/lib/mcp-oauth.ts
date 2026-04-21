import { prisma } from '@customerEQ/database'

type ClerkOrganizationMembership = {
  organization?: {
    id?: string
    name?: string
  }
}

export type AuthorizedMcpBrand = {
  id: string
  name: string
  clerkOrgId: string
  organizationName: string
}

export async function getAuthorizedMcpBrands(
  userId: string,
): Promise<AuthorizedMcpBrand[]> {
  const secret = process.env.CLERK_SECRET_KEY?.trim()
  if (!secret) return []

  const response = await fetch(
    `https://api.clerk.com/v1/users/${encodeURIComponent(userId)}/organization_memberships`,
    {
      headers: {
        Authorization: `Bearer ${secret}`,
      },
      cache: 'no-store',
    },
  )

  if (!response.ok) {
    return []
  }

  const body = (await response.json()) as {
    data?: ClerkOrganizationMembership[]
  }

  const organizations = (body.data ?? [])
    .map((membership) => ({
      id: membership.organization?.id ?? null,
      name: membership.organization?.name ?? null,
    }))
    .filter(
      (organization): organization is { id: string; name: string | null } =>
        typeof organization.id === 'string' && organization.id.length > 0,
    )

  if (organizations.length === 0) {
    return []
  }

  const brands = await prisma.brand.findMany({
    where: {
      clerkOrgId: {
        in: organizations.map((organization) => organization.id),
      },
    },
    select: {
      id: true,
      name: true,
      clerkOrgId: true,
    },
  })

  const organizationNameById = new Map(
    organizations.map((organization) => [
      organization.id,
      organization.name ?? organization.id,
    ]),
  )

  return brands
    .map((brand) => ({
      id: brand.id,
      name: brand.name,
      clerkOrgId: brand.clerkOrgId,
      organizationName:
        organizationNameById.get(brand.clerkOrgId) ?? brand.clerkOrgId,
    }))
    .sort((left, right) => left.organizationName.localeCompare(right.organizationName))
}

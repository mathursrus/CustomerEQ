import { getTestPrisma } from '../db/setup.js'

let counter = 0

export async function createBrand(
  overrides: {
    name?: string
    clerkOrgId?: string
    // Issue #231 PR2 — survey/identifier configuration. All have schema-level
    // defaults; tests that don't care omit these.
    memberIdentifierKind?: 'EMAIL' | 'PHONE' | 'CUSTOMER_ID'
    consentMode?: 'EXPLICIT' | 'IMPLIED_ON_SUBMIT'
    consentTextDefault?: string | null
    privacyPolicyUrl?: string | null
    termsUrl?: string | null
  } = {},
) {
  const prisma = getTestPrisma()
  counter++
  return prisma.brand.create({
    data: {
      clerkOrgId: overrides.clerkOrgId ?? `org_test_${counter}_${Date.now()}`,
      name: overrides.name ?? `Test Brand ${counter}`,
      memberIdentifierKind: overrides.memberIdentifierKind ?? 'EMAIL',
      consentMode: overrides.consentMode ?? 'EXPLICIT',
      consentTextDefault: overrides.consentTextDefault ?? null,
      privacyPolicyUrl: overrides.privacyPolicyUrl ?? null,
      termsUrl: overrides.termsUrl ?? null,
    },
  })
}

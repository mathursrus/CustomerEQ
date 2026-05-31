// Issue #231 PR2 — single ingress for member resolution + auto-enrollment.
//
// Consumed by:
//   - POST /v1/members/enroll (integrator manual enroll)
//   - POST /v1/public/surveys/:id/respond (auto-enroll on first survey response)
//   - bulk-migration tooling (idempotent re-enroll path)
//
// Behavior:
//   - Lookup is case-insensitive on `(brandId, externalId)` per R5.
//   - Existing member → last-write-wins on non-identifier profile fields (R6).
//   - New member → insert with `enrolledVia` per channel attribution (R15).
//   - `consentGivenAt` is server-stamped to `now()` if the caller omits it (R8).
//   - `enrolledVia` is set at create time only and never updated (audit invariant).
//   - Identifier shape is validated against `Brand.memberIdentifierKind` (R4).

import type { PrismaClient, Member, MemberEnrolledVia, MemberIdentifierKind } from '@prisma/client'

export interface ResolveOrEnrollMemberOpts {
  memberId: string
  email?: string
  phone?: string
  firstName?: string
  lastName?: string
  consentGivenAt?: Date
  consentVersion?: string
  emailOptIn?: boolean
  smsOptIn?: boolean
  clerkUserId?: string
  enrolledVia: MemberEnrolledVia
}

export type IdentifierShapeError = {
  code: 'IDENTIFIER_SHAPE_INVALID'
  message: string
  expectedKind: MemberIdentifierKind
}

export type ResolveOrEnrollResult =
  | {
      ok: true
      member: Member
      created: boolean
      // Fields whose value was updated by this call. Populated only for
      // existing members (created=false). Empty array if the caller's input
      // matched the existing row exactly.
      updatedFields: string[]
    }
  | { ok: false; error: IdentifierShapeError }

const E164_RE = /^\+[1-9]\d{1,14}$/
// Exported so the identifier-migration pre-flight validator (R10 email-shape
// check) reuses the exact same shape contract — no regex drift between live
// enrollment and the migration mapping validation.
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateIdentifierShape(
  memberId: string,
  email: string | undefined,
  kind: MemberIdentifierKind,
): IdentifierShapeError | null {
  switch (kind) {
    case 'EMAIL': {
      // Either memberId is email-shaped, or the integrator supplied a separate
      // email sidecar. Otherwise we have no PII fallback for this EMAIL brand.
      const memberIdIsEmail = EMAIL_RE.test(memberId)
      if (memberIdIsEmail) return null
      if (email && EMAIL_RE.test(email)) return null
      return {
        code: 'IDENTIFIER_SHAPE_INVALID',
        message:
          'Brand identifier kind is EMAIL — memberId must be a valid email or an email sidecar must be supplied.',
        expectedKind: 'EMAIL',
      }
    }
    case 'PHONE': {
      // memberId must be E.164. The phone sidecar is informational; the
      // identifier itself carries the canonical phone for PHONE brands.
      if (E164_RE.test(memberId)) return null
      return {
        code: 'IDENTIFIER_SHAPE_INVALID',
        message:
          'Brand identifier kind is PHONE — memberId must be in E.164 format (e.g., +14155552671).',
        expectedKind: 'PHONE',
      }
    }
    case 'CUSTOMER_ID': {
      // Opaque; just require non-empty (already enforced upstream by zod).
      return null
    }
    default: {
      // Defensive — a future identifier kind that we don't yet validate.
      return null
    }
  }
}

// Compares a candidate value against an existing member's value. Returns true
// if the candidate is non-undefined AND differs from existing. Used to compute
// the updatedFields set for the R6 idempotent-upsert response shape.
function isUpdate<T>(candidate: T | undefined | null, existing: T | null | undefined): boolean {
  if (candidate === undefined) return false
  return candidate !== existing
}

export async function resolveOrEnrollMember(
  prisma: PrismaClient,
  brandId: string,
  opts: ResolveOrEnrollMemberOpts,
): Promise<ResolveOrEnrollResult> {
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: { memberIdentifierKind: true },
  })
  if (!brand) {
    // Caller is responsible for validating brandId before this point; treat
    // a missing brand as a programmer error.
    throw new Error(`Brand ${brandId} not found`)
  }

  // Trim before validating + lookup. Whitespace-padded identifiers in URL
  // queries / form posts are accidentally common; we match the migration
  // backfill semantics LOWER(TRIM(email)).
  const trimmedMemberId = opts.memberId.trim()
  const trimmedEmail = opts.email?.trim()

  const shapeError = validateIdentifierShape(
    trimmedMemberId,
    trimmedEmail,
    brand.memberIdentifierKind,
  )
  if (shapeError) {
    return { ok: false, error: shapeError }
  }

  const externalId = trimmedMemberId.toLowerCase()

  // For EMAIL brands, derive the email PII sidecar from memberId when the
  // integrator didn't supply one explicitly and memberId is email-shaped.
  // Preserve the original case of the email PII (only externalId is lowered).
  const derivedEmail =
    trimmedEmail ??
    (brand.memberIdentifierKind === 'EMAIL' && EMAIL_RE.test(trimmedMemberId)
      ? trimmedMemberId
      : undefined)

  const existing = await prisma.member.findUnique({
    where: { brandId_externalId: { brandId, externalId } },
  })

  if (!existing) {
    const member = await prisma.member.create({
      data: {
        brandId,
        externalId,
        enrolledVia: opts.enrolledVia,
        email: derivedEmail ?? null,
        phone: opts.phone ?? null,
        firstName: opts.firstName ?? null,
        lastName: opts.lastName ?? null,
        clerkUserId: opts.clerkUserId ?? undefined,
        consentGivenAt: opts.consentGivenAt ?? new Date(),
        consentVersion: opts.consentVersion ?? null,
        emailOptIn: opts.emailOptIn ?? false,
        smsOptIn: opts.smsOptIn ?? false,
      },
    })
    return { ok: true, member, created: true, updatedFields: [] }
  }

  // R6: existing member — last-write-wins on non-identifier fields only.
  // `externalId` and `enrolledVia` are immutable post-create.
  const updates: Record<string, unknown> = {}
  const updatedFields: string[] = []

  if (isUpdate(derivedEmail, existing.email)) {
    updates.email = derivedEmail
    updatedFields.push('email')
  }
  if (isUpdate(opts.phone, existing.phone)) {
    updates.phone = opts.phone
    updatedFields.push('phone')
  }
  if (isUpdate(opts.firstName, existing.firstName)) {
    updates.firstName = opts.firstName
    updatedFields.push('firstName')
  }
  if (isUpdate(opts.lastName, existing.lastName)) {
    updates.lastName = opts.lastName
    updatedFields.push('lastName')
  }
  if (isUpdate(opts.clerkUserId, existing.clerkUserId)) {
    updates.clerkUserId = opts.clerkUserId
    updatedFields.push('clerkUserId')
  }
  if (isUpdate(opts.consentVersion, existing.consentVersion)) {
    updates.consentVersion = opts.consentVersion
    updatedFields.push('consentVersion')
  }
  if (opts.emailOptIn !== undefined && opts.emailOptIn !== existing.emailOptIn) {
    updates.emailOptIn = opts.emailOptIn
    updatedFields.push('emailOptIn')
  }
  if (opts.smsOptIn !== undefined && opts.smsOptIn !== existing.smsOptIn) {
    updates.smsOptIn = opts.smsOptIn
    updatedFields.push('smsOptIn')
  }

  // consentGivenAt: refresh only when the caller supplied an explicit value
  // (an integrator re-attesting consent). Auto-stamping `now()` on every
  // idempotent re-enroll would silently rotate the consent timestamp, which
  // is exactly the audit signal we want to preserve.
  if (opts.consentGivenAt && opts.consentGivenAt.getTime() !== existing.consentGivenAt?.getTime()) {
    updates.consentGivenAt = opts.consentGivenAt
    updatedFields.push('consentGivenAt')
  }

  if (updatedFields.length === 0) {
    return { ok: true, member: existing, created: false, updatedFields: [] }
  }

  const member = await prisma.member.update({
    where: { id: existing.id },
    data: updates,
  })
  return { ok: true, member, created: false, updatedFields }
}

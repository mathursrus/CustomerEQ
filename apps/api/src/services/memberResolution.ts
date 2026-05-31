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

import type {
  PrismaClient,
  Member,
  MemberEnrolledVia,
  MemberIdentifierKind,
  MigrationOldKeyIngress,
} from '@prisma/client'
import { recordOldKeyUsage } from './migrationOldKeyUsage.js'

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
  // Issue #524 — when set, an old-identifier resolution during an active
  // migration is attributed to this ingress for R33 telemetry. The three
  // honor-kind callers (public respond / API enroll / distribution) pass it;
  // other callers leave it undefined (they never carry the old external id).
  ingress?: MigrationOldKeyIngress
}

export type IdentifierShapeError = {
  code: 'IDENTIFIER_SHAPE_INVALID'
  message: string
  expectedKind: MemberIdentifierKind
}

// Issue #524 (R35 / §M.4a) — after a migration's grace window expires, an old
// identifier that still matches a retained mapping is rejected with an
// actionable error naming the brand's current (new) identifier kind, instead of
// the generic shape error. `expectedKind` is the brand's CURRENT kind so callers
// can read `error.expectedKind` uniformly across both error shapes.
export type IdentifierDeprecatedError = {
  code: 'IDENTIFIER_DEPRECATED_AFTER_MIGRATION'
  message: string
  expectedKind: MemberIdentifierKind
}

export type MemberResolutionError = IdentifierShapeError | IdentifierDeprecatedError

export type ResolveOrEnrollResult =
  | {
      ok: true
      member: Member
      created: boolean
      // Fields whose value was updated by this call. Populated only for
      // existing members (created=false). Empty array if the caller's input
      // matched the existing row exactly.
      updatedFields: string[]
      // Issue #524 — true when the member was resolved via the migration's
      // old-key mapping (dual-key fallback), not the primary lookup.
      resolvedViaOldKey?: boolean
    }
  | { ok: false; error: MemberResolutionError }

// Statuses during which the migration mapping is consulted on a primary miss.
// PROCESSING + grace → dual-key RESOLVE (R19/R32). GRACE_EXPIRED → mapping is
// consulted only to return the actionable deprecated error (R35/§M.4a).
const MIGRATION_LOOKUP_STATUSES = [
  'PROCESSING',
  'REKEY_COMPLETE_IN_GRACE',
  'GRACE_EXPIRED',
] as const

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

  const externalId = trimmedMemberId.toLowerCase()

  // For EMAIL brands, derive the email PII sidecar from memberId when the
  // integrator didn't supply one explicitly and memberId is email-shaped.
  // Preserve the original case of the email PII (only externalId is lowered).
  const derivedEmail =
    trimmedEmail ??
    (brand.memberIdentifierKind === 'EMAIL' && EMAIL_RE.test(trimmedMemberId)
      ? trimmedMemberId
      : undefined)

  // Primary lookup on the canonical key.
  let existing = await prisma.member.findUnique({
    where: { brandId_externalId: { brandId, externalId } },
  })

  // Issue #524 — dual-key fallback (R19/R32/§E). Only on a primary MISS, and
  // only when an active/in-grace/expired migration exists for this brand (so the
  // hero hot path pays nothing in steady state). The supplied identifier might
  // be the OLD external id of an already-re-keyed member.
  let resolvedViaOldKey = false
  if (!existing) {
    const migration = await prisma.memberIdentifierMigration.findFirst({
      where: { brandId, status: { in: [...MIGRATION_LOOKUP_STATUSES] } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true },
    })
    if (migration) {
      const mapping = await prisma.memberIdentifierMigrationMapping.findUnique({
        where: {
          migrationId_oldExternalId: { migrationId: migration.id, oldExternalId: externalId },
        },
        select: { memberId: true },
      })
      if (mapping) {
        if (migration.status === 'GRACE_EXPIRED') {
          // R35 / §M.4a — the grace window is over: don't resolve, don't create.
          // Return the actionable deprecated error naming the brand's new kind.
          return {
            ok: false,
            error: {
              code: 'IDENTIFIER_DEPRECATED_AFTER_MIGRATION',
              message: `This member was migrated. The organization now identifies members by ${brand.memberIdentifierKind}; supply their ${brand.memberIdentifierKind} value instead of the retired identifier.`,
              expectedKind: brand.memberIdentifierKind,
            },
          }
        }
        // PROCESSING or REKEY_COMPLETE_IN_GRACE — resolve to the migrated member.
        existing = await prisma.member.findUnique({ where: { id: mapping.memberId } })
        if (existing) {
          resolvedViaOldKey = true
          // R33 — attribute the old-key hit when the caller declared an ingress.
          if (opts.ingress) {
            await recordOldKeyUsage(prisma, migration.id, brandId, opts.ingress)
          }
        }
      }
    }
  }

  // Shape validation gates a brand-NEW create and any primary-hit re-supply, but
  // is SKIPPED when we resolved via the old-key mapping — an old-shape identifier
  // is expected there and must not be rejected against the post-flip kind (§E).
  if (!resolvedViaOldKey) {
    const shapeError = validateIdentifierShape(
      trimmedMemberId,
      trimmedEmail,
      brand.memberIdentifierKind,
    )
    if (shapeError) {
      return { ok: false, error: shapeError }
    }
  }

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
    return { ok: true, member, created: true, updatedFields: [], resolvedViaOldKey }
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
    return { ok: true, member: existing, created: false, updatedFields: [], resolvedViaOldKey }
  }

  const member = await prisma.member.update({
    where: { id: existing.id },
    data: updates,
  })
  return { ok: true, member, created: false, updatedFields, resolvedViaOldKey }
}

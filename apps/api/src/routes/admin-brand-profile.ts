import type { FastifyPluginAsync } from 'fastify'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import {
  zConsentText,
  hasPrivacyToken,
} from '@customerEQ/consent-text'
import { PUBLIC_FRONTEND_HOST } from '@customerEQ/shared'
import { DEFAULT_CONSENT_TEXT } from '../lib/consent.js'
import { DEFAULT_THEMES } from '../lib/default-themes.js'

// Issue #292 Slice 3 / Issue #277 — Organization Settings backend.
//
// Routes:
//   GET   /v1/admin/brand/profile  — lazy-upsert + decorated response
//   PATCH /v1/admin/brand/profile  — Zod-validated edits + cross-field rules
//
// Status-code conventions (variance from RFC §4.2 alignment):
//   422 — Zod validation failures (matches the existing /v1/themes pattern at
//         themes.ts:29 / themes.ts:71 — keeps the admin surface uniform).
//   400 — Cross-field business-rule failures: EXPLICIT without {{privacy}}
//         token, body-supplied brandId (multiTenant plugin), generic 400 path.
//   409 — Identifier-kind locked when members exist (RFC §4.2 explicit code).
//
// Q2 binding (Slice 4 carries the UI surface): PATCH writes Brand.name only;
// IdentityProvider is NOT invoked — Slice 4's UI shows Organization Name
// (read-only from Clerk session) separately from Brand Name (editable).
//
// Q4 binding (closes SLICE2-MED-1): privacyPolicyUrl + termsUrl validators
// add an /^https?:/i refinement so javascript:/data:/mailto: schemes cannot
// reach the React renderer's anchor href.

const SUPPORT_EMAIL_FALLBACK = `support@${PUBLIC_FRONTEND_HOST}`

const HttpsUrl = z
  .string()
  .url()
  .refine((u) => /^https?:/i.test(u), { message: 'must use http(s) scheme' })

const AttestationSchema = z.object({
  justification: z.string().min(1).max(500),
  confirmed: z.literal(true),
})

const PatchBrandProfileSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    siteDomain: z
      .string()
      .regex(/^[a-z0-9.-]+$/)
      .optional()
      .nullable(),
    logoUrl: HttpsUrl.optional().nullable(),
    orgSize: z
      .enum([
        'SIZE_1_10',
        'SIZE_11_50',
        'SIZE_51_300',
        'SIZE_301_5000',
        'SIZE_5000_PLUS',
        'PREFER_NOT_TO_SAY',
      ])
      .optional()
      .nullable(),
    timezone: z
      .string()
      .regex(/^[A-Za-z_/+-]+$/)
      .optional(),
    locale: z
      .string()
      .regex(/^[a-z]{2}(-[A-Z]{2})?$/)
      .optional(),
    defaultThemeId: z.string().cuid().optional().nullable(),
    memberIdentifierKind: z.enum(['EMAIL', 'PHONE', 'CUSTOMER_ID']).optional(),
    consentMode: z.enum(['EXPLICIT', 'IMPLIED_ON_SUBMIT']).optional(),
    consentTextDefault: zConsentText.optional().nullable(),
    privacyPolicyUrl: HttpsUrl.optional().nullable(),
    termsUrl: HttpsUrl.optional().nullable(),
    attestation: AttestationSchema.optional(),
  })
  .refine(
    (body) => !(body.consentMode === 'IMPLIED_ON_SUBMIT' && !body.attestation),
    {
      message: 'attestation required when switching to IMPLIED_ON_SUBMIT',
      path: ['attestation'],
    },
  )

type PatchBrandProfileBody = z.infer<typeof PatchBrandProfileSchema>

const ROUTE_AUDIT_CONFIG = {
  auditAction: 'brand.profile.update',
  auditResourceType: 'brand_profile',
  auditAllowlist: [
    'changedFields',
    'before',
    'after',
    'attestation',
    'memberCountAtChange',
  ],
} as const

// Single source of truth for the Brand fields surfaced through this route.
// Used by GET (initial read), PATCH (read-current for cross-field rules and
// before/after diff), and the PATCH update return. Keeping it as one constant
// guarantees the response shape stays consistent across the three callsites.
const BRAND_PROFILE_SELECT = {
  id: true,
  clerkOrgId: true,
  name: true,
  siteDomain: true,
  logoUrl: true,
  orgSize: true,
  timezone: true,
  locale: true,
  defaultThemeId: true,
  memberIdentifierKind: true,
  consentMode: true,
  consentTextDefault: true,
  privacyPolicyUrl: true,
  termsUrl: true,
  createdAt: true,
} as const

const adminBrandProfileRoutes: FastifyPluginAsync = async (fastify) => {
  // -------------------------------------------------------------------------
  // GET /v1/admin/brand/profile — lazy-upsert + decorated response.
  // -------------------------------------------------------------------------
  fastify.get(
    '/admin/brand/profile',
    { config: { lazyUpsertBrand: true } },
    async (request, reply) => {
      // Lazy-upsert path: when the auth plugin set clerkOrgId but not
      // brandId, the Brand row doesn't exist yet. Create it with sensible
      // defaults; subsequent GETs are idempotent (where: { clerkOrgId } +
      // update: {}).
      let brandId = request.brandId
      if (!brandId && request.clerkOrgId) {
        const tzHint = (request.headers['x-timezone-hint'] as string | undefined) ?? 'UTC'
        const localeHint =
          (request.headers['x-locale-hint'] as string | undefined) ?? 'en-US'

        // Pull the organization name from the identity provider so the
        // newly-created Brand starts with the same name the admin sees in
        // the org-switcher chip (PR #308 review feedback). After this
        // initial seed `Brand.name` is editable independently — the two
        // surfaces are intentionally decoupled per the Q2 reframe (RFC §7a).
        // Best-effort: if the provider call fails (transient network, dev
        // test bypass that didn't wire up getOrg, etc.) fall back to a
        // generic placeholder so first-run UX still completes.
        let initialBrandName = 'Untitled Organization'
        try {
          const org = await fastify.identityProvider.getOrg(request.clerkOrgId)
          if (org?.name) initialBrandName = org.name
        } catch (err) {
          fastify.log.warn(
            { err, clerkOrgId: request.clerkOrgId },
            'identityProvider.getOrg failed during lazy-upsert; falling back to default Brand.name',
          )
        }

        // Lazy-upsert: nested createMany on the brandThemes relation seeds
        // the four default themes (Indigo / Forest / Sunset / Slate) atomically
        // with the Brand row (R25 — "all four pickable from first paint").
        // Nested writes only fire on the create branch of upsert, so an
        // already-existing brand is not re-seeded; the unique clerkOrgId
        // constraint plus this nested write together close the race window
        // for two simultaneous first GETs.
        const brand = await fastify.prisma.brand.upsert({
          where: { clerkOrgId: request.clerkOrgId },
          update: {},
          create: {
            clerkOrgId: request.clerkOrgId,
            name: initialBrandName,
            consentTextDefault: DEFAULT_CONSENT_TEXT,
            timezone: tzHint,
            locale: localeHint,
            brandThemes: {
              createMany: { data: [...DEFAULT_THEMES] },
            },
          },
        })
        brandId = brand.id
        request.brandId = brandId

        // First-paint default: point Brand.defaultThemeId at the seeded
        // Indigo row so the Look & Feel section opens with a real
        // selection rather than an empty radio group. Idempotent — a
        // re-entry hits the existing brand (defaultThemeId already set,
        // so we no-op), and the Indigo theme is guaranteed to exist
        // because the nested createMany above seeded it on this same
        // create branch.
        if (brand.defaultThemeId === null) {
          const indigo = await fastify.prisma.brandTheme.findFirst({
            where: { brandId, name: 'Indigo' },
            select: { id: true },
          })
          if (indigo) {
            await fastify.prisma.brand.update({
              where: { id: brandId },
              data: { defaultThemeId: indigo.id },
            })
          }
        }
      }

      if (!brandId) {
        return reply
          .status(401)
          .send({ error: 'No brandId could be resolved for this session' })
      }

      // Issue #405 — self-heal: pre-existing brands created before PR #307
      // added theme-seeding to the lazy-upsert's create branch can sit
      // permanently with zero themes (e.g. ArtistOS — Brand row inserted by
      // hand long ago). The upsert above only seeds on the `create` branch;
      // `update: {}` never re-evaluates whether themes exist. This block
      // closes the gap for any brand that lands here without themes,
      // mirroring the create-branch payload + Indigo default-theme pointer.
      const existingThemeCount = await fastify.prisma.brandTheme.count({
        where: { brandId },
      })
      if (existingThemeCount === 0) {
        await fastify.prisma.brandTheme.createMany({
          data: DEFAULT_THEMES.map((t) => ({ ...t, brandId })),
        })
        const indigo = await fastify.prisma.brandTheme.findFirst({
          where: { brandId, name: 'Indigo' },
          select: { id: true },
        })
        if (indigo) {
          await fastify.prisma.brand.update({
            where: { id: brandId },
            data: { defaultThemeId: indigo.id },
          })
        }
      }

      const [brand, themes, memberCount] = await Promise.all([
        fastify.prisma.brand.findUniqueOrThrow({
          where: { id: brandId },
          select: BRAND_PROFILE_SELECT,
        }),
        fastify.prisma.brandTheme.findMany({
          where: { brandId },
          select: {
            id: true,
            name: true,
            primaryColor: true,
            secondaryColor: true,
            backgroundColor: true,
            textColor: true,
            accentColor: true,
            buttonColor: true,
            buttonTextColor: true,
            fontFamily: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
        fastify.prisma.member.count({ where: { brandId } }),
      ])

      // swatches projection is the picker's brand-vibe preview — primary +
      // secondary + page background. accentColor is intentionally NOT shown
      // here (it's used for error/warning emphasis, not brand identity, and
      // mixing it into the picker chip strip would mislead admins). The full
      // color set is exposed alongside swatches so consumers that render the
      // theme (e.g. Issue #420 email-preview pane, F14) can read all fields
      // without a follow-up fetch.
      const themesDecorated = themes.map((t) => ({
        id: t.id,
        name: t.name,
        isDefault: t.id === brand.defaultThemeId,
        swatches: [t.primaryColor, t.secondaryColor, t.backgroundColor] as [string, string, string],
        primaryColor: t.primaryColor,
        secondaryColor: t.secondaryColor,
        backgroundColor: t.backgroundColor,
        textColor: t.textColor,
        accentColor: t.accentColor,
        buttonColor: t.buttonColor,
        buttonTextColor: t.buttonTextColor,
        fontFamily: t.fontFamily,
      }))

      return reply.status(200).send({
        brand: {
          ...brand,
          createdAt: brand.createdAt.toISOString(),
        },
        themes: themesDecorated,
        memberCount,
        supportEmail: process.env.SUPPORT_EMAIL ?? SUPPORT_EMAIL_FALLBACK,
      })
    },
  )

  // -------------------------------------------------------------------------
  // PATCH /v1/admin/brand/profile — edit org-level settings.
  // -------------------------------------------------------------------------
  fastify.patch(
    '/admin/brand/profile',
    { config: ROUTE_AUDIT_CONFIG },
    async (request, reply) => {
      const parse = PatchBrandProfileSchema.safeParse(request.body)
      if (!parse.success) {
        return reply.status(422).send({
          error: 'Validation failed',
          message: parse.error.errors.map((e) => e.message).join(', '),
          details: parse.error.errors,
        })
      }
      const body: PatchBrandProfileBody = parse.data
      const brandId = request.brandId

      // Read current row (single read) — needed for cross-field rules
      // (EXPLICIT requires {{privacy}}, identifier-kind lock) and for the
      // audit "before" snapshot.
      const current = await fastify.prisma.brand.findUniqueOrThrow({
        where: { id: brandId },
        select: BRAND_PROFILE_SELECT,
      })

      // Cross-field rule 1: identifier-kind change blocked when members exist.
      // The radio-toggle path remains rejected (the guided migration flow is the
      // only way to change the kind once members exist — Issue #524 R1/R2). The
      // 409 now points the admin at the guided flow (or an in-flight migration).
      if (
        body.memberIdentifierKind !== undefined &&
        body.memberIdentifierKind !== current.memberIdentifierKind
      ) {
        const memberCount = await fastify.prisma.member.count({ where: { brandId } })
        if (memberCount > 0) {
          const activeMigration = await fastify.prisma.memberIdentifierMigration.findFirst({
            where: {
              brandId,
              status: { in: ['PENDING_VALIDATION', 'VALIDATED', 'PROCESSING', 'REKEY_COMPLETE_IN_GRACE'] },
            },
            select: { id: true },
          })
          return reply.status(409).send({
            error: 'Identifier kind cannot be changed while members exist',
            code: 'MEMBER_IDENTIFIER_KIND_LOCKED',
            memberCount,
            redirectTo: activeMigration
              ? `/admin/settings/organization/migrations/${activeMigration.id}`
              : '/admin/settings/organization/migrations/new',
          })
        }
      }

      // Cross-field rule 2: EXPLICIT mode requires consentTextDefault to
      // contain a {{privacy}} token. Only enforced when the PATCH actually
      // touches a consent-related field (so unrelated PATCHes — e.g.,
      // renaming, setting timezone — don't fail because of a pre-existing
      // invalid state). Considers the post-PATCH effective state.
      const touchesConsent =
        body.consentMode !== undefined || body.consentTextDefault !== undefined
      if (touchesConsent) {
        const effectiveConsentMode = body.consentMode ?? current.consentMode
        if (effectiveConsentMode === 'EXPLICIT') {
          const effectiveConsentText =
            body.consentTextDefault !== undefined
              ? body.consentTextDefault
              : current.consentTextDefault
          if (!effectiveConsentText || !hasPrivacyToken(effectiveConsentText)) {
            return reply.status(400).send({
              error:
                'EXPLICIT consent mode requires consentTextDefault to contain a {{privacy}} token',
              code: 'EXPLICIT_REQUIRES_PRIVACY_TOKEN',
            })
          }
        }
      }

      // Compute the changedFields + before/after snapshots for the audit row.
      // Only include keys that the request body explicitly sent (not undefined).
      const editableKeys = [
        'name',
        'siteDomain',
        'logoUrl',
        'orgSize',
        'timezone',
        'locale',
        'defaultThemeId',
        'memberIdentifierKind',
        'consentMode',
        'consentTextDefault',
        'privacyPolicyUrl',
        'termsUrl',
      ] as const
      type EditableKey = (typeof editableKeys)[number]

      const changedFields: EditableKey[] = []
      const before: Partial<Record<EditableKey, unknown>> = {}
      const after: Partial<Record<EditableKey, unknown>> = {}
      const updateData: Partial<Record<EditableKey, unknown>> = {}

      for (const key of editableKeys) {
        const proposed = body[key]
        if (proposed === undefined) continue
        const currentValue = current[key]
        if (proposed !== currentValue) {
          changedFields.push(key)
          before[key] = currentValue
          after[key] = proposed
        }
        updateData[key] = proposed
      }

      // No-op PATCH (body had no editable fields or all were already at the
      // current value): respond with the current row and skip the audit.
      if (changedFields.length === 0) {
        return reply.status(200).send({
          brand: {
            ...current,
            createdAt: current.createdAt.toISOString(),
          },
        })
      }

      const updated = await fastify.prisma.brand.update({
        where: { id: brandId },
        data: updateData as Prisma.BrandUpdateInput,
        select: BRAND_PROFILE_SELECT,
      })

      // Populate audit metadata for the onResponse hook to filter + persist.
      // Per RFC §9: changedFields, before, after; attestation if IMPLIED.
      const auditMetadata: Record<string, unknown> = {
        changedFields,
        before,
        after,
      }
      if (body.attestation && body.consentMode === 'IMPLIED_ON_SUBMIT') {
        auditMetadata.attestation = {
          admin: request.clerkUserId,
          justification: body.attestation.justification,
          attestedAt: new Date().toISOString(),
        }
      }
      request.audit = { metadata: auditMetadata }

      // Q2 binding: PATCH writes Brand.name only; IdentityProvider is NOT
      // invoked. Slice 4 UI splits Organization Name (read-only, Clerk) from
      // Brand Name (editable, CustomerEQ). No sync, no retry queue.

      return reply.status(200).send({
        brand: {
          ...updated,
          createdAt: updated.createdAt.toISOString(),
        },
      })
    },
  )
}

export default adminBrandProfileRoutes

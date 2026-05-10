import { z } from 'zod'
import { zConsentText } from '@customerEQ/consent-text'

// Issue #292 Slice 4 — Zod schema for the Organization Settings form.
//
// Mirrors apps/api/src/routes/admin-brand-profile.ts PatchBrandProfileSchema
// (single source of truth between API and frontend per R18). The frontend
// schema accepts empty strings for optional URL fields (cleared inputs)
// and resolves them to null on PATCH submit; the API's HttpsUrl refinement
// re-validates on the wire.

const HttpsUrlOrEmpty = z
  .string()
  .trim()
  .refine((v) => v === '' || /^https?:\/\//i.test(v), {
    message: 'Must be an https:// URL',
  })
  .refine(
    (v) => {
      if (v === '') return true
      try {
        new URL(v)
        return true
      } catch {
        return false
      }
    },
    { message: 'Must be a valid URL' },
  )

const SiteDomainOrEmpty = z
  .string()
  .trim()
  .refine((v) => v === '' || /^[a-z0-9.-]+$/i.test(v), {
    message: 'Hostname only — no scheme or path',
  })

const TimezoneIana = z
  .string()
  .trim()
  .min(1, { message: 'Time zone is required' })
  .regex(/^[A-Za-z_/+-]+$/, { message: 'Invalid IANA time zone' })

const LocaleBcp47 = z
  .string()
  .trim()
  .min(1, { message: 'Locale is required' })
  .regex(/^[a-z]{2}(-[A-Z]{2})?$/, { message: 'Invalid BCP 47 locale' })

const OrgSizeEnum = z.enum([
  'SIZE_1_10',
  'SIZE_11_50',
  'SIZE_51_300',
  'SIZE_301_5000',
  'SIZE_5000_PLUS',
  'PREFER_NOT_TO_SAY',
])

export const orgFormSchema = z.object({
  name: z.string().trim().min(1, { message: 'Brand name is required' }).max(120),
  siteDomain: SiteDomainOrEmpty,
  logoUrl: HttpsUrlOrEmpty,
  orgSize: z.union([OrgSizeEnum, z.literal('')]),
  timezone: TimezoneIana,
  locale: LocaleBcp47,
  defaultThemeId: z.string(),
  memberIdentifierKind: z.enum(['EMAIL', 'PHONE', 'CUSTOMER_ID']),
  consentMode: z.enum(['EXPLICIT', 'IMPLIED_ON_SUBMIT']),
  consentTextDefault: z.union([zConsentText, z.literal('')]),
  privacyPolicyUrl: HttpsUrlOrEmpty,
  termsUrl: HttpsUrlOrEmpty,
})

export type OrgFormSchemaInput = z.infer<typeof orgFormSchema>

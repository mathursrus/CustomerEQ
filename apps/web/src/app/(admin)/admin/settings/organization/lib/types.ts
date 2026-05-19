// Issue #292 Slice 4 — Organization Settings UI types.
//
// Server contract mirrored from apps/api/src/routes/admin-brand-profile.ts
// (GET /v1/admin/brand/profile response shape) plus client-side form types.

export type OrgSizeCategory =
  | 'SIZE_1_10'
  | 'SIZE_11_50'
  | 'SIZE_51_300'
  | 'SIZE_301_5000'
  | 'SIZE_5000_PLUS'
  | 'PREFER_NOT_TO_SAY'

export type MemberIdentifierKind = 'EMAIL' | 'PHONE' | 'CUSTOMER_ID'

export type ConsentMode = 'EXPLICIT' | 'IMPLIED_ON_SUBMIT'

export interface BrandProfile {
  id: string
  clerkOrgId: string
  name: string
  siteDomain: string | null
  logoUrl: string | null
  orgSize: OrgSizeCategory | null
  timezone: string
  locale: string
  defaultThemeId: string | null
  memberIdentifierKind: MemberIdentifierKind
  consentMode: ConsentMode
  consentTextDefault: string | null
  privacyPolicyUrl: string | null
  termsUrl: string | null
  createdAt: string
}

export interface BrandTheme {
  id: string
  name: string
  isDefault: boolean
  swatches: [string, string, string]
}

export interface ProfileResponse {
  brand: BrandProfile
  themes: BrandTheme[]
  memberCount: number
  supportEmail: string
}

// Form values — shape passed into RHF. All editable fields plus the
// optional attestation block populated only when flipping consent mode
// to IMPLIED_ON_SUBMIT.
export interface OrgFormValues {
  name: string
  siteDomain: string
  logoUrl: string
  orgSize: OrgSizeCategory | ''
  timezone: string
  locale: string
  defaultThemeId: string
  memberIdentifierKind: MemberIdentifierKind
  consentMode: ConsentMode
  consentTextDefault: string
  privacyPolicyUrl: string
  termsUrl: string
}

// Section identifiers — used by AdminPendingBanner for jump-to anchors
// and by the form for per-section dirty detection.
export type SectionId =
  | 's-identity'
  | 's-defaults'
  | 's-lookfeel'
  | 's-members'
  | 's-consent'
  | 's-developer'

// Field paths in OrgFormValues, partitioned by section. Per-section
// dirty + Save/Cancel reveal logic filters formState.dirtyFields by these.
export const SECTION_FIELDS: Record<SectionId, (keyof OrgFormValues)[]> = {
  's-identity': ['name', 'siteDomain', 'logoUrl', 'orgSize'],
  's-defaults': ['timezone', 'locale'],
  's-lookfeel': ['defaultThemeId'],
  's-members': ['memberIdentifierKind'],
  's-consent': ['consentMode', 'consentTextDefault', 'privacyPolicyUrl', 'termsUrl'],
  's-developer': [],
}

// Pending-banner row shape — produced from form values + brand state.
//
// `field` widens to accommodate rows that aren't tied to a single form
// input — e.g. Issue #405's "themes" / "defaultTheme" rows are derived
// from server-loaded brand state (themesCount, hasDefaultTheme) rather
// than any one OrgFormValues key. The downstream consumer
// (`AdminPendingBanner`) already types `field` as `string`.
export interface PendingItem {
  field: keyof OrgFormValues | 'themes' | 'defaultTheme'
  label: string
  consequence: string
  jumpToSectionId: SectionId
}

// Server-loaded brand state surfaced into pending-item computation that
// isn't represented in OrgFormValues (themes are not form-managed).
export interface PendingItemContext {
  themesCount: number
  hasDefaultTheme: boolean
}

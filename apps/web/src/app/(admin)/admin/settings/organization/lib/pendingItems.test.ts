// Issue #292 Slice 4 + Issue #405 — pendingItems unit tests.
//
// Slice 4 (existing): row generation for missing brand name, missing consent
// text, missing privacy URL.
//
// #405 (new): row generation for themes-empty + default-theme-not-set, surfaced
// at the top of /admin/settings/organization so an admin viewer sees what to
// fix before scrolling. Both new rows jump to the 's-lookfeel' section.

import { describe, it, expect } from 'vitest'
import { computePendingItems } from './pendingItems'
import type { OrgFormValues } from './types'

function baseValues(overrides: Partial<OrgFormValues> = {}): OrgFormValues {
  return {
    name: 'Acme',
    siteDomain: '',
    logoUrl: '',
    orgSize: '',
    timezone: 'UTC',
    locale: 'en-US',
    defaultThemeId: 'thm_indigo',
    memberIdentifierKind: 'EMAIL',
    consentMode: 'EXPLICIT',
    consentTextDefault: 'I agree to {{privacy}}',
    privacyPolicyUrl: 'https://acme.com/privacy',
    termsUrl: '',
    ...overrides,
  }
}

describe('computePendingItems', () => {
  describe('Slice 4 baseline (regression)', () => {
    it('returns empty list when all required fields are set', () => {
      const items = computePendingItems(baseValues(), { themesCount: 4, hasDefaultTheme: true })
      expect(items).toEqual([])
    })

    it('surfaces missing Brand name', () => {
      const items = computePendingItems(baseValues({ name: '   ' }), {
        themesCount: 4,
        hasDefaultTheme: true,
      })
      expect(items.find((i) => i.field === 'name')).toBeDefined()
    })

    it('surfaces missing consent text under EXPLICIT mode', () => {
      const items = computePendingItems(baseValues({ consentTextDefault: '' }), {
        themesCount: 4,
        hasDefaultTheme: true,
      })
      const row = items.find((i) => i.field === 'consentTextDefault')
      expect(row?.consequence).toMatch(/empty/i)
    })
  })

  describe('Issue #405 — themes-related rows', () => {
    it('surfaces a "Themes" row when the brand has zero themes', () => {
      const items = computePendingItems(baseValues({ defaultThemeId: '' }), {
        themesCount: 0,
        hasDefaultTheme: false,
      })
      const themesRow = items.find((i) => i.field === 'themes')
      expect(themesRow, 'expected a pending row for empty themes').toBeDefined()
      expect(themesRow?.label).toMatch(/themes?/i)
      expect(themesRow?.consequence).toMatch(/no themes/i)
      expect(themesRow?.jumpToSectionId).toBe('s-lookfeel')
    })

    it('surfaces a "Default theme" row when themes exist but defaultThemeId is unset', () => {
      const items = computePendingItems(baseValues({ defaultThemeId: '' }), {
        themesCount: 4,
        hasDefaultTheme: false,
      })
      const defaultRow = items.find((i) => i.field === 'defaultTheme')
      expect(defaultRow, 'expected a pending row for missing default theme').toBeDefined()
      expect(defaultRow?.label).toMatch(/default theme/i)
      expect(defaultRow?.jumpToSectionId).toBe('s-lookfeel')
    })

    it('does NOT surface either themes-related row when themes exist and default is set', () => {
      const items = computePendingItems(baseValues(), { themesCount: 4, hasDefaultTheme: true })
      expect(items.find((i) => i.field === 'themes')).toBeUndefined()
      expect(items.find((i) => i.field === 'defaultTheme')).toBeUndefined()
    })

    it('surfaces ONLY the Themes row when count is zero (subsumes default-not-set)', () => {
      // If there are no themes, there can't be a default to point at — show
      // the single root-cause row, not both. Otherwise the admin sees two
      // rows that both resolve via the same action.
      const items = computePendingItems(baseValues({ defaultThemeId: '' }), {
        themesCount: 0,
        hasDefaultTheme: false,
      })
      const themesRow = items.find((i) => i.field === 'themes')
      const defaultRow = items.find((i) => i.field === 'defaultTheme')
      expect(themesRow).toBeDefined()
      expect(defaultRow).toBeUndefined()
    })

    it('treats hasDefaultTheme=true the same regardless of OrgFormValues.defaultThemeId in-flight edits', () => {
      // The banner reflects PERSISTED brand state — operators editing the
      // form locally shouldn't see/clear the row until they save. The
      // computePendingItems signature receives hasDefaultTheme from the
      // server-loaded brand record, not from the live form value.
      const items = computePendingItems(baseValues({ defaultThemeId: '' }), {
        themesCount: 4,
        hasDefaultTheme: true,
      })
      expect(items.find((i) => i.field === 'defaultTheme')).toBeUndefined()
    })
  })
})

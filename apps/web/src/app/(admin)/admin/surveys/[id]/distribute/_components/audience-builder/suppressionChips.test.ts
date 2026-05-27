// Issue #420 — Status chip styling tests.

import { describe, it, expect } from 'vitest'

import { suppressionChipStyle } from './suppressionChips'

describe('suppressionChipStyle', () => {
  it('returns enabled OK chip in green', () => {
    const s = suppressionChipStyle('OK', null)
    expect(s.label).toBe('OK')
    expect(s.disabled).toBe(false)
    expect(s.bg).toMatch(/green/)
  })

  it('appends the since-date to UNSUBSCRIBED label', () => {
    const s = suppressionChipStyle('UNSUBSCRIBED', '2026-04-12T00:00:00.000Z')
    expect(s.label).toBe('⚠ Unsubscribed · 2026-04-12')
    expect(s.disabled).toBe(true)
  })

  it('renders NO_CONSENT as disabled amber', () => {
    const s = suppressionChipStyle('NO_CONSENT', null)
    expect(s.disabled).toBe(true)
    expect(s.bg).toMatch(/amber/)
    expect(s.label).toContain('No consent')
  })

  it('renders ERASED as disabled rose', () => {
    const s = suppressionChipStyle('ERASED', null)
    expect(s.disabled).toBe(true)
    expect(s.bg).toMatch(/rose/)
  })

  it('renders NO_EMAIL as disabled amber', () => {
    const s = suppressionChipStyle('NO_EMAIL', null)
    expect(s.disabled).toBe(true)
    expect(s.label).toContain('No email')
  })
})

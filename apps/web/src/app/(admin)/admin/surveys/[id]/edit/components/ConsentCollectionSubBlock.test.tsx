// Issue #241 Slice 4b (#336) — ConsentCollectionSubBlock RTL.
//
// Coverage per spec §2.1.1 / R9–R14:
//   - Dropdown options follow R9 visibility rules: inherit-from-brand is
//     always available; the OPPOSITE-of-brand override option appears so the
//     operator can move to a more permissive or stricter mode.
//   - R12 disclosure editor: Privacy / Terms toolbar buttons insert the
//     token markers ({{privacy:"…"}} / {{terms:"…"}}) at the cursor position.
//   - R12 edge: Terms button is hidden when Brand.termsUrl === null.
//   - R13: blank disclosure → preview card empties (no "No consent block"
//     fallback in the editor preview — the renderer handles the runtime case).
//   - R14: preview reflects EXPLICIT (checkbox) vs IMPLIED_ON_SUBMIT (no checkbox).

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { ConsentCollectionSubBlock } from './ConsentCollectionSubBlock'
import {
  MOCK_BRAND_EXPLICIT,
  MOCK_BRAND_IMPLIED,
  MOCK_BRAND_NO_TERMS,
} from '../__fixtures__/editor-fixtures'

const NOOP = () => {}

function renderBlock(opts: {
  brand?: typeof MOCK_BRAND_EXPLICIT
  consentMode?: 'INHERIT' | 'EXPLICIT' | 'IMPLIED_ON_SUBMIT'
  consentTextOverride?: string | null
  onChange?: (next: {
    consentMode: 'INHERIT' | 'EXPLICIT' | 'IMPLIED_ON_SUBMIT'
    consentTextOverride: string | null
  }) => void
} = {}) {
  return render(
    <ConsentCollectionSubBlock
      brand={opts.brand ?? MOCK_BRAND_EXPLICIT}
      consentMode={opts.consentMode ?? 'INHERIT'}
      consentTextOverride={opts.consentTextOverride ?? null}
      onChange={opts.onChange ?? NOOP}
      disabled={false}
    />,
  )
}

describe('<ConsentCollectionSubBlock>', () => {
  describe('R9 dropdown options', () => {
    it('brand EXPLICIT: dropdown offers "Inherit (Explicit)" and "Override · Implied on submit"', () => {
      renderBlock({ brand: MOCK_BRAND_EXPLICIT })
      const select = screen.getByRole('combobox', { name: /consent mode/i })
      const optionLabels = Array.from(select.querySelectorAll('option')).map((o) => o.textContent)
      expect(optionLabels.some((l) => l && /inherit.*explicit/i.test(l))).toBe(true)
      expect(optionLabels.some((l) => l && /override.*implied/i.test(l))).toBe(true)
    })

    it('brand IMPLIED_ON_SUBMIT: dropdown offers "Inherit (Implied on submit)" and "Override · Explicit consent required"', () => {
      renderBlock({ brand: MOCK_BRAND_IMPLIED })
      const select = screen.getByRole('combobox', { name: /consent mode/i })
      const optionLabels = Array.from(select.querySelectorAll('option')).map((o) => o.textContent)
      expect(optionLabels.some((l) => l && /inherit.*implied/i.test(l))).toBe(true)
      expect(optionLabels.some((l) => l && /override.*explicit/i.test(l))).toBe(true)
    })
  })

  describe('R10 amber callout (more-permissive override)', () => {
    it('brand=EXPLICIT + override=IMPLIED: amber callout warns about the deviation log', () => {
      renderBlock({ brand: MOCK_BRAND_EXPLICIT, consentMode: 'IMPLIED_ON_SUBMIT' })
      expect(
        screen.getByText(/this deviation will be logged/i),
      ).toBeInTheDocument()
    })

    it('brand=IMPLIED + override=EXPLICIT: NO amber callout (stricter override is non-deviation)', () => {
      renderBlock({ brand: MOCK_BRAND_IMPLIED, consentMode: 'EXPLICIT' })
      expect(screen.queryByText(/this deviation will be logged/i)).not.toBeInTheDocument()
    })
  })

  describe('R12 disclosure toolbar', () => {
    it('renders both Privacy and Terms buttons when brand has both URLs', () => {
      renderBlock({ brand: MOCK_BRAND_EXPLICIT })
      expect(screen.getByRole('button', { name: /insert privacy link/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /insert terms link/i })).toBeInTheDocument()
    })

    it('hides the Terms button when Brand.termsUrl is null', () => {
      renderBlock({ brand: MOCK_BRAND_NO_TERMS })
      expect(screen.getByRole('button', { name: /insert privacy link/i })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /insert terms link/i })).not.toBeInTheDocument()
    })

    it('clicking Privacy button inserts {{privacy:"Privacy Policy"}} token via onChange', () => {
      const onChange = vi.fn()
      renderBlock({ brand: MOCK_BRAND_EXPLICIT, consentTextOverride: '', onChange })
      fireEvent.click(screen.getByRole('button', { name: /insert privacy link/i }))
      const lastCall = onChange.mock.calls.at(-1)?.[0]
      expect(lastCall?.consentTextOverride).toMatch(/\{\{privacy:.+\}\}/)
    })
  })

  describe('R13/R14 preview behavior', () => {
    it('blank disclosure → preview card body is empty (no inherited brand text)', () => {
      renderBlock({
        brand: MOCK_BRAND_EXPLICIT,
        consentMode: 'INHERIT',
        consentTextOverride: '',
      })
      const preview = screen.getByTestId('consent-preview')
      expect(preview).toBeInTheDocument()
      expect(preview).toHaveTextContent('')
    })

    it('EXPLICIT mode: preview shows a consent checkbox (R14)', () => {
      renderBlock({
        brand: MOCK_BRAND_EXPLICIT,
        consentMode: 'INHERIT',
        consentTextOverride: 'I agree.',
      })
      const preview = screen.getByTestId('consent-preview')
      expect(preview.querySelector('input[type="checkbox"]')).toBeInTheDocument()
    })

    it('IMPLIED_ON_SUBMIT mode: preview shows the disclosure copy without a checkbox', () => {
      renderBlock({
        brand: MOCK_BRAND_IMPLIED,
        consentMode: 'INHERIT',
        consentTextOverride: 'By submitting, you agree.',
      })
      const preview = screen.getByTestId('consent-preview')
      expect(preview.querySelector('input[type="checkbox"]')).not.toBeInTheDocument()
      expect(preview).toHaveTextContent(/by submitting, you agree/i)
    })

    it('R14 mode badge: renders an indicator badge naming the effective mode', () => {
      renderBlock({ brand: MOCK_BRAND_EXPLICIT, consentMode: 'IMPLIED_ON_SUBMIT' })
      expect(screen.getByTestId('consent-mode-badge')).toHaveTextContent(/implied on submit/i)
    })
  })

  describe('disabled mode', () => {
    it('dropdown and toolbar disabled when disabled=true (STOPPED status)', () => {
      render(
        <ConsentCollectionSubBlock
          brand={MOCK_BRAND_EXPLICIT}
          consentMode="INHERIT"
          consentTextOverride={null}
          onChange={NOOP}
          disabled
        />,
      )
      expect(screen.getByRole('combobox', { name: /consent mode/i })).toBeDisabled()
      expect(screen.getByRole('button', { name: /insert privacy link/i })).toBeDisabled()
    })
  })
})

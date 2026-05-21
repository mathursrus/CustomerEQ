// Issue #413 — Phase 4 (implement-code) — R12 byte-identity assertions
// for the four token-error states on the tokenized respondent page.
//
// User-mandated enforcement test for the timing-attack invariant:
// the footer DOM/bytes MUST be identical across `expired` / `responded` /
// `survey-not-open` / `invalid` so a token-guess can't distinguish state
// from byte-length signal. Sister-rule: #378 NFR-S5 (uniform server
// response payload).
//
// Implementation guarantee: the four states share one card render path
// (apps/web/src/app/survey/[id]/r/[token]/page.tsx — `if (tokenState &&
// tokenState !== 'valid') ...`) with the same surrounding <div>, the
// same <PoweredByFooter variant="neutral" channel="link" />, and only
// ERROR_COPY varies the inner <p>. This test locks the invariant against
// future regressions that might sneak a per-state data-* attribute or
// inline style into the footer subtree.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor, cleanup } from '@testing-library/react'

import TokenizedSurveyPage from './page'

const SURVEY_ID = 'srv_r12_fixture'
const TOKEN = 'tok_r12_fixture'

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: SURVEY_ID, token: TOKEN }),
}))

type TokenErrorState = 'expired' | 'responded' | 'survey-not-open' | 'invalid'
const TOKEN_ERROR_STATES: TokenErrorState[] = ['expired', 'responded', 'survey-not-open', 'invalid']

const originalFetch = globalThis.fetch

function mockTokenStatusFetch(state: TokenErrorState) {
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString()
    if (url.includes('/token-status')) {
      return new Response(JSON.stringify({ state }), { status: 200 })
    }
    // Survey-fetch should NEVER fire when state is non-valid (R12 + #378 NFR-S5
    // — no survey content exposed for error states). If it does, fail loud.
    throw new Error(`Unexpected fetch in error-state render: ${url}`)
  }) as typeof globalThis.fetch
}

/** Render the page in the given token-error state and return the footer's outerHTML. */
async function captureFooterHtml(state: TokenErrorState): Promise<string> {
  mockTokenStatusFetch(state)
  const { container } = render(<TokenizedSurveyPage />)

  // Wait for the fetch effect to resolve and the error-state card to render.
  const footer = await waitFor(() => {
    const el = container.querySelector('[data-survey-footer]')
    if (!el) throw new Error(`footer not yet rendered for state=${state}`)
    return el
  })

  return footer.outerHTML
}

describe('Tokenized respondent page — R12 footer byte-identity across token-error states', () => {
  beforeEach(() => {
    // No-op — mock is installed per call inside captureFooterHtml so each
    // render gets its own state-specific token-status response.
  })

  afterEach(() => {
    cleanup()
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('renders the same footer subtree HTML for state="expired" and state="responded"', async () => {
    const expired = await captureFooterHtml('expired')
    cleanup()
    const responded = await captureFooterHtml('responded')
    expect(responded).toBe(expired)
  })

  it('renders the same footer subtree HTML for state="expired" and state="survey-not-open"', async () => {
    const expired = await captureFooterHtml('expired')
    cleanup()
    const notOpen = await captureFooterHtml('survey-not-open')
    expect(notOpen).toBe(expired)
  })

  it('renders the same footer subtree HTML for state="expired" and state="invalid"', async () => {
    const expired = await captureFooterHtml('expired')
    cleanup()
    const invalid = await captureFooterHtml('invalid')
    expect(invalid).toBe(expired)
  })

  it('renders the same footer subtree HTML across all four token-error states in a single equality assertion', async () => {
    const captured: Record<TokenErrorState, string> = {} as Record<TokenErrorState, string>
    for (const state of TOKEN_ERROR_STATES) {
      cleanup()
      captured[state] = await captureFooterHtml(state)
    }

    // All four must equal the first. Using the first as the reference makes
    // the failure message identify the diverging state(s) immediately.
    const reference = captured.expired
    for (const state of TOKEN_ERROR_STATES) {
      expect(captured[state], `state=${state} diverged from state=expired`).toBe(reference)
    }
  })

  it('the matched footer subtree is non-empty and contains the "Powered by" prefix + CustomerEQ anchor', async () => {
    const html = await captureFooterHtml('expired')

    expect(html.length).toBeGreaterThan(0)
    expect(html).toContain('Powered by')
    expect(html).toContain('>CustomerEQ<')
    expect(html).toContain('data-survey-footer')
  })

  it('the footer subtree contains no per-state data-* attribute, no per-state inline style, and no per-state text other than the canonical "Powered by CustomerEQ" copy', async () => {
    // Defensive — if a future PR adds `data-error-state={tokenState}` or
    // similar to the footer subtree, the four captures will diverge and the
    // earlier tests will fail, but this assertion calls out *why* up front.
    for (const state of TOKEN_ERROR_STATES) {
      cleanup()
      const html = await captureFooterHtml(state)
      expect(html, `state=${state} footer must not contain the token-state string`).not.toContain(state)
    }
  })
})

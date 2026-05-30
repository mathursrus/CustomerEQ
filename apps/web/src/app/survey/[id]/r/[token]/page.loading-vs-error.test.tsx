// Issue #543 F2 — tokenized respondent page no longer flashes
// "Failed to load survey" during the brief window between the token-status
// preflight resolving to 'valid' and the form's data-fetch useEffect firing.
//
// The pre-fix branch at page.tsx:188 was reachable in TWO distinct states:
//   (a) genuine fetch failure — form.error / form.loadError populated, OR
//   (b) transient render after tokenState→valid and before form.loading→true.
// The pre-fix code rendered the red error card for both, producing a
// ~50-200ms flash of scary "Failed to load survey" copy at every respondent.
//
// The fix routes state (b) back to the Loading card; state (a) still shows
// the error card. These tests lock that invariant.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'

import TokenizedSurveyPage from './page'

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'srv_x', token: 'tok_x' }),
}))

// Mock the hook so each test controls the exact shape of the returned
// form state. This isolates the page's conditional rendering logic from
// the hook's effect timing — the bug was in the page, not the hook.
const mockFormState = {
  resolvedSurvey: null as unknown,
  brandLite: null as unknown,
  loading: false,
  loadError: null as string | null,
  error: null as string | null,
  setError: vi.fn(),
  submitted: false,
  answers: {},
  setAnswers: vi.fn(),
  memberIdentifier: '',
  setMemberIdentifier: vi.fn(),
  consentGiven: false,
  setConsentGiven: vi.fn(),
  validate: vi.fn(() => true),
  consentRequired: false,
}

vi.mock('@/components/survey-form/useSurveyResponseForm', () => ({
  useSurveyResponseForm: () => mockFormState,
}))

// Mock fetch to resolve token-status to 'valid' immediately so the
// tokenStatus phase finishes and the page falls into the form-render gate.
const originalFetch = globalThis.fetch
function mockTokenStatusValid() {
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString()
    if (url.includes('/token-status')) {
      return new Response(JSON.stringify({ state: 'valid' }), { status: 200 })
    }
    return new Response('{}', { status: 200 })
  }) as typeof globalThis.fetch
}

function resetFormStateMock() {
  mockFormState.resolvedSurvey = null
  mockFormState.brandLite = null
  mockFormState.loading = false
  mockFormState.loadError = null
  mockFormState.error = null
  mockFormState.submitted = false
}

describe('Tokenized respondent page — Loading vs Failed-to-Load discrimination (#543 F2)', () => {
  afterEach(() => {
    cleanup()
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
    resetFormStateMock()
  })

  it('renders Loading (not the red error card) when tokenState=valid AND form has no error AND no resolved data yet', async () => {
    // Race window: tokenState resolved to 'valid', form is enabled, but
    // form's useEffect hasn't fired yet (so loading=false, resolvedSurvey=null,
    // error=null). Pre-fix this triggered the "Failed to load survey." card.
    mockTokenStatusValid()
    resetFormStateMock()
    // All form fields are at their initial-no-fetch-yet state. Hook is
    // mocked, so the page renders exactly the conditional we're testing.

    const { container, findByText } = render(<TokenizedSurveyPage />)

    // Wait for tokenStatus fetch to resolve and the page to re-render.
    await findByText('Loading…')

    // The error card carries `bg-red-50` on its wrapper div; the loading
    // card uses `bg-white`. Assert no red wrapper exists.
    const redWrapper = container.querySelector('.bg-red-50')
    expect(redWrapper).toBeNull()

    // Belt-and-braces: explicit "Failed to load survey." copy must not appear.
    expect(container.textContent).not.toContain('Failed to load survey')
  })

  it('renders the error card when form.loadError is populated (genuine fetch failure)', async () => {
    mockTokenStatusValid()
    resetFormStateMock()
    mockFormState.loadError = 'Survey is no longer available.'

    const { container, findByText } = render(<TokenizedSurveyPage />)
    await findByText('Survey is no longer available.')

    // The fix preserves the error-card path when an actual error is present.
    const redWrapper = container.querySelector('.bg-red-50')
    expect(redWrapper).not.toBeNull()
  })

  it('renders the error card when form.error is populated (post-submit failure)', async () => {
    mockTokenStatusValid()
    resetFormStateMock()
    mockFormState.error = 'Submission failed. Please try again.'

    const { container, findByText } = render(<TokenizedSurveyPage />)
    await findByText('Submission failed. Please try again.')

    const redWrapper = container.querySelector('.bg-red-50')
    expect(redWrapper).not.toBeNull()
  })
})

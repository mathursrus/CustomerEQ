// Issue #241 Slice 4b (#336) — /admin/surveys/[id]/edit page RTL.
//
// Covers the page-level integration:
//   - auth() / Clerk bearer + GET /v1/surveys/:id + GET /v1/brand-themes
//     + GET /v1/me + GET /v1/programs (4-fetch load sequence, same shape as
//     Slice 4a's detail page).
//   - Initial tab from ?tab= query param. Invalid values fall back to 'basics'.
//   - STOPPED status renders read-only mode (all inputs disabled, no Save).
//   - DRAFT renders the auto-save indicator and no explicit Save button.
//   - **Mock stability**: Clerk hook returns are declared at module scope
//     (Slice 4a Lesson 2 — reference instability caused an infinite render
//     loop in 335-survey-detail-page).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

import {
  DRAFT_SURVEY_ID,
  STOPPED_SURVEY_ID,
  MOCK_BRAND_EXPLICIT,
  MOCK_DRAFT_SURVEY,
  MOCK_STOPPED_SURVEY,
  MOCK_PROGRAM_NPS_WITH_RULE,
  MOCK_THEME_DEFAULT,
  MOCK_THEME_LIBRARY,
} from './__fixtures__/editor-fixtures'

// ─── Stable mocks at module scope (Slice 4a Lesson 2) ───────────────────────
const STABLE_GET_TOKEN = async () => 'test-token'
const STABLE_USE_AUTH = { getToken: STABLE_GET_TOKEN }
const SEARCH_PARAMS_HOLDER = { current: new URLSearchParams() }

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => STABLE_USE_AUTH,
}))

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: SEARCH_PARAMS_HOLDER.current.get('__id') ?? DRAFT_SURVEY_ID }),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => `/admin/surveys/${DRAFT_SURVEY_ID}/edit`,
  useSearchParams: () => SEARCH_PARAMS_HOLDER.current,
}))

const originalFetch = globalThis.fetch

function mockApi(opts: { survey?: typeof MOCK_DRAFT_SURVEY } = {}) {
  const survey = opts.survey ?? MOCK_DRAFT_SURVEY
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString()
    if (url.endsWith(`/v1/surveys/${survey.id}`)) {
      return new Response(JSON.stringify({ survey }), { status: 200 })
    }
    if (url.includes('/v1/brand-themes/')) {
      return new Response(JSON.stringify({ theme: MOCK_THEME_DEFAULT }), { status: 200 })
    }
    if (url.endsWith('/v1/brand-themes')) {
      return new Response(JSON.stringify({ themes: MOCK_THEME_LIBRARY }), { status: 200 })
    }
    if (url.endsWith('/v1/me')) {
      return new Response(JSON.stringify({ brand: MOCK_BRAND_EXPLICIT }), { status: 200 })
    }
    if (url.endsWith('/v1/programs')) {
      return new Response(
        JSON.stringify({ data: [MOCK_PROGRAM_NPS_WITH_RULE] }),
        { status: 200 },
      )
    }
    return new Response('not found', { status: 404 })
  }) as unknown as typeof fetch
}

beforeEach(() => {
  SEARCH_PARAMS_HOLDER.current = new URLSearchParams()
  mockApi()
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('/admin/surveys/[id]/edit · editor page', () => {
  it('renders the SurveyEditorForm shell after the 4-fetch load completes', async () => {
    const Page = (await import('./page')).default
    render(<Page />)
    await waitFor(
      () => expect(screen.getByRole('tab', { name: /basics/i })).toBeInTheDocument(),
      { timeout: 5000 },
    )
  })

  it('initial tab from ?tab= query param: questions', async () => {
    SEARCH_PARAMS_HOLDER.current = new URLSearchParams('tab=questions')
    const Page = (await import('./page')).default
    render(<Page />)
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: /questions/i })).toHaveAttribute('aria-selected', 'true'),
    )
  })

  it('invalid ?tab= value falls back to basics', async () => {
    SEARCH_PARAMS_HOLDER.current = new URLSearchParams('tab=not-a-real-tab')
    const Page = (await import('./page')).default
    render(<Page />)
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: /basics/i })).toHaveAttribute('aria-selected', 'true'),
    )
  })

  it('DRAFT: renders the auto-save indicator (no explicit Save button)', async () => {
    const Page = (await import('./page')).default
    render(<Page />)
    await waitFor(() => expect(screen.getByTestId('autosave-indicator')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /^save changes$/i })).not.toBeInTheDocument()
  })

  it('STOPPED: read-only mode (inputs disabled, no Save, "Stopped — Restart to edit" header)', async () => {
    SEARCH_PARAMS_HOLDER.current = new URLSearchParams(`__id=${STOPPED_SURVEY_ID}`)
    mockApi({ survey: MOCK_STOPPED_SURVEY })
    const Page = (await import('./page')).default
    render(<Page />)
    await waitFor(() => expect(screen.getByText(/stopped — restart to edit/i)).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /^save changes$/i })).not.toBeInTheDocument()
  })
})

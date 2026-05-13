import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { SURVEY_ALL_TYPES } from '@/components/survey-form/__fixtures__/survey-all-types'
import { THEME_DISTINCT } from '@/components/survey-form/__fixtures__/theme-default'

// Issue #241 Slice 4a — page-level RTL for /admin/surveys/[id].
// Asserts the 3 sections render in order and initial chevron state follows
// responsesCount.

// Mock Next params + Clerk auth at the module level so the page can be
// imported as a default-exported client component.
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: SURVEY_ALL_TYPES.id }),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => `/admin/surveys/${SURVEY_ALL_TYPES.id}`,
  useSearchParams: () => new URLSearchParams(),
}))


// Stable references so useAuth returns the SAME object/function each call.
// Otherwise the page's `useCallback([getToken])` invalidates on every render,
// re-fires loadAll inside useEffect, and the page never escapes the loading
// state (infinite render loop).
const STABLE_GET_TOKEN = async () => 'test-token'
const STABLE_USE_AUTH = { getToken: STABLE_GET_TOKEN }

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => STABLE_USE_AUTH,
}))

const originalFetch = globalThis.fetch

function mockApi(overrides: { survey?: any; theme?: any; brand?: any; program?: any } = {}) {
  const survey = overrides.survey ?? { ...SURVEY_ALL_TYPES, _count: { responses: 0 } }
  const theme = overrides.theme ?? THEME_DISTINCT
  const brand = overrides.brand ?? {
    id: 'brd_fixture',
    name: 'Fixture Brand',
    logoUrl: null,
    consentTextDefault: null,
    termsUrl: null,
    privacyPolicyUrl: null,
    memberIdentifierKind: 'email',
  }
  const program = overrides.program ?? { id: SURVEY_ALL_TYPES.programId, name: 'Fixture Program' }

  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString()
    if (url.endsWith(`/v1/surveys/${SURVEY_ALL_TYPES.id}`)) {
      return new Response(JSON.stringify({ survey }), { status: 200 })
    }
    if (url.includes('/v1/brand-themes/')) {
      return new Response(JSON.stringify({ theme }), { status: 200 })
    }
    if (url.endsWith('/v1/me')) {
      return new Response(JSON.stringify({ brand }), { status: 200 })
    }
    if (url.endsWith('/v1/programs')) {
      return new Response(JSON.stringify({ data: [program] }), { status: 200 })
    }
    return new Response('not found', { status: 404 })
  }) as unknown as typeof fetch
}

beforeEach(() => mockApi())
afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('/admin/surveys/[id] · detail page rewrite', () => {
  it('renders the four sections in the order Distribution / Loop Monitor / Response / Configuration summary', async () => {
    const Page = (await import('./page')).default
    render(<Page />)
    await waitFor(
      () => expect(screen.getByRole('heading', { name: /Distribution/i })).toBeInTheDocument(),
      { timeout: 5000 },
    )
    const headings = screen.getAllByRole('heading').map((h) => h.textContent)
    const distributionIdx = headings.findIndex((t) => t?.includes('Distribution'))
    const loopMonitorIdx = headings.findIndex((t) => t?.toLowerCase().includes('loop monitor'))
    const responseIdx = headings.findIndex((t) => t === 'Response')
    const configIdx = headings.findIndex((t) => t?.includes('Configuration summary'))
    expect(distributionIdx).toBeGreaterThanOrEqual(0)
    expect(loopMonitorIdx).toBeGreaterThan(distributionIdx)
    expect(responseIdx).toBeGreaterThan(loopMonitorIdx)
    expect(configIdx).toBeGreaterThan(responseIdx)
  })

  it('with responsesCount=0: Distribution expanded, Loop Monitor expanded, Response collapsed, Configuration expanded (R32b)', async () => {
    const Page = (await import('./page')).default
    render(<Page />)
    await waitFor(() => expect(screen.getByText('Share link')).toBeInTheDocument())
    // Distribution body visible (Share link tile rendered)
    expect(screen.getByText('Share link')).toBeInTheDocument()
    // Loop Monitor body visible — placeholder shell reaches the DOM (LoopMonitor's own fetch is stubbed by mockApi)
    expect(await screen.findByTestId('loop-monitor-placeholder')).toBeInTheDocument()
    // Configuration body visible (survey title from the preview)
    expect(screen.getByRole('heading', { name: 'Quick check-in' })).toBeInTheDocument()
    // Response body hidden — deferral note must not be visible
    expect(screen.queryByText(/sibling sub-issue/i)).toBeNull()
  })

  it('with responsesCount>0: Distribution collapsed, Loop Monitor expanded, Response expanded, Configuration collapsed', async () => {
    mockApi({ survey: { ...SURVEY_ALL_TYPES, _count: { responses: 7 } } })
    const Page = (await import('./page')).default
    render(<Page />)
    // Loop Monitor stays expanded regardless of responsesCount (R32b)
    expect(await screen.findByTestId('loop-monitor-placeholder')).toBeInTheDocument()
    // Response body visible — deferral note inside it
    await waitFor(() => expect(screen.getByText(/sibling sub-issue/i)).toBeInTheDocument())
    expect(screen.queryByText('Share link')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Quick check-in' })).toBeNull()
  })

  it('renders the survey breadcrumb and status pill in the header', async () => {
    const Page = (await import('./page')).default
    render(<Page />)
    // Breadcrumb back-link
    await waitFor(() => expect(screen.getByRole('link', { name: 'Surveys' })).toBeInTheDocument())
    // h1 with survey name
    expect(screen.getByRole('heading', { level: 1, name: SURVEY_ALL_TYPES.name })).toBeInTheDocument()
    // Status badge text (Draft for the fixture). The page also renders "Draft"
    // inside the Configuration summary's dl. Assert at least one exists.
    expect(screen.getAllByText('Draft').length).toBeGreaterThanOrEqual(1)
  })
})

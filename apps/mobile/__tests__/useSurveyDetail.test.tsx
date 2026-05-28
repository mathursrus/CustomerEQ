/**
 * Tests for useSurveyDetail hook — verifies production API shape mapping.
 *
 * Guards against the five shape mismatches fixed in #536:
 *   1. data.data not data.responses
 *   2. sentiment as float → string label
 *   3. answers as object → textResponses extraction
 *   4. member.identifierValue email fallback
 *   5. page/totalPages hasMore derivation
 *   6. sentimentBands/scoreBands param names (not sentiment/scoreBand)
 */
import React from 'react'
import { renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { notifyManager } from '@tanstack/react-query'
import { useSurveyDetail } from '../hooks/useSurveyDetail'

// Run React Query updates synchronously so waitFor resolves quickly.
notifyManager.setScheduler(fn => fn())

jest.mock('@clerk/clerk-expo', () => ({
  useAuth: () => ({ getToken: async () => 'clerk_token', isSignedIn: true }),
}))

jest.mock('../lib/api', () => ({
  API_URL: 'http://test-api',
  queryEnabled: () => true,
  apiHeaders: async () => ({ 'x-api-key': 'test-key' }),
}))

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
}

const BASE_ROW = {
  id: 'r1',
  score: 3,
  completedAt: '2026-05-10T00:00:00Z',
  member: { firstName: 'Sara', lastName: 'Kim', email: null, identifierValue: 'sara@example.com' },
}

function mockFetch(payload: unknown) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true, status: 200,
    json: async () => payload,
  } as Response)
}

afterEach(() => jest.restoreAllMocks())

// ── data envelope ────────────────────────────────────────────────────────────

describe('data envelope', () => {
  it('reads items from data.data (production field)', async () => {
    mockFetch({ data: [{ ...BASE_ROW, sentiment: -0.5, answers: {} }], total: 1, page: 1, totalPages: 1 })
    const { result } = renderHook(() => useSurveyDetail('s1'), { wrapper: makeWrapper() })
    await waitFor(() => { expect(result.current.data?.items).toHaveLength(1) })
    expect(result.current.data?.items[0].id).toBe('r1')
  })

  it('falls back to data.responses envelope', async () => {
    mockFetch({ responses: [{ ...BASE_ROW, sentiment: null, answers: {} }], total: 1, page: 1, totalPages: 1 })
    const { result } = renderHook(() => useSurveyDetail('s1'), { wrapper: makeWrapper() })
    await waitFor(() => { expect(result.current.data?.items).toHaveLength(1) })
  })
})

// ── sentiment float → string ──────────────────────────────────────────────────

describe('sentiment conversion', () => {
  it.each([
    [0.8, 'positive'],
    [-0.3, 'negative'],
    [0.0, 'neutral'],
    [0.09, 'neutral'],
    [-0.09, 'neutral'],
  ])('sentiment %f → %s', async (float, label) => {
    mockFetch({ data: [{ ...BASE_ROW, sentiment: float, answers: {} }], total: 1, page: 1, totalPages: 1 })
    const { result } = renderHook(() => useSurveyDetail('s1'), { wrapper: makeWrapper() })
    await waitFor(() => { expect(result.current.data?.items).toHaveLength(1) })
    expect(result.current.data?.items[0].sentiment).toBe(label)
  })

  it('passes through string sentiment unchanged', async () => {
    mockFetch({ data: [{ ...BASE_ROW, sentiment: 'positive', answers: {} }], total: 1, page: 1, totalPages: 1 })
    const { result } = renderHook(() => useSurveyDetail('s1'), { wrapper: makeWrapper() })
    await waitFor(() => { expect(result.current.data?.items).toHaveLength(1) })
    expect(result.current.data?.items[0].sentiment).toBe('positive')
  })

  it('maps null sentiment to null', async () => {
    mockFetch({ data: [{ ...BASE_ROW, sentiment: null, answers: {} }], total: 1, page: 1, totalPages: 1 })
    const { result } = renderHook(() => useSurveyDetail('s1'), { wrapper: makeWrapper() })
    await waitFor(() => { expect(result.current.data?.items).toHaveLength(1) })
    expect(result.current.data?.items[0].sentiment).toBeNull()
  })
})

// ── answers extraction ────────────────────────────────────────────────────────

describe('answers extraction', () => {
  it('extracts strings from object answers (production shape)', async () => {
    mockFetch({ data: [{ ...BASE_ROW, sentiment: null, answers: { q1: 3, q2: 'Coffee was cold.' } }], total: 1, page: 1, totalPages: 1 })
    const { result } = renderHook(() => useSurveyDetail('s1'), { wrapper: makeWrapper() })
    await waitFor(() => { expect(result.current.data?.items).toHaveLength(1) })
    expect(result.current.data?.items[0].textResponses).toEqual([{ text: 'Coffee was cold.' }])
  })

  it('extracts from array answers', async () => {
    mockFetch({ data: [{ ...BASE_ROW, sentiment: null, answers: [{ text: 'Great!' }, { text: '' }] }], total: 1, page: 1, totalPages: 1 })
    const { result } = renderHook(() => useSurveyDetail('s1'), { wrapper: makeWrapper() })
    await waitFor(() => { expect(result.current.data?.items).toHaveLength(1) })
    expect(result.current.data?.items[0].textResponses).toEqual([{ text: 'Great!' }])
  })

  it('prefers textResponses field over answers', async () => {
    mockFetch({ data: [{ ...BASE_ROW, sentiment: null, textResponses: [{ text: 'From textResponses' }], answers: { q1: 'Should not appear' } }], total: 1, page: 1, totalPages: 1 })
    const { result } = renderHook(() => useSurveyDetail('s1'), { wrapper: makeWrapper() })
    await waitFor(() => { expect(result.current.data?.items).toHaveLength(1) })
    expect(result.current.data?.items[0].textResponses).toEqual([{ text: 'From textResponses' }])
  })

  it('ignores blank strings in object answers', async () => {
    mockFetch({ data: [{ ...BASE_ROW, sentiment: null, answers: { q1: '   ', q2: 'Valid' } }], total: 1, page: 1, totalPages: 1 })
    const { result } = renderHook(() => useSurveyDetail('s1'), { wrapper: makeWrapper() })
    await waitFor(() => { expect(result.current.data?.items).toHaveLength(1) })
    expect(result.current.data?.items[0].textResponses).toEqual([{ text: 'Valid' }])
  })
})

// ── member email fallback ─────────────────────────────────────────────────────

describe('member email fallback', () => {
  it('uses member.email when present', async () => {
    mockFetch({ data: [{ ...BASE_ROW, sentiment: null, answers: {}, member: { firstName: 'Alex', lastName: 'Chen', email: 'alex@example.com', identifierValue: 'id-123' } }], total: 1, page: 1, totalPages: 1 })
    const { result } = renderHook(() => useSurveyDetail('s1'), { wrapper: makeWrapper() })
    await waitFor(() => { expect(result.current.data?.items).toHaveLength(1) })
    expect(result.current.data?.items[0].memberEmail).toBe('alex@example.com')
  })

  it('falls back to identifierValue when email is null', async () => {
    mockFetch({ data: [{ ...BASE_ROW, sentiment: null, answers: {} }], total: 1, page: 1, totalPages: 1 })
    const { result } = renderHook(() => useSurveyDetail('s1'), { wrapper: makeWrapper() })
    await waitFor(() => { expect(result.current.data?.items).toHaveLength(1) })
    expect(result.current.data?.items[0].memberEmail).toBe('sara@example.com')
  })

  it('returns null memberEmail when member is null', async () => {
    mockFetch({ data: [{ ...BASE_ROW, sentiment: null, answers: {}, member: null }], total: 1, page: 1, totalPages: 1 })
    const { result } = renderHook(() => useSurveyDetail('s1'), { wrapper: makeWrapper() })
    await waitFor(() => { expect(result.current.data?.items).toHaveLength(1) })
    expect(result.current.data?.items[0].memberEmail).toBeNull()
  })
})

// ── pagination / hasMore ──────────────────────────────────────────────────────

describe('pagination', () => {
  it('hasMore true when page < totalPages', async () => {
    mockFetch({ data: Array(20).fill({ ...BASE_ROW, sentiment: null, answers: {} }), total: 110, page: 1, totalPages: 6 })
    const { result } = renderHook(() => useSurveyDetail('s1'), { wrapper: makeWrapper() })
    await waitFor(() => { expect(result.current.data?.items).toHaveLength(20) })
    expect(result.current.data?.hasMore).toBe(true)
  })

  it('hasMore false when page === totalPages', async () => {
    mockFetch({ data: Array(10).fill({ ...BASE_ROW, sentiment: null, answers: {} }), total: 110, page: 6, totalPages: 6 })
    const { result } = renderHook(() => useSurveyDetail('s1', 6), { wrapper: makeWrapper() })
    await waitFor(() => { expect(result.current.data?.items).toHaveLength(10) })
    expect(result.current.data?.hasMore).toBe(false)
  })

  it('returns correct total', async () => {
    mockFetch({ data: [{ ...BASE_ROW, sentiment: null, answers: {} }], total: 42, page: 1, totalPages: 3 })
    const { result } = renderHook(() => useSurveyDetail('s1'), { wrapper: makeWrapper() })
    await waitFor(() => { expect(result.current.data?.items).toHaveLength(1) })
    expect(result.current.data?.total).toBe(42)
  })
})

// ── filter URL params ─────────────────────────────────────────────────────────

describe('filter param names sent to API', () => {
  it('sends sentimentBands= not sentiment=', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: [], total: 0, page: 1, totalPages: 1 }) } as Response)
    global.fetch = fetchMock
    const { result } = renderHook(() => useSurveyDetail('s1', 1, { sentiment: 'negative' }), { wrapper: makeWrapper() })
    await waitFor(() => { expect(result.current.data).toBeDefined() })
    const url = fetchMock.mock.calls[0][0] as string
    expect(url).toContain('sentimentBands=negative')
    expect(url).not.toContain('sentiment=negative')
  })

  it('sends scoreBands= not scoreBand=', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: [], total: 0, page: 1, totalPages: 1 }) } as Response)
    global.fetch = fetchMock
    const { result } = renderHook(() => useSurveyDetail('s1', 1, { scoreBand: 'promoter' }), { wrapper: makeWrapper() })
    await waitFor(() => { expect(result.current.data).toBeDefined() })
    const url = fetchMock.mock.calls[0][0] as string
    expect(url).toContain('scoreBands=promoter')
    expect(url).not.toContain('scoreBand=promoter')
  })
})

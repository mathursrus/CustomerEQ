/**
 * Tests for useSurveys hook — verifies API response shape mapping.
 *
 * Drives a real fetch mock with the exact payload the production API returns,
 * then asserts the normalized Survey objects the hook exposes to the UI.
 * Guards against field-name regressions like responsesCount→responseCount.
 */
import React from 'react'
import { renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { notifyManager } from '@tanstack/react-query'
import { useSurveys } from '../hooks/useSurveys'

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

function mockFetch(payload: unknown) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true, status: 200,
    json: async () => payload,
  } as Response)
}

afterEach(() => jest.restoreAllMocks())

describe('useSurveys — API shape mapping', () => {
  it('maps responsesCount (production field) to responseCount', async () => {
    mockFetch({ data: [{ id: 's1', name: 'Post-Visit NPS', title: 'Post-Visit NPS', type: 'NPS', status: 'ACTIVE', responsesCount: 42, score: null }] })
    const { result } = renderHook(() => useSurveys(), { wrapper: makeWrapper() })
    await waitFor(() => { expect(result.current.data.length).toBeGreaterThan(0) })
    expect(result.current.data[0].responseCount).toBe(42)
  })

  it('also handles responseCount field if present directly', async () => {
    mockFetch({ data: [{ id: 's2', name: 'CSAT', title: null, type: 'CSAT', status: 'ACTIVE', responseCount: 7, score: 4.2 }] })
    const { result } = renderHook(() => useSurveys(), { wrapper: makeWrapper() })
    await waitFor(() => { expect(result.current.data.length).toBeGreaterThan(0) })
    expect(result.current.data[0].responseCount).toBe(7)
    expect(result.current.data[0].score).toBe(4.2)
  })

  it('handles data.surveys envelope', async () => {
    mockFetch({ surveys: [{ id: 's3', name: 'Old envelope', title: null, type: 'NPS', status: 'DRAFT', responsesCount: 0, score: null }] })
    const { result } = renderHook(() => useSurveys(), { wrapper: makeWrapper() })
    await waitFor(() => { expect(result.current.data.length).toBeGreaterThan(0) })
    expect(result.current.data[0].id).toBe('s3')
  })

  it('normalizes title: null → title stays null, name preserved', async () => {
    mockFetch({ data: [{ id: 's4', name: 'Internal Name', title: null, type: 'NPS', status: 'ACTIVE', responsesCount: 0, score: null }] })
    const { result } = renderHook(() => useSurveys(), { wrapper: makeWrapper() })
    await waitFor(() => { expect(result.current.data.length).toBeGreaterThan(0) })
    expect(result.current.data[0].title).toBeNull()
    expect(result.current.data[0].name).toBe('Internal Name')
  })

  it('maps score: null when API omits it', async () => {
    mockFetch({ data: [{ id: 's5', name: 'No score', title: null, type: 'NPS', status: 'ACTIVE', responsesCount: 110 }] })
    const { result } = renderHook(() => useSurveys(), { wrapper: makeWrapper() })
    await waitFor(() => { expect(result.current.data.length).toBeGreaterThan(0) })
    expect(result.current.data[0].score).toBeNull()
  })

  it('returns empty array and isError on non-ok response', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) } as Response)
    const { result } = renderHook(() => useSurveys(), { wrapper: makeWrapper() })
    await waitFor(() => { expect(result.current.isError).toBe(true) })
    expect(result.current.data).toEqual([])
  })
})

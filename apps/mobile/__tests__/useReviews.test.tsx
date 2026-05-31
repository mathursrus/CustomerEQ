import React from 'react'
import { renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { notifyManager } from '@tanstack/react-query'
import { useReviews } from '../hooks/useReviews'

notifyManager.setScheduler(fn => fn())

jest.mock('@clerk/clerk-expo', () => ({
  useAuth: () => ({ getToken: async () => 'clerk_token', isSignedIn: true }),
}))

jest.mock('../lib/api', () => ({
  API_URL: 'http://test-api',
  queryEnabled: () => true,
  apiHeaders: async () => ({ Authorization: 'Bearer test' }),
}))

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
}

afterEach(() => jest.restoreAllMocks())

describe('useReviews', () => {
  it('keeps the empty reviews array reference stable across renders', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: [],
        meta: { total: 0, page: 1, limit: 20, hasMore: false, overallRating: null, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } },
      }),
    } as Response)

    const { result, rerender } = renderHook(() => useReviews(1), { wrapper: makeWrapper() })
    await waitFor(() => { expect(result.current.meta?.total).toBe(0) })

    const first = result.current.reviews
    rerender({})

    expect(result.current.reviews).toBe(first)
  })
})

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-expo'
import { API_URL, queryEnabled, apiHeaders } from '../lib/api'

export interface Review { id: string; author: string; rating: number; text: string; date: string | null; replied: boolean }
export interface ReviewMeta { total: number; page: number; limit: number; hasMore: boolean; overallRating: number | null; distribution: Record<string, number> }

const EMPTY_REVIEWS: Review[] = []

export function useReviews(page = 1) {
  const { getToken, isSignedIn } = useAuth()
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['reviews', page],
    enabled: queryEnabled(isSignedIn ?? false),
    queryFn: async () => {
      const headers = await apiHeaders(getToken)
      const res = await fetch(`${API_URL}/v1/reviews?page=${page}&limit=20`, { headers })
      if (!res.ok) throw new Error(`Reviews fetch failed: ${res.status}`)
      const payload = await res.json()
      return {
        data: Array.isArray(payload.data) ? payload.data as Review[] : [],
        meta: payload.meta as ReviewMeta,
      }
    },
  })

  const replyMutation = useMutation({
    mutationFn: async ({ reviewId, text }: { reviewId: string; text: string }) => {
      const headers = await apiHeaders(getToken)
      const res = await fetch(`${API_URL}/v1/reviews/${reviewId}/reply`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error ?? 'Failed to submit reply')
      }
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reviews'] }),
  })

  return {
    reviews: query.data?.data ?? EMPTY_REVIEWS,
    meta: query.data?.meta ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    submitReply: (reviewId: string, text: string) => replyMutation.mutateAsync({ reviewId, text }),
  }
}

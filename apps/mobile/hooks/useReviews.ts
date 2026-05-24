import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-expo'
import { API_URL, DEV_BYPASS, DEV_TOKEN } from '../lib/api'

interface Review { id: string; author: string; rating: number; text: string; date: string | null; replied: boolean }
interface ReviewMeta { total: number; page: number; limit: number; hasMore: boolean; overallRating: number | null; distribution: Record<string, number> }

export function useReviews(page = 1) {
  const { getToken } = useAuth()
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['reviews', page],
    queryFn: async () => {
      const token = DEV_BYPASS ? DEV_TOKEN : await getToken()
      const res = await fetch(`${API_URL}/v1/reviews?page=${page}&limit=20`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error('Failed to fetch reviews')
      return res.json() as Promise<{ data: Review[]; meta: ReviewMeta }>
    },
  })

  const replyMutation = useMutation({
    mutationFn: async ({ reviewId, text }: { reviewId: string; text: string }) => {
      const token = DEV_BYPASS ? DEV_TOKEN : await getToken()
      const res = await fetch(`${API_URL}/v1/reviews/${reviewId}/reply`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) throw new Error('Failed to submit reply')
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reviews'] }),
  })

  return {
    reviews: query.data?.data ?? [],
    meta: query.data?.meta ?? null,
    isLoading: query.isLoading,
    submitReply: (reviewId: string, text: string) => replyMutation.mutateAsync({ reviewId, text }),
  }
}

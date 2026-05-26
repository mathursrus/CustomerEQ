import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-expo'
import { API_URL, DEV_BYPASS, DEV_TOKEN } from '../lib/api'

export interface Verbatim {
  id: string; score: number | null; sentiment: string | null; completedAt: string | null
  memberName: string | null; memberEmail: string | null
  textResponses: Array<{ text: string }>
}

export interface ResponseFilters {
  sentiment?: 'positive' | 'neutral' | 'negative'
  scoreBand?: 'promoter' | 'passive' | 'detractor'
}

export function useSurveyDetail(surveyId: string | null, page = 1, filters: ResponseFilters = {}) {
  const { getToken, isSignedIn } = useAuth()
  return useQuery({
    queryKey: ['survey-detail', surveyId, page, filters],
    enabled: !!surveyId && (DEV_BYPASS || isSignedIn === true),
    queryFn: async () => {
      const token = DEV_BYPASS ? DEV_TOKEN : await getToken()
      const params = new URLSearchParams({ pageSize: '20', page: String(page) })
      if (filters.sentiment) params.set('sentiment', filters.sentiment)
      if (filters.scoreBand) params.set('scoreBand', filters.scoreBand)
      const res = await fetch(`${API_URL}/v1/surveys/${surveyId}/responses?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to fetch survey responses')
      const data = await res.json()
      const responses = (data.responses ?? []) as Array<{
        id: string; score: number | null; sentiment: string | null; completedAt: string | null
        member?: { firstName?: string; lastName?: string; email?: string } | null
        textResponses?: Array<{ text: string }>
        answers?: Array<{ text?: string }>
      }>
      return {
        items: responses.map((r) => ({
          id: r.id,
          score: r.score,
          sentiment: r.sentiment,
          completedAt: r.completedAt,
          memberName: r.member ? [r.member.firstName, r.member.lastName].filter(Boolean).join(' ') || null : null,
          memberEmail: r.member?.email ?? null,
          textResponses: r.textResponses ?? r.answers?.filter(a => a.text) ?? [],
        })) as Verbatim[],
        hasMore: data.hasMore ?? data.pagination?.hasMore ?? responses.length === 20,
        total: data.total ?? data.pagination?.total ?? null,
      }
    },
  })
}

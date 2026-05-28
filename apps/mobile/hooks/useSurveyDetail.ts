import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-expo'
import { API_URL, queryEnabled, apiHeaders } from '../lib/api'

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
    enabled: !!surveyId && queryEnabled(isSignedIn ?? false),
    queryFn: async () => {
      const headers = await apiHeaders(getToken)
      const params = new URLSearchParams({ pageSize: '20', page: String(page) })
      if (filters.sentiment) params.set('sentiment', filters.sentiment)
      if (filters.scoreBand) params.set('scoreBand', filters.scoreBand)
      const res = await fetch(`${API_URL}/v1/surveys/${surveyId}/responses?${params}`, { headers })
      if (!res.ok) throw new Error(`Survey responses fetch failed: ${res.status}`)
      const data = await res.json()
      // API returns { data: [...], total, page, pageSize, totalPages }
      const responses = (data.data ?? data.responses ?? []) as Array<{
        id: string; score: number | null; sentiment: number | string | null; completedAt: string | null
        member?: { firstName?: string; lastName?: string; email?: string; identifierValue?: string } | null
        textResponses?: Array<{ text: string }>
        answers?: Record<string, unknown> | Array<{ text?: string }>
      }>

      function sentimentLabel(s: number | string | null): string | null {
        if (s === null || s === undefined) return null
        if (typeof s === 'string') return s
        if (s > 0.1) return 'positive'
        if (s < -0.1) return 'negative'
        return 'neutral'
      }

      function extractTextResponses(answers: Record<string, unknown> | Array<{ text?: string }> | undefined): Array<{ text: string }> {
        if (!answers) return []
        if (Array.isArray(answers)) return answers.filter((a): a is { text: string } => typeof a.text === 'string' && a.text.trim() !== '')
        return Object.values(answers).filter((v): v is string => typeof v === 'string' && v.trim() !== '').map(text => ({ text }))
      }

      return {
        items: responses.map((r) => ({
          id: r.id,
          score: r.score,
          sentiment: sentimentLabel(r.sentiment),
          completedAt: r.completedAt,
          memberName: r.member ? [r.member.firstName, r.member.lastName].filter(Boolean).join(' ') || null : null,
          memberEmail: r.member?.email ?? r.member?.identifierValue ?? null,
          textResponses: r.textResponses ?? extractTextResponses(r.answers),
        })) as Verbatim[],
        hasMore: data.hasMore ?? data.pagination?.hasMore ?? (data.page != null && data.totalPages != null ? data.page < data.totalPages : responses.length === 20),
        total: data.total ?? data.pagination?.total ?? null,
      }
    },
  })
}

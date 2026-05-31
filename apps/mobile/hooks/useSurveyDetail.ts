import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-expo'
import { API_URL, queryEnabled, apiHeaders } from '../lib/api'

export interface Verbatim {
  id: string; score: number | null; sentiment: string | null; completedAt: string | null
  memberName: string | null; memberEmail: string | null
  textResponses: Array<{ text: string }>
  summary: string | null; channel: string | null
}

export interface ResponseFilters {
  sentiment?: 'positive' | 'neutral' | 'negative'
  scoreBand?: 'promoter' | 'passive' | 'detractor'
}

export function sentimentLabel(s: number | string | null): string | null {
  if (s === null || s === undefined) return null
  if (typeof s === 'string') return s
  if (s > 0.1) return 'positive'
  if (s < -0.1) return 'negative'
  return 'neutral'
}

export function extractTextResponses(answers: Record<string, unknown> | Array<{ text?: string }> | undefined): Array<{ text: string }> {
  if (!answers) return []
  if (Array.isArray(answers)) return answers.filter((a): a is { text: string } => typeof a.text === 'string' && a.text.trim() !== '')
  return Object.values(answers).filter((v): v is string => typeof v === 'string' && v.trim() !== '').map(text => ({ text }))
}

export function mapResponseRow(r: {
  id: string; score: number | null; sentiment: number | string | null; completedAt: string | null
  member?: {
    firstName?: string | null
    lastName?: string | null
    email?: string | null
    identifierValue?: string | null
  } | null
  textResponses?: Array<{ text: string }>
  answers?: Record<string, unknown> | Array<{ text?: string }>
  summary?: string | null; channel?: string | null
}): Verbatim {
  return {
    id: r.id,
    score: r.score,
    sentiment: sentimentLabel(r.sentiment),
    completedAt: r.completedAt,
    memberName: r.member ? [r.member.firstName, r.member.lastName].filter(Boolean).join(' ') || null : null,
    memberEmail: r.member?.email ?? r.member?.identifierValue ?? null,
    textResponses: r.textResponses ?? extractTextResponses(r.answers),
    summary: (r.summary as string | null | undefined) ?? null,
    channel: (r.channel as string | null | undefined) ?? null,
  }
}

export function deriveHasMore(data: { hasMore?: boolean; pagination?: { hasMore?: boolean }; page?: number; totalPages?: number }, responseCount: number): boolean {
  return data.hasMore ?? data.pagination?.hasMore ?? (data.page != null && data.totalPages != null ? data.page < data.totalPages : responseCount === 20)
}

export function useSurveyDetail(surveyId: string | null, page = 1, filters: ResponseFilters = {}) {
  const { getToken, isSignedIn } = useAuth()
  return useQuery({
    queryKey: ['survey-detail', surveyId, page, filters],
    enabled: !!surveyId && queryEnabled(isSignedIn ?? false),
    queryFn: async () => {
      const headers = await apiHeaders(getToken)
      const params = new URLSearchParams({ pageSize: '20', page: String(page) })
      if (filters.sentiment) params.set('sentimentBands', filters.sentiment)
      if (filters.scoreBand) params.set('scoreBands', filters.scoreBand)
      const res = await fetch(`${API_URL}/v1/surveys/${surveyId}/responses?${params}`, { headers })
      if (!res.ok) throw new Error(`Survey responses fetch failed: ${res.status}`)
      const data = await res.json()
      // API returns { data: [...], total, page, pageSize, totalPages }
      const responses = (data.data ?? data.responses ?? []) as Parameters<typeof mapResponseRow>[0][]
      return {
        items: responses.map(mapResponseRow) as Verbatim[],
        hasMore: deriveHasMore(data, responses.length),
        total: data.total ?? data.pagination?.total ?? null,
      }
    },
  })
}

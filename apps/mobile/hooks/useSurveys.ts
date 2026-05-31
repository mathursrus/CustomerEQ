import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-expo'
import { API_URL, queryEnabled, apiHeaders } from '../lib/api'

export interface Survey {
  id: string; name: string; title: string | null; type: string; status: string
  responseCount: number; score: number | null; createdAt: string | null
}

export function toSurvey(raw: Record<string, unknown>): Survey {
  return {
    id: raw.id as string,
    name: (raw.name as string) ?? '',
    title: (raw.title as string | null) ?? null,
    type: raw.type as string,
    status: raw.status as string,
    responseCount: (raw.responsesCount ?? raw.responseCount ?? 0) as number,
    score: (raw.score ?? null) as number | null,
    createdAt: (raw.createdAt ?? null) as string | null,
  }
}

export interface SurveyQuestion {
  id: string
  text: string
  type: 'rating' | 'text' | 'choice' | 'multiple_choice' | 'checkbox' | 'dropdown' | 'matrix' | 'ranking' | 'slider' | 'likert' | 'image_choice' | 'file_upload'
  required: boolean
  config: Record<string, unknown>
  isScoreField?: boolean
}

export interface CreateSurveyInput {
  name: string
  title: string
  description?: string
  type: string
  programId?: string
  responsePolicy: 'ONCE' | 'MULTIPLE' | 'LATEST_OVERWRITES'
  questions: SurveyQuestion[]
}

export function useSurveys() {
  const { getToken, isSignedIn } = useAuth()
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['surveys'],
    enabled: queryEnabled(isSignedIn ?? false),
    queryFn: async () => {
      const headers = await apiHeaders(getToken)
      const res = await fetch(`${API_URL}/v1/surveys`, { headers })
      if (!res.ok) throw new Error(`Surveys fetch failed: ${res.status}`)
      const data = await res.json()
      const raw: Record<string, unknown>[] = data.surveys ?? data.data ?? data
      return raw.map(toSurvey)
    },
  })

  const create = useMutation({
    mutationFn: async (input: CreateSurveyInput) => {
      if (!input.programId) throw new Error('Create a loyalty program before creating a survey.')
      const headers = await apiHeaders(getToken)
      const res = await fetch(`${API_URL}/v1/surveys`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error ?? 'Failed to create survey')
      }
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['surveys'] }),
  })

  return { ...query, data: query.data ?? [], createSurvey: create }
}

export function usePrograms() {
  const { getToken, isSignedIn } = useAuth()
  return useQuery({
    queryKey: ['programs'],
    enabled: queryEnabled(isSignedIn ?? false),
    queryFn: async () => {
      const headers = await apiHeaders(getToken)
      const res = await fetch(`${API_URL}/v1/programs`, { headers })
      if (!res.ok) return []
      const data = await res.json()
      return (data.programs ?? data.data ?? []) as Array<{ id: string; name: string }>
    },
  })
}

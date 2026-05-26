import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-expo'
import { API_URL, DEV_BYPASS, DEV_TOKEN } from '../lib/api'

export interface Survey {
  id: string; name: string; title: string | null; type: string; status: string
  responseCount: number; score: number | null
}

export interface SurveyQuestion {
  id: string; text: string; type: 'rating' | 'text' | 'multiple_choice'; required: boolean
  config: Record<string, unknown>
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
    enabled: DEV_BYPASS || isSignedIn === true,
    queryFn: async () => {
      const token = DEV_BYPASS ? DEV_TOKEN : await getToken()
      const res = await fetch(`${API_URL}/v1/surveys`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error('Failed to fetch surveys')
      const data = await res.json()
      return (data.surveys ?? data.data ?? data) as Survey[]
    },
  })

  const create = useMutation({
    mutationFn: async (input: CreateSurveyInput) => {
      const token = DEV_BYPASS ? DEV_TOKEN : await getToken()
      const res = await fetch(`${API_URL}/v1/surveys`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
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
    enabled: DEV_BYPASS || isSignedIn === true,
    queryFn: async () => {
      const token = DEV_BYPASS ? DEV_TOKEN : await getToken()
      const res = await fetch(`${API_URL}/v1/programs`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) return []
      const data = await res.json()
      return (data.programs ?? data.data ?? []) as Array<{ id: string; name: string }>
    },
  })
}

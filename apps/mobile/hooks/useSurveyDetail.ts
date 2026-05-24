import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-expo'
import { API_URL } from '../lib/api'

interface Verbatim { id: string; score: number | null; sentiment: string | null; completedAt: string | null; textResponses: Array<{ text: string }> }

export function useSurveyDetail(surveyId: string | null) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['survey-detail', surveyId],
    enabled: !!surveyId,
    queryFn: async () => {
      const token = await getToken()
      const res = await fetch(`${API_URL}/v1/surveys/${surveyId}/responses?pageSize=5`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to fetch survey responses')
      const data = await res.json()
      return (data.responses ?? []) as Verbatim[]
    },
  })
}

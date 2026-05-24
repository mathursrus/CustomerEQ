import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-expo'
import { API_URL } from '../lib/api'

interface Survey {
  id: string; name: string; type: string; status: string
  responseCount: number; score: number | null
}

export function useSurveys() {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['surveys'],
    queryFn: async () => {
      const token = await getToken()
      const res = await fetch(`${API_URL}/v1/surveys`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error('Failed to fetch surveys')
      const data = await res.json()
      return (data.surveys ?? data) as Survey[]
    },
  })
}

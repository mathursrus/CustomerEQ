import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-expo'

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000'

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

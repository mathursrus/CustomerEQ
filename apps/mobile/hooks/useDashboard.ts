import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-expo'

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000'

export function useDashboard() {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const token = await getToken()
      const res = await fetch(`${API_URL}/v1/mobile/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to fetch dashboard')
      return res.json() as Promise<{
        nps: { currentScore: number | null; delta: number | null; weeklyTrend: Array<{ weekStart: string; nps: number | null; count: number }> }
        responseRate: number
        totalResponses: number
        activeAnomaly: { id: string; clusterId: string | null; clusterLabel: string | null; summary: string; severity: string; detectedAt: string } | null
      }>
    },
  })
}

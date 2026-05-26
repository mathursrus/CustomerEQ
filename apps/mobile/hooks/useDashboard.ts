import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-expo'
import { API_URL, DEV_BYPASS, DEV_TOKEN } from '../lib/api'

export function useDashboard() {
  const { getToken, isSignedIn } = useAuth()
  return useQuery({
    queryKey: ['dashboard'],
    enabled: DEV_BYPASS || isSignedIn === true,
    queryFn: async () => {
      const token = DEV_BYPASS ? DEV_TOKEN : await getToken()
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

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-expo'
import { API_URL, queryEnabled, apiHeaders } from '../lib/api'

export function useDashboard() {
  const { getToken, isSignedIn } = useAuth()
  return useQuery({
    queryKey: ['dashboard'],
    enabled: queryEnabled(isSignedIn ?? false),
    queryFn: async () => {
      const headers = await apiHeaders(getToken)
      const res = await fetch(`${API_URL}/v1/mobile/dashboard`, { headers })
      if (!res.ok) throw new Error(`Dashboard fetch failed: ${res.status}`)
      return res.json() as Promise<{
        nps: { currentScore: number | null; delta: number | null; weeklyTrend: Array<{ weekStart: string; nps: number | null; count: number }> }
        responseRate: number
        totalResponses: number
        activeAnomaly: { id: string; clusterId: string | null; clusterLabel: string | null; summary: string; severity: string; detectedAt: string } | null
      }>
    },
  })
}

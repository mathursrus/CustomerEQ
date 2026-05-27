import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-expo'
import { API_URL, queryEnabled, apiHeaders } from '../lib/api'

interface Cluster { id: string; label: string; description: string | null; responseCount: number; trend: number }
interface Anomaly { id: string; clusterId: string | null; clusterLabel: string | null; summary: string; severity: string; detectedAt: string }

export function useClusters() {
  const { getToken, isSignedIn } = useAuth()
  const enabled = queryEnabled(isSignedIn ?? false)

  const clusters = useQuery({
    queryKey: ['clusters'],
    enabled,
    queryFn: async () => {
      const headers = await apiHeaders(getToken)
      const res = await fetch(`${API_URL}/v1/analytics/cx/clusters`, { headers })
      if (!res.ok) throw new Error(`Clusters fetch failed: ${res.status}`)
      const data = await res.json()
      return (data.clusters ?? []) as Cluster[]
    },
  })

  const anomalies = useQuery({
    queryKey: ['anomalies'],
    enabled,
    queryFn: async () => {
      const headers = await apiHeaders(getToken)
      const res = await fetch(`${API_URL}/v1/analytics/cx/anomalies`, { headers })
      if (!res.ok) throw new Error(`Anomalies fetch failed: ${res.status}`)
      const data = await res.json()
      return (data.anomalies ?? []) as Anomaly[]
    },
  })

  return {
    clusters: clusters.data ?? [],
    anomaly: anomalies.data?.[0] ?? null,
    isLoading: clusters.isLoading || anomalies.isLoading,
    isError: clusters.isError || anomalies.isError,
    error: clusters.error ?? anomalies.error,
  }
}

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-expo'
import { API_URL, DEV_BYPASS, DEV_TOKEN } from '../lib/api'

interface Cluster { id: string; label: string; description: string | null; responseCount: number; trend: number }
interface Anomaly { id: string; clusterId: string | null; clusterLabel: string | null; summary: string; severity: string; detectedAt: string }

export function useClusters() {
  const { getToken } = useAuth()
  const clusters = useQuery({
    queryKey: ['clusters'],
    queryFn: async () => {
      const token = DEV_BYPASS ? DEV_TOKEN : await getToken()
      const res = await fetch(`${API_URL}/v1/analytics/cx/clusters`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error('Failed to fetch clusters')
      const data = await res.json()
      return (data.clusters ?? []) as Cluster[]
    },
  })
  const anomalies = useQuery({
    queryKey: ['anomalies'],
    queryFn: async () => {
      const token = DEV_BYPASS ? DEV_TOKEN : await getToken()
      const res = await fetch(`${API_URL}/v1/analytics/cx/anomalies`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error('Failed to fetch anomalies')
      const data = await res.json()
      return (data.anomalies ?? []) as Anomaly[]
    },
  })
  return {
    clusters: clusters.data ?? [],
    anomaly: anomalies.data?.[0] ?? null,
    isLoading: clusters.isLoading || anomalies.isLoading,
  }
}

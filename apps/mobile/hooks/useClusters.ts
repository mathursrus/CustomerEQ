import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-expo'
import { API_URL, queryEnabled, apiHeaders } from '../lib/api'

export interface Cluster {
  id: string
  label: string
  description: string | null
  responseCount: number
  trend: number
  avgSentiment: number | null
  trending: string | null
  keywords: string[]
}

export interface Anomaly {
  id: string
  clusterId: string | null
  clusterLabel: string | null
  summary: string
  severity: string
  detectedAt: string
}

export function arrayFromEnvelope<T>(payload: unknown, key: string): T[] {
  if (Array.isArray(payload)) return payload as T[]
  if (payload && typeof payload === 'object' && Array.isArray((payload as Record<string, unknown>)[key])) {
    return (payload as Record<string, unknown>)[key] as T[]
  }
  return []
}

function toNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function mapCluster(raw: Record<string, unknown>): Cluster {
  return {
    id: String(raw.id ?? ''),
    label: String(raw.label ?? 'Untitled cluster'),
    description: typeof raw.description === 'string' ? raw.description : null,
    responseCount: toNumber(raw.responseCount),
    trend: toNumber(raw.trend ?? raw.changePercent),
    avgSentiment: typeof raw.avgSentiment === 'number' ? raw.avgSentiment : null,
    trending: typeof raw.trending === 'string' ? raw.trending : null,
    keywords: Array.isArray(raw.keywords) ? raw.keywords.filter((k): k is string => typeof k === 'string') : [],
  }
}

export function mapAnomaly(raw: Record<string, unknown>): Anomaly {
  return {
    id: String(raw.id ?? ''),
    clusterId: typeof raw.clusterId === 'string' ? raw.clusterId : null,
    clusterLabel: typeof raw.clusterLabel === 'string' ? raw.clusterLabel : null,
    summary: String(raw.summary ?? 'An unusual feedback pattern was detected.'),
    severity: String(raw.severity ?? 'MEDIUM'),
    detectedAt: String(raw.detectedAt ?? new Date().toISOString()),
  }
}

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
      return arrayFromEnvelope<Record<string, unknown>>(data, 'clusters').map(mapCluster)
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
      return arrayFromEnvelope<Record<string, unknown>>(data, 'anomalies').map(mapAnomaly)
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

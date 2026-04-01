// Anomaly detection: identify unusual patterns in feedback trends

import { getAiClient } from '../client.js'
import type { ClusterTrend, AnomalyReport } from '../types.js'

export async function detectAnomalies(
  clusterTrends: ClusterTrend[],
  totalResponsesLast30d: number,
  totalResponsesPrevious30d: number,
): Promise<AnomalyReport> {
  const client = getAiClient()
  return client.detectAnomalies(clusterTrends, totalResponsesLast30d, totalResponsesPrevious30d)
}

// Statistical anomaly helper: compute z-score for a value against a series
export function zScore(value: number, series: number[]): number {
  if (series.length === 0) return 0
  const mean = series.reduce((a, b) => a + b, 0) / series.length
  const variance = series.reduce((sum, v) => sum + (v - mean) ** 2, 0) / series.length
  const stdDev = Math.sqrt(variance)
  if (stdDev === 0) return 0
  return (value - mean) / stdDev
}

// Check if a daily volume is anomalous (|z| > threshold)
export function isVolumeAnomaly(dailyVolume: number, historicalVolumes: number[], threshold = 2.0): boolean {
  return Math.abs(zScore(dailyVolume, historicalVolumes)) > threshold
}

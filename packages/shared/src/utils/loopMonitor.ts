// Pure functions for Loop Monitor — no dependencies, fully unit-testable

export type LoopMonitorWarning = {
  type: 'no_campaigns_triggered_48h'
  message: string
}

const WARNING_THRESHOLD_MS = 48 * 60 * 60 * 1000 // 48 hours

/**
 * Compute the Loop Monitor 48-hour warning.
 * Returns a warning object when:
 *   - firstResponseAt is more than 48h ago
 *   - AND campaignsTriggered === 0
 * Returns null in all other cases (including when firstResponseAt is null/undefined).
 */
export function computeLoopMonitorWarning(
  firstResponseAt: Date | null | undefined,
  campaignsTriggered: number,
): LoopMonitorWarning | null {
  if (!firstResponseAt) return null
  if (campaignsTriggered > 0) return null
  const elapsed = Date.now() - firstResponseAt.getTime()
  if (elapsed < WARNING_THRESHOLD_MS) return null
  return {
    type: 'no_campaigns_triggered_48h',
    message:
      'No campaigns have been triggered in 48+ hours since the first response arrived. Review your rules to ensure they match the expected score ranges.',
  }
}

export type LatencyPercentiles = {
  p50Ms: number | null
  p95Ms: number | null
  sampleSize: number
  slaStatus: 'ok' | 'warning' | 'breach'
}

// SLA thresholds (in milliseconds): green < 15min, amber 15–30min, red > 30min
const SLA_OK_MS = 15 * 60 * 1000    // 900 000ms
const SLA_WARN_MS = 30 * 60 * 1000  // 1 800 000ms

/**
 * Compute P50 and P95 latency from a sorted or unsorted array of latency values (ms).
 * Returns null percentiles when sampleSize < 10.
 */
export function computeLatencyPercentiles(latencyMsValues: number[]): LatencyPercentiles {
  const sampleSize = latencyMsValues.length
  if (sampleSize < 10) {
    return { p50Ms: null, p95Ms: null, sampleSize, slaStatus: 'ok' }
  }

  const sorted = [...latencyMsValues].sort((a, b) => a - b)
  const p50Ms = percentileCont(sorted, 0.5)
  const p95Ms = percentileCont(sorted, 0.95)

  let slaStatus: 'ok' | 'warning' | 'breach' = 'ok'
  if (p95Ms > SLA_WARN_MS) slaStatus = 'breach'
  else if (p95Ms > SLA_OK_MS) slaStatus = 'warning'

  return { p50Ms, p95Ms, sampleSize, slaStatus }
}

/** Linear interpolation percentile (mirrors PostgreSQL PERCENTILE_CONT behaviour). */
function percentileCont(sorted: number[], p: number): number {
  if (sorted.length === 1) return sorted[0]
  const virtualIndex = p * (sorted.length - 1)
  const lower = Math.floor(virtualIndex)
  const upper = Math.ceil(virtualIndex)
  if (lower === upper) return sorted[lower]
  const fraction = virtualIndex - lower
  return sorted[lower] + fraction * (sorted[upper] - sorted[lower])
}

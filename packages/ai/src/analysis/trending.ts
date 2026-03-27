// Trend computation: determine if a cluster is trending up, down, or stable

export type TrendDirection = 'up' | 'down' | 'stable'

export interface TrendResult {
  direction: TrendDirection
  changePercent: number // percentage change vs previous period
}

export function computeTrend(
  recentVolumes: number[],
  previousVolumes: number[],
): TrendResult {
  const recentTotal = recentVolumes.reduce((a, b) => a + b, 0)
  const previousTotal = previousVolumes.reduce((a, b) => a + b, 0)

  if (previousTotal === 0) {
    return {
      direction: recentTotal > 0 ? 'up' : 'stable',
      changePercent: recentTotal > 0 ? 100 : 0,
    }
  }

  const changePercent = Math.round(((recentTotal - previousTotal) / previousTotal) * 100)

  let direction: TrendDirection = 'stable'
  if (changePercent > 15) direction = 'up'
  else if (changePercent < -15) direction = 'down'

  return { direction, changePercent }
}

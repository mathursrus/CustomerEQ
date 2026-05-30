import { arrayFromEnvelope, mapAnomaly, mapCluster } from '../hooks/useClusters'

describe('cluster API mapping', () => {
  it('reads the production array response shape', () => {
    const rows = [{ id: 'c1', label: 'Slow checkout', responseCount: 12, changePercent: 25 }]
    expect(arrayFromEnvelope(rows, 'clusters')).toBe(rows)
  })

  it('also supports an envelope shape for backwards compatibility', () => {
    const rows = [{ id: 'c1' }]
    expect(arrayFromEnvelope({ clusters: rows }, 'clusters')).toBe(rows)
  })

  it('maps API changePercent into the mobile trend field', () => {
    expect(mapCluster({
      id: 'c1',
      label: 'Slow checkout',
      description: 'Customers mention friction at checkout.',
      responseCount: 12,
      avgSentiment: -0.25,
      trending: 'up',
      changePercent: 25,
      keywords: ['checkout', 'speed'],
    })).toEqual({
      id: 'c1',
      label: 'Slow checkout',
      description: 'Customers mention friction at checkout.',
      responseCount: 12,
      avgSentiment: -0.25,
      trending: 'up',
      trend: 25,
      keywords: ['checkout', 'speed'],
    })
  })

  it('maps anomalies from the production array response rows', () => {
    expect(mapAnomaly({
      id: 'a1',
      clusterLabel: 'Slow checkout',
      summary: 'Mentions spiked this week.',
      severity: 'HIGH',
      detectedAt: '2026-05-30T00:00:00.000Z',
    })).toEqual({
      id: 'a1',
      clusterId: null,
      clusterLabel: 'Slow checkout',
      summary: 'Mentions spiked this week.',
      severity: 'HIGH',
      detectedAt: '2026-05-30T00:00:00.000Z',
    })
  })
})

import { arrayFromEnvelope, mapAnomaly, mapAnalyticsPayload, mapCluster } from '../hooks/useClusters'

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

  it('maps the production aggregate CX analytics payload used by the web app', () => {
    expect(mapAnalyticsPayload({
      totalResponses: 9,
      clusters: [{ id: 'c1', label: 'Workflow organization', count: 2, avgSentiment: 0.82, changePercent: 0 }],
      anomalies: [{ id: 'a1', clusterLabel: 'Workflow organization', summary: 'Mentions changed.', severity: 'MEDIUM', detectedAt: '2026-05-30T00:00:00.000Z' }],
    })).toEqual({
      clusters: [{
        id: 'c1',
        label: 'Workflow organization',
        description: null,
        responseCount: 2,
        avgSentiment: 0.82,
        trending: null,
        trend: 0,
        keywords: [],
      }],
      anomalies: [{
        id: 'a1',
        clusterId: null,
        clusterLabel: 'Workflow organization',
        summary: 'Mentions changed.',
        severity: 'MEDIUM',
        detectedAt: '2026-05-30T00:00:00.000Z',
      }],
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

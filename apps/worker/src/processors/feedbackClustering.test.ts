/// <reference types="vitest" />
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { MockPrisma } from '@customerEQ/config/test-utils'

// ---------------------------------------------------------------------------
// Module mocks — use shared factories from test-utils (async import for hoisting)
// ---------------------------------------------------------------------------

vi.mock('@customerEQ/database', async () => {
  const { databaseMockFactory } = await import('@customerEQ/config/test-utils')
  return databaseMockFactory()
})

vi.mock('@customerEQ/ai', async () => {
  const { mockDiscoverClusters, mockDetectAnomalies } = await import('@customerEQ/config/test-utils')
  return { discoverClusters: mockDiscoverClusters, detectAnomalies: mockDetectAnomalies }
})

vi.mock('pino', async () => {
  const { pinoMockFactory } = await import('@customerEQ/config/test-utils')
  return pinoMockFactory()
})

// ---------------------------------------------------------------------------
// Import mocked instances after vi.mock
// ---------------------------------------------------------------------------

import { prisma } from '@customerEQ/database'
import { discoverClusters, detectAnomalies } from '@customerEQ/ai'
import { processFeedbackClustering } from './feedbackClustering.js'

const mockPrisma = prisma as unknown as MockPrisma
const mockDiscoverClusters = discoverClusters as ReturnType<typeof vi.fn>
const mockDetectAnomalies = detectAnomalies as ReturnType<typeof vi.fn>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      brandId: 'brand-001',
      ...overrides,
    },
  }
}

// ---------------------------------------------------------------------------
// Tests: processFeedbackClustering
// ---------------------------------------------------------------------------

describe('processFeedbackClustering', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default: no existing clusters, no unassigned responses, no anomalies
    mockPrisma.feedbackCluster.findMany.mockResolvedValue([])
    mockPrisma.surveyResponse.findMany.mockResolvedValue([])
    mockPrisma.surveyResponse.aggregate.mockResolvedValue({
      _count: { id: 0 },
      _avg: { sentiment: null },
    })
    mockPrisma.clusterSnapshot.findMany.mockResolvedValue([])
    mockDetectAnomalies.mockResolvedValue({ anomalies: [], overallSummary: 'No anomalies' })
  })

  it('returns zero counts when no unassigned responses exist', async () => {
    const result = await processFeedbackClustering(makeJob() as never)

    expect(result.newClustersCreated).toBe(0)
    expect(result.responsesAssigned).toBe(0)
    expect(result.snapshotsCreated).toBe(0)
    expect(result.anomaliesDetected).toBe(0)
  })

  it('does not call discoverClusters when no unassigned responses exist', async () => {
    await processFeedbackClustering(makeJob() as never)

    expect(mockDiscoverClusters).not.toHaveBeenCalled()
  })

  it('calls discoverClusters with correct arguments when unassigned responses exist', async () => {
    // First findMany call: existing clusters (empty)
    mockPrisma.feedbackCluster.findMany
      .mockResolvedValueOnce([]) // existing active clusters
    // Second findMany call used after discovery: allClusters
    mockPrisma.feedbackCluster.findMany
      .mockResolvedValueOnce([]) // allClusters after discovery

    mockPrisma.surveyResponse.findMany.mockResolvedValueOnce([
      { id: 'resp-1', answers: { q1: 'Great product' }, sentiment: 0.8 },
      { id: 'resp-2', answers: { q1: 'Terrible service' }, sentiment: -0.5 },
    ])

    mockDiscoverClusters.mockResolvedValue({
      newClusters: [],
      assignments: [],
      mergeRecommendations: [],
    })

    await processFeedbackClustering(makeJob() as never)

    expect(mockDiscoverClusters).toHaveBeenCalledTimes(1)
    expect(mockDiscoverClusters).toHaveBeenCalledWith(
      [
        { id: 'resp-1', text: 'Great product', sentiment: 0.8 },
        { id: 'resp-2', text: 'Terrible service', sentiment: -0.5 },
      ],
      [], // no existing clusters
    )
  })

  it('creates new cluster records from AI response', async () => {
    mockPrisma.feedbackCluster.findMany
      .mockResolvedValueOnce([]) // existing active clusters
      .mockResolvedValueOnce([]) // allClusters after discovery

    mockPrisma.surveyResponse.findMany.mockResolvedValueOnce([
      { id: 'resp-1', answers: { q1: 'Shipping was slow' }, sentiment: -0.3 },
    ])

    mockDiscoverClusters.mockResolvedValue({
      newClusters: [
        { label: 'Shipping Issues', description: 'Problems with delivery', keywords: ['shipping', 'delivery'] },
        { label: 'Product Quality', description: 'Issues with product quality', keywords: ['quality', 'broken'] },
      ],
      assignments: [],
      mergeRecommendations: [],
    })

    mockPrisma.feedbackCluster.create
      .mockResolvedValueOnce({ id: 'cluster-new-1', label: 'Shipping Issues' })
      .mockResolvedValueOnce({ id: 'cluster-new-2', label: 'Product Quality' })

    const result = await processFeedbackClustering(makeJob() as never)

    expect(mockPrisma.feedbackCluster.create).toHaveBeenCalledTimes(2)
    expect(mockPrisma.feedbackCluster.create).toHaveBeenCalledWith({
      data: {
        brandId: 'brand-001',
        label: 'Shipping Issues',
        description: 'Problems with delivery',
        keywords: ['shipping', 'delivery'],
        responseCount: 0,
      },
    })
    expect(result.newClustersCreated).toBe(2)
  })

  it('assigns feedback to clusters', async () => {
    mockPrisma.feedbackCluster.findMany
      .mockResolvedValueOnce([
        { id: 'cluster-1', label: 'Shipping', description: 'Shipping issues', keywords: ['shipping'] },
      ])
      .mockResolvedValueOnce([
        { id: 'cluster-1', label: 'Shipping', description: 'Shipping issues' },
      ])

    mockPrisma.surveyResponse.findMany.mockResolvedValueOnce([
      { id: 'resp-1', answers: { q1: 'Slow shipping' }, sentiment: -0.4 },
    ])

    mockDiscoverClusters.mockResolvedValue({
      newClusters: [],
      assignments: [
        { feedbackId: 'resp-1', clusterLabel: 'Shipping' },
      ],
      mergeRecommendations: [],
    })

    mockPrisma.surveyResponse.update.mockResolvedValue({})

    const result = await processFeedbackClustering(makeJob() as never)

    expect(mockPrisma.surveyResponse.update).toHaveBeenCalledWith({
      where: { id: 'resp-1' },
      data: { clusterId: 'cluster-1' },
    })
    expect(result.responsesAssigned).toBe(1)
  })

  it('creates daily snapshots for each active cluster', async () => {
    // No unassigned responses, but existing clusters
    mockPrisma.feedbackCluster.findMany
      .mockResolvedValueOnce([
        { id: 'cluster-1', label: 'Shipping', description: 'Shipping issues', keywords: ['shipping'] },
      ])
      .mockResolvedValueOnce([
        { id: 'cluster-1', label: 'Shipping', description: 'Shipping issues' },
      ])

    mockPrisma.surveyResponse.findMany.mockResolvedValueOnce([]) // no unassigned

    mockPrisma.surveyResponse.aggregate.mockResolvedValue({
      _count: { id: 5 },
      _avg: { sentiment: 0.3 },
    })

    mockPrisma.clusterSnapshot.upsert.mockResolvedValue({})
    mockPrisma.clusterSnapshot.findMany.mockResolvedValue([])

    const result = await processFeedbackClustering(makeJob() as never)

    expect(mockPrisma.clusterSnapshot.upsert).toHaveBeenCalledTimes(1)
    expect(mockPrisma.clusterSnapshot.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          clusterId: 'cluster-1',
          brandId: 'brand-001',
        }),
      }),
    )
    expect(result.snapshotsCreated).toBe(1)
  })

  it('calls detectAnomalies and creates anomaly records', async () => {
    mockPrisma.feedbackCluster.findMany
      .mockResolvedValueOnce([
        { id: 'cluster-1', label: 'Shipping', description: 'Shipping issues', keywords: ['shipping'] },
      ])
      .mockResolvedValueOnce([
        { id: 'cluster-1', label: 'Shipping', description: 'Shipping issues' },
      ])

    mockPrisma.surveyResponse.findMany.mockResolvedValueOnce([]) // no unassigned

    mockPrisma.surveyResponse.aggregate.mockResolvedValue({
      _count: { id: 10 },
      _avg: { sentiment: -0.2 },
    })

    mockPrisma.clusterSnapshot.upsert.mockResolvedValue({})
    mockPrisma.clusterSnapshot.findMany.mockResolvedValue([
      { bucketDate: new Date(), volume: 10, avgSentiment: -0.2 },
    ])

    mockDetectAnomalies.mockResolvedValue({
      anomalies: [
        {
          clusterLabel: 'Shipping',
          type: 'volume_spike',
          severity: 'high',
          summary: 'Shipping complaints increased 200%',
        },
      ],
      overallSummary: 'Shipping volume spike detected',
    })

    mockPrisma.feedbackAnomaly.create.mockResolvedValue({})

    const result = await processFeedbackClustering(makeJob() as never)

    expect(mockDetectAnomalies).toHaveBeenCalledTimes(1)
    expect(mockPrisma.feedbackAnomaly.create).toHaveBeenCalledTimes(1)
    expect(mockPrisma.feedbackAnomaly.create).toHaveBeenCalledWith({
      data: {
        brandId: 'brand-001',
        clusterId: 'cluster-1',
        type: 'volume_spike',
        severity: 'high',
        summary: 'Shipping complaints increased 200%',
        metadata: { overallSummary: 'Shipping volume spike detected' },
      },
    })
    expect(result.anomaliesDetected).toBe(1)
  })
})

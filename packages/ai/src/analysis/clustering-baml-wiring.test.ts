/// <reference types="vitest" />

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../generated/baml_client/index.js', async () => {
  const { bamlClientMockFactory } = await import('@customerEQ/config/test-utils')
  return bamlClientMockFactory()
})

import { discoverClusters } from './clustering.js'

async function getDiscoverClustersMock() {
  const { mockBamlDiscoverClusters } = await import('@customerEQ/config/test-utils')
  return vi.mocked(mockBamlDiscoverClusters)
}

describe('discoverClusters -> BAML wiring', () => {
  const originalProvider = process.env.AI_PROVIDER

  beforeEach(async () => {
    delete process.env.AI_PROVIDER
    const { clearBamlMocks } = await import('@customerEQ/config/test-utils')
    clearBamlMocks()
  })

  afterEach(() => {
    if (originalProvider === undefined) delete process.env.AI_PROVIDER
    else process.env.AI_PROVIDER = originalProvider
  })

  it('calls b.DiscoverClusters in the default path', async () => {
    const mockedDiscoverClusters = await getDiscoverClustersMock()
    mockedDiscoverClusters.mockResolvedValue({
      new_clusters: [
        {
          label: 'Checkout Issues',
          description: 'Problems during checkout',
          keywords: ['checkout', 'coupon', 'payment'],
        },
      ],
      assignments: [
        { feedback_id: 'resp-1', cluster_label: 'Checkout Issues' },
      ],
      merge_recommendations: [],
    })

    const result = await discoverClusters(
      [
        { id: 'resp-1', text: 'Checkout was confusing and the coupon failed', sentiment: -0.7 },
      ],
      [],
    )

    expect(mockedDiscoverClusters).toHaveBeenCalledOnce()
    expect(result).toEqual({
      newClusters: [
        {
          label: 'Checkout Issues',
          description: 'Problems during checkout',
          keywords: ['checkout', 'coupon', 'payment'],
        },
      ],
      assignments: [
        { feedbackId: 'resp-1', clusterLabel: 'Checkout Issues' },
      ],
      mergeRecommendations: [],
    })
  })

  it('passes existing cluster context through to BAML unchanged', async () => {
    const mockedDiscoverClusters = await getDiscoverClustersMock()
    mockedDiscoverClusters.mockResolvedValue({
      new_clusters: [],
      assignments: [],
      merge_recommendations: [],
    })

    await discoverClusters(
      [
        { id: 'resp-1', text: 'Support solved billing quickly', sentiment: 0.8 },
      ],
      [
        {
          id: 'cluster-1',
          label: 'Billing Support',
          description: 'Billing and support issues',
          keywords: ['billing', 'support'],
        },
      ],
    )

    expect(mockedDiscoverClusters).toHaveBeenCalledWith(
      [
        { id: 'resp-1', text: 'Support solved billing quickly', sentiment: 0.8 },
      ],
      [
        {
          label: 'Billing Support',
          description: 'Billing and support issues',
          keywords: ['billing', 'support'],
        },
      ],
    )
  })

  it('does not call b.DiscoverClusters when AI_PROVIDER=mock', async () => {
    const mockedDiscoverClusters = await getDiscoverClustersMock()
    process.env.AI_PROVIDER = 'mock'

    const result = await discoverClusters(
      [{ id: 'resp-1', text: 'A response', sentiment: 0.2 }],
      [],
    )

    expect(mockedDiscoverClusters).not.toHaveBeenCalled()
    expect(Array.isArray(result.newClusters)).toBe(true)
    expect(Array.isArray(result.assignments)).toBe(true)
    expect(Array.isArray(result.mergeRecommendations)).toBe(true)
  })
})

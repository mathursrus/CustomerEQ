/// <reference types="vitest" />
import { describe, it, expect, beforeEach } from 'vitest'
import {
  seedTestDb,
  createBrand,
  createProgram,
  createConsentedMember,
  createSurvey,
  createSurveyResponse,
  authenticatedRequest,
  InMemoryQueue,
  getTestPrisma,
} from '@customerEQ/config/test-utils'

describe('Analytics CX — NPS, sentiment, clusters, anomalies', () => {
  beforeEach(async () => {
    await seedTestDb()
    InMemoryQueue.clear()
  })

  // Helper: wide date range that covers all test data
  function dateRangeParams() {
    return {
      startDate: '2020-01-01T00:00:00.000Z',
      endDate: '2030-12-31T23:59:59.000Z',
    }
  }

  // ---------------------------------------------------------------------------
  // 1. Empty state
  // ---------------------------------------------------------------------------

  it('returns zeroed-out CX metrics when there are no survey responses', async () => {
    const brand = await createBrand()
    const request = authenticatedRequest(brand.id)

    const res = await request.get('/v1/analytics/cx').query(dateRangeParams())

    expect(res.status).toBe(200)
    expect(res.body.totalResponses).toBe(0)
    expect(res.body.nps.score).toBeNull()
    expect(res.body.sentiment.average).toBeNull()
    expect(res.body.clusters).toEqual([])
    expect(res.body.anomalies).toEqual([])
  })

  // ---------------------------------------------------------------------------
  // 2. Missing date params returns 422
  // ---------------------------------------------------------------------------

  it('returns 422 when startDate/endDate are missing', async () => {
    const brand = await createBrand()
    const request = authenticatedRequest(brand.id)

    const res = await request.get('/v1/analytics/cx')

    expect(res.status).toBe(422)
    expect(res.body.error).toMatch(/validation/i)
  })

  // ---------------------------------------------------------------------------
  // 3. NPS calculation
  // ---------------------------------------------------------------------------

  it('calculates NPS score correctly from promoter, passive, and detractor responses', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    const survey = await createSurvey({
      brandId: brand.id,
      programId: program.id,
      status: 'ACTIVE',
      type: 'NPS',
    })
    const request = authenticatedRequest(brand.id)

    // Promoter (score 9)
    const m1 = await createConsentedMember({ brandId: brand.id })
    await createSurveyResponse({
      surveyId: survey.id,
      memberId: m1.id,
      brandId: brand.id,
      score: 9,
    })

    // Passive (score 7)
    const m2 = await createConsentedMember({ brandId: brand.id })
    await createSurveyResponse({
      surveyId: survey.id,
      memberId: m2.id,
      brandId: brand.id,
      score: 7,
    })

    // Detractor (score 3)
    const m3 = await createConsentedMember({ brandId: brand.id })
    await createSurveyResponse({
      surveyId: survey.id,
      memberId: m3.id,
      brandId: brand.id,
      score: 3,
    })

    const res = await request.get('/v1/analytics/cx').query(dateRangeParams())

    expect(res.status).toBe(200)
    expect(res.body.nps.promoters).toBe(1)
    expect(res.body.nps.passives).toBe(1)
    expect(res.body.nps.detractors).toBe(1)
    // NPS = ((1 - 1) / 3) * 100 = 0
    expect(res.body.nps.score).toBe(0)
    expect(res.body.nps.responses).toBe(3)
  })

  // ---------------------------------------------------------------------------
  // 4. Sentiment distribution
  // ---------------------------------------------------------------------------

  it('returns correct sentiment distribution: positive, neutral, negative', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    const survey = await createSurvey({
      brandId: brand.id,
      programId: program.id,
      status: 'ACTIVE',
      type: 'NPS',
    })
    const request = authenticatedRequest(brand.id)

    // Positive sentiment (> 0.3)
    const m1 = await createConsentedMember({ brandId: brand.id })
    await createSurveyResponse({
      surveyId: survey.id,
      memberId: m1.id,
      brandId: brand.id,
      sentiment: 0.5,
      score: 9,
    })

    // Neutral sentiment (-0.3 to 0.3)
    const m2 = await createConsentedMember({ brandId: brand.id })
    await createSurveyResponse({
      surveyId: survey.id,
      memberId: m2.id,
      brandId: brand.id,
      sentiment: 0.0,
      score: 7,
    })

    // Negative sentiment (< -0.3)
    const m3 = await createConsentedMember({ brandId: brand.id })
    await createSurveyResponse({
      surveyId: survey.id,
      memberId: m3.id,
      brandId: brand.id,
      sentiment: -0.5,
      score: 3,
    })

    const res = await request.get('/v1/analytics/cx').query(dateRangeParams())

    expect(res.status).toBe(200)
    expect(res.body.sentiment.distribution.positive).toBe(1)
    expect(res.body.sentiment.distribution.neutral).toBe(1)
    expect(res.body.sentiment.distribution.negative).toBe(1)
    expect(res.body.sentiment.totalAnalyzed).toBe(3)
    // Average sentiment = (0.5 + 0.0 + -0.5) / 3 = 0
    expect(res.body.sentiment.average).toBeCloseTo(0, 1)
  })

  // ---------------------------------------------------------------------------
  // 5. Top topics
  // ---------------------------------------------------------------------------

  it('aggregates top topics from survey response topics arrays', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    const survey = await createSurvey({
      brandId: brand.id,
      programId: program.id,
      status: 'ACTIVE',
      type: 'CUSTOM',
    })
    const request = authenticatedRequest(brand.id)

    const m1 = await createConsentedMember({ brandId: brand.id })
    await createSurveyResponse({
      surveyId: survey.id,
      memberId: m1.id,
      brandId: brand.id,
      topics: ['shipping'],
      score: 5,
    })

    const m2 = await createConsentedMember({ brandId: brand.id })
    await createSurveyResponse({
      surveyId: survey.id,
      memberId: m2.id,
      brandId: brand.id,
      topics: ['shipping', 'support'],
      score: 4,
    })

    const m3 = await createConsentedMember({ brandId: brand.id })
    await createSurveyResponse({
      surveyId: survey.id,
      memberId: m3.id,
      brandId: brand.id,
      topics: ['pricing'],
      score: 6,
    })

    const res = await request.get('/v1/analytics/cx').query(dateRangeParams())

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.topTopics)).toBe(true)

    const topicsMap = new Map(
      res.body.topTopics.map((t: { topic: string; count: number }) => [t.topic, t.count]),
    )
    expect(topicsMap.get('shipping')).toBe(2)
    expect(topicsMap.get('support')).toBe(1)
    expect(topicsMap.get('pricing')).toBe(1)
  })

  // ---------------------------------------------------------------------------
  // 6. Clusters in response
  // ---------------------------------------------------------------------------

  it('returns active clusters with trend direction in CX analytics', async () => {
    const brand = await createBrand()
    const request = authenticatedRequest(brand.id)
    const prisma = getTestPrisma()

    // Create an active cluster
    const cluster = await prisma.feedbackCluster.create({
      data: {
        brandId: brand.id,
        label: 'Shipping Issues',
        description: 'Feedback related to shipping delays',
        keywords: ['shipping', 'delivery', 'late'],
        responseCount: 15,
        avgSentiment: -0.4,
        isActive: true,
      },
    })

    // Create snapshots: earlier period (lower volume) and recent period (higher volume)
    const midDate = new Date('2025-06-15T00:00:00Z')
    await prisma.clusterSnapshot.create({
      data: {
        clusterId: cluster.id,
        brandId: brand.id,
        bucketDate: new Date('2025-03-01T00:00:00Z'),
        volume: 5,
        avgSentiment: -0.3,
      },
    })
    await prisma.clusterSnapshot.create({
      data: {
        clusterId: cluster.id,
        brandId: brand.id,
        bucketDate: new Date('2025-09-01T00:00:00Z'),
        volume: 15,
        avgSentiment: -0.5,
      },
    })

    const res = await request.get('/v1/analytics/cx').query(dateRangeParams())

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.clusters)).toBe(true)
    expect(res.body.clusters.length).toBeGreaterThanOrEqual(1)

    const shippingCluster = res.body.clusters.find(
      (c: { label: string }) => c.label === 'Shipping Issues',
    )
    expect(shippingCluster).toBeDefined()
    expect(shippingCluster.responseCount).toBe(15)
    // Recent volume (15) >> previous volume (5) => trending up
    expect(shippingCluster.trending).toBe('up')
  })

  // ---------------------------------------------------------------------------
  // 7. Anomalies in response
  // ---------------------------------------------------------------------------

  it('returns seeded anomalies with type, severity, and summary', async () => {
    const brand = await createBrand()
    const request = authenticatedRequest(brand.id)
    const prisma = getTestPrisma()

    await prisma.feedbackAnomaly.create({
      data: {
        brandId: brand.id,
        type: 'volume_spike',
        severity: 'high',
        summary: 'Sudden 300% increase in shipping complaints',
        detectedAt: new Date('2025-06-01T00:00:00Z'),
      },
    })

    await prisma.feedbackAnomaly.create({
      data: {
        brandId: brand.id,
        type: 'sentiment_drop',
        severity: 'medium',
        summary: 'Average sentiment dropped from 0.3 to -0.2',
        detectedAt: new Date('2025-07-01T00:00:00Z'),
      },
    })

    const res = await request.get('/v1/analytics/cx').query(dateRangeParams())

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.anomalies)).toBe(true)
    expect(res.body.anomalies.length).toBe(2)

    const spike = res.body.anomalies.find(
      (a: { type: string }) => a.type === 'volume_spike',
    )
    expect(spike).toBeDefined()
    expect(spike.severity).toBe('high')
    expect(spike.summary).toContain('shipping complaints')

    const drop = res.body.anomalies.find(
      (a: { type: string }) => a.type === 'sentiment_drop',
    )
    expect(drop).toBeDefined()
    expect(drop.severity).toBe('medium')
  })

  // ---------------------------------------------------------------------------
  // 8. Cluster detail — GET /v1/analytics/cx/clusters/:id/trend
  // ---------------------------------------------------------------------------

  it('returns cluster detail with label, keywords, and trend time-series', async () => {
    const brand = await createBrand()
    const request = authenticatedRequest(brand.id)
    const prisma = getTestPrisma()

    const cluster = await prisma.feedbackCluster.create({
      data: {
        brandId: brand.id,
        label: 'Product Quality',
        description: 'Feedback about product build quality',
        keywords: ['quality', 'defect', 'broken'],
        responseCount: 25,
        avgSentiment: -0.2,
        isActive: true,
      },
    })

    // Create a series of snapshots
    await prisma.clusterSnapshot.createMany({
      data: [
        { clusterId: cluster.id, brandId: brand.id, bucketDate: new Date('2025-01-01'), volume: 3, avgSentiment: -0.1 },
        { clusterId: cluster.id, brandId: brand.id, bucketDate: new Date('2025-02-01'), volume: 5, avgSentiment: -0.3 },
        { clusterId: cluster.id, brandId: brand.id, bucketDate: new Date('2025-03-01'), volume: 8, avgSentiment: -0.2, isAnomaly: true },
      ],
    })

    const res = await request.get(`/v1/analytics/cx/clusters/${cluster.id}/trend?startDate=2024-01-01T00:00:00.000Z&endDate=2026-12-31T00:00:00.000Z`)

    expect(res.status).toBe(200)
    expect(res.body.clusterId).toBe(cluster.id)
    expect(res.body.label).toBe('Product Quality')
    expect(res.body.description).toBe('Feedback about product build quality')
    expect(res.body.keywords).toEqual(['quality', 'defect', 'broken'])
    expect(res.body.responseCount).toBe(25)
    expect(Array.isArray(res.body.trend)).toBe(true)
    expect(res.body.trend.length).toBe(3)

    // Verify trend entries have expected shape
    expect(res.body.trend[0].volume).toBe(3)
    expect(res.body.trend[1].volume).toBe(5)
    expect(res.body.trend[2].volume).toBe(8)
    expect(res.body.trend[2].isAnomaly).toBe(true)
  })

  // ---------------------------------------------------------------------------
  // 9. Non-existent cluster returns 404
  // ---------------------------------------------------------------------------

  it('returns 404 for a non-existent cluster ID', async () => {
    const brand = await createBrand()
    const request = authenticatedRequest(brand.id)

    const res = await request.get('/v1/analytics/cx/clusters/fake-cluster-id/trend')

    expect(res.status).toBe(404)
    expect(res.body.error).toMatch(/not found/i)
  })

  // ---------------------------------------------------------------------------
  // 10. Anomalies endpoint — GET /v1/analytics/cx/anomalies
  // ---------------------------------------------------------------------------

  it('returns all anomalies from the dedicated anomalies endpoint', async () => {
    const brand = await createBrand()
    const request = authenticatedRequest(brand.id)
    const prisma = getTestPrisma()

    // Create a cluster so we can associate an anomaly to it
    const cluster = await prisma.feedbackCluster.create({
      data: {
        brandId: brand.id,
        label: 'Returns',
        keywords: ['return', 'refund'],
        isActive: true,
      },
    })

    await prisma.feedbackAnomaly.create({
      data: {
        brandId: brand.id,
        clusterId: cluster.id,
        type: 'new_theme',
        severity: 'low',
        summary: 'New cluster of feedback about returns policy',
        detectedAt: new Date('2025-05-15T00:00:00Z'),
      },
    })

    await prisma.feedbackAnomaly.create({
      data: {
        brandId: brand.id,
        type: 'volume_decline',
        severity: 'medium',
        summary: 'Overall feedback volume dropped 40%',
        detectedAt: new Date('2025-06-01T00:00:00Z'),
      },
    })

    const res = await request.get('/v1/analytics/cx/anomalies').query(dateRangeParams())

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBe(2)

    // The cluster-linked anomaly should have the clusterLabel resolved
    const newTheme = res.body.find((a: { type: string }) => a.type === 'new_theme')
    expect(newTheme).toBeDefined()
    expect(newTheme.clusterLabel).toBe('Returns')
    expect(newTheme.severity).toBe('low')
    expect(newTheme.detectedAt).toBeDefined()

    // The standalone anomaly should have clusterLabel = null
    const decline = res.body.find((a: { type: string }) => a.type === 'volume_decline')
    expect(decline).toBeDefined()
    expect(decline.clusterLabel).toBeNull()
  })

  // ---------------------------------------------------------------------------
  // Multi-survey type aggregation
  // ---------------------------------------------------------------------------

  it('aggregates CSAT and CES averages alongside NPS in the CX response', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    const request = authenticatedRequest(brand.id)

    // NPS survey + responses
    const npsSurvey = await createSurvey({
      brandId: brand.id,
      programId: program.id,
      status: 'ACTIVE',
      type: 'NPS',
    })
    const m1 = await createConsentedMember({ brandId: brand.id })
    await createSurveyResponse({ surveyId: npsSurvey.id, memberId: m1.id, brandId: brand.id, score: 10 })

    // CSAT survey + responses (scores 4 and 5, average = 4.5)
    const csatSurvey = await createSurvey({
      brandId: brand.id,
      programId: program.id,
      status: 'ACTIVE',
      type: 'CSAT',
    })
    const m2 = await createConsentedMember({ brandId: brand.id })
    await createSurveyResponse({ surveyId: csatSurvey.id, memberId: m2.id, brandId: brand.id, score: 4 })
    const m3 = await createConsentedMember({ brandId: brand.id })
    await createSurveyResponse({ surveyId: csatSurvey.id, memberId: m3.id, brandId: brand.id, score: 5 })

    // CES survey + response (score 2)
    const cesSurvey = await createSurvey({
      brandId: brand.id,
      programId: program.id,
      status: 'ACTIVE',
      type: 'CES',
    })
    const m4 = await createConsentedMember({ brandId: brand.id })
    await createSurveyResponse({ surveyId: cesSurvey.id, memberId: m4.id, brandId: brand.id, score: 2 })

    const res = await request.get('/v1/analytics/cx').query(dateRangeParams())

    expect(res.status).toBe(200)
    expect(res.body.totalResponses).toBe(4)

    // NPS: 1 promoter (10), score = 100
    expect(res.body.nps.score).toBe(100)
    expect(res.body.nps.promoters).toBe(1)
    expect(res.body.nps.detractors).toBe(0)

    // CSAT average: (4 + 5) / 2 = 4.5
    expect(res.body.csat.average).toBeCloseTo(4.5, 1)
    expect(res.body.csat.responses).toBe(2)

    // CES average: 2
    expect(res.body.ces.average).toBe(2)
    expect(res.body.ces.responses).toBe(1)
  })

  // ---------------------------------------------------------------------------
  // Brand isolation — one brand cannot see another's data
  // ---------------------------------------------------------------------------

  it('isolates CX data between brands', async () => {
    const brand1 = await createBrand()
    const brand2 = await createBrand()
    const program1 = await createProgram({ brandId: brand1.id, status: 'ACTIVE' })
    const program2 = await createProgram({ brandId: brand2.id, status: 'ACTIVE' })

    const survey1 = await createSurvey({ brandId: brand1.id, programId: program1.id, status: 'ACTIVE', type: 'NPS' })
    const survey2 = await createSurvey({ brandId: brand2.id, programId: program2.id, status: 'ACTIVE', type: 'NPS' })

    const m1 = await createConsentedMember({ brandId: brand1.id })
    await createSurveyResponse({ surveyId: survey1.id, memberId: m1.id, brandId: brand1.id, score: 10 })

    const m2 = await createConsentedMember({ brandId: brand2.id })
    await createSurveyResponse({ surveyId: survey2.id, memberId: m2.id, brandId: brand2.id, score: 1 })

    // Brand 1 should only see its own data
    const res1 = await authenticatedRequest(brand1.id).get('/v1/analytics/cx').query(dateRangeParams())
    expect(res1.status).toBe(200)
    expect(res1.body.totalResponses).toBe(1)
    expect(res1.body.nps.score).toBe(100) // only promoter

    // Brand 2 should only see its own data
    const res2 = await authenticatedRequest(brand2.id).get('/v1/analytics/cx').query(dateRangeParams())
    expect(res2.status).toBe(200)
    expect(res2.body.totalResponses).toBe(1)
    expect(res2.body.nps.score).toBe(-100) // only detractor
  })
})

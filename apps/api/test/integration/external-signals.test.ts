/// <reference types="vitest" />
import { describe, it, expect, beforeEach } from 'vitest'
import {
  seedTestDb,
  createBrand,
  createProgram,
  createConsentedMember,
  createExternalSignalSource,
  createExternalSignal,
  authenticatedRequest,
  InMemoryQueue,
} from '@customerEQ/config/test-utils'

describe('External Signals API', () => {
  beforeEach(async () => {
    await seedTestDb()
    InMemoryQueue.clear()
  })

  it('creates and lists multiple brand-scoped external signal sources', async () => {
    const brand = await createBrand()
    const request = authenticatedRequest(brand.id)

    const createRes = await request.post('/v1/admin/external-signal-sources').send({
      name: 'Flagship Reviews',
      sourceType: 'GOOGLE_BUSINESS_PROFILE',
      connectionMethod: 'oauth',
      syncMode: 'POLL',
      enabled: true,
      scopeConfig: {
        locationIds: ['loc-1'],
      },
      filterConfig: {},
      matchingConfig: { memberResolutionEnabled: true },
    })

    expect(createRes.status).toBe(201)
    expect(createRes.body.name).toBe('Flagship Reviews')
    expect(createRes.body.webhookPath).toContain('/v1/integrations/webhooks/external-signals/')

    const secondCreateRes = await request.post('/v1/admin/external-signal-sources').send({
      name: 'LinkedIn Product Comments',
      sourceType: 'LINKEDIN_ORG',
      connectionMethod: 'oauth',
      syncMode: 'POLL',
      enabled: false,
      scopeConfig: {
        organizationUrn: 'urn:li:organization:123',
      },
      filterConfig: {},
      matchingConfig: { memberResolutionEnabled: false },
    })

    expect(secondCreateRes.status).toBe(201)

    const listRes = await request.get('/v1/admin/external-signal-sources?page=1&pageSize=10')
    expect(listRes.status).toBe(200)
    expect(listRes.body.total).toBe(2)
    expect(listRes.body.data.map((source: { name: string }) => source.name)).toEqual(
      expect.arrayContaining(['Flagship Reviews', 'LinkedIn Product Comments']),
    )
  })

  it('tests a source and returns normalized preview records', async () => {
    const brand = await createBrand()
    const source = await createExternalSignalSource({
      brandId: brand.id,
      sourceType: 'GENERIC_WEBHOOK',
      scopeConfig: {
        samplePayloads: [
          {
            externalId: 'preview-1',
            body: 'Delivery was delayed but support fixed it.',
            rating: 3,
            topics: ['shipping', 'support'],
          },
        ],
      },
    })

    const request = authenticatedRequest(brand.id)
    const res = await request.post(`/v1/admin/external-signal-sources/${source.id}/test`).send({})

    expect(res.status).toBe(200)
    expect(res.body.samples).toHaveLength(1)
    expect(res.body.samples[0].externalId).toBe('preview-1')
    expect(res.body.samples[0].topics).toEqual(['shipping', 'support'])
  })

  it('queues a manual source sync job', async () => {
    const brand = await createBrand()
    const source = await createExternalSignalSource({ brandId: brand.id })
    const request = authenticatedRequest(brand.id)

    const res = await request.post(`/v1/admin/external-signal-sources/${source.id}/sync`)

    expect(res.status).toBe(202)
    expect(InMemoryQueue.getJobs('external-signal-sync')).toHaveLength(1)
  })

  it('lists external signals and includes them in CX analytics summaries', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    const member = await createConsentedMember({ brandId: brand.id, programId: program.id })
    const source = await createExternalSignalSource({ brandId: brand.id, name: 'Brandwatch Feed' })

    await createExternalSignal({
      brandId: brand.id,
      sourceId: source.id,
      memberId: member.id,
      sourceType: 'GENERIC_WEBHOOK',
      body: 'Customers keep mentioning checkout friction.',
      sentiment: -0.4,
      topics: ['checkout'],
      subjectLabel: 'Checkout',
    })

    const request = authenticatedRequest(brand.id)
    const listRes = await request.get('/v1/admin/external-signals?page=1&pageSize=10')
    expect(listRes.status).toBe(200)
    expect(listRes.body.total).toBe(1)
    expect(listRes.body.data[0].sourceName).toBe('Brandwatch Feed')

    const analyticsRes = await request
      .get('/v1/analytics/cx')
      .query({
        startDate: '2020-01-01T00:00:00.000Z',
        endDate: '2030-01-01T00:00:00.000Z',
      })

    expect(analyticsRes.status).toBe(200)
    expect(analyticsRes.body.externalSignals.total).toBe(1)
    expect(analyticsRes.body.externalSignals.matched).toBe(1)

    const feedRes = await request
      .get('/v1/analytics/cx/external-signals')
      .query({
        startDate: '2020-01-01T00:00:00.000Z',
        endDate: '2030-01-01T00:00:00.000Z',
        page: 1,
        pageSize: 10,
      })

    expect(feedRes.status).toBe(200)
    expect(feedRes.body.data).toHaveLength(1)
    expect(feedRes.body.data[0].matchStatus).toBe('MATCHED')
  })

  it('returns unmatched signals in analytics while preserving source health and canonical metadata', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    const member = await createConsentedMember({ brandId: brand.id, programId: program.id })
    const source = await createExternalSignalSource({
      brandId: brand.id,
      sourceType: 'REDDIT',
      healthStatus: 'error',
      lastSyncAt: new Date('2026-04-07T10:00:00.000Z'),
      lastSuccessAt: new Date('2026-04-07T09:00:00.000Z'),
      lastImportCount: 4,
      lastError: 'Rate limited by provider',
    })

    await createExternalSignal({
      brandId: brand.id,
      sourceId: source.id,
      memberId: null,
      sourceType: 'REDDIT',
      body: 'Customers are discussing the rewards checkout flow.',
      canonicalUrl: 'https://reddit.com/r/example/comments/thread-1',
      subjectLabel: 'Rewards Checkout',
      matchStatus: 'UNMATCHED',
    })

    const request = authenticatedRequest(brand.id)
    const sourceRes = await request.get('/v1/admin/external-signal-sources?page=1&pageSize=10')
    expect(sourceRes.status).toBe(200)
    const listedSource = sourceRes.body.data.find((item: { id: string }) => item.id === source.id)
    expect(listedSource).toBeDefined()
    expect(listedSource.healthStatus).toBe('error')
    expect(listedSource.lastError).toBe('Rate limited by provider')
    expect(listedSource.lastImportCount).toBe(4)

    const analyticsFeedRes = await request
      .get('/v1/analytics/cx/external-signals')
      .query({
        startDate: '2020-01-01T00:00:00.000Z',
        endDate: '2030-01-01T00:00:00.000Z',
        page: 1,
        pageSize: 10,
      })

    expect(analyticsFeedRes.status).toBe(200)
    expect(analyticsFeedRes.body.data[0].matchStatus).toBe('UNMATCHED')
    expect(analyticsFeedRes.body.data[0].canonicalUrl).toBe('https://reddit.com/r/example/comments/thread-1')
    expect(analyticsFeedRes.body.data[0].subjectLabel).toBe('Rewards Checkout')

    const member360Res = await request.get(`/v1/members/${member.id}/360`)
    expect(member360Res.status).toBe(200)
    expect(member360Res.body.externalSignals.items).toHaveLength(0)
  })
})

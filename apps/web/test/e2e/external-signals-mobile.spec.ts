import { test, expect, type Page, type Route, devices } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const API = 'http://localhost:4000'
const EVIDENCE_DIR = path.resolve(process.cwd(), '..', '..', 'docs', 'evidence', 'ui-polish', '113')

test.use({ ...devices['iPhone 13'] })

function ensureEvidenceDir() {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
}

async function mockClerkAuth(page: Page) {
  await page.route('**/clerk.**', async (route: Route) => {
    if (route.request().resourceType() === 'document') {
      return route.continue()
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })
  await page.route('**/.well-known/**', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })
}

async function mockIntegrations(page: Page) {
  await page.route(`${API}/v1/admin/external-signal-sources?page=1&pageSize=50`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            id: 'source-1',
            name: 'Flagship Reviews',
            sourceType: 'GENERIC_WEBHOOK',
            connectionMethod: 'webhook_secret',
            syncMode: 'WEBHOOK',
            enabled: true,
            healthStatus: 'healthy',
            lastSyncAt: '2026-04-07T12:00:00.000Z',
            lastSuccessAt: '2026-04-07T12:00:00.000Z',
            lastImportCount: 12,
            lastError: null,
            scopeConfig: { samplePayloads: [] },
            webhookPath: '/v1/integrations/webhooks/external-signals/source-1',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 50,
        totalPages: 1,
      }),
    })
  })
}

async function mockAnalytics(page: Page) {
  await page.route(`${API}/v1/analytics/cx?*`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        totalResponses: 48,
        nps: { score: 31, responses: 18, promoters: 9, passives: 6, detractors: 3 },
        csat: { average: 4.3, responses: 12 },
        ces: { average: 5.1, responses: 7 },
        sentiment: {
          average: 0.18,
          distribution: { positive: 18, neutral: 20, negative: 10 },
          totalAnalyzed: 48,
        },
        externalSignals: {
          total: 14,
          matched: 9,
          unmatched: 5,
          bySourceType: { GENERIC_WEBHOOK: 9, REDDIT: 5 },
          sentimentDistribution: { positive: 4, neutral: 6, negative: 4 },
        },
        topTopics: [
          { topic: 'checkout', count: 11 },
          { topic: 'shipping', count: 7 },
        ],
        surveys: [
          {
            id: 'survey-1',
            name: 'Post Purchase NPS',
            type: 'NPS',
            responsesCount: 18,
            totalResponses: 18,
            nps: { score: 31, responses: 18, promoters: 9, passives: 6, detractors: 3 },
            csat: { average: null, responses: 0 },
            ces: { average: null, responses: 0 },
            sentiment: {
              average: 0.2,
              distribution: { positive: 7, neutral: 7, negative: 4 },
              totalAnalyzed: 18,
            },
            topTopics: [{ topic: 'shipping', count: 7 }],
            clusters: [{ id: 'cluster-1', label: 'Fulfillment', count: 8, avgSentiment: 0.1 }],
          },
        ],
        clusters: [
          {
            id: 'cluster-1',
            label: 'Fulfillment',
            responseCount: 8,
            avgSentiment: 0.1,
            trending: 'up',
            changePercent: 12,
          },
        ],
        anomalies: [
          {
            id: 'anomaly-1',
            severity: 'HIGH',
            summary: 'Shipping complaints rose 18% week over week.',
            clusterLabel: 'Fulfillment',
            detectedAt: '2026-04-07T09:00:00.000Z',
          },
        ],
      }),
    })
  })

  await page.route(`${API}/v1/analytics/cx/responses?*`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            id: 'response-1',
            surveyName: 'Post Purchase NPS',
            surveyType: 'NPS',
            memberName: 'Jordan Lee',
            memberEmail: 'jordan@example.com',
            score: 6,
            sentiment: -0.2,
            text: 'Checkout was confusing on mobile.',
            topics: ['checkout', 'mobile'],
            summary: null,
            clusterLabel: 'Fulfillment',
            channel: 'email',
            completedAt: '2026-04-06T17:00:00.000Z',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 15,
        totalPages: 1,
      }),
    })
  })

  await page.route(`${API}/v1/analytics/cx/external-signals?*`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            id: 'signal-1',
            sourceId: 'source-1',
            sourceName: 'Flagship Reviews',
            sourceType: 'GENERIC_WEBHOOK',
            body: 'Customers keep mentioning checkout friction in reviews.',
            summary: 'Checkout friction recurring',
            rating: 3,
            sentiment: -0.4,
            topics: ['checkout'],
            canonicalUrl: 'https://example.com/review/1',
            externalAuthorLabel: 'Local Guide',
            subjectLabel: 'Checkout',
            matchStatus: 'MATCHED',
            postedAt: '2026-04-06T10:00:00.000Z',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 15,
        totalPages: 1,
      }),
    })
  })
}

async function mockMember360(page: Page) {
  await page.route(`${API}/v1/members/member-1/360`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        member: {
          id: 'member-1',
          email: 'jordan@example.com',
          firstName: 'Jordan',
          lastName: 'Lee',
          phone: null,
          pointsBalance: 1240,
          status: 'ACTIVE',
          enrollmentDate: '2026-01-15T00:00:00.000Z',
          consentGivenAt: '2026-01-15T00:00:00.000Z',
          consentVersion: 'v1',
          tier: { id: 'tier-1', name: 'Gold', rank: 2, benefits: [], multiplier: 1.2 },
          healthScore: 74,
          healthScoreUpdatedAt: '2026-04-07T09:00:00.000Z',
          healthScoreBreakdown: null,
        },
        recentEvents: { items: [], hasMore: false, total: 0 },
        surveyResponses: { items: [], hasMore: false, total: 0 },
        redemptions: { items: [], hasMore: false, total: 0 },
        campaignEvents: { items: [], hasMore: false, total: 0 },
        externalSignals: {
          items: [
            {
              id: 'signal-1',
              sourceId: 'source-1',
              sourceType: 'GENERIC_WEBHOOK',
              sourceName: 'Flagship Reviews',
              body: 'Customers keep mentioning checkout friction in reviews.',
              summary: 'Checkout friction recurring',
              rating: 3,
              sentiment: -0.4,
              topics: ['checkout'],
              canonicalUrl: 'https://example.com/review/1',
              externalAuthorLabel: 'Local Guide',
              subjectLabel: 'Checkout',
              postedAt: '2026-04-06T10:00:00.000Z',
              matchConfidence: 1,
            },
          ],
          hasMore: false,
          total: 1,
        },
        openCases: [],
        stats: {
          totalEvents: 0,
          totalSurveyResponses: 0,
          averageSentiment: null,
          totalPointsEarned: 1240,
          totalPointsRedeemed: 0,
        },
      }),
    })
  })

  await page.route(`${API}/v1/members/member-1/notes`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    })
  })
}

test.describe('Workflow 8: Mobile External Signal Surfaces', () => {
  test.beforeEach(async ({ page }) => {
    ensureEvidenceDir()
    await mockClerkAuth(page)
    await mockIntegrations(page)
    await mockAnalytics(page)
    await mockMember360(page)
  })

  test('captures mobile evidence for integrations', async ({ page }) => {
    await page.goto('/admin/integrations')
    await expect(page.getByRole('heading', { name: 'Integrations' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Review and Social Sources' })).toBeVisible()
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, 'integrations-iphone13-portrait.png'),
      fullPage: true,
    })
  })

  test('captures mobile evidence for CX analytics', async ({ page }) => {
    await page.goto('/admin/analytics/cx')
    await expect(page.getByRole('heading', { name: 'CX Insights' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'External Signals' })).toBeVisible()
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, 'analytics-cx-iphone13-portrait.png'),
      fullPage: true,
    })
  })

  test('captures mobile evidence for Customer 360', async ({ page }) => {
    await page.goto('/admin/members/member-1')
    await expect(page.getByText('Customer 360')).toBeVisible()
    await expect(page.getByRole('heading', { name: /External Signals/ })).toBeVisible()
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, 'member-360-iphone13-portrait.png'),
      fullPage: true,
    })
  })
})

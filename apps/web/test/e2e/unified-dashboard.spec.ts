import { test, expect, type Route } from '@playwright/test'

/**
 * Unified CX+Loyalty Operator Dashboard E2E Tests — Issue #78
 *
 * Covers the /admin home dashboard:
 *   - CX Health and Loyalty Health panels render side by side
 *   - Insight cards render with CTA links
 *   - Empty states render when no surveys or no campaigns
 *   - CTA click navigates to pre-filtered campaign builder
 *   - Campaign builder pre-populates segment when filter=detractors
 */

const API = 'http://localhost:4000'

const FULL_HEALTH_RESPONSE = {
  cxHealth: {
    avgNps: 42,
    activeSurveys: 3,
    responseRate: 25.5,
    atRiskCount: 18,
  },
  loyaltyHealth: {
    activeMembers: 250,
    pointsIssuedThisWeek: 12000,
    redemptionRate: 14.2,
    activeCampaigns: 2,
  },
  insights: [
    {
      id: 'detractors-no-redemption',
      message: '18 detractors (NPS < 7) have not redeemed a reward in 30 days',
      ctaLabel: 'Create win-back campaign',
      ctaHref: '/admin/campaigns/new?filter=detractors&maxNps=6',
      severity: 'warning',
    },
  ],
}

const NO_SURVEYS_RESPONSE = {
  cxHealth: {
    avgNps: null,
    activeSurveys: 0,
    responseRate: 0,
    atRiskCount: 0,
  },
  loyaltyHealth: {
    activeMembers: 50,
    pointsIssuedThisWeek: 0,
    redemptionRate: 0,
    activeCampaigns: 1,
  },
  insights: [],
}

const NO_CAMPAIGNS_RESPONSE = {
  cxHealth: {
    avgNps: 30,
    activeSurveys: 2,
    responseRate: 22,
    atRiskCount: 0,
  },
  loyaltyHealth: {
    activeMembers: 100,
    pointsIssuedThisWeek: 500,
    redemptionRate: 0,
    activeCampaigns: 0,
  },
  insights: [],
}

test.describe('Unified CX+Loyalty Dashboard', () => {
  test('renders CX Health and Loyalty Health panels side by side', async ({ page }) => {
    await page.route(`${API}/v1/analytics/program-health`, (route: Route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(FULL_HEALTH_RESPONSE),
      })
    })

    await page.goto('/admin')

    await expect(page.getByTestId('cx-health-panel')).toBeVisible()
    await expect(page.getByTestId('loyalty-health-panel')).toBeVisible()
  })

  test('renders stat values from CX Health data', async ({ page }) => {
    await page.route(`${API}/v1/analytics/program-health`, (route: Route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(FULL_HEALTH_RESPONSE),
      })
    })

    await page.goto('/admin')

    const cxPanel = page.getByTestId('cx-health-panel')
    await expect(cxPanel).toContainText('42')   // avgNps
    await expect(cxPanel).toContainText('18')   // atRiskCount
  })

  test('renders stat values from Loyalty Health data', async ({ page }) => {
    await page.route(`${API}/v1/analytics/program-health`, (route: Route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(FULL_HEALTH_RESPONSE),
      })
    })

    await page.goto('/admin')

    const loyaltyPanel = page.getByTestId('loyalty-health-panel')
    await expect(loyaltyPanel).toContainText('250')  // activeMembers
  })

  test('renders insight card with CTA link', async ({ page }) => {
    await page.route(`${API}/v1/analytics/program-health`, (route: Route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(FULL_HEALTH_RESPONSE),
      })
    })

    await page.goto('/admin')

    await expect(page.getByTestId('insights-section')).toBeVisible()
    await expect(page.getByTestId('insight-card-detractors-no-redemption')).toBeVisible()
    await expect(page.getByTestId('insight-card-detractors-no-redemption')).toContainText('18 detractors')
  })

  test('CTA click navigates to campaign builder with filter=detractors', async ({ page }) => {
    await page.route(`${API}/v1/analytics/program-health`, (route: Route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(FULL_HEALTH_RESPONSE),
      })
    })

    await page.goto('/admin')

    const ctaLink = page.getByTestId('insight-cta-detractors-no-redemption')
    await ctaLink.click()

    await expect(page).toHaveURL(/filter=detractors/)
    await expect(page).toHaveURL(/maxNps=6/)
  })

  test('shows no-surveys empty state when activeSurveys is 0', async ({ page }) => {
    await page.route(`${API}/v1/analytics/program-health`, (route: Route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(NO_SURVEYS_RESPONSE),
      })
    })

    await page.goto('/admin')

    await expect(page.getByTestId('cx-health-empty')).toBeVisible()
    await expect(page.getByTestId('cx-health-empty')).toContainText('No surveys yet')
  })

  test('shows no-campaigns empty state when activeCampaigns is 0', async ({ page }) => {
    await page.route(`${API}/v1/analytics/program-health`, (route: Route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(NO_CAMPAIGNS_RESPONSE),
      })
    })

    await page.goto('/admin')

    await expect(page.getByTestId('loyalty-health-empty')).toBeVisible()
    await expect(page.getByTestId('loyalty-health-empty')).toContainText('No campaigns active')
  })

  test('renders — for null avgNps', async ({ page }) => {
    await page.route(`${API}/v1/analytics/program-health`, (route: Route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(NO_SURVEYS_RESPONSE),
      })
    })

    await page.goto('/admin')

    const cxPanel = page.getByTestId('cx-health-panel')
    await expect(cxPanel).toContainText('—')
  })

  test('campaign builder pre-populates segment condition when filter=detractors', async ({ page }) => {
    await page.goto('/admin/campaigns/new?filter=detractors&maxNps=6')

    // The nps_score condition field should be pre-selected
    const conditionField = page.locator('[data-testid="campaign-condition-field"]')
    await expect(conditionField).toHaveValue('nps_score')
  })
})

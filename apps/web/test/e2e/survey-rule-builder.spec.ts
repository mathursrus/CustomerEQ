import { test, expect } from '@playwright/test'

/**
 * Survey Rule Builder E2E Tests — Issue #80
 *
 * All API calls are mocked via page.route() — no running API server required.
 *
 * Covers:
 *   - Happy path: all 4 steps complete → launch → redirect
 *   - Step 3 overlap validation prevents advance
 *   - Back button from Step 4 returns to Step 3 with rules preserved
 *   - Playbook save + load (rules replaced from playbook)
 *   - Skip rules → Step 4 with empty rules
 *   - Loop Monitor renders for ACTIVE survey (mocked API)
 *   - Loop Monitor shows placeholder for DRAFT survey
 *   - Loop Monitor 48h warning visible and dismissible
 */

const API = 'http://localhost:4000'

const MOCK_PROGRAMS = [{ id: 'prog-1', name: 'Spring Rewards 2026' }]
const MOCK_SURVEY_CREATED = { id: 'survey-rule-test-123' }
const MOCK_LAUNCH_RESPONSE = { campaignsCreated: 2, surveyId: 'survey-rule-test-123' }

const MOCK_REACH_ESTIMATE = {
  estimatedCount: 32,
  channels: { email: 32, inApp: 25, sms: 8 },
  windowDays: 30,
}

const MOCK_CX_PLAYBOOKS = {
  data: [
    {
      id: 'playbook-1',
      name: 'Standard NPS Recovery',
      surveyType: 'NPS',
      rules: [
        { scoreMin: 0, scoreMax: 6, actionType: 'award_points', actionConfig: { points: 200 }, ruleLabel: 'Detractors' },
        { scoreMin: 9, scoreMax: 10, actionType: 'award_points', actionConfig: { points: 100 }, ruleLabel: 'Promoters' },
      ],
    },
  ],
  total: 1,
}

const MOCK_LOOP_MONITOR_ACTIVE = {
  surveyId: 'survey-rule-test-123',
  generatedAt: new Date().toISOString(),
  placeholder: false,
  pipeline: {
    surveysSent: 120,
    responsesReceived: 34,
    scoreDistribution: { '0-6': 10, '7-8': 14, '9-10': 10 },
    rulesMatched: 10,
    campaignsTriggered: 10,
    loyaltyOutcomes: { pointsAwarded: 1000, rewardsIssued: 0, retentionDelta: null },
  },
  latency: {
    p50Ms: 1200,
    p95Ms: 4500,
    sampleSize: 10,
    slaStatus: 'ok' as const,
  },
  warning: null,
}

const MOCK_LOOP_MONITOR_WARNING = {
  ...MOCK_LOOP_MONITOR_ACTIVE,
  pipeline: { ...MOCK_LOOP_MONITOR_ACTIVE.pipeline, campaignsTriggered: 0 },
  warning: {
    type: 'no_campaigns_triggered_48h',
    message: 'Responses have been received for 48+ hours but no campaigns have been triggered. Check your rule configuration.',
  },
}

test.describe('Survey Rule Builder — /admin/surveys/new (Steps 3 & 4)', () => {
  test.beforeEach(async ({ page }) => {
    // Mock programs list
    await page.route(`${API}/v1/programs*`, async (route) => {
      await route.fulfill({ json: { data: MOCK_PROGRAMS, total: 1 } })
    })

    // Mock trigger options (for step 1)
    await page.route(`${API}/v1/programs/*/trigger-options`, async (route) => {
      await route.fulfill({
        json: {
          loyaltyMoments: [
            { key: 'tier_upgrade', label: 'Tier Upgrade', icon: '🏆' },
          ],
          hasEarnRules: true,
        },
      })
    })

    // Mock reach estimate
    await page.route(`${API}/v1/analytics/reach-estimate*`, async (route) => {
      await route.fulfill({ json: MOCK_REACH_ESTIMATE })
    })

    // Mock survey creation (POST /v1/surveys)
    await page.route(`${API}/v1/surveys`, async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 201, json: MOCK_SURVEY_CREATED })
      } else {
        await route.fulfill({ json: { data: [], total: 0 } })
      }
    })

    // Mock cx-playbooks
    await page.route(`${API}/v1/cx-playbooks*`, async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          json: { id: 'playbook-new', name: 'My Saved Playbook', surveyType: 'NPS', rules: [] },
        })
      } else {
        await route.fulfill({ json: MOCK_CX_PLAYBOOKS })
      }
    })

    // Mock launch
    await page.route(`${API}/v1/surveys/*/launch`, async (route) => {
      await route.fulfill({ json: MOCK_LAUNCH_RESPONSE })
    })
  })

  async function advanceToStep3(page: Parameters<typeof test>[1]['page']) {
    await page.goto('/admin/surveys/new')

    // Step 1: pick loyalty trigger
    await page.getByTestId('trigger-category-loyalty').click()
    await page.getByTestId('sub-trigger-tier_upgrade').click()
    await page.getByTestId('trigger-continue-btn').click()

    // Step 2: fill survey details
    await page.getByTestId('survey-name-input').fill('Tier Upgrade NPS Survey')
    await page.getByTestId('survey-program-select').selectOption('prog-1')
    await page.getByTestId('survey-submit-btn').click()

    // Wait for Step 3 to appear
    await expect(page.getByTestId('rule-builder-step')).toBeVisible()
  }

  test('Step 3 renders with one default rule row', async ({ page }) => {
    await advanceToStep3(page)

    await expect(page.getByTestId('rule-row-0')).toBeVisible()
    await expect(page.getByTestId('add-rule-btn')).toBeVisible()
    await expect(page.getByTestId('rules-continue-btn')).toBeVisible()
    await expect(page.getByTestId('skip-rules-btn')).toBeVisible()
  })

  test('Adding a rule appends a new rule row', async ({ page }) => {
    await advanceToStep3(page)

    await page.getByTestId('add-rule-btn').click()

    await expect(page.getByTestId('rule-row-0')).toBeVisible()
    await expect(page.getByTestId('rule-row-1')).toBeVisible()
  })

  test('Overlapping rules show error and disable Continue', async ({ page }) => {
    await advanceToStep3(page)

    // Add second rule
    await page.getByTestId('add-rule-btn').click()

    // Set rule 0: 0–6, rule 1: 5–8 (overlaps at 5–6)
    await page.getByTestId('rule-score-min-0').fill('0')
    await page.getByTestId('rule-score-max-0').fill('6')
    await page.getByTestId('rule-score-min-1').fill('5')
    await page.getByTestId('rule-score-max-1').fill('8')

    await expect(page.getByTestId('overlap-error')).toBeVisible()
    await expect(page.getByTestId('rules-continue-btn')).toBeDisabled()
  })

  test('Fixing overlap clears error and enables Continue', async ({ page }) => {
    await advanceToStep3(page)

    await page.getByTestId('add-rule-btn').click()

    // Create overlap
    await page.getByTestId('rule-score-min-1').fill('5')
    await page.getByTestId('rule-score-max-1').fill('8')
    await expect(page.getByTestId('overlap-error')).toBeVisible()

    // Fix by adjusting rule 1 to non-overlapping range
    await page.getByTestId('rule-score-min-1').fill('7')
    await expect(page.getByTestId('overlap-error')).not.toBeVisible()
    await expect(page.getByTestId('rules-continue-btn')).toBeEnabled()
  })

  test('Skip rules advances to Step 4 with empty rules summary', async ({ page }) => {
    await advanceToStep3(page)

    await page.getByTestId('skip-rules-btn').click()

    await expect(page.getByTestId('review-launch-step')).toBeVisible()
    await expect(page.getByTestId('review-rules-card')).toContainText('No rules')
  })

  test('Continue with valid rules advances to Step 4 showing rule rows', async ({ page }) => {
    await advanceToStep3(page)

    // Ensure rule 0 has non-overlapping values (default should be fine)
    await page.getByTestId('rules-continue-btn').click()

    await expect(page.getByTestId('review-launch-step')).toBeVisible()
    await expect(page.getByTestId('review-rule-row-0')).toBeVisible()
  })

  test('Back button from Step 4 returns to Step 3 with rules preserved', async ({ page }) => {
    await advanceToStep3(page)

    // Set a label on rule 0
    await page.getByTestId('rule-label-0').fill('Detractors')
    await page.getByTestId('rules-continue-btn').click()

    await expect(page.getByTestId('review-launch-step')).toBeVisible()

    // Go back
    await page.getByTestId('back-btn').click()

    await expect(page.getByTestId('rule-builder-step')).toBeVisible()
    // Label should be preserved
    await expect(page.getByTestId('rule-label-0')).toHaveValue('Detractors')
  })

  test('Happy path: all 4 steps → Launch → redirect to survey detail', async ({ page }) => {
    await advanceToStep3(page)

    // Step 3: continue with default rules
    await page.getByTestId('rules-continue-btn').click()

    // Step 4: review
    await expect(page.getByTestId('review-launch-step')).toBeVisible()
    await expect(page.getByTestId('review-survey-card')).toContainText('Tier Upgrade NPS Survey')

    await page.getByTestId('launch-btn').click()

    await expect(page).toHaveURL(/\/admin\/surveys\/survey-rule-test-123/)
  })

  test('Playbook selector loads playbooks and replaces rules on load', async ({ page }) => {
    await advanceToStep3(page)

    // PlaybookSelector should have loaded the mock playbook
    const playbookSelect = page.getByTestId('playbook-select')
    await expect(playbookSelect).toBeVisible()

    // Select the playbook
    await playbookSelect.selectOption('playbook-1')

    // Load button click
    await page.getByTestId('load-playbook-btn').click()

    // Rules should now be the playbook's 2 rules
    await expect(page.getByTestId('rule-row-0')).toBeVisible()
    await expect(page.getByTestId('rule-row-1')).toBeVisible()
    await expect(page.getByTestId('rule-label-0')).toHaveValue('Detractors')
    await expect(page.getByTestId('rule-label-1')).toHaveValue('Promoters')
  })

  test('Save as Playbook calls POST /v1/cx-playbooks', async ({ page }) => {
    let playbookSaveBody: unknown = null
    await page.route(`${API}/v1/cx-playbooks`, async (route) => {
      if (route.request().method() === 'POST') {
        playbookSaveBody = route.request().postDataJSON()
        await route.fulfill({
          status: 201,
          json: { id: 'new-playbook', name: 'Custom Playbook', surveyType: 'NPS', rules: [] },
        })
      } else {
        await route.fulfill({ json: { data: [], total: 0 } })
      }
    })

    await advanceToStep3(page)

    await page.getByTestId('playbook-name-input').fill('Custom Playbook')
    await page.getByTestId('save-playbook-btn').click()

    // Input should be cleared after save
    await expect(page.getByTestId('playbook-name-input')).toHaveValue('')
    expect(playbookSaveBody).toBeTruthy()
    expect((playbookSaveBody as { name?: string }).name).toBe('Custom Playbook')
  })

  test('Reach estimate badge appears after debounce on score range change', async ({ page }) => {
    await advanceToStep3(page)

    // Change score range to trigger a fresh reach estimate fetch
    await page.getByTestId('rule-score-max-0').fill('8')

    // Wait for debounce + fetch (500ms debounce + network)
    await expect(page.getByTestId('reach-badge-0')).toBeVisible({ timeout: 3000 })
    await expect(page.getByTestId('reach-badge-0')).toContainText('32')
  })
})

// =============================================================================
// Loop Monitor component (mocked API — survey detail page)
// =============================================================================

test.describe('Loop Monitor — survey detail page (/admin/surveys/:id)', () => {
  const surveyId = 'survey-loop-test-456'

  async function setupSurveyPage(
    page: Parameters<typeof test>[1]['page'],
    surveyData: Record<string, unknown>,
    loopMonitorData: Record<string, unknown>,
  ) {
    await page.route(`${API}/v1/surveys/${surveyId}`, async (route) => {
      await route.fulfill({ json: surveyData })
    })
    await page.route(`${API}/v1/surveys/${surveyId}/loop-monitor`, async (route) => {
      await route.fulfill({ json: loopMonitorData })
    })
  }

  test('Loop Monitor renders pipeline stages for ACTIVE survey', async ({ page }) => {
    await setupSurveyPage(
      page,
      {
        id: surveyId,
        name: 'Post-Purchase NPS',
        type: 'NPS',
        status: 'ACTIVE',
        responses: [],
        triggerCategory: null,
        triggerKey: null,
        surveyTypeOverride: null,
        incentivePoints: null,
        createdAt: new Date().toISOString(),
      },
      MOCK_LOOP_MONITOR_ACTIVE,
    )

    await page.goto(`/admin/surveys/${surveyId}`)

    await expect(page.getByTestId('loop-monitor')).toBeVisible()
    await expect(page.getByTestId('pipeline-stages')).toBeVisible()
    await expect(page.getByTestId('stage-responsesReceived')).toContainText('34')
    await expect(page.getByTestId('stage-campaignsTriggered')).toContainText('10')
  })

  test('Loop Monitor shows SLA status strip', async ({ page }) => {
    await setupSurveyPage(
      page,
      {
        id: surveyId,
        name: 'Post-Purchase NPS',
        type: 'NPS',
        status: 'ACTIVE',
        responses: [],
        triggerCategory: null,
        triggerKey: null,
        surveyTypeOverride: null,
        incentivePoints: null,
        createdAt: new Date().toISOString(),
      },
      MOCK_LOOP_MONITOR_ACTIVE,
    )

    await page.goto(`/admin/surveys/${surveyId}`)

    await expect(page.getByTestId('latency-strip')).toBeVisible()
    await expect(page.getByTestId('sla-status')).toContainText('Within SLA')
  })

  test('Loop Monitor placeholder shown for DRAFT survey (no API call needed)', async ({ page }) => {
    await page.route(`${API}/v1/surveys/${surveyId}`, async (route) => {
      await route.fulfill({
        json: {
          id: surveyId,
          name: 'Draft Survey',
          type: 'NPS',
          status: 'DRAFT',
          responses: [],
          triggerCategory: null,
          triggerKey: null,
          surveyTypeOverride: null,
          incentivePoints: null,
          createdAt: new Date().toISOString(),
        },
      })
    })

    await page.goto(`/admin/surveys/${surveyId}`)

    // Component renders a static placeholder when not ACTIVE
    await expect(page.getByTestId('loop-monitor-placeholder')).toBeVisible()
    await expect(page.getByTestId('loop-monitor')).not.toBeVisible()
  })

  test('48h warning banner is visible and can be dismissed', async ({ page }) => {
    await setupSurveyPage(
      page,
      {
        id: surveyId,
        name: 'Post-Purchase NPS',
        type: 'NPS',
        status: 'ACTIVE',
        responses: [],
        triggerCategory: null,
        triggerKey: null,
        surveyTypeOverride: null,
        incentivePoints: null,
        createdAt: new Date().toISOString(),
      },
      MOCK_LOOP_MONITOR_WARNING,
    )

    await page.goto(`/admin/surveys/${surveyId}`)

    await expect(page.getByTestId('loop-monitor-warning')).toBeVisible()

    // Dismiss
    await page.getByTestId('dismiss-warning-btn').click()
    await expect(page.getByTestId('loop-monitor-warning')).not.toBeVisible()
  })

  test('Clicking a pipeline stage opens inline drawer', async ({ page }) => {
    await setupSurveyPage(
      page,
      {
        id: surveyId,
        name: 'Post-Purchase NPS',
        type: 'NPS',
        status: 'ACTIVE',
        responses: [],
        triggerCategory: null,
        triggerKey: null,
        surveyTypeOverride: null,
        incentivePoints: null,
        createdAt: new Date().toISOString(),
      },
      MOCK_LOOP_MONITOR_ACTIVE,
    )

    await page.goto(`/admin/surveys/${surveyId}`)

    await page.getByTestId('stage-responsesReceived').click()

    await expect(page.getByTestId('stage-drawer')).toBeVisible()
    // Should show score distribution for responsesReceived stage
    await expect(page.getByTestId('stage-drawer')).toContainText('Score Distribution')
  })
})

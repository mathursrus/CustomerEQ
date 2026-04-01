import { test, expect } from '@playwright/test'

/**
 * Demo Request Form E2E Tests
 *
 * Covers the public-facing /request-demo page:
 *   - Happy-path submission
 *   - Required-field validation
 *   - Email format validation
 *
 * Uses actual data-testid attributes present in the implementation.
 */

const API = 'http://localhost:4000'

test.describe('Demo Request Form', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the demo request API so tests run without a live backend
    await page.route(`${API}/v1/public/demo-requests`, (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' })
    })
    await page.goto('/request-demo')
  })

  // ---------------------------------------------------------------------------
  // Happy path
  // ---------------------------------------------------------------------------
  test('visitor can submit a demo request', async ({ page }) => {
    await page.getByTestId('demo-firstName').fill('Alice')
    await page.getByTestId('demo-lastName').fill('Smith')
    await page.getByTestId('demo-workEmail').fill('alice.smith@acme.com')
    await page.getByTestId('demo-companyName').fill('Acme Corp')
    await page.getByTestId('demo-companySize').selectOption('51-200')
    await page.getByTestId('demo-message').fill('Interested in the loyalty platform.')

    await page.getByTestId('demo-submit-btn').click()

    // Success confirmation must be visible
    await expect(page.getByTestId('demo-success-msg')).toBeVisible()

    // Form inputs must no longer be visible
    await expect(page.getByTestId('demo-firstName')).not.toBeVisible()
  })

  // ---------------------------------------------------------------------------
  // Required-field validation
  // ---------------------------------------------------------------------------
  test('form validates required fields', async ({ page }) => {
    await page.getByTestId('demo-submit-btn').click()

    // Required-field errors appear as sibling <p> elements next to inputs
    await expect(page.getByTestId('demo-firstName').locator('..').locator('p')).toBeVisible()
    await expect(page.getByTestId('demo-lastName').locator('..').locator('p')).toBeVisible()
    await expect(page.getByTestId('demo-workEmail').locator('..').locator('p')).toBeVisible()
    await expect(page.getByTestId('demo-companyName').locator('..').locator('p')).toBeVisible()

    // Success message must NOT appear
    await expect(page.getByTestId('demo-success-msg')).not.toBeVisible()
  })

  // ---------------------------------------------------------------------------
  // Email format validation
  // ---------------------------------------------------------------------------
  test('form validates email format', async ({ page }) => {
    await page.getByTestId('demo-workEmail').fill('notanemail')
    await page.getByTestId('demo-submit-btn').click()

    // Email error paragraph must be visible
    const emailError = page.getByTestId('demo-workEmail').locator('..').locator('p')
    await expect(emailError).toBeVisible()
  })
})

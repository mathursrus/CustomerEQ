import { test, expect } from '@playwright/test'

/**
 * Demo Request Form E2E Tests
 *
 * Covers the public-facing /request-demo page:
 *   - Happy-path submission
 *   - Required-field validation
 *   - Email format validation
 *
 * Selector strategy: data-testid attributes throughout.
 */

test.describe('Demo Request Form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/request-demo')
  })

  // ---------------------------------------------------------------------------
  // Happy path
  // ---------------------------------------------------------------------------
  test('visitor can submit a demo request', async ({ page }) => {
    // Required fields
    await page.getByTestId('demo-first-name-input').fill('Alice')
    await page.getByTestId('demo-last-name-input').fill('Smith')
    await page.getByTestId('demo-work-email-input').fill('alice.smith@acme.com')
    await page.getByTestId('demo-company-name-input').fill('Acme Corp')

    // Optional fields
    await page.getByTestId('demo-company-size-select').selectOption('51-200')
    await page.getByTestId('demo-message-textarea').fill('Interested in the loyalty platform for our retail brand.')

    await page.getByTestId('demo-submit-btn').click()

    // Success confirmation must be visible
    await expect(page.getByTestId('demo-success-message')).toBeVisible()

    // Form inputs must be cleared / replaced by the success state
    await expect(page.getByTestId('demo-first-name-input')).not.toBeVisible()
    await expect(page.getByTestId('demo-work-email-input')).not.toBeVisible()
  })

  // ---------------------------------------------------------------------------
  // Required-field validation
  // ---------------------------------------------------------------------------
  test('form validates required fields', async ({ page }) => {
    // Submit without filling anything
    await page.getByTestId('demo-submit-btn').click()

    // All four required fields must surface a validation error
    await expect(page.getByTestId('demo-first-name-error')).toBeVisible()
    await expect(page.getByTestId('demo-last-name-error')).toBeVisible()
    await expect(page.getByTestId('demo-work-email-error')).toBeVisible()
    await expect(page.getByTestId('demo-company-name-error')).toBeVisible()

    // Success message must NOT appear
    await expect(page.getByTestId('demo-success-message')).not.toBeVisible()
  })

  // ---------------------------------------------------------------------------
  // Email format validation
  // ---------------------------------------------------------------------------
  test('form validates email format', async ({ page }) => {
    // Fill only the email field with an invalid value; leave others blank so
    // we can isolate the email error specifically.
    await page.getByTestId('demo-work-email-input').fill('notanemail')

    // Trigger validation by attempting to submit
    await page.getByTestId('demo-submit-btn').click()

    // Email-specific error must be visible
    const emailError = page.getByTestId('demo-work-email-error')
    await expect(emailError).toBeVisible()
    await expect(emailError).not.toHaveText('')

    // Correcting the email should clear the error
    await page.getByTestId('demo-work-email-input').fill('valid@example.com')
    // Trigger re-validation (blur or re-submit)
    await page.getByTestId('demo-work-email-input').blur()
    await expect(page.getByTestId('demo-work-email-error')).not.toBeVisible()
  })
})

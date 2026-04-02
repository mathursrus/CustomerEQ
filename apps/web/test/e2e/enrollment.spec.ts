import { test, expect, type Route } from '@playwright/test'

/**
 * Member Enrollment Flow E2E Tests
 *
 * Covers the public /{programSlug}/enroll page:
 *   - Happy-path enrollment → welcome screen
 *   - Client-side required-field validation
 *   - Consent checkbox required
 *   - Duplicate email → 409 error banner
 */

const API = 'http://localhost:4000'
const PROGRAM_SLUG = 'test-rewards'

const PROGRAM_STUB = {
  programId: 'prog-test-001',
  programName: 'Test Rewards',
  programSlug: PROGRAM_SLUG,
  brandId: 'brand-test-001',
  brandName: 'Test Brand',
}

test.describe('Member Enrollment Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the program slug lookup
    await page.route(`${API}/v1/public/programs/by-slug/${PROGRAM_SLUG}`, (route: Route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(PROGRAM_STUB),
      })
    })

    // Mock Clerk's useSignUp — inject a minimal stub via window
    await page.addInitScript(() => {
      ;(window as unknown as Record<string, unknown>).__CLERK_MOCK__ = true
    })
  })

  // ---------------------------------------------------------------------------
  // Client-side validation
  // ---------------------------------------------------------------------------
  test('shows validation errors when required fields are empty', async ({ page }) => {
    await page.goto(`/${PROGRAM_SLUG}/enroll`)

    await page.getByTestId('enroll-submit').click()

    // Required field errors should appear
    await expect(page.locator('#email-error')).toBeVisible()
    await expect(page.locator('#password-error')).toBeVisible()
    await expect(page.locator('#consent-error')).toBeVisible()
  })

  test('shows consent error when form is filled but consent not checked', async ({ page }) => {
    await page.goto(`/${PROGRAM_SLUG}/enroll`)

    await page.locator('#email').fill('test@example.com')
    await page.locator('#password').fill('Password123!')
    await page.locator('#firstName').fill('Jane')
    await page.locator('#lastName').fill('Doe')

    await page.getByTestId('enroll-submit').click()

    await expect(page.locator('#consent-error')).toBeVisible()
  })

  // ---------------------------------------------------------------------------
  // Duplicate email — 409
  // ---------------------------------------------------------------------------
  test('shows already-enrolled error banner on 409 response', async ({ page }) => {
    await page.route(`${API}/v1/members/enroll`, (route: Route) => {
      route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'EMAIL_ALREADY_ENROLLED',
          message: 'This email is already enrolled in this program.',
        }),
      })
    })

    // Mock Clerk signup to succeed
    await page.route('**/clerk/**', (route: Route) => route.fulfill({ status: 200, body: '{}' }))

    await page.goto(`/${PROGRAM_SLUG}/enroll`)

    await page.locator('#email').fill('existing@example.com')
    await page.locator('#password').fill('Password123!')
    await page.locator('#firstName').fill('Jane')
    await page.locator('#lastName').fill('Doe')
    await page.getByTestId('consent-checkbox').check()

    await page.getByTestId('enroll-submit').click()

    await expect(page.getByTestId('enrollment-error')).toBeVisible()
    await expect(page.getByTestId('enrollment-error')).toContainText('already enrolled')
  })

  // ---------------------------------------------------------------------------
  // Happy path → welcome screen
  // ---------------------------------------------------------------------------
  test('shows welcome screen after successful enrollment', async ({ page }) => {
    await page.route(`${API}/v1/members/enroll`, (route: Route) => {
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          memberId: 'member-001',
          email: 'newmember@example.com',
          firstName: 'Jane',
          pointsBalance: 0,
          programName: 'Test Rewards',
          enrollmentBonusPending: true,
        }),
      })
    })

    // Mock Clerk signup to succeed
    await page.route('**/clerk/**', (route: Route) => route.fulfill({ status: 200, body: '{}' }))

    await page.goto(`/${PROGRAM_SLUG}/enroll`)

    await page.locator('#email').fill('newmember@example.com')
    await page.locator('#password').fill('Password123!')
    await page.locator('#firstName').fill('Jane')
    await page.locator('#lastName').fill('Doe')
    await page.getByTestId('consent-checkbox').check()

    await page.getByTestId('enroll-submit').click()

    await expect(page.getByTestId('welcome-screen')).toBeVisible()
    await expect(page.getByTestId('go-to-dashboard')).toBeVisible()
  })

  test('"Go to my Dashboard" button navigates to /dashboard', async ({ page }) => {
    await page.route(`${API}/v1/members/enroll`, (route: Route) => {
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          memberId: 'member-001',
          email: 'newmember@example.com',
          firstName: 'Jane',
          pointsBalance: 0,
          programName: 'Test Rewards',
          enrollmentBonusPending: true,
        }),
      })
    })
    await page.route('**/clerk/**', (route: Route) => route.fulfill({ status: 200, body: '{}' }))

    await page.goto(`/${PROGRAM_SLUG}/enroll`)
    await page.locator('#email').fill('newmember@example.com')
    await page.locator('#password').fill('Password123!')
    await page.locator('#firstName').fill('Jane')
    await page.locator('#lastName').fill('Doe')
    await page.getByTestId('consent-checkbox').check()
    await page.getByTestId('enroll-submit').click()

    await expect(page.getByTestId('welcome-screen')).toBeVisible()
    await page.getByTestId('go-to-dashboard').click()

    await expect(page).toHaveURL('/dashboard')
  })

  // ---------------------------------------------------------------------------
  // Invalid slug → 404
  // ---------------------------------------------------------------------------
  test('navigating to an unknown program slug shows 404', async ({ page }) => {
    await page.route(`${API}/v1/public/programs/by-slug/no-such-program`, (route: Route) => {
      route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"not found"}' })
    })

    const response = await page.goto('/no-such-program/enroll')
    expect(response?.status()).toBe(404)
  })

  // ---------------------------------------------------------------------------
  // Responsive: enrollment form visible at required breakpoints (R19 — ≥375px)
  // ---------------------------------------------------------------------------
  test('enrollment form is usable at 375px mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(`/${PROGRAM_SLUG}/enroll`)

    await expect(page.locator('form')).toBeVisible()
    await expect(page.getByTestId('enroll-submit')).toBeVisible()
    await expect(page.getByTestId('consent-checkbox')).toBeVisible()
  })

  test('enrollment form is usable at 768px tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto(`/${PROGRAM_SLUG}/enroll`)

    await expect(page.locator('form')).toBeVisible()
    await expect(page.getByTestId('enroll-submit')).toBeVisible()
  })

  test('enrollment form is usable at 1280px desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(`/${PROGRAM_SLUG}/enroll`)

    await expect(page.locator('form')).toBeVisible()
    await expect(page.getByTestId('enroll-submit')).toBeVisible()
  })
})

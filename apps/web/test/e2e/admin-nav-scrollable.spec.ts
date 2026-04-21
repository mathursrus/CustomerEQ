import { test, expect, type Page, type Route } from '@playwright/test'

/**
 * Issue #155 — Left nav pane must be independently scrollable
 *
 * When the browser viewport height is small (e.g. 600px with DevTools open),
 * the admin sidebar nav should scroll independently so that lower menu items
 * (Knowledge Base, Analytics, Integrations, Developer, Themes) remain reachable.
 *
 * Assertion: the <nav> inside the sidebar has computed overflow-y of "auto" or
 * "scroll", which enables the browser to show a scrollbar when content overflows.
 *
 * All API calls are mocked — no running API server required.
 */

async function mockClerkAuth(page: Page) {
  await page.route('**/clerk.**', (route: Route) => {
    if (route.request().resourceType() === 'document') return route.continue()
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })
  await page.route('**/.well-known/**', (route: Route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })
}

test.describe('Admin left nav — scrollable at small viewport heights', () => {
  test('nav has overflow-y auto so lower items are reachable at 600px viewport height', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 600 })
    await mockClerkAuth(page)

    await page.route('**/v1/**', (route: Route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    })

    await page.goto('/admin/members')

    const nav = page.locator('aside nav').first()
    await expect(nav).toBeVisible()

    const overflowY = await nav.evaluate(
      (el) => window.getComputedStyle(el).overflowY,
    )

    expect(
      ['auto', 'scroll'],
      `Expected nav overflow-y to be "auto" or "scroll" so it scrolls independently, but got "${overflowY}". ` +
        `Add overflow-y-auto (or overflow-y: auto) to the <nav> element in apps/web/src/app/(admin)/layout.tsx.`,
    ).toContain(overflowY)
  })

  test('lower nav items are reachable (scrollable) at 600px viewport height', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 600 })
    await mockClerkAuth(page)

    await page.route('**/v1/**', (route: Route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    })

    await page.goto('/admin/members')

    const developerLink = page.locator('aside').getByRole('link', { name: 'Developer' })
    await expect(developerLink).toBeAttachedToDOM()

    await developerLink.scrollIntoViewIfNeeded()
    await expect(developerLink).toBeVisible()
  })
})

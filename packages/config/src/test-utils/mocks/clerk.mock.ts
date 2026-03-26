import { vi } from 'vitest'

export interface MockClerkAuth {
  brandId: string
  userId: string
  orgId: string
}

/**
 * Returns HTTP headers to use with authenticatedRequest() that simulate
 * a valid Clerk JWT for the given brand and user.
 *
 * In integration tests, the auth plugin reads these headers and resolves
 * the brandId from the mocked Clerk response.
 */
export function mockClerkAuth(brandId: string, userId = 'user_test_123'): Record<string, string> {
  return {
    Authorization: `Bearer test_token_${brandId}`,
    'X-Test-Brand-Id': brandId, // consumed by test auth bypass
    'X-Test-User-Id': userId,
  }
}

/**
 * Mocks the Clerk verifyToken function to return a payload for the given orgId.
 * Use this in unit tests for the auth plugin.
 */
export function mockClerkVerifyToken(orgId: string, userId = 'user_test_123') {
  return vi.fn().mockResolvedValue({
    org_id: orgId,
    sub: userId,
  })
}

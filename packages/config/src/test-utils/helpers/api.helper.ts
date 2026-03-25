import type { FastifyInstance } from 'fastify'
import supertest from 'supertest'

/**
 * Returns a Supertest agent pre-configured with the auth headers for the given brandId.
 * The API's test mode accepts X-Test-Brand-Id instead of a real Clerk JWT.
 */
export function authenticatedRequest(app: FastifyInstance, brandId: string, userId = 'user_test_123') {
  return supertest(app.server).set({
    Authorization: `Bearer test_token_${brandId}`,
    'X-Test-Brand-Id': brandId,
    'X-Test-User-Id': userId,
    'Content-Type': 'application/json',
  })
}

/**
 * Returns a Supertest agent without auth headers (for testing public routes or auth failures).
 */
export function unauthenticatedRequest(app: FastifyInstance) {
  return supertest(app.server).set({
    'Content-Type': 'application/json',
  })
}

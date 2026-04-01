import type { FastifyInstance } from 'fastify'
import supertest from 'supertest'

let _app: FastifyInstance | undefined

export function setTestApp(app: FastifyInstance): void {
  _app = app
}

export function getTestApp(): FastifyInstance {
  if (!_app) throw new Error('Test app not initialized. Call setTestApp(app) in beforeAll().')
  return _app
}

export function authenticatedRequest(app: FastifyInstance | string, brandId?: string, userId = 'user_test_123') {
  if (typeof app === 'string' && brandId === undefined) {
    brandId = app
    app = getTestApp()
  }
  const agent = supertest.agent((app as FastifyInstance).server)
  agent.set('Authorization', `Bearer test_token_${brandId}`)
  agent.set('X-Test-Brand-Id', brandId!)
  agent.set('X-Test-User-Id', userId)
  agent.set('Content-Type', 'application/json')
  return agent
}

export function unauthenticatedRequest(app?: FastifyInstance) {
  app = app ?? getTestApp()
  const agent = supertest.agent(app.server)
  agent.set('Content-Type', 'application/json')
  return agent
}

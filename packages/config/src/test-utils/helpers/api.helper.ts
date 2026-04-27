import { FastifyInstance } from 'fastify'
import supertest from 'supertest'

const GLOBAL_APP_KEY = Symbol.for('customerEQ.test_app')

export function setTestApp(app: FastifyInstance): void {
  console.log(`[DEBUG] setTestApp called in process ${process.pid}`)
  ;(globalThis as any)[GLOBAL_APP_KEY] = app
}

export function getTestApp(): FastifyInstance {
  const app = (globalThis as any)[GLOBAL_APP_KEY]
  if (!app) {
    console.error(`[DEBUG] getTestApp FAILED in process ${process.pid}. globalThis symbols:`, Object.getOwnPropertySymbols(globalThis).map(s => s.toString()))
    throw new Error('Test app not initialized. Call setTestApp(app) in beforeAll().')
  }
  return app
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

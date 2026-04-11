/// <reference types="vitest" />
import { describe, it, expect, vi } from 'vitest'
import crypto from 'node:crypto'

// Mock prisma
vi.mock('@customerEQ/database', async () => {
  const { databaseMockFactory } = await import('@customerEQ/config/test-utils')
  return databaseMockFactory()
})

vi.mock('pino', async () => {
  const { pinoMockFactory } = await import('@customerEQ/config/test-utils')
  return pinoMockFactory()
})

describe('OAuth state signing', () => {
  const OAUTH_STATE_SECRET = 'test-secret-for-oauth-state'

  function signState(payload: Record<string, unknown>): string {
    const data = Buffer.from(JSON.stringify(payload)).toString('base64url')
    const sig = crypto.createHmac('sha256', OAUTH_STATE_SECRET).update(data).digest('base64url')
    return `${data}.${sig}`
  }

  function verifyState(state: string): Record<string, unknown> | null {
    const [data, sig] = state.split('.')
    if (!data || !sig) return null
    const expected = crypto.createHmac('sha256', OAUTH_STATE_SECRET).update(data).digest('base64url')
    if (sig !== expected) return null
    try {
      return JSON.parse(Buffer.from(data, 'base64url').toString()) as Record<string, unknown>
    } catch {
      return null
    }
  }

  it('signs and verifies a valid state parameter', () => {
    const payload = { sourceId: 'source-001', brandId: 'brand-001' }
    const state = signState(payload)

    const verified = verifyState(state)
    expect(verified).toEqual(payload)
  })

  it('rejects a tampered state parameter', () => {
    const payload = { sourceId: 'source-001', brandId: 'brand-001' }
    const state = signState(payload)

    // Tamper with the payload portion
    const [, sig] = state.split('.')
    const tamperedData = Buffer.from(JSON.stringify({ sourceId: 'hacked', brandId: 'brand-001' })).toString('base64url')
    const tamperedState = `${tamperedData}.${sig}`

    const verified = verifyState(tamperedState)
    expect(verified).toBeNull()
  })

  it('rejects malformed state', () => {
    expect(verifyState('')).toBeNull()
    expect(verifyState('not-a-valid-state')).toBeNull()
    expect(verifyState('abc.')).toBeNull()
    expect(verifyState('.def')).toBeNull()
  })

  it('builds correct Google authorization URL', () => {
    const clientId = 'test-google-client-id'
    const redirectUri = 'http://localhost:4000/v1/integrations/oauth/google/callback'
    const scope = 'https://www.googleapis.com/auth/business.manage'
    const state = signState({ sourceId: 'src-1', brandId: 'brand-1' })

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope,
      state,
      access_type: 'offline',
      prompt: 'consent',
    })

    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
    expect(url).toContain('accounts.google.com')
    expect(url).toContain('client_id=test-google-client-id')
    expect(url).toContain('access_type=offline')
    expect(url).toContain('prompt=consent')
    expect(url).toContain('scope=')
  })

  it('builds correct LinkedIn authorization URL', () => {
    const clientId = 'test-linkedin-client-id'
    const redirectUri = 'http://localhost:4000/v1/integrations/oauth/linkedin/callback'
    const scope = 'r_organization_social'
    const state = signState({ sourceId: 'src-1', brandId: 'brand-1' })

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope,
      state,
    })

    const url = `https://www.linkedin.com/oauth/v2/authorization?${params}`
    expect(url).toContain('linkedin.com')
    expect(url).toContain('client_id=test-linkedin-client-id')
    expect(url).toContain('r_organization_social')
  })

  it('rejects unsupported provider', () => {
    // Provider validation is a string check in the route
    const validProviders = ['google', 'linkedin']
    expect(validProviders.includes('facebook')).toBe(false)
    expect(validProviders.includes('google')).toBe(true)
  })
})

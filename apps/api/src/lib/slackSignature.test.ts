import { describe, it, expect } from 'vitest'
import crypto from 'node:crypto'
import { verifySlackSignature } from './slackSignature.js'

function sign(secret: string, timestamp: string, body: string): string {
  return 'v0=' + crypto.createHmac('sha256', secret).update(`v0:${timestamp}:${body}`).digest('hex')
}

describe('verifySlackSignature', () => {
  const secret = 'test_signing_secret_123'
  const body = '{"type":"event_callback","event":{"type":"message","text":"hi"}}'

  it('accepts a valid signature within timestamp tolerance', () => {
    const ts = Math.floor(Date.now() / 1000).toString()
    const sig = sign(secret, ts, body)
    expect(verifySlackSignature({ signingSecret: secret, timestamp: ts, rawBody: body, signature: sig })).toBe(true)
  })

  it('rejects a bad signature', () => {
    const ts = Math.floor(Date.now() / 1000).toString()
    expect(verifySlackSignature({ signingSecret: secret, timestamp: ts, rawBody: body, signature: 'v0=deadbeef' })).toBe(false)
  })

  it('rejects an expired timestamp (> 5 minutes old)', () => {
    const oldTs = Math.floor((Date.now() - 6 * 60 * 1000) / 1000).toString()
    const sig = sign(secret, oldTs, body)
    expect(verifySlackSignature({ signingSecret: secret, timestamp: oldTs, rawBody: body, signature: sig })).toBe(false)
  })

  it('rejects a malformed timestamp', () => {
    const sig = sign(secret, 'not-a-number', body)
    expect(verifySlackSignature({ signingSecret: secret, timestamp: 'not-a-number', rawBody: body, signature: sig })).toBe(false)
  })
})

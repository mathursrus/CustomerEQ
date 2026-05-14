/// <reference types="vitest" />
import { describe, it, expect, beforeEach } from 'vitest'
import crypto from 'node:crypto'
import {
  seedTestDb,
  createBrand,
  createMember,
  createConversation,
  unauthenticatedRequest,
  getTestPrisma,
} from '@customerEQ/config/test-utils'

/** Compute a valid Slack HMAC-SHA256 signature for given timestamp + body. */
function sign(secret: string, timestamp: string, body: string): string {
  return 'v0=' + crypto.createHmac('sha256', secret).update(`v0:${timestamp}:${body}`).digest('hex')
}

describe('POST /v1/webhooks/slack/events', () => {
  beforeEach(async () => {
    await seedTestDb()
  })

  // ─── Test 1: URL verification challenge ──────────────────────────────────
  it('responds to Slack URL verification challenge without signature headers', async () => {
    const payload = { type: 'url_verification', challenge: 'abc123' }
    const req = unauthenticatedRequest()
    const res = await req
      .post('/v1/webhooks/slack/events')
      .send(payload)

    expect(res.status).toBe(200)
    expect(res.body.challenge).toBe('abc123')
  })

  // ─── Test 2: Valid thread-reply event ─────────────────────────────────────
  it('ingests a thread reply as an AGENT message when signature is valid', async () => {
    const signingSecret = 'slack_test_signing_secret_xyz'
    const prisma = getTestPrisma()

    // Create brand with slackSigningSecret
    const brand = await createBrand({ name: 'SlackBrand1' })
    await prisma.brand.update({
      where: { id: brand.id },
      data: { slackSigningSecret: signingSecret },
    })

    const member = await createMember({ brandId: brand.id, email: 'slack1@example.com' })
    const conv = await createConversation({ brandId: brand.id, memberId: member.id, channel: 'SLACK' })

    // Create the seed AGENT message with a slackTs so thread lookup resolves
    const threadTs = '1234567890.123456'
    await prisma.message.create({
      data: {
        conversationId: conv.id,
        role: 'AGENT',
        content: 'original message',
        slackTs: threadTs,
      },
    })

    const payload = JSON.stringify({
      type: 'event_callback',
      event: {
        type: 'message',
        thread_ts: threadTs,
        text: 'reply from agent',
        user: 'U001',
      },
    })
    const ts = Math.floor(Date.now() / 1000).toString()
    const sig = sign(signingSecret, ts, payload)

    const req = unauthenticatedRequest()
    const res = await req
      .post('/v1/webhooks/slack/events')
      .set('Content-Type', 'application/json')
      .set('X-Brand-Id', brand.id)
      .set('X-Slack-Request-Timestamp', ts)
      .set('X-Slack-Signature', sig)
      .send(payload)

    expect(res.status).toBe(200)

    // Assert a new message was created with role=AGENT, correct content + slackTs
    const messages = await prisma.message.findMany({
      where: { conversationId: conv.id, role: 'AGENT' },
      orderBy: { createdAt: 'asc' },
    })
    // Should have 2 messages: the seed + the new inbound one
    expect(messages).toHaveLength(2)
    const inbound = messages[1]
    expect(inbound.content).toBe('reply from agent')
    expect(inbound.slackTs).toBe(threadTs)
    expect(inbound.conversationId).toBe(conv.id)
  })

  // ─── Test 3: Bad signature → 401 ─────────────────────────────────────────
  it('returns 401 for an invalid Slack signature', async () => {
    const signingSecret = 'slack_test_signing_secret_xyz'
    const prisma = getTestPrisma()

    const brand = await createBrand({ name: 'SlackBrand2' })
    await prisma.brand.update({
      where: { id: brand.id },
      data: { slackSigningSecret: signingSecret },
    })

    const ts = Math.floor(Date.now() / 1000).toString()
    const payload = JSON.stringify({ type: 'event_callback', event: { type: 'message', thread_ts: 'x', text: 'hi', user: 'U001' } })

    const req = unauthenticatedRequest()
    const res = await req
      .post('/v1/webhooks/slack/events')
      .set('Content-Type', 'application/json')
      .set('X-Brand-Id', brand.id)
      .set('X-Slack-Request-Timestamp', ts)
      .set('X-Slack-Signature', 'v0=deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef')
      .send(payload)

    expect(res.status).toBe(401)
  })

  // ─── Test 4: Missing Slack signature headers → 401 ───────────────────────
  it('returns 401 when Slack signature headers are missing', async () => {
    const signingSecret = 'slack_test_signing_secret_xyz'
    const prisma = getTestPrisma()

    const brand = await createBrand({ name: 'SlackBrand3' })
    await prisma.brand.update({
      where: { id: brand.id },
      data: { slackSigningSecret: signingSecret },
    })

    const payload = JSON.stringify({ type: 'event_callback', event: { type: 'message', thread_ts: 'x', text: 'hi', user: 'U001' } })

    const req = unauthenticatedRequest()
    const res = await req
      .post('/v1/webhooks/slack/events')
      .set('Content-Type', 'application/json')
      .set('X-Brand-Id', brand.id)
      // Deliberately omit X-Slack-Signature and X-Slack-Request-Timestamp
      .send(payload)

    expect(res.status).toBe(401)
  })

  // ─── Test 5: Missing X-Brand-Id header → 400 ──────────────────────────────
  it('returns 400 when X-Brand-Id header is missing', async () => {
    const ts = Math.floor(Date.now() / 1000).toString()
    const payload = JSON.stringify({ type: 'event_callback', event: { type: 'message', thread_ts: 'x', text: 'hi', user: 'U001' } })
    const sig = sign('any_secret', ts, payload)

    const req = unauthenticatedRequest()
    const res = await req
      .post('/v1/webhooks/slack/events')
      .set('Content-Type', 'application/json')
      .set('X-Slack-Request-Timestamp', ts)
      .set('X-Slack-Signature', sig)
      .send(payload)

    expect(res.status).toBe(400)
  })
})

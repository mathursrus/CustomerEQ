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

  // ─── Test 6: Cross-brand thread injection rejected (C1 regression) ────────
  // Attacker scenario: Brand A controls their own Slack workspace and signing secret.
  // They craft a thread_ts that matches a slackTs belonging to Brand B's conversation,
  // sign the payload with Brand A's own valid signing secret, and POST as Brand A.
  // Without the brandId-scoped lookup, the handler would write the attacker's text
  // into Brand B's conversation. With the fix, the handler must return 403 and not
  // write any message to Brand B.
  it('rejects a thread reply when the parent conversation belongs to a different brand', async () => {
    const prisma = getTestPrisma()

    // Brand A — attacker (has Slack configured)
    const attackerSecret = 'attacker_brand_a_signing_secret'
    const brandA = await createBrand({ name: 'AttackerBrandA' })
    await prisma.brand.update({
      where: { id: brandA.id },
      data: { slackSigningSecret: attackerSecret },
    })

    // Brand B — victim (also has Slack configured; signing secret irrelevant for the attack)
    const brandB = await createBrand({ name: 'VictimBrandB' })
    await prisma.brand.update({
      where: { id: brandB.id },
      data: { slackSigningSecret: 'victim_brand_b_signing_secret' },
    })

    const victimMember = await createMember({ brandId: brandB.id, email: 'victim@example.com' })
    const victimConv = await createConversation({
      brandId: brandB.id,
      memberId: victimMember.id,
      channel: 'SLACK',
    })

    // Seed an AGENT message on Brand B with slackTs = T
    const sharedThreadTs = '9999000000.000001'
    await prisma.message.create({
      data: {
        conversationId: victimConv.id,
        role: 'AGENT',
        content: 'victim original message',
        slackTs: sharedThreadTs,
      },
    })
    const messagesBefore = await prisma.message.count({ where: { conversationId: victimConv.id } })

    // Attacker forges a payload referencing Brand B's thread_ts, but signs with their own secret
    const attackerPayload = JSON.stringify({
      type: 'event_callback',
      event: {
        type: 'message',
        thread_ts: sharedThreadTs,
        text: 'injected by attacker',
        user: 'U_ATTACKER',
      },
    })
    const ts = Math.floor(Date.now() / 1000).toString()
    const sig = sign(attackerSecret, ts, attackerPayload)

    const req = unauthenticatedRequest()
    const res = await req
      .post('/v1/webhooks/slack/events')
      .set('Content-Type', 'application/json')
      .set('X-Brand-Id', brandA.id)
      .set('X-Slack-Request-Timestamp', ts)
      .set('X-Slack-Signature', sig)
      .send(attackerPayload)

    // Must reject — payload signature is valid for brand A but the thread belongs to brand B
    expect(res.status).toBe(403)

    // Brand B's conversation must NOT have been written to
    const messagesAfter = await prisma.message.count({ where: { conversationId: victimConv.id } })
    expect(messagesAfter).toBe(messagesBefore)
    const injected = await prisma.message.findFirst({
      where: { conversationId: victimConv.id, content: 'injected by attacker' },
    })
    expect(injected).toBeNull()
  })
})

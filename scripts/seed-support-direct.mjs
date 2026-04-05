#!/usr/bin/env node
/**
 * Seed support conversations, messages, and rules directly into prod DB.
 * Public HTTP path requires Redis queue for orchestration, which is off in prod.
 */
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { PrismaClient } = require('../node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma/client')

const p = new PrismaClient({
  datasources: { db: { url: 'postgresql://customereq:peHVp0K5plRlGZN9cJi04G8URubH2Wc@customereq-db.postgres.database.azure.com:5432/customereq?sslmode=require' } },
})

const BRAND_ID = '2f33570b-d0dc-467c-a3c3-bfc9f32d99e8'

// ───────── Support Rules ─────
const SUPPORT_RULES = [
  {
    name: 'Billing questions → auto-respond with policy',
    description: 'FAQ about refunds, payment, points expiration routes to KB auto-response',
    status: 'ACTIVE', priority: 10,
    intentFilters: ['billing', 'refund'],
    tierFilters: [],
    topicFilters: [],
    conditions: {},
  },
  {
    name: 'Shipping issues → escalate to Ops Team',
    description: 'Shipping topic routes directly to ops lead regardless of health score',
    status: 'ACTIVE', priority: 20,
    intentFilters: ['shipping'],
    tierFilters: [],
    topicFilters: ['shipping', 'delivery', 'tracking'],
    escalateToAssignee: 'ops-lead@customereq.demo',
    conditions: {},
  },
  {
    name: 'Gold tier unhappy customers → priority escalation',
    description: 'High-value members with low health score bypass queue',
    status: 'ACTIVE', priority: 5,
    intentFilters: [],
    tierFilters: ['Gold', 'Platinum'],
    healthScoreMax: 40,
    topicFilters: [],
    escalateToAssignee: 'vip-support@customereq.demo',
    awardPoints: 500,
    conditions: {},
  },
  {
    name: 'Product questions → award points for engagement',
    description: 'Encourage product-related conversations with 50 pts',
    status: 'ACTIVE', priority: 50,
    intentFilters: ['product_info', 'how_to'],
    tierFilters: [],
    topicFilters: [],
    awardPoints: 50,
    conditions: {},
  },
  {
    name: 'Complaint detected → trigger CSAT follow-up survey',
    description: 'After resolved complaint, send CSAT to measure recovery',
    status: 'PAUSED', priority: 30,
    intentFilters: ['complaint'],
    tierFilters: [],
    topicFilters: [],
    conditions: {},
  },
]

// ───────── Conversation scenarios ─────
const SCENARIOS = [
  {
    intent: 'shipping', confidence: 0.92, topic: 'shipping',
    status: 'RESOLVED', assignee: 'ops-lead@customereq.demo',
    summary: 'Customer package delayed 5 days, Ops reshipped via express.',
    messages: [
      { role: 'CUSTOMER', content: 'My package has been stuck at the carrier for 5 days now. Tracking hasn\'t updated. Order #ORD-88231.' },
      { role: 'AI', content: 'I\'m sorry to hear about the delay. Let me check that order for you. I can see ORD-88231 shipped on March 28th — there does appear to be a carrier issue. I\'m escalating this to our Ops team for immediate action.', metadata: { intentResult: 'shipping', confidence: 0.92, kbArticleIds: [] } },
      { role: 'AGENT', content: 'Hi, Ops team here. I\'ve initiated a reship via express (2-day) at no cost to you. Tracking will arrive in your inbox within the hour. As an apology, I\'ve added 500 Diamond points to your account.' },
      { role: 'CUSTOMER', content: 'Thank you! That\'s a fast turnaround.' },
    ],
  },
  {
    intent: 'billing', confidence: 0.88, topic: 'refund',
    status: 'RESOLVED', assignee: null,
    summary: 'Refund policy question, answered by AI with KB article.',
    messages: [
      { role: 'CUSTOMER', content: 'How long do I have to return a defective product?' },
      { role: 'AI', content: 'Great question! You have 30 days from delivery to return items for a full refund. For defective items specifically, we also cover return shipping. I\'ll send you the full policy details.', metadata: { intentResult: 'billing', confidence: 0.88, kbArticleIds: ['kb-return-policy'] } },
      { role: 'CUSTOMER', content: 'Perfect, thanks!' },
    ],
  },
  {
    intent: 'points', confidence: 0.95, topic: 'loyalty',
    status: 'RESOLVED', assignee: null,
    summary: 'Points not showing after purchase — delayed posting explained.',
    messages: [
      { role: 'CUSTOMER', content: 'I placed an order yesterday but don\'t see my points yet. Is something wrong?' },
      { role: 'AI', content: 'No worries! Points take up to 24 hours to post after a qualifying purchase. Your order from yesterday should appear by tomorrow morning. If you still don\'t see them after 24 hours, reply here and I\'ll dig in.', metadata: { intentResult: 'points', confidence: 0.95 } },
    ],
  },
  {
    intent: 'complaint', confidence: 0.81, topic: 'product quality',
    status: 'ESCALATED', assignee: 'vip-support@customereq.demo',
    summary: 'Gold-tier member unhappy with product quality, escalated for personal follow-up.',
    messages: [
      { role: 'CUSTOMER', content: 'This is my third defective product in 2 months. I\'m a Gold member and this is unacceptable.' },
      { role: 'AI', content: 'I\'m so sorry to hear this — that\'s definitely not the experience we want for you. Given your Gold status and the pattern here, I\'m escalating this directly to our VIP support team for a personal review.', metadata: { intentResult: 'complaint', confidence: 0.81, rulesMatched: ['vip-escalation'] } },
    ],
  },
  {
    intent: 'how_to', confidence: 0.76, topic: 'rewards',
    status: 'ACTIVE', assignee: null,
    summary: 'Customer asking how to redeem points for rewards.',
    messages: [
      { role: 'CUSTOMER', content: 'How do I use my points to get a reward?' },
      { role: 'AI', content: 'You can browse our rewards catalog from your account dashboard. Select a reward, click Redeem, and points are deducted instantly. Digital rewards arrive via email within minutes. What tier of reward are you looking for?', metadata: { intentResult: 'how_to', confidence: 0.76 } },
      { role: 'CUSTOMER', content: 'Something around 500 points for a gift card' },
    ],
  },
  {
    intent: 'login', confidence: 0.89, topic: 'account',
    status: 'CLOSED', assignee: 'support-agent-2@customereq.demo',
    summary: 'Password reset completed.',
    messages: [
      { role: 'CUSTOMER', content: 'I can\'t log into my account. I reset my password twice and it still says invalid.' },
      { role: 'AI', content: 'Let me look into this. Can you confirm the email on your account?', metadata: { intentResult: 'login', confidence: 0.89 } },
      { role: 'CUSTOMER', content: 'Yes, same one I\'m messaging from.' },
      { role: 'AGENT', content: 'Hi, I see the issue — your account had a stale session token. I\'ve cleared it and sent you a fresh password reset link. Please try again and let me know.' },
      { role: 'CUSTOMER', content: 'Worked! Thanks.' },
      { role: 'AGENT', content: 'Glad to hear it. Marking this resolved. Have a great day!' },
    ],
  },
  {
    intent: 'shipping', confidence: 0.94, topic: 'delivery',
    status: 'WAITING_ON_CUSTOMER', assignee: 'ops-lead@customereq.demo',
    summary: 'Asked customer for delivery address confirmation.',
    messages: [
      { role: 'CUSTOMER', content: 'My order was marked delivered but I never got it.' },
      { role: 'AI', content: 'That\'s frustrating — let me help. This sometimes happens when carriers mark early. Can you confirm the shipping address on file is correct, and check with neighbors/porches in case it was dropped off nearby?', metadata: { intentResult: 'shipping', confidence: 0.94 } },
      { role: 'AGENT', content: 'Following up here — if it doesn\'t turn up in 24 hours, we\'ll reship at no cost. Can you confirm the address for our reship file?' },
    ],
  },
  {
    intent: 'feedback', confidence: 0.72, topic: 'general',
    status: 'RESOLVED', assignee: null,
    summary: 'Positive feedback about onboarding.',
    messages: [
      { role: 'CUSTOMER', content: 'Just wanted to say the onboarding flow was really smooth. Great work!' },
      { role: 'AI', content: 'Thank you so much for sharing that! I\'ll pass this along to our product team — they work hard on it. Is there anything else I can help with today?', metadata: { intentResult: 'feedback', confidence: 0.72 } },
      { role: 'CUSTOMER', content: 'Nope, all good!' },
    ],
  },
  {
    intent: 'product_info', confidence: 0.83, topic: 'product',
    status: 'ACTIVE', assignee: null,
    summary: 'Customer asking for product compatibility info.',
    messages: [
      { role: 'CUSTOMER', content: 'Is the Diamond Pro compatible with the Silver model accessories?' },
      { role: 'AI', content: 'Great question! The Diamond Pro is fully compatible with Silver model accessories released after 2024. Older Silver accessories may require the adapter bundle. Do you have a specific accessory in mind?', metadata: { intentResult: 'product_info', confidence: 0.83 } },
    ],
  },
  {
    intent: 'complaint', confidence: 0.91, topic: 'support',
    status: 'ESCALATED', assignee: 'support-manager@customereq.demo',
    summary: 'Customer frustrated with long wait times on phone support.',
    messages: [
      { role: 'CUSTOMER', content: 'I waited 45 minutes on hold yesterday and got disconnected. This is ridiculous.' },
      { role: 'AI', content: 'That is absolutely not the experience we want for you. I\'m escalating this to our Support Manager directly, and adding 200 points to your account as an apology for your time.', metadata: { intentResult: 'complaint', confidence: 0.91, rulesMatched: ['complaint-escalation'] } },
    ],
  },
]

async function main() {
  console.log('💬 Seeding support data...\n')

  // Rules
  console.log('📐 Support rules...')
  let rulesCreated = 0
  for (const r of SUPPORT_RULES) {
    try {
      await p.supportRule.create({ data: { brandId: BRAND_ID, ...r } })
      rulesCreated++
      console.log(`  ✅ ${r.name} (priority ${r.priority}, ${r.status})`)
    } catch (e) {
      console.log(`  ⚠️  ${r.name}: ${e.message.slice(0, 80)}`)
    }
  }

  // Conversations — assign each to a random member
  console.log('\n💬 Conversations + messages...')
  const members = await p.member.findMany({
    where: { brandId: BRAND_ID, deletedAt: null },
    select: { id: true },
    take: 50, orderBy: { createdAt: 'desc' },
  })
  if (members.length === 0) { console.log('  ⚠️  No members'); await p.$disconnect(); return }

  let convCreated = 0, msgCreated = 0
  const now = Date.now()
  for (let i = 0; i < SCENARIOS.length; i++) {
    const s = SCENARIOS[i]
    const member = members[i % members.length]
    // Backdate start: 1-20 days ago
    const ageDays = 1 + Math.floor(Math.random() * 20)
    const startedAt = new Date(now - ageDays * 24 * 60 * 60 * 1000)

    try {
      const conv = await p.conversation.create({
        data: {
          brandId: BRAND_ID,
          memberId: member.id,
          status: s.status,
          intent: s.intent,
          confidence: s.confidence,
          topic: s.topic,
          summary: s.summary,
          assignee: s.assignee,
          rulesMatched: [],
          createdAt: startedAt,
          updatedAt: startedAt,
          escalatedAt: s.status === 'ESCALATED' ? new Date(startedAt.getTime() + 5 * 60 * 1000) : null,
          resolvedAt: s.status === 'RESOLVED' ? new Date(startedAt.getTime() + 30 * 60 * 1000) : null,
          closedAt: s.status === 'CLOSED' ? new Date(startedAt.getTime() + 60 * 60 * 1000) : null,
        },
      })
      convCreated++

      // Create messages sequentially, spaced minutes apart
      for (let j = 0; j < s.messages.length; j++) {
        const m = s.messages[j]
        const msgAt = new Date(startedAt.getTime() + j * (2 + Math.random() * 5) * 60 * 1000)
        await p.message.create({
          data: {
            conversationId: conv.id,
            role: m.role,
            content: m.content,
            metadata: m.metadata ?? null,
            createdAt: msgAt,
          },
        })
        msgCreated++
      }
      console.log(`  ✅ [${s.status}] ${s.intent}/${s.topic} — ${s.messages.length} messages`)
    } catch (e) {
      console.log(`  ⚠️  scenario ${i}: ${e.message.slice(0, 100)}`)
    }
  }

  console.log(`\n✨ Done. Rules: ${rulesCreated}, Conversations: ${convCreated}, Messages: ${msgCreated}`)
  await p.$disconnect()
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })

#!/usr/bin/env node
/**
 * Seed additional demo aspects into prod to round out the story:
 * - Campaigns (variety: draft, scheduled, active, completed, rich action types)
 * - KB articles (FAQ, POLICY, TROUBLESHOOTING, PRODUCT_GUIDE)
 * - Loyalty events (purchase, referral, engagement) to populate balances
 * - Additional alert rules (CSAT, sentiment)
 * - Case transitions (progress some OPEN cases through CONTACTED/RESOLVED/CLOSED)
 *
 * Idempotent where practical. Run: node scripts/seed-demo-aspects.mjs
 */

const API = 'https://customereq-api.salmonsea-4eb14bdc.eastus.azurecontainerapps.io'
const API_KEY = process.env.MCP_API_KEY || 'ceq_c3697a733b642e66a36a0230a91392c0b87417a2362fd924e6fece60ad8b71ec'
const DIAMOND_PROGRAM_ID = 'cmn9kiqjs000110d1p5ikp3kr'

const headers = { 'Content-Type': 'application/json', 'X-Api-Key': API_KEY }

async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const text = await res.text()
  let data; try { data = JSON.parse(text) } catch { data = text }
  if (!res.ok) return { error: true, status: res.status, data }
  return data
}

const iso = (d) => new Date(d).toISOString()
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d }
const daysFromNow = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d }

// ───────── Campaigns ─────────────────────────────────────────────────────────
async function seedCampaigns() {
  console.log('\n📣 Seeding campaigns...')
  const defs = [
    {
      name: 'Welcome Bonus — New Members',
      triggerType: 'member.enrolled',
      actionType: 'award_points',
      actionConfig: { points: 100 },
      startDate: iso(daysAgo(60)), endDate: iso(daysFromNow(365)),
      activate: true,
    },
    {
      name: 'Birthday Surprise',
      triggerType: 'member.birthday',
      actionType: 'send_message',
      actionConfig: { message: '🎂 Happy Birthday! Enjoy 500 bonus points today only.' },
      startDate: iso(daysAgo(30)), endDate: iso(daysFromNow(365)),
      activate: true,
    },
    {
      name: 'Refer-a-Friend — Double Points',
      triggerType: 'event',
      triggerCondition: { field: 'eventType', op: 'eq', value: 'member.referred' },
      actionType: 'award_points',
      actionConfig: { points: 200 },
      budgetCap: 50000,
      startDate: iso(daysAgo(14)), endDate: iso(daysFromNow(45)),
      activate: true,
    },
    {
      name: 'Spring Spin Wheel',
      triggerType: 'event',
      triggerCondition: { field: 'eventType', op: 'eq', value: 'purchase.completed' },
      actionType: 'spin_wheel',
      actionConfig: {
        wheelStyle: 'neon',
        segments: [
          { label: '50 pts', points: 50, probability: 40, color: '#4F46E5' },
          { label: '100 pts', points: 100, probability: 25, color: '#10B981' },
          { label: '250 pts', points: 250, probability: 15, color: '#F59E0B' },
          { label: '500 pts', points: 500, probability: 10, color: '#EF4444' },
          { label: '1000 pts', points: 1000, probability: 5, color: '#EC4899' },
          { label: 'Try again', points: 1, probability: 5, color: '#6B7280' },
        ],
      },
      startDate: iso(daysAgo(7)), endDate: iso(daysFromNow(60)),
      activate: true,
    },
    {
      name: 'Holiday Scratch Card',
      triggerType: 'event',
      triggerCondition: { field: 'orderValue', op: 'gte', value: 50 },
      actionType: 'scratch_card',
      actionConfig: {
        cardStyle: 'holiday',
        scratchText: 'Scratch for holiday cheer!',
        prizes: [
          { label: '25 pts', points: 25, probability: 50 },
          { label: '100 pts', points: 100, probability: 30 },
          { label: '500 pts', points: 500, probability: 15 },
          { label: '1 Free Month', points: 2000, probability: 5 },
        ],
      },
      startDate: iso(daysFromNow(14)), endDate: iso(daysFromNow(60)),
      activate: false, // stays DRAFT (scheduled)
    },
    {
      name: 'Q1 Win-Back — Dormant Members',
      triggerType: 'member.inactive_60_days',
      actionType: 'award_points',
      actionConfig: { points: 300 },
      startDate: iso(daysAgo(120)), endDate: iso(daysAgo(30)), // completed
      activate: false,
      completed: true,
    },
    {
      name: 'Mystery Box — VIP Tier',
      triggerType: 'event',
      triggerCondition: { field: 'tier', op: 'eq', value: 'gold' },
      actionType: 'mystery_box',
      actionConfig: {
        boxStyle: 'treasure',
        prizes: [
          { label: '200 pts', points: 200, probability: 60 },
          { label: '1000 pts', points: 1000, probability: 25 },
          { label: '$10 gift card', points: 1000, probability: 10 },
          { label: 'Jackpot 5000 pts', points: 5000, probability: 5 },
        ],
      },
      startDate: iso(daysAgo(5)), endDate: iso(daysFromNow(90)),
      activate: true,
    },
  ]

  let created = 0, skipped = 0
  for (const d of defs) {
    const result = await api('POST', '/v1/campaigns', {
      programId: DIAMOND_PROGRAM_ID,
      name: d.name,
      triggerType: d.triggerType,
      triggerCondition: d.triggerCondition,
      actionType: d.actionType,
      actionConfig: d.actionConfig,
      budgetCap: d.budgetCap,
      startDate: d.startDate,
      endDate: d.endDate,
    })
    if (result.error) { console.log(`  ⚠️  ${d.name}: ${result.status} ${JSON.stringify(result.data).slice(0, 120)}`); skipped++; continue }
    created++
    if (d.activate) {
      await api('PATCH', `/v1/campaigns/${result.id}/status`, { status: 'ACTIVE' })
    } else if (d.completed) {
      await api('PATCH', `/v1/campaigns/${result.id}/status`, { status: 'COMPLETED' })
    }
    console.log(`  ✅ ${d.name} (${d.actionType})`)
  }
  console.log(`  Campaigns: ${created} created, ${skipped} skipped`)
}

// ───────── KB Articles ───────────────────────────────────────────────────────
async function seedKBArticles() {
  console.log('\n📚 Seeding KB articles...')
  const articles = [
    // FAQ
    { category: 'FAQ', title: 'How do I earn Diamond points?', body: 'You earn Diamond points on every qualifying purchase, by completing surveys, referring friends, and engaging with promotions. Points are awarded automatically and visible in your account within 24 hours.', tags: ['points', 'earning', 'loyalty'] },
    { category: 'FAQ', title: 'When do my points expire?', body: 'Diamond points expire 18 months after the date earned. You can see upcoming expirations in your account dashboard. Active members (1+ purchase in the last 12 months) get a 6-month extension automatically.', tags: ['points', 'expiration', 'policy'] },
    { category: 'FAQ', title: 'How do I redeem points for rewards?', body: 'Browse the rewards catalog in your account, select a reward, and click Redeem. Points are deducted instantly, and digital rewards arrive via email within minutes. Physical rewards ship within 5-7 business days.', tags: ['redemption', 'rewards'] },
    { category: 'FAQ', title: 'Can I combine points with a friend?', body: 'Point pooling is not currently supported. Each member account maintains its own balance. However, you can gift specific rewards to friends after redeeming them.', tags: ['points', 'gifting'] },

    // POLICY
    { category: 'POLICY', title: 'Return & Refund Policy', body: 'Products may be returned within 30 days of delivery for a full refund. Items must be unused and in original packaging. Points earned on returned items will be deducted from your balance. Shipping costs are non-refundable except for defective items.', tags: ['returns', 'refunds', 'policy'] },
    { category: 'POLICY', title: 'Privacy & Data Use Policy', body: 'We collect data to personalize your experience and improve our services. You can export or delete your data at any time from Account Settings. We never sell your data to third parties. Full policy: see legal/privacy.', tags: ['privacy', 'gdpr', 'data'] },
    { category: 'POLICY', title: 'Shipping Policy', body: 'Standard shipping (5-7 business days) is free on orders over $50. Express shipping (2-3 days) is $9.99. International shipping available to 40+ countries; customs duties may apply. Orders ship Mon-Fri from our US warehouse.', tags: ['shipping', 'delivery', 'policy'] },

    // TROUBLESHOOTING
    { category: 'TROUBLESHOOTING', title: 'My points are not showing up', body: 'Points can take up to 24 hours to post after a qualifying action. If you still do not see them after 24 hours: 1) Check your purchase history is linked to your loyalty account, 2) Verify the purchase was above any minimum threshold, 3) Contact support with your order number.', tags: ['points', 'missing', 'support'] },
    { category: 'TROUBLESHOOTING', title: 'I cannot log into my account', body: 'If you forgot your password, use the Reset Password link. If you see "account locked", wait 15 minutes and try again. If issues persist, contact support with your email address. We will verify and restore access within 4 business hours.', tags: ['login', 'password', 'account'] },
    { category: 'TROUBLESHOOTING', title: 'My package did not arrive', body: 'First, check the tracking link in your shipping email. If it shows delivered but you did not receive it, wait 48 hours (carriers sometimes mark early). Then contact support with your order number. We will file a claim and either reship or refund.', tags: ['shipping', 'lost', 'delivery'] },
    { category: 'TROUBLESHOOTING', title: 'Reward code is not working at checkout', body: 'Ensure you copied the full code without spaces. Codes are case-sensitive. Each code is single-use and expires 90 days from issue. If still failing, refresh the page, clear cart, and try again. Contact support if the problem persists.', tags: ['rewards', 'redemption', 'checkout'] },

    // PRODUCT_GUIDE
    { category: 'PRODUCT_GUIDE', title: 'Getting Started with Diamond Loyalty', body: 'Welcome! Here is how to get started: 1) Complete your profile (earns 50 pts), 2) Link your email for offers, 3) Make your first purchase (earns base points + welcome bonus), 4) Complete the welcome survey (earns 100 pts). You are on your way to Gold tier.', tags: ['onboarding', 'getting-started'] },
    { category: 'PRODUCT_GUIDE', title: 'Understanding Loyalty Tiers', body: 'We offer 3 tiers: Silver (0-999 pts), Gold (1,000-4,999 pts), Platinum (5,000+ pts). Each tier unlocks better rewards, early access to sales, and exclusive events. Tier status is reviewed monthly based on last 12 months activity.', tags: ['tiers', 'status', 'benefits'] },

    // PROCESS
    { category: 'PROCESS', title: 'How to escalate a support case', body: 'If your case has been open for more than 48 hours without resolution, reply to your case email with "ESCALATE" in the subject. A senior agent will review within 4 business hours. For urgent billing or security issues, call our priority line.', tags: ['support', 'escalation'] },
  ]

  let created = 0, failed = 0
  for (const a of articles) {
    const result = await api('POST', '/v1/kb/articles', { ...a, status: 'PUBLISHED' })
    if (result.error) { console.log(`  ⚠️  ${a.title}: ${result.status}`); failed++; continue }
    created++
    process.stdout.write(`  ✅ ${a.category}: ${a.title}\n`)
  }
  console.log(`  KB: ${created} created, ${failed} failed`)
}

// ───────── Loyalty events ───────────────────────────────────────────────────
async function seedEvents() {
  console.log('\n💎 Seeding loyalty events...')
  // Get list of members
  const memRes = await api('GET', '/v1/members?pageSize=50')
  const members = memRes.data || []
  if (members.length === 0) { console.log('  ⚠️  No members'); return }

  const eventTypes = [
    { type: 'purchase.completed', payloadFn: () => ({ orderId: `ord_${Math.random().toString(36).slice(2, 10)}`, orderValue: 20 + Math.floor(Math.random() * 200), items: 1 + Math.floor(Math.random() * 4) }) },
    { type: 'member.referred', payloadFn: () => ({ referredEmail: `friend${Math.floor(Math.random() * 1000)}@example.com` }) },
    { type: 'app.engagement', payloadFn: () => ({ action: ['login', 'browse', 'wishlist_add', 'review_posted'][Math.floor(Math.random() * 4)] }) },
    { type: 'reward.redeemed', payloadFn: () => ({ rewardName: ['$5 off', '$10 off', 'Free shipping', 'Double points weekend'][Math.floor(Math.random() * 4)], pointsSpent: [500, 1000, 250, 750][Math.floor(Math.random() * 4)] }) },
  ]

  let sent = 0, failed = 0
  // 120 events across ~40 members
  for (let i = 0; i < 120; i++) {
    const m = members[i % Math.min(members.length, 40)]
    const et = eventTypes[i % eventTypes.length]
    const r = await api('POST', '/v1/events', { eventType: et.type, memberId: m.id, payload: et.payloadFn() })
    if (r.error) failed++
    else sent++
    if (i % 30 === 29) process.stdout.write(`  ${i + 1}/120 (${sent} ok, ${failed} fail)\n`)
  }
  console.log(`  Events: ${sent} sent, ${failed} failed`)
}

// ───────── Additional alert rules ───────────────────────────────────────────
async function seedAlertRules() {
  console.log('\n🚨 Seeding alert rules...')
  const rules = [
    {
      name: 'CSAT Low-Score Alert',
      surveyTypes: ['CSAT'],
      scoreMin: 1, scoreMax: 2,
      sentimentThreshold: null,
      topicFilters: [],
      emailRecipients: ['cx-team@customereq.demo', 'support-lead@customereq.demo'],
      defaultAssignee: 'Support Manager',
      slaHours: 24,
      priority: 'HIGH',
    },
    {
      name: 'Negative Sentiment Anywhere',
      surveyTypes: ['NPS', 'CSAT', 'CES', 'CUSTOM'],
      sentimentThreshold: -0.3,
      topicFilters: [],
      emailRecipients: ['cx-team@customereq.demo'],
      defaultAssignee: 'Sarah K. (CX Lead)',
      slaHours: 48,
      priority: 'MEDIUM',
    },
    {
      name: 'Shipping Complaints — Urgent',
      surveyTypes: ['NPS', 'CSAT'],
      scoreMin: 0, scoreMax: 4,
      topicFilters: ['shipping', 'delivery'],
      emailRecipients: ['ops-lead@customereq.demo'],
      defaultAssignee: 'Ops Team',
      slaHours: 12,
      priority: 'CRITICAL',
    },
  ]
  let created = 0, failed = 0
  for (const r of rules) {
    const result = await api('POST', '/v1/alert-rules', r)
    if (result.error) { console.log(`  ⚠️  ${r.name}: ${result.status} ${JSON.stringify(result.data).slice(0, 120)}`); failed++; continue }
    created++
    console.log(`  ✅ ${r.name} (${r.priority})`)
  }
  console.log(`  Alert rules: ${created} created, ${failed} failed`)
}

// ───────── Case transitions ─────────────────────────────────────────────────
async function transitionCases() {
  console.log('\n📋 Transitioning cases through lifecycle...')
  const res = await api('GET', '/v1/cases?status=OPEN&pageSize=100')
  const cases = res.cases || res.data || []
  if (cases.length === 0) { console.log('  ⚠️  No OPEN cases'); return }

  // Take first 60 cases: 15 → CONTACTED, 15 → RESOLVED (via CONTACTED), 15 → CLOSED, 15 leave OPEN
  const shuffled = [...cases].sort(() => Math.random() - 0.5)
  const batches = [
    { status: 'CONTACTED', count: 15, note: 'Reached out via email with resolution steps' },
    { status: 'RESOLVED', count: 15, note: 'Customer confirmed issue fixed — offered 200 point goodwill' },
    { status: 'CLOSED', count: 15, note: 'Case resolved, customer satisfied' },
  ]

  let ops = 0, failed = 0
  let idx = 0
  for (const b of batches) {
    for (let i = 0; i < b.count && idx < shuffled.length; i++, idx++) {
      const c = shuffled[idx]
      // For RESOLVED/CLOSED, first CONTACT, then set final state
      if (b.status === 'RESOLVED' || b.status === 'CLOSED') {
        await api('PATCH', `/v1/cases/${c.id}/status`, { status: 'CONTACTED' })
      }
      const r = await api('PATCH', `/v1/cases/${c.id}/status`, { status: b.status })
      if (r.error) { failed++; continue }
      await api('POST', `/v1/cases/${c.id}/notes`, { text: b.note, author: 'Sarah K. (CX Lead)' })
      ops++
    }
    console.log(`  ✅ ${b.count} cases → ${b.status}`)
  }
  console.log(`  Case transitions: ${ops} done, ${failed} failed`)
}

// ───────── Analytics backfills ──────────────────────────────────────────────
async function triggerAnalytics() {
  console.log('\n📊 Triggering analytics backfills...')
  const endpoints = [
    { m: 'POST', p: '/v1/analytics/cx/backfill-sentiment?limit=1000&force=true', label: 'sentiment (pass 1)' },
    { m: 'POST', p: '/v1/analytics/cx/backfill-sentiment?limit=1000&force=true', label: 'sentiment (pass 2)' },
    { m: 'POST', p: '/v1/analytics/cx/clustering/trigger', label: 'clustering' },
    { m: 'POST', p: '/v1/analytics/cx/backfill-snapshots?days=30', label: 'snapshots' },
  ]
  for (const e of endpoints) {
    const r = await api(e.m, e.p)
    console.log(`  ${r.error ? '⚠️' : '✅'} ${e.label}: ${r.error ? r.status : 'ok'}`)
  }
}

// ───────── Main ─────────────────────────────────────────────────────────────
async function main() {
  console.log('🚀 Seeding demo aspects into PROD')
  console.log(`   Target: ${API}\n`)
  const args = process.argv.slice(2)
  const only = args.length ? new Set(args) : null
  const run = (name, fn) => (!only || only.has(name)) ? fn() : Promise.resolve()
  await run('campaigns', seedCampaigns)
  await run('kb', seedKBArticles)
  await run('events', seedEvents)
  await run('alerts', seedAlertRules)
  await run('cases', transitionCases)
  await run('analytics', triggerAnalytics)
  console.log('\n✨ Done')
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })

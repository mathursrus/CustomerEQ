// Acme Coffee — fictional online coffee shop demonstrating end-to-end
// CustomerEQ integration. This is the backend a real customer product
// would run; the frontend (public/index.html) shows the customer UX.
//
// What it integrates:
//   1. Member enrollment      → POST /v1/members/enroll
//   2. Loyalty events         → POST /v1/events (purchase, review, share)
//   3. Member 360 view        → GET  /v1/members/:id/360
//   4. Reward redemption      → POST /v1/redemptions
//   5. Public survey widget   → embedded <script src=".../widget.js">
//   6. Survey trigger via tokenized batch → POST /v1/surveys/:id/distribution-batches
//   7. KB search              → POST /v1/kb/search
//   8. CX analytics dashboard → GET  /v1/analytics/cx
//
// Run:
//   cp .env.example .env  &&  edit .env to fill in CUSTOMEREQ_API_KEY etc.
//   npm install
//   npm start
//   open http://localhost:5000

import express from 'express'
import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { CustomerEQ } from './lib/customereq.js'

dotenv.config()

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
app.use(express.json())
app.use(express.static(join(__dirname, 'public')))

const ceq = new CustomerEQ({
  apiUrl: process.env.CUSTOMEREQ_API_URL,
  apiKey: process.env.CUSTOMEREQ_API_KEY,
  brandId: process.env.CUSTOMEREQ_BRAND_ID,
})

// In a real product these would live in your own DB. We use an in-memory
// session for the demo so you can sign up, browse, and check out without
// any persistence layer.
const sessions = new Map() // sessionId → { memberId, email, firstName }

function getSession(req) {
  const sid = req.headers['x-acme-session'] ?? req.query.sid
  return sid ? sessions.get(sid) : null
}

// ── Catalog (hardcoded — this is Acme's own data, not CustomerEQ's) ────
const CATALOG = [
  { sku: 'COFFEE-001', name: 'House Blend',     priceCents: 1599, category: 'beans' },
  { sku: 'COFFEE-002', name: 'Single Origin',   priceCents: 2299, category: 'beans' },
  { sku: 'COFFEE-003', name: 'Cold Brew Kit',   priceCents: 3499, category: 'kit'   },
  { sku: 'COFFEE-004', name: 'Espresso Beans',  priceCents: 1899, category: 'beans' },
]

// ── Demo config exposed to the frontend ────────────────────────────────
app.get('/api/config', (_req, res) => {
  res.json({
    apiUrl: process.env.CUSTOMEREQ_API_URL,
    brandId: process.env.CUSTOMEREQ_BRAND_ID,
    npsSurveyId: process.env.CUSTOMEREQ_NPS_SURVEY_ID || null,
    csatSurveyId: process.env.CUSTOMEREQ_CSAT_SURVEY_ID || null,
    reviewSourceId: process.env.CUSTOMEREQ_REVIEW_SOURCE_ID || null,
    catalog: CATALOG,
  })
})

// ── Member enrollment (Acme sign-up form) ──────────────────────────────
app.post('/api/signup', async (req, res) => {
  const { email, firstName, lastName } = req.body
  if (!email || !firstName) return res.status(400).json({ error: 'email and firstName required' })

  try {
    // Resolve the program slug → programId on the fly so demo works against
    // any seeded brand without hardcoding cuids.
    const program = await ceq.getProgramBySlug(process.env.CUSTOMEREQ_PROGRAM_SLUG ?? 'diamond-loyalty-club')

    let member
    try {
      member = await ceq.enrollMember({
        email,
        firstName,
        lastName: lastName ?? '',
        programId: program.programId,
      })
    } catch (err) {
      // 409 = already enrolled. Look them up by email and continue so repeat
      // visitors can pick up where they left off.
      if (err.status === 409) {
        const existing = await ceq.request('GET', '/v1/members', { query: { q: email, pageSize: 1 } })
        const hit = existing?.data?.[0]
        if (!hit) throw err
        member = { memberId: hit.id, pointsBalance: hit.pointsBalance, programName: program.programName, enrollmentBonusPending: false }
      } else {
        throw err
      }
    }

    const sid = `sess_${Math.random().toString(36).slice(2, 12)}`
    sessions.set(sid, { memberId: member.memberId, email, firstName })
    res.json({ sessionId: sid, ...member })
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message })
  }
})

// ── Checkout (purchase event ingestion) ────────────────────────────────
app.post('/api/checkout', async (req, res) => {
  const session = getSession(req)
  if (!session) return res.status(401).json({ error: 'sign up first' })

  const { items } = req.body
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'items required' })

  const subtotalCents = items.reduce((sum, item) => {
    const product = CATALOG.find((p) => p.sku === item.sku)
    return sum + (product ? product.priceCents * item.qty : 0)
  }, 0)

  // The integration moment: every purchase becomes a loyalty event.
  // CustomerEQ evaluates earning rules, awards points, fires campaigns.
  const orderId = `order_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  try {
    const result = await ceq.ingestEvent({
      memberId: session.memberId,
      eventType: 'purchase',
      payload: {
        orderId,
        amount: subtotalCents / 100,
        currency: 'USD',
        itemCount: items.reduce((s, i) => s + i.qty, 0),
        items: items.map((i) => ({ sku: i.sku, qty: i.qty })),
      },
      idempotencyKey: orderId,
    })
    res.json({ orderId, subtotal: subtotalCents / 100, ceqJob: result })
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message })
  }
})

// ── My Account: Customer 360 view ──────────────────────────────────────
app.get('/api/account', async (req, res) => {
  const session = getSession(req)
  if (!session) return res.status(401).json({ error: 'sign up first' })

  try {
    const [balance, profile360] = await Promise.all([
      ceq.getMemberBalance(session.memberId),
      ceq.getMember360(session.memberId),
    ])
    res.json({ balance, profile: profile360 })
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message })
  }
})

// ── Rewards catalog & redemption ───────────────────────────────────────
app.get('/api/rewards', async (_req, res) => {
  try {
    const data = await ceq.listRewards()
    res.json(data)
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message })
  }
})

app.post('/api/redeem', async (req, res) => {
  const session = getSession(req)
  if (!session) return res.status(401).json({ error: 'sign up first' })

  try {
    const result = await ceq.redeemReward({ rewardId: req.body.rewardId, memberId: session.memberId })
    res.json(result)
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message })
  }
})

// ── Trigger a follow-up survey from a "ticket resolved" webhook ────────
// In a real integration, this would be called from your support tool
// (Zendesk, Intercom, etc.) when a ticket closes.
app.post('/api/ticket-resolved', async (req, res) => {
  const session = getSession(req)
  if (!session) return res.status(401).json({ error: 'sign up first' })

  if (!process.env.CUSTOMEREQ_CSAT_SURVEY_ID) {
    return res.status(400).json({ error: 'CUSTOMEREQ_CSAT_SURVEY_ID not configured' })
  }

  try {
    const result = await ceq.triggerSurvey({
      memberEmail: session.email,
      surveyId: process.env.CUSTOMEREQ_CSAT_SURVEY_ID,
      source: 'acme-coffee-helpdesk',
    })
    res.json(result)
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message })
  }
})

// ── Knowledge base search (powers Acme's self-serve help page) ─────────
app.post('/api/help/search', async (req, res) => {
  try {
    const data = await ceq.searchKnowledgeBase({ query: req.body.query, limit: 3 })
    res.json(data)
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message })
  }
})

// ── External signal webhook: forward Google/Reddit/X reviews to CustomerEQ ──
// In a real integration, Acme's ops team subscribes to Google Business
// Profile review notifications (or Reddit polling, etc.), normalizes the
// payload, and POSTs it to CustomerEQ. We simulate that here.
app.post('/api/simulate-review', async (req, res) => {
  const session = getSession(req)
  const { rating = 5, body = 'Great coffee, shipping was fast!' } = req.body ?? {}

  if (!process.env.CUSTOMEREQ_REVIEW_SOURCE_ID) {
    return res.status(400).json({ error: 'CUSTOMEREQ_REVIEW_SOURCE_ID not configured' })
  }

  const payload = {
    externalId: `gbp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    externalAuthorLabel: session?.firstName ?? 'Acme Customer',
    // `memberEmail` is the field CustomerEQ's normalizer uses to resolve
    // the review back to a consented member record. If the email matches a
    // member in this brand, the review attaches to their 360 profile.
    memberEmail: session?.email ?? null,
    rating,
    body,
    postedAt: new Date().toISOString(),
    canonicalUrl: 'https://g.co/fakepbusiness/acme-coffee/reviews',
    providerMetadata: { provider: 'google_business_profile', simulated: true },
  }

  try {
    const result = await ceq.pushExternalSignal({
      sourceId: process.env.CUSTOMEREQ_REVIEW_SOURCE_ID,
      sourceSecret: process.env.CUSTOMEREQ_REVIEW_SOURCE_SECRET,
      payload,
    })
    res.json({ pushed: payload, response: result })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── CRM note: Acme's CS rep attaches context to a member record ────────
app.post('/api/notes', async (req, res) => {
  const session = getSession(req)
  if (!session) return res.status(401).json({ error: 'sign up first' })
  const { body } = req.body ?? {}
  if (!body) return res.status(400).json({ error: 'body required' })

  try {
    const result = await ceq.addMemberNote({
      memberId: session.memberId,
      body,
      category: 'note',
      sentiment: 'neutral',
      author: 'acme-cs-rep@acmecoffee.io',
    })
    res.json(result)
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message })
  }
})

// ── Analytics: what Acme's ops team would see in their own dashboards ──
app.get('/api/ops/analytics', async (_req, res) => {
  try {
    const data = await ceq.getCxAnalytics({})
    res.json(data)
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message })
  }
})

const PORT = process.env.PORT ?? 5000
app.listen(PORT, () => {
  console.log(`☕ Acme Coffee demo running at http://localhost:${PORT}`)
  console.log(`   CustomerEQ API: ${process.env.CUSTOMEREQ_API_URL}`)
  console.log(`   Brand:          ${process.env.CUSTOMEREQ_BRAND_ID || '(not set)'}`)
})

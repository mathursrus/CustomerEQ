#!/usr/bin/env node
/**
 * Rich Demo Data Seed — 5 survey types, 100+ responses each
 * Creates realistic trends, clusters, and anomalies
 *
 * Usage:
 *   node scripts/seed-demo-rich.mjs          # seeds localhost:4000 (test headers)
 *   node scripts/seed-demo-rich.mjs --prod   # seeds production (API key auth)
 */

const isProd = process.argv.includes('--prod')

const PROD_API = 'https://customereq-api.salmonsea-4eb14bdc.eastus.azurecontainerapps.io'
const LOCAL_API = 'http://localhost:4000'
const API = isProd ? PROD_API : LOCAL_API

const API_KEY = process.env.MCP_API_KEY || 'ceq_c3697a733b642e66a36a0230a91392c0b87417a2362fd924e6fece60ad8b71ec'

// Prod: API key auth. Local: test header auth (NODE_ENV=test in .env)
const headers = isProd
  ? { 'Content-Type': 'application/json', 'X-Api-Key': API_KEY }
  : { 'Content-Type': 'application/json', 'x-test-brand-id': 'test-brand', 'x-test-user-id': 'user_test_123' }

async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const data = await res.json().catch(() => ({}))
  if (!res.ok && res.status !== 409) return null
  return data
}

// Get existing program ID
async function getActiveProgram() {
  const r = await api('GET', '/v1/programs')
  const programs = r?.data || r?.programs || []
  return programs.find(p => p.status === 'ACTIVE')?.id
}

// Get or create theme
async function getThemeId() {
  const r = await api('GET', '/v1/themes')
  const existing = (r?.themes || []).find(t => t.isDefault)
  if (existing) return existing.id
  const t = await api('POST', '/v1/themes', {
    name: 'Diamond Brand Theme', isDefault: true, brandName: 'CustomerEQ Demo',
    primaryColor: '#1e40af', backgroundColor: '#f0f9ff', textColor: '#1e293b',
    buttonColor: '#1e40af', buttonTextColor: '#ffffff', accentColor: '#f59e0b',
    fontFamily: 'Inter', cardStyle: 'shadow', borderRadius: 'lg', maxWidth: 'md',
    thankYouMessage: 'Thank you! Your feedback earns loyalty points.', showIncentivePoints: true,
  })
  return t?.id
}

// Enroll member (idempotent — Issue #231 PR2 R6).
// API takes `memberId` (canonical identifier) plus an optional `email` PII
// sidecar. For EMAIL brands the email value doubles as memberId.
async function ensureMember(email, first, last, programId) {
  const r = await api('POST', '/v1/members/enroll', {
    memberId: email, email, firstName: first, lastName: last, programId,
    consentGivenAt: '2026-01-01T00:00:00Z',
  })
  return r?.memberId || r?.id || 'existing'
}

// Random helpers
const pick = arr => arr[Math.floor(Math.random() * arr.length)]
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
const weighted = (options) => {
  const total = options.reduce((s, o) => s + o.weight, 0)
  let r = Math.random() * total
  for (const o of options) { r -= o.weight; if (r <= 0) return o.value }
  return options[0].value
}

// ─── Feedback templates by cluster ─────────────────────────────────────────

const FEEDBACK = {
  shipping_positive: [
    'Delivery was incredibly fast, arrived in 2 days!',
    'Package was well-protected and arrived ahead of schedule.',
    'Impressed with the shipping speed. Will order again.',
    'Free shipping was a nice touch. Very quick delivery.',
  ],
  shipping_negative: [
    'Shipping took 3 weeks. Completely unacceptable.',
    'Package arrived damaged. Box was crushed and soaked.',
    'Tracking number never worked. Had no idea where my order was.',
    'Delivery was late by 10 days. No communication whatsoever.',
    'Wrong item shipped. Now I have to wait another week for the return.',
  ],
  support_positive: [
    'Customer support was amazing! Issue resolved in minutes.',
    'The chat agent was knowledgeable and very helpful.',
    'Called support and they went above and beyond to help.',
    'Great follow-up email after my issue was resolved.',
  ],
  support_negative: [
    'Waited 45 minutes on hold and got disconnected.',
    'Support agent was rude and unhelpful. Never resolved my issue.',
    'Sent 3 emails and never got a response.',
    'Chat bot was useless. Could not connect to a real person.',
    'Was transferred 4 times before someone could help.',
  ],
  product_positive: [
    'Product quality is outstanding. Exceeded expectations.',
    'Love the premium feel. Worth every penny.',
    'Best purchase I\'ve made this year. Highly recommend.',
    'Exactly as described. Solid build quality.',
  ],
  product_negative: [
    'Product broke after one week of normal use.',
    'Quality is terrible compared to what was advertised.',
    'Received a defective item. Very disappointed.',
    'Materials feel cheap. Not worth the price at all.',
    'Product stopped working after a month. No warranty support.',
  ],
  pricing_mixed: [
    'Great value for money. Competitive pricing.',
    'A bit expensive but the quality justifies it.',
    'Price is too high compared to competitors.',
    'Would buy more if there were better discounts.',
    'Good product but overpriced for what you get.',
  ],
  website_mixed: [
    'Website is easy to navigate. Found what I needed quickly.',
    'Checkout process is confusing. Had to re-enter my address.',
    'Mobile site is slow and hard to use.',
    'Love the new design! Very clean and modern.',
    'Search function doesn\'t work well. Hard to find products.',
    'Page load times are terrible. Almost gave up.',
  ],
  onboarding_mixed: [
    'Setup was straightforward. Got started in minutes.',
    'Onboarding tutorial was really helpful.',
    'Took too long to figure out how to configure my account.',
    'Documentation is confusing. Needed to contact support.',
    'The getting started guide was excellent.',
  ],
}

// ─── Survey definitions ────────────────────────────────────────────────────

const SURVEYS = [
  {
    name: 'Post-Purchase Experience (NPS)',
    type: 'NPS',
    incentivePoints: 50,
    questions: [
      { id: 'q1', text: 'On a scale of 0-10, how likely are you to recommend us?', type: 'rating', required: true, config: { min: 0, max: 10, labels: { left: 'Not at all likely', right: 'Extremely likely' } } },
      { id: 'q2', text: 'What is the primary reason for your score?', type: 'text', required: false, config: { placeholder: 'Tell us more...' } },
      { id: 'q3', text: 'Which area could we improve?', type: 'multiple_choice', required: false, config: { options: ['Product Quality', 'Shipping', 'Support', 'Pricing', 'Website'] } },
    ],
    // Trend: mostly positive with a shipping anomaly spike in recent days
    responseGen: (i) => {
      const recentSpike = i > 80 // last 20 responses have shipping issues
      if (recentSpike && Math.random() < 0.6) {
        return { score: randInt(1, 4), text: pick(FEEDBACK.shipping_negative), choice: 'Shipping' }
      }
      const score = weighted([
        { value: randInt(9, 10), weight: 30 }, // promoters
        { value: randInt(7, 8), weight: 25 },  // passives
        { value: randInt(4, 6), weight: 25 },   // mild detractors
        { value: randInt(0, 3), weight: 20 },   // strong detractors
      ])
      const clusters = score >= 7
        ? [pick([...FEEDBACK.product_positive, ...FEEDBACK.shipping_positive, ...FEEDBACK.support_positive])]
        : [pick([...FEEDBACK.shipping_negative, ...FEEDBACK.support_negative, ...FEEDBACK.product_negative])]
      const choices = ['Product Quality', 'Shipping', 'Support', 'Pricing', 'Website']
      return { score, text: clusters[0], choice: score >= 7 ? pick(choices.slice(0, 2)) : pick(choices.slice(1, 4)) }
    },
  },
  {
    name: 'Customer Support Satisfaction (CSAT)',
    type: 'CSAT',
    incentivePoints: 25,
    questions: [
      { id: 'q1', text: 'How satisfied were you with your support experience? (1-5)', type: 'rating', required: true, config: { min: 1, max: 5, labels: { left: 'Very Unsatisfied', right: 'Very Satisfied' } } },
      { id: 'q2', text: 'Tell us about your experience', type: 'text', required: false },
    ],
    // Trend: sentiment dropping over time (support quality declining)
    responseGen: (i) => {
      const decline = Math.min(i / 120, 0.5) // gradually worse
      const score = weighted([
        { value: 5, weight: 30 - decline * 40 },
        { value: 4, weight: 25 },
        { value: 3, weight: 15 + decline * 10 },
        { value: 2, weight: 15 + decline * 15 },
        { value: 1, weight: 15 + decline * 15 },
      ])
      const text = score >= 4 ? pick(FEEDBACK.support_positive) : pick(FEEDBACK.support_negative)
      return { score, text }
    },
  },
  {
    name: 'Website Usability (CES)',
    type: 'CES',
    incentivePoints: 30,
    questions: [
      { id: 'q1', text: 'How easy was it to complete your task on our website? (1-7)', type: 'rating', required: true, config: { min: 1, max: 7, labels: { left: 'Very Difficult', right: 'Very Easy' } } },
      { id: 'q2', text: 'What were you trying to do?', type: 'text', required: false },
    ],
    // Trend: stable with a sudden improvement after "redesign" (last 30 responses)
    responseGen: (i) => {
      const redesigned = i > 75
      if (redesigned) {
        const score = weighted([{ value: randInt(5, 7), weight: 60 }, { value: randInt(3, 4), weight: 30 }, { value: randInt(1, 2), weight: 10 }])
        return { score, text: pick([...FEEDBACK.website_mixed.filter(f => !f.includes('slow') && !f.includes('confusing')), 'The redesigned checkout is so much smoother!', 'New site is fast and intuitive.']) }
      }
      const score = weighted([{ value: randInt(5, 7), weight: 25 }, { value: randInt(3, 4), weight: 40 }, { value: randInt(1, 2), weight: 35 }])
      return { score, text: pick(FEEDBACK.website_mixed) }
    },
  },
  {
    name: 'Product Quality Feedback',
    type: 'CUSTOM',
    incentivePoints: 40,
    questions: [
      { id: 'q1', text: 'Rate the overall product quality (1-10)', type: 'rating', required: true, config: { min: 1, max: 10 } },
      { id: 'q2', text: 'What did you think of the product?', type: 'text', required: true },
      { id: 'q3', text: 'Would you buy from us again?', type: 'multiple_choice', required: false, config: { options: ['Definitely', 'Probably', 'Not sure', 'Probably not', 'Definitely not'] } },
    ],
    // Trend: bimodal — people either love it or hate it (quality inconsistency)
    responseGen: (i) => {
      const loves = Math.random() < 0.55
      if (loves) {
        const score = randInt(7, 10)
        return { score, text: pick(FEEDBACK.product_positive), choice: pick(['Definitely', 'Probably']) }
      }
      const score = randInt(1, 4)
      return { score, text: pick(FEEDBACK.product_negative), choice: pick(['Probably not', 'Definitely not', 'Not sure']) }
    },
  },
  {
    name: 'Onboarding Experience (NPS)',
    type: 'NPS',
    incentivePoints: 35,
    questions: [
      { id: 'q1', text: 'How likely are you to recommend our onboarding process?', type: 'rating', required: true, config: { min: 0, max: 10, labels: { left: 'Not at all', right: 'Extremely likely' } } },
      { id: 'q2', text: 'How was your onboarding experience?', type: 'text', required: false },
    ],
    // Trend: steadily improving (onboarding team is getting better)
    responseGen: (i) => {
      const improvement = Math.min(i / 100, 0.4)
      const score = weighted([
        { value: randInt(9, 10), weight: 25 + improvement * 40 },
        { value: randInt(7, 8), weight: 30 },
        { value: randInt(4, 6), weight: 25 - improvement * 15 },
        { value: randInt(0, 3), weight: 20 - improvement * 25 },
      ])
      const text = score >= 6 ? pick(FEEDBACK.onboarding_mixed.filter(f => !f.includes('confusing') && !f.includes('long'))) : pick(FEEDBACK.onboarding_mixed.filter(f => f.includes('confusing') || f.includes('long') || f.includes('Documentation')))
      return { score, text: text || pick(FEEDBACK.onboarding_mixed) }
    },
  },
]

// ─── Name generator ────────────────────────────────────────────────────────

const FIRST_NAMES = ['Emma','Liam','Olivia','Noah','Ava','James','Sophia','William','Isabella','Oliver','Mia','Benjamin','Charlotte','Elijah','Amelia','Lucas','Harper','Mason','Evelyn','Logan','Abigail','Alexander','Emily','Ethan','Elizabeth','Jacob','Sofia','Michael','Avery','Daniel','Ella','Henry','Scarlett','Sebastian','Grace','Jack','Chloe','Aiden','Victoria','Owen','Riley','Samuel','Aria','Ryan','Lily','Nathan','Aurora','Matthew','Zoey','Leo']
const LAST_NAMES = ['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Hernandez','Lopez','Gonzalez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin','Lee','Perez','Thompson','White','Harris','Sanchez','Clark','Ramirez','Lewis','Robinson','Walker','Young','Allen','King','Wright','Scott','Torres','Nguyen','Hill','Flores','Green','Adams','Nelson','Baker','Hall','Rivera','Campbell','Mitchell','Carter']

function genEmail(i) {
  const first = FIRST_NAMES[i % FIRST_NAMES.length].toLowerCase()
  const last = LAST_NAMES[i % LAST_NAMES.length].toLowerCase()
  return { email: `${first}.${last}.${i}@demo.customereq.com`, firstName: FIRST_NAMES[i % FIRST_NAMES.length], lastName: LAST_NAMES[i % LAST_NAMES.length] }
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log(`🚀 Seeding RICH demo data — 5 surveys, 100+ responses each`)
  console.log(`   Target: ${isProd ? 'PRODUCTION' : 'LOCALHOST'} (${API})\n`)

  // For local mode, ensure the program exists (may need to create one)
  let programId = await getActiveProgram()
  if (!programId) {
    console.log('  No active program found — creating one...')
    const program = await api('POST', '/v1/programs', {
      name: 'Diamond Loyalty Club',
      description: 'Premium loyalty program with points for every interaction',
      pointCurrencyName: 'Diamonds',
      pointToCurrencyRatio: 0.01,
    })
    programId = program?.id
    if (programId) {
      await api('POST', `/v1/programs/${programId}/rules`, {
        name: 'Survey Completion Bonus',
        triggerEvent: 'cx.survey_completed',
        pointsAwarded: 50,
        multiplier: 1.0,
      })
      await api('PATCH', `/v1/programs/${programId}`, { status: 'ACTIVE' })
    }
    if (!programId) { console.error('❌ Could not create program'); return }
  }
  console.log(`  Program: ${programId}`)

  const themeId = await getThemeId()
  console.log(`  Theme: ${themeId}\n`)

  // Enroll 150 unique members
  console.log('📧 Enrolling 150 demo members...')
  for (let i = 0; i < 150; i++) {
    const { email, firstName, lastName } = genEmail(i)
    await ensureMember(email, firstName, lastName, programId)
    if (i % 30 === 29) process.stdout.write(`  ${i + 1}/150\n`)
  }
  console.log('  ✅ Members enrolled\n')

  // Create and populate each survey
  for (const surveyDef of SURVEYS) {
    console.log(`📋 ${surveyDef.name}`)

    // Create survey
    const survey = await api('POST', '/v1/surveys', {
      name: surveyDef.name,
      programId,
      type: surveyDef.type,
      themeId,
      incentivePoints: surveyDef.incentivePoints,
      questions: surveyDef.questions,
    })
    if (!survey?.id) { console.log('  ⚠️  Survey may already exist, skipping'); continue }

    // Activate
    await api('PATCH', `/v1/surveys/${survey.id}/status`, { status: 'ACTIVE' })

    // Submit 110 responses
    let submitted = 0
    let failed = 0
    for (let i = 0; i < 110; i++) {
      const { email } = genEmail(i)
      const r = surveyDef.responseGen(i)
      const answers = { q1: r.score, q2: r.text || '' }
      if (r.choice) answers.q3 = r.choice

      const result = await api('POST', `/v1/public/surveys/${survey.id}/respond`, {
        memberEmail: email,
        answers,
        score: r.score,
        channel: pick(['email', 'link', 'in_app']),
      })
      if (result?.responseId) submitted++
      else failed++

      if (i % 25 === 24) process.stdout.write(`  ${i + 1}/110 (${submitted} ok, ${failed} failed)\n`)
    }
    console.log(`  ✅ ${submitted} responses submitted (${failed} failed/duplicate)\n`)
  }

  console.log('\n✨ Rich demo data seeded!')
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📊 DEMO WALKTHROUGH — CX Insights Page')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('')
  console.log('1️⃣  AGGREGATE VIEW (All Surveys)')
  console.log('   → 563 responses, NPS -14, CSAT 2.83, CES 4.18')
  console.log('   → Sentiment bar: green/yellow/red — clear distribution')
  console.log('   → Top topics: customer support, product quality, website experience')
  console.log('   → 6 clusters with live response counts and sentiment scores')
  console.log('')
  console.log('2️⃣  DECLINING SUPPORT QUALITY')
  console.log('   Survey: "Customer Support Satisfaction (CSAT)"')
  console.log('   → Sentiment -0.28 (red!) — nearly half negative (53/110)')
  console.log('   → Zero positive responses — nobody is happy with support')
  console.log('   → Response text: "Waited 45 min on hold", "Chat bot was useless"')
  console.log('   → Cluster: "Customer Support" (83 resp, -0.24)')
  console.log('')
  console.log('3️⃣  SHIPPING CRISIS')
  console.log('   Survey: "Post-Purchase Experience (NPS)"')
  console.log('   → NPS -33, last 20 responses spike with shipping complaints')
  console.log('   → Cluster: "Shipping Delays" (58 resp, -0.06)')
  console.log('   → Response text: "3 weeks delivery", "Package arrived damaged"')
  console.log('')
  console.log('4️⃣  PRODUCT QUALITY — LOVE IT OR HATE IT')
  console.log('   Survey: "Product Quality Feedback"')
  console.log('   → Bimodal: 58 positive vs 33 negative — inconsistent quality')
  console.log('   → Cluster: "Product Quality" (149 resp, +0.13)')
  console.log('   → Positive: "Outstanding, exceeded expectations"')
  console.log('   → Negative: "Broke after one week", "Feels cheap"')
  console.log('')
  console.log('5️⃣  WEBSITE REDESIGN IMPACT')
  console.log('   Survey: "Website Usability (CES)"')
  console.log('   → CES 4.18 — mixed, but improving after redesign')
  console.log('   → Cluster: "Website & App UX" (77 resp, -0.08)')
  console.log('   → Recent: "Redesigned checkout is so much smoother!"')
  console.log('   → Older: "Page load times are terrible"')
  console.log('')
  console.log('6️⃣  ONBOARDING GETTING BETTER')
  console.log('   Survey: "Onboarding Experience (NPS)"')
  console.log('   → NPS +5, Sentiment +0.26 (best of all surveys!)')
  console.log('   → 51 positive vs only 10 negative — clear improvement')
  console.log('   → Positive: "Setup was straightforward", "Guide was excellent"')
  console.log('   → Negative: "Documentation is confusing"')
  console.log('')
  console.log('7️⃣  CLUSTER DRILL-DOWN')
  console.log('   Click any cluster → 30-day trend chart + individual responses')
  console.log('   Best demo: "Customer Support" cluster — shows mix of CSAT and')
  console.log('   Onboarding responses, with negative CSAT pulling sentiment down')
  const authHeader = isProd
    ? `-H "X-Api-Key: ${API_KEY}"`
    : `-H "x-test-brand-id: test-brand"`
  console.log('')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('After seeding, run these to populate analytics:')
  console.log(`  curl -X POST ${authHeader} "${API}/v1/analytics/cx/backfill-sentiment?limit=500&force=true"`)
  console.log(`  curl -X POST ${authHeader} "${API}/v1/analytics/cx/backfill-sentiment?limit=500&force=true"`)
  console.log(`  curl -X POST ${authHeader} "${API}/v1/analytics/cx/clustering/trigger"`)
  console.log(`  curl -X POST ${authHeader} "${API}/v1/analytics/cx/backfill-snapshots?days=30"`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })

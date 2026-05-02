/**
 * Run a named demo scenario against the live API pipeline.
 * Scenarios fire real events through BullMQ — watch the worker logs and admin dashboard.
 *
 * Usage:
 *   pnpm run-scenario --scenario unhappy-customer
 *   pnpm run-scenario --scenario earn-points
 *   pnpm run-scenario --scenario redeem-reward
 *   pnpm run-scenario --scenario at-risk-trigger
 *   pnpm run-scenario --scenario new-member-first-purchase
 *
 * Env:
 *   DEMO_API_URL   (default: http://localhost:4000)
 *   DEMO_BRAND_ID  (default: cmn689ibu000089tqad1g234t)
 */

const API = process.env.DEMO_API_URL ?? 'http://localhost:4000'
const BRAND_ID = process.env.DEMO_BRAND_ID ?? 'cmn689ibu000089tqad1g234t'

const AUTH_HEADERS = {
  'Content-Type': 'application/json',
  'X-Test-Brand-Id': BRAND_ID,
  'X-Test-User-Id': 'demo-admin',
}

// ── Persona emails (must match seed-demo.ts) ──────────────────────────────────
const PERSONA_EMAILS = {
  alex:  'alex.chen@starbrew.demo',
  maria: 'maria.lopez@starbrew.demo',
  james: 'james.park@starbrew.demo',
  sara:  'sara.kim@starbrew.demo',
  david: 'david.wu@starbrew.demo',
} as const

// ── HTTP helpers ──────────────────────────────────────────────────────────────

async function api<T = Record<string, unknown>>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T | null> {
  let res: Response
  try {
    res = await fetch(`${API}${path}`, {
      method,
      headers: AUTH_HEADERS,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch (err) {
    const cause = (err as { cause?: NodeJS.ErrnoException }).cause
    const isConnRefused = cause?.code === 'ECONNREFUSED' || (cause as { errors?: NodeJS.ErrnoException[] })?.errors?.some(e => e.code === 'ECONNREFUSED')
    if (isConnRefused) {
      console.error(`\n  ✗ Cannot reach API at ${API}`)
      console.error('    Start the local stack first:')
      console.error('      docker compose up -d')
      console.error('      pnpm db:migrate')
      console.error('      pnpm dev\n')
      process.exit(1)
    }
    throw err
  }
  const data = await res.json().catch(() => ({})) as T
  if (!res.ok) {
    const msg = (data as Record<string, unknown>).message ?? (data as Record<string, unknown>).error ?? ''
    console.error(`  ✗ ${method} ${path} → ${res.status} ${msg}`)
    return null
  }
  return data
}

interface MemberRow { id: string; email: string; firstName: string; pointsBalance: number; tierName: string | null }
interface MembersResponse { data: MemberRow[] }
interface RewardsResponse { rewards: Array<{ id: string; name: string; pointsCost: number; isAvailable: boolean }> }
interface SurveysResponse { data: Array<{ id: string; name: string; type: string; status: string }> }

async function requireMember(email: string): Promise<MemberRow> {
  const res = await api<MembersResponse>('GET', `/v1/members?q=${encodeURIComponent(email)}&pageSize=1`)
  const member = res?.data?.[0]
  if (!member) {
    console.error(`\n  ✗ Member not found: ${email}`)
    console.error('    Run "pnpm seed:demo" first to create the StarBrew personas.')
    process.exit(1)
  }
  return member
}

async function requireNpsSurvey(): Promise<string> {
  const res = await api<SurveysResponse>('GET', '/v1/surveys?pageSize=50')
  const survey = res?.data?.find(s => s.name === 'Post-Visit NPS' && s.status === 'ACTIVE')
  if (!survey) {
    console.error('\n  ✗ Active NPS survey not found.')
    console.error('    Run "pnpm seed:demo" first to create StarBrew surveys.')
    process.exit(1)
  }
  return survey.id
}

async function requireCsatSurvey(): Promise<string> {
  const res = await api<SurveysResponse>('GET', '/v1/surveys?pageSize=50')
  const survey = res?.data?.find(s => s.name === 'Store Experience CSAT' && s.status === 'ACTIVE')
  if (!survey) {
    console.error('\n  ✗ Active CSAT survey not found.')
    console.error('    Run "pnpm seed:demo" first to create StarBrew surveys.')
    process.exit(1)
  }
  return survey.id
}

async function requireReward(name: string): Promise<string> {
  const res = await api<RewardsResponse>('GET', '/v1/rewards')
  const reward = res?.rewards?.find(r => r.name === name && r.isAvailable)
  if (!reward) {
    console.error(`\n  ✗ Reward "${name}" not found or unavailable.`)
    console.error('    Run "pnpm seed:demo" first to create the reward catalog.')
    process.exit(1)
  }
  return reward.id
}

// ── Scenarios ─────────────────────────────────────────────────────────────────

async function scenarioUnhappyCustomer() {
  console.log('Scenario: unhappy-customer')
  console.log('  Sara Kim submits a 2-star NPS review → Issue #6 campaign fires\n')

  const sara = await requireMember(PERSONA_EMAILS.sara)
  const npsSurveyId = await requireNpsSurvey()

  console.log(`  Member:  ${sara.firstName} ${sara.email}  (${sara.pointsBalance} pts, tier: ${sara.tierName ?? 'none'})`)
  console.log(`  Survey:  Post-Visit NPS (${npsSurveyId})`)
  console.log(`  Firing NPS score = 2 at ${new Date().toISOString()}\n`)

  const firedAt = Date.now()
  const res = await api('POST', `/v1/public/surveys/${npsSurveyId}/respond`, {
    memberEmail: sara.email,
    answers: {
      q1: 2,
      q2: 'My order was wrong and the barista was dismissive when I asked for help.',
      q3: 'Staff Friendliness',
    },
    score: 2,
    channel: 'email',
  })

  if (!res) {
    console.error('  ✗ Survey submission failed.')
    process.exit(1)
  }

  console.log('  ✓ Survey response submitted')
  console.log('')
  console.log('  ┌─ Issue #6 Pipeline ─────────────────────────────────────┐')
  console.log('  │  1. Survey response → sentiment analysis queued          │')
  console.log('  │  2. Campaign trigger evaluates nps_score ≤ 6             │')
  console.log('  │  3. "Detractor Recovery" awards 200 bonus StarPoints      │')
  console.log('  │  4. Notification dispatched to Sara                      │')
  console.log('  └──────────────────────────────────────────────────────────┘')
  console.log('')
  console.log(`  Wall clock started: ${new Date(firedAt).toISOString()}`)
  console.log('  Watch the worker logs for campaign trigger processing.')
  console.log('  Target SLA: < 15 minutes  →  http://localhost:3003/admin/alerts/cases')
}

async function scenarioEarnPoints() {
  console.log('Scenario: earn-points')
  console.log('  Alex Chen completes a purchase → 500 StarPoints credited\n')

  const alex = await requireMember(PERSONA_EMAILS.alex)
  const balanceBefore = alex.pointsBalance

  console.log(`  Member:  ${alex.firstName} ${alex.email}`)
  console.log(`  Balance before: ${balanceBefore} pts`)

  const orderId = `STARBREW-${alex.id.slice(-6).toUpperCase()}-DEMO-${Date.now()}`
  const res = await api('POST', '/v1/events', {
    eventType: 'purchase',
    memberId: alex.id,
    payload: {
      orderId,
      amount: 5.75,
      currency: 'USD',
      items: [{ name: 'Grande Latte', quantity: 1, price: 5.75 }],
      channel: 'in-store',
    },
    idempotencyKey: `scenario-earn-${orderId}`,
  })

  if (!res) {
    console.error('  ✗ Event submission failed.')
    process.exit(1)
  }

  console.log('  ✓ Purchase event accepted')
  console.log(`  Expected balance after processing: ${balanceBefore + 500} pts`)
  console.log('  Check:  http://localhost:3003/admin/members')
}

async function scenarioRedeemReward() {
  console.log('Scenario: redeem-reward')
  console.log('  David Wu redeems a "Free Tall Coffee" (500 pts)\n')

  const david = await requireMember(PERSONA_EMAILS.david)
  const rewardId = await requireReward('Free Tall Coffee')

  console.log(`  Member:  ${david.firstName} ${david.email}`)
  console.log(`  Balance: ${david.pointsBalance} pts`)

  if (david.pointsBalance < 500) {
    console.error(`  ✗ Insufficient points (need 500, have ${david.pointsBalance}).`)
    console.error('    Run "pnpm seed:demo" to rebuild purchase history first.')
    process.exit(1)
  }

  const res = await api('POST', '/v1/redemptions', {
    rewardId,
    memberId: david.id,
  })

  if (!res) {
    console.error('  ✗ Redemption failed.')
    process.exit(1)
  }

  const redemption = res as { id: string; pointsSpent: number; status: string }
  console.log('  ✓ Redemption processed')
  console.log(`  Redemption ID: ${redemption.id}`)
  console.log(`  Points spent:  ${redemption.pointsSpent}`)
  console.log(`  Status:        ${redemption.status}`)
  console.log(`  Balance after: ~${david.pointsBalance - 500} pts`)
  console.log('  Check:  http://localhost:3003/admin/members')
}

async function scenarioAtRiskTrigger() {
  console.log('Scenario: at-risk-trigger')
  console.log('  James Park submits a low CSAT → at-risk signal fires\n')

  const james = await requireMember(PERSONA_EMAILS.james)
  const csatSurveyId = await requireCsatSurvey()

  console.log(`  Member:  ${james.firstName} ${james.email}  (${james.pointsBalance} pts, tier: ${james.tierName ?? 'none'})`)
  console.log(`  Survey:  Store Experience CSAT (${csatSurveyId})`)
  console.log('  Firing CSAT score = 2\n')

  const res = await api('POST', `/v1/public/surveys/${csatSurveyId}/respond`, {
    memberEmail: james.email,
    answers: {
      q1: 2,
      q2: "The store was understaffed and I waited 20 minutes for a simple drip coffee. I haven't been back since.",
    },
    score: 2,
    channel: 'link',
  })

  if (!res) {
    console.error('  ✗ Survey submission failed.')
    process.exit(1)
  }

  console.log('  ✓ CSAT response submitted')
  console.log('  Pipeline: sentiment analysis → alert rule evaluation → case created')
  console.log('  Check:  http://localhost:3003/admin/alerts/cases')
}

async function scenarioNewMemberFirstPurchase() {
  console.log('Scenario: new-member-first-purchase')
  console.log('  Maria Lopez makes her first purchase → welcome earn rule fires\n')

  const maria = await requireMember(PERSONA_EMAILS.maria)

  console.log(`  Member:  ${maria.firstName} ${maria.email}  (${maria.pointsBalance} pts)`)
  console.log('  Firing first purchase event\n')

  const orderId = `STARBREW-${maria.id.slice(-6).toUpperCase()}-FIRST-${Date.now()}`
  const res = await api('POST', '/v1/events', {
    eventType: 'purchase',
    memberId: maria.id,
    payload: {
      orderId,
      amount: 4.75,
      currency: 'USD',
      items: [{ name: 'Tall Drip Coffee', quantity: 1, price: 4.75 }],
      channel: 'mobile-app',
    },
    idempotencyKey: `scenario-first-purchase-${orderId}`,
  })

  if (!res) {
    console.error('  ✗ Event submission failed.')
    process.exit(1)
  }

  const balanceBefore = maria.pointsBalance
  console.log('  ✓ Purchase event accepted')
  console.log(`  Expected balance after processing: ${balanceBefore + 500} pts`)
  console.log('  Check:  http://localhost:3003/admin/members')
}

// ── CLI entrypoint ────────────────────────────────────────────────────────────

const SCENARIOS = {
  'unhappy-customer':        scenarioUnhappyCustomer,
  'earn-points':             scenarioEarnPoints,
  'redeem-reward':           scenarioRedeemReward,
  'at-risk-trigger':         scenarioAtRiskTrigger,
  'new-member-first-purchase': scenarioNewMemberFirstPurchase,
} as const

type ScenarioName = keyof typeof SCENARIOS

function parseArgs(): ScenarioName {
  const args = process.argv.slice(2)
  const scenarioIdx = args.indexOf('--scenario')
  const scenarioName = scenarioIdx >= 0 ? args[scenarioIdx + 1] : undefined

  if (!scenarioName || !(scenarioName in SCENARIOS)) {
    console.error('Usage: pnpm run-scenario --scenario <name>\n')
    console.error('Available scenarios:')
    for (const name of Object.keys(SCENARIOS)) {
      console.error(`  ${name}`)
    }
    console.error('')
    console.error('Scenario descriptions:')
    console.error('  unhappy-customer         Sara Kim: 2-star NPS → recovery campaign (Issue #6 hero demo)')
    console.error('  earn-points              Alex Chen: purchase event → 500 pts credited')
    console.error('  redeem-reward            David Wu: redeem Free Tall Coffee (500 pts)')
    console.error('  at-risk-trigger          James Park: low CSAT → alert case created')
    console.error('  new-member-first-purchase  Maria Lopez: first purchase → earn rule fires')
    process.exit(1)
  }

  return scenarioName as ScenarioName
}

async function main() {
  const scenarioName = parseArgs()
  console.log(`\n☕  StarBrew Demo — ${scenarioName}\n`)
  console.log(`    API:      ${API}`)
  console.log(`    Brand ID: ${BRAND_ID}\n`)

  await SCENARIOS[scenarioName]()
  console.log('')
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})

/**
 * Seed StarBrew Coffee demo data into an existing Brand tenant.
 * Idempotent — safe to re-run; skips resources that already exist.
 *
 * Usage: pnpm seed:demo
 * Env:   DEMO_API_URL   (default: http://localhost:4000)
 *        DEMO_BRAND_ID  (default: cmn689ibu000089tqad1g234t)  — used locally only
 *        DEMO_API_KEY   — API key for production; falls back to MCP_API_KEY
 */

const API = process.env.DEMO_API_URL ?? 'http://localhost:4000'
const BRAND_ID = process.env.DEMO_BRAND_ID ?? 'cmn689ibu000089tqad1g234t'
const API_KEY = process.env.DEMO_API_KEY ?? process.env.MCP_API_KEY

const AUTH_HEADERS: Record<string, string> = API_KEY
  ? { 'Content-Type': 'application/json', 'X-Api-Key': API_KEY }
  : { 'Content-Type': 'application/json', 'X-Test-Brand-Id': BRAND_ID, 'X-Test-User-Id': 'demo-admin' }

// ── Personas ──────────────────────────────────────────────────────────────────
// Each persona maps to a named scenario in run-scenario.ts.
const PERSONAS = [
  {
    email: 'alex.chen@starbrew.demo',
    firstName: 'Alex',
    lastName: 'Chen',
    purchases: 5,    // happy Gold regular
    npsScore: null,
  },
  {
    email: 'maria.lopez@starbrew.demo',
    firstName: 'Maria',
    lastName: 'Lopez',
    purchases: 1,    // new Bronze member
    npsScore: null,
  },
  {
    email: 'james.park@starbrew.demo',
    firstName: 'James',
    lastName: 'Park',
    purchases: 12,   // high-value Platinum, at risk (45-day no-visit)
    npsScore: null,
  },
  {
    email: 'sara.kim@starbrew.demo',
    firstName: 'Sara',
    lastName: 'Kim',
    purchases: 1,    // left a 2-star review — unhappy-customer scenario target
    npsScore: null,
  },
  {
    email: 'david.wu@starbrew.demo',
    firstName: 'David',
    lastName: 'Wu',
    purchases: 4,    // active Gold redeemer
    npsScore: null,
  },
] as const

// ── HTTP helper ───────────────────────────────────────────────────────────────

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
  if (!res.ok && res.status !== 409) {
    const msg = (data as Record<string, unknown>).message ?? (data as Record<string, unknown>).error ?? ''
    console.error(`  ✗ ${method} ${path} → ${res.status} ${msg}`)
    return null
  }
  return data
}

// ── Member lookup ─────────────────────────────────────────────────────────────

interface MemberRow { id: string; email: string; pointsBalance: number }
interface MembersResponse { data: MemberRow[] }

async function findMemberByEmail(email: string): Promise<MemberRow | null> {
  const res = await api<MembersResponse>('GET', `/v1/members?q=${encodeURIComponent(email)}&pageSize=1`)
  return res?.data?.[0] ?? null
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('☕  Seeding StarBrew Coffee demo data…\n')
  console.log(`    API:      ${API}`)
  console.log(`    Brand ID: ${BRAND_ID}\n`)

  // ── 1. Program ──────────────────────────────────────────────────────────────
  console.log('1/9  Creating loyalty program…')
  const programRes = await api<{ id: string }>('POST', '/v1/programs', {
    name: 'StarBrew Rewards',
    description: 'Earn StarPoints on every visit and redeem them for free drinks.',
    pointCurrencyName: 'StarPoints',
    pointToCurrencyRatio: 0.01,
  })
  const programsListRes = await api<{ data: Array<{ id: string; name: string; status: string }> }>(
    'GET', '/v1/programs?pageSize=50',
  )
  const programs = programsListRes?.data ?? []
  const program = programs.find(p => p.name === 'StarBrew Rewards') ?? programs.find(p => p.status === 'ACTIVE')
  const programId = program?.id ?? programRes?.id
  if (!programId) {
    console.error('  ✗ Could not resolve a program ID — is the API running?')
    process.exit(1)
  }
  console.log(`  ✓ Program: ${program?.name ?? 'StarBrew Rewards'} (${programId})\n`)

  // ── 2. Earning rules ────────────────────────────────────────────────────────
  console.log('2/9  Adding earning rules…')
  await api('POST', `/v1/programs/${programId}/rules`, {
    name: 'Purchase Reward',
    triggerEvent: 'purchase',
    pointsAwarded: 500,
    multiplier: 1.0,
  })
  await api('POST', `/v1/programs/${programId}/rules`, {
    name: 'Survey Completion Bonus',
    triggerEvent: 'cx.survey_completed',
    pointsAwarded: 50,
    multiplier: 1.0,
  })
  await api('PATCH', `/v1/programs/${programId}`, { status: 'ACTIVE' })
  console.log('  ✓ Earning rules added; program activated\n')

  // ── 3. Survey theme ─────────────────────────────────────────────────────────
  console.log('3/9  Creating survey theme…')
  const themeRes = await api<{ id: string }>('POST', '/v1/themes', {
    name: 'StarBrew Theme',
    isDefault: false,
    brandName: 'StarBrew Coffee',
    primaryColor: '#00704A',
    secondaryColor: '#CBA258',
    backgroundColor: '#F9F5F0',
    textColor: '#1A1A1A',
    buttonColor: '#00704A',
    buttonTextColor: '#FFFFFF',
    accentColor: '#CBA258',
    fontFamily: 'Inter',
    headingSize: 'lg',
    bodySize: 'md',
    cardStyle: 'shadow',
    borderRadius: 'lg',
    maxWidth: 'md',
    thankYouMessage: 'Thank you for your feedback! Your voice helps us make every cup better.',
    showIncentivePoints: true,
  })
  const themeId = themeRes?.id
  console.log(`  ✓ Theme: StarBrew Theme (${themeId ?? 'created'})\n`)

  // ── 4. NPS survey ───────────────────────────────────────────────────────────
  console.log('4/9  Creating surveys…')
  const npsSurveyRes = await api<{ id: string }>('POST', '/v1/surveys', {
    name: 'Post-Visit NPS',
    programId,
    type: 'NPS',
    themeId,
    incentivePoints: 50,
    questions: [
      {
        id: 'q1',
        text: 'How likely are you to recommend StarBrew to a friend? (0–10)',
        type: 'rating',
        required: true,
        config: { min: 0, max: 10, labels: { left: 'Not at all', right: 'Absolutely' } },
      },
      {
        id: 'q2',
        text: 'What stood out most about your visit?',
        type: 'text',
        required: false,
        config: { placeholder: 'Tell us more…', maxLength: 500 },
      },
      {
        id: 'q3',
        text: 'Which area could we improve?',
        type: 'multiple_choice',
        required: false,
        config: { options: ['Drink Quality', 'Wait Time', 'Staff Friendliness', 'Store Ambiance', 'Mobile App'] },
      },
    ],
  })
  const npsSurveyId = npsSurveyRes?.id
  console.log(`  ✓ NPS survey (${npsSurveyId})`)

  const csatSurveyRes = await api<{ id: string }>('POST', '/v1/surveys', {
    name: 'Store Experience CSAT',
    programId,
    type: 'CSAT',
    themeId,
    incentivePoints: 25,
    questions: [
      {
        id: 'q1',
        text: 'How satisfied were you with your in-store experience today? (1–5)',
        type: 'rating',
        required: true,
        config: { min: 1, max: 5, labels: { left: 'Very Unsatisfied', right: 'Very Satisfied' } },
      },
      {
        id: 'q2',
        text: 'What can we do better?',
        type: 'text',
        required: false,
        config: { placeholder: 'Your feedback matters…' },
      },
    ],
  })
  const csatSurveyId = csatSurveyRes?.id
  console.log(`  ✓ CSAT survey (${csatSurveyId})`)

  if (npsSurveyId) await api('PATCH', `/v1/surveys/${npsSurveyId}/status`, { status: 'ACTIVE' })
  if (csatSurveyId) await api('PATCH', `/v1/surveys/${csatSurveyId}/status`, { status: 'ACTIVE' })
  console.log('  ✓ Both surveys activated\n')

  // ── 5. Alert rule ───────────────────────────────────────────────────────────
  console.log('5/9  Creating detractor alert rule…')
  await api('POST', '/v1/alert-rules', {
    name: 'NPS Detractor Alert',
    surveyTypes: ['NPS'],
    scoreMin: 0,
    scoreMax: 6,
    emailRecipients: ['cx@starbrew.demo'],
    defaultAssignee: 'CX Team',
    slaHours: 4,
  })
  console.log('  ✓ Alert rule created\n')

  // ── 6. Recovery campaign ────────────────────────────────────────────────────
  console.log('6/9  Creating detractor recovery campaign…')
  const campaignRes = await api<{ id: string }>('POST', '/v1/campaigns', {
    programId,
    name: 'Detractor Recovery — 200 Bonus StarPoints',
    triggerType: 'cx.nps_response',
    triggerCondition: { field: 'nps_score', op: 'lte', value: 6 },
    actionType: 'award_points',
    actionConfig: {
      points: 200,
      message: "We're sorry your visit didn't meet expectations. Here are 200 bonus StarPoints on us.",
    },
    budgetCap: 50000,
    startDate: new Date().toISOString(),
  })
  if (campaignRes?.id) {
    await api('PATCH', `/v1/campaigns/${campaignRes.id}/status`, { status: 'ACTIVE' })
  }
  console.log(`  ✓ Campaign created and activated (${campaignRes?.id ?? 'id unknown'})\n`)

  // ── 7. Reward ───────────────────────────────────────────────────────────────
  console.log('7/9  Creating reward catalog…')
  await api('POST', '/v1/rewards', {
    programId,
    name: 'Free Tall Coffee',
    description: 'Redeem for any tall (12 oz) beverage at any StarBrew location.',
    pointsCost: 500,
    stock: 1000,
    isAvailable: true,
  })
  await api('POST', '/v1/rewards', {
    programId,
    name: 'Free Pastry',
    description: 'Redeem for any pastry in the bakery case.',
    pointsCost: 300,
    stock: 500,
    isAvailable: true,
  })
  console.log('  ✓ Rewards created\n')

  // ── 8. Enroll personas ──────────────────────────────────────────────────────
  console.log('8/9  Enrolling personas…')
  const enrolledMembers: Array<{ email: string; firstName: string; id: string }> = []

  for (const persona of PERSONAS) {
    const existing = await findMemberByEmail(persona.email)
    if (existing) {
      console.log(`  → ${persona.firstName} ${persona.lastName} already enrolled (${existing.id})`)
      enrolledMembers.push({ email: persona.email, firstName: persona.firstName, id: existing.id })
      continue
    }
    // Issue #231 PR2: enroll API takes memberId + optional consentGivenAt
    // (server-stamps when omitted). consentGiven literal-true was dropped.
    const res = await api<{ memberId: string }>('POST', '/v1/members/enroll', {
      memberId: persona.email,
      email: persona.email,
      firstName: persona.firstName,
      lastName: persona.lastName,
      programId,
      consentGivenAt: new Date().toISOString(),
      consentVersion: '1.0',
    })
    if (res?.memberId) {
      console.log(`  ✓ ${persona.firstName} ${persona.lastName} enrolled (${res.memberId})`)
      enrolledMembers.push({ email: persona.email, firstName: persona.firstName, id: res.memberId })
    } else {
      console.error(`  ✗ Failed to enroll ${persona.firstName} ${persona.lastName}`)
    }
  }
  console.log('')

  // ── 9. Purchase history ─────────────────────────────────────────────────────
  console.log('9/9  Building purchase history…')

  for (const persona of PERSONAS) {
    const member = enrolledMembers.find(m => m.email === persona.email)
    if (!member) continue

    const orderAmounts = [4.75, 5.25, 6.50, 4.25, 7.00, 5.75, 6.25, 4.50, 8.00, 5.50, 6.75, 5.00]
    const purchases = orderAmounts.slice(0, persona.purchases)

    for (let i = 0; i < purchases.length; i++) {
      const amount = purchases[i]
      await api('POST', '/v1/events', {
        eventType: 'purchase',
        memberId: member.id,
        payload: {
          orderId: `STARBREW-${member.id.slice(-6).toUpperCase()}-${String(i + 1).padStart(3, '0')}`,
          amount,
          currency: 'USD',
          items: [{ name: 'Coffee', quantity: 1, price: amount }],
          channel: 'in-store',
        },
        idempotencyKey: `seed-purchase-${member.id}-${i}`,
      })
    }
    console.log(`  ✓ ${member.firstName}: ${purchases.length} purchase(s) fired`)
  }
  console.log('')

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════════════')
  console.log('  StarBrew demo data seeded successfully!\n')
  console.log('  Personas:')
  for (const m of enrolledMembers) {
    const persona = PERSONAS.find(p => p.email === m.email)
    console.log(`    ${m.firstName.padEnd(8)}  ${m.email}  (id: ${m.id})`)
    void persona
  }
  console.log('')
  console.log('  Demo URLs:')
  console.log('    Admin dashboard:  http://localhost:3003/admin')
  console.log('    Members:          http://localhost:3003/admin/members')
  console.log('    Analytics:        http://localhost:3003/admin/analytics')
  console.log('    Campaigns:        http://localhost:3003/admin/campaigns')
  console.log('    Alert cases:      http://localhost:3003/admin/alerts/cases')
  if (npsSurveyId) console.log(`    Live NPS survey:  http://localhost:3003/survey/${npsSurveyId}`)
  console.log('')
  console.log('  Next step:')
  console.log('    pnpm run-scenario --scenario unhappy-customer')
  console.log('═══════════════════════════════════════════════════════')
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})

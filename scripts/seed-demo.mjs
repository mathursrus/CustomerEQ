#!/usr/bin/env node
/**
 * Demo Data Seed Script
 *
 * Sets up everything needed for a live demo:
 * - Loyalty program with earning rules
 * - Branded survey theme
 * - NPS + CSAT surveys (ACTIVE)
 * - Sample members with consent
 * - Alert rule for detractors
 * - Campaign for low-score responses
 * - Sample survey responses with varied scores
 */

const API = 'http://localhost:4000'
const BRAND_ID = 'cmn689ibu000089tqad1g234t'  // CustomerEQ Dev Org
const headers = {
  'Content-Type': 'application/json',
  'X-Test-Brand-Id': BRAND_ID,
  'X-Test-User-Id': 'demo-admin',
}

async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok && res.status !== 409) {
    console.error(`  ❌ ${method} ${path}: ${res.status}`, data.message || data.error || '')
    return null
  }
  return data
}

async function main() {
  console.log('🚀 Seeding demo data for CustomerEQ Dev Org...\n')

  // ─── 1. Create Program ──────────────────────────────────────────────────
  console.log('1️⃣  Creating loyalty program...')
  const program = await api('POST', '/v1/programs', {
    name: 'Diamond Loyalty Club',
    description: 'Premium loyalty program with points for every interaction',
    pointCurrencyName: 'Diamonds',
    pointToCurrencyRatio: 0.01,
  })
  if (!program) { console.log('  ⚠️  Program may already exist, continuing...') }
  const programId = program?.id
  console.log(`  ✅ Program: ${programId || 'using existing'}`)

  // Add earning rule if we have a program
  if (programId) {
    console.log('  Adding earning rule...')
    await api('POST', `/v1/programs/${programId}/rules`, {
      name: 'Survey Completion Bonus',
      triggerEvent: 'cx.survey_completed',
      pointsAwarded: 50,
      multiplier: 1.0,
    })

    // Activate program
    await api('PATCH', `/v1/programs/${programId}`, { status: 'ACTIVE' })
    console.log('  ✅ Program activated with earning rule')
  }

  // Use first available active program
  const programsRes = await api('GET', '/v1/programs')
  const programs = programsRes?.data || programsRes?.programs || []
  const activeProgram = programs.find(p => p.status === 'ACTIVE') || programs[0]
  const useProgramId = activeProgram?.id || programId
  console.log(`  Using program: ${activeProgram?.name || 'Diamond Loyalty Club'} (${useProgramId})\n`)

  // ─── 2. Create Brand Theme (Issue #291 — was SurveyTheme; brand-level visual identity only) ─
  console.log('2️⃣  Creating branded brand theme...')
  const theme = await api('POST', '/v1/themes', {
    name: 'Diamond Brand Theme',
    primaryColor: '#1e40af',
    secondaryColor: '#3b82f6',
    backgroundColor: '#f0f9ff',
    textColor: '#1e293b',
    buttonColor: '#1e40af',
    buttonTextColor: '#ffffff',
    accentColor: '#f59e0b',
    fontFamily: 'Inter',
    headingSize: 'lg',
    bodySize: 'md',
    cardStyle: 'shadow',
    borderRadius: 'lg',
    maxWidth: 'md',
  })
  const themeId = theme?.id
  console.log(`  ✅ Theme: ${themeId || 'created'}\n`)

  // Issue #291 — isDefault flag replaced by Brand.defaultThemeId FK; the
  // dedicated default endpoint writes the brand row in a single statement.
  if (themeId) {
    await api('POST', `/v1/themes/${themeId}/default`, {})
    console.log(`  ✅ Set as brand default theme\n`)
  }

  // ─── 3. Create Surveys ──────────────────────────────────────────────────
  // Issue #291 — thankYouMessage / showIncentivePoints moved from BrandTheme to Survey.
  console.log('3️⃣  Creating surveys...')

  const npsSurvey = await api('POST', '/v1/surveys', {
    name: 'Post-Purchase NPS Survey',
    programId: useProgramId,
    type: 'NPS',
    themeId,
    incentivePoints: 50,
    thankYouMessage: 'Thank you for being a valued Diamond member! Your feedback helps us improve.',
    showIncentivePoints: true,
    questions: [
      { id: 'q1', text: 'On a scale of 0-10, how likely are you to recommend us to a friend?', type: 'rating', required: true, config: { min: 0, max: 10, labels: { left: 'Not at all likely', right: 'Extremely likely' } } },
      { id: 'q2', text: 'What is the primary reason for your score?', type: 'text', required: false, config: { placeholder: 'Tell us more...', maxLength: 500 } },
      { id: 'q3', text: 'Which area could we improve the most?', type: 'multiple_choice', required: false, config: { options: ['Product Quality', 'Shipping Speed', 'Customer Support', 'Pricing', 'Website Experience'] } },
    ],
  })
  const npsSurveyId = npsSurvey?.id
  console.log(`  ✅ NPS Survey: ${npsSurveyId}`)

  const csatSurvey = await api('POST', '/v1/surveys', {
    name: 'Support CSAT Survey',
    programId: useProgramId,
    type: 'CSAT',
    themeId,
    incentivePoints: 25,
    thankYouMessage: 'Thank you for being a valued Diamond member! Your feedback helps us improve.',
    showIncentivePoints: true,
    questions: [
      { id: 'q1', text: 'How satisfied were you with your support experience? (1-5)', type: 'rating', required: true, config: { min: 1, max: 5, labels: { left: 'Very Unsatisfied', right: 'Very Satisfied' } } },
      { id: 'q2', text: 'What could we do to improve your support experience?', type: 'text', required: false, config: { placeholder: 'Your feedback helps us improve...' } },
    ],
  })
  const csatSurveyId = csatSurvey?.id
  console.log(`  ✅ CSAT Survey: ${csatSurveyId}`)

  // Activate surveys
  if (npsSurveyId) await api('PATCH', `/v1/surveys/${npsSurveyId}/status`, { status: 'ACTIVE' })
  if (csatSurveyId) await api('PATCH', `/v1/surveys/${csatSurveyId}/status`, { status: 'ACTIVE' })
  console.log('  ✅ Both surveys activated\n')

  // ─── 4. Create Members ──────────────────────────────────────────────────
  console.log('4️⃣  Enrolling demo members...')
  const memberEmails = [
    { email: 'sarah.johnson@example.com', firstName: 'Sarah', lastName: 'Johnson' },
    { email: 'mike.chen@example.com', firstName: 'Mike', lastName: 'Chen' },
    { email: 'emma.wilson@example.com', firstName: 'Emma', lastName: 'Wilson' },
    { email: 'james.rodriguez@example.com', firstName: 'James', lastName: 'Rodriguez' },
    { email: 'lisa.park@example.com', firstName: 'Lisa', lastName: 'Park' },
    { email: 'david.kim@example.com', firstName: 'David', lastName: 'Kim' },
    { email: 'anna.martinez@example.com', firstName: 'Anna', lastName: 'Martinez' },
    { email: 'tom.brown@example.com', firstName: 'Tom', lastName: 'Brown' },
  ]

  const members = []
  for (const m of memberEmails) {
    // Issue #231 PR2: API expects `memberId` (canonical identifier).
    const result = await api('POST', '/v1/members/enroll', {
      memberId: m.email,
      email: m.email,
      firstName: m.firstName,
      lastName: m.lastName,
      programId: useProgramId,
    })
    if (result?.memberId) members.push({ ...m, id: result.memberId })
    else if (result?.id) members.push({ ...m, id: result.id })
  }
  console.log(`  ✅ ${members.length} members enrolled\n`)

  // ─── 5. Create Alert Rule ──────────────────────────────────────────────
  console.log('5️⃣  Creating alert rule for detractors...')
  const alertRule = await api('POST', '/v1/alert-rules', {
    name: 'NPS Detractor Alert',
    surveyTypes: ['NPS'],
    scoreMin: 0,
    scoreMax: 6,
    emailRecipients: ['cx-team@customereq.demo'],
    defaultAssignee: 'Sarah K. (CX Lead)',
    assignmentRules: [
      { topic: 'shipping', assignee: 'Ops Team' },
      { topic: 'support', assignee: 'Support Manager' },
    ],
    slaHours: 4,
  })
  console.log(`  ✅ Alert rule: ${alertRule?.id || 'created'}\n`)

  // ─── 6. Create Campaign ─────────────────────────────────────────────────
  console.log('6️⃣  Creating loyalty recovery campaign...')
  if (useProgramId) {
    const campaign = await api('POST', '/v1/campaigns', {
      programId: useProgramId,
      name: 'Detractor Recovery — 2x Points',
      triggerType: 'cx.nps_response',
      triggerCondition: { field: 'nps_score', op: 'lte', value: 6 },
      actionType: 'award_points',
      actionConfig: { points: 200, message: 'We appreciate your feedback! Here are 200 bonus Diamonds.' },
      budgetCap: 10000,
      startDate: new Date().toISOString(),
    })
    if (campaign?.id) {
      await api('PATCH', `/v1/campaigns/${campaign.id}/status`, { status: 'ACTIVE' })
    }
    console.log(`  ✅ Campaign: ${campaign?.id || 'created'}\n`)
  }

  // ─── 7. Submit Sample Responses ─────────────────────────────────────────
  console.log('7️⃣  Submitting sample survey responses...')

  const npsResponses = [
    { member: 0, score: 9, q2: 'Absolutely love the product quality! Fast shipping too.', q3: 'Product Quality' },
    { member: 1, score: 10, q2: 'Best customer service I\'ve ever experienced. Will definitely recommend!', q3: 'Customer Support' },
    { member: 2, score: 3, q2: 'Shipping took 3 weeks and the package was damaged when it arrived.', q3: 'Shipping Speed' },
    { member: 3, score: 2, q2: 'Terrible support experience. Waited on hold for 45 minutes and got disconnected twice.', q3: 'Customer Support' },
    { member: 4, score: 8, q2: 'Great products but pricing is a bit high compared to competitors.', q3: 'Pricing' },
    { member: 5, score: 1, q2: 'Product broke after one week. Requested refund but still waiting after a month.', q3: 'Product Quality' },
    { member: 6, score: 7, q2: 'Decent experience overall. Website could be faster.', q3: 'Website Experience' },
    { member: 7, score: 6, q2: 'Checkout process is confusing. Had to re-enter my address twice.', q3: 'Website Experience' },
  ]

  for (const r of npsResponses) {
    if (!members[r.member] || !npsSurveyId) continue
    const result = await api('POST', `/v1/public/surveys/${npsSurveyId}/respond`, {
      memberEmail: members[r.member].email,
      answers: { q1: r.score, q2: r.q2, q3: r.q3 },
      score: r.score,
      channel: 'email',
    })
    const emoji = r.score >= 9 ? '🟢' : r.score >= 7 ? '🟡' : '🔴'
    console.log(`  ${emoji} ${members[r.member].firstName}: NPS ${r.score} — ${result?.responseId ? 'submitted' : 'skipped'}`)
  }

  // CSAT responses
  const csatResponses = [
    { member: 2, score: 1, q2: 'Support agent was rude and unhelpful. Never resolved my issue.' },
    { member: 3, score: 2, q2: 'Long wait times and no follow-up after my complaint.' },
    { member: 4, score: 5, q2: 'Quick resolution, very happy with the support team!' },
    { member: 6, score: 4, q2: 'Good support but could be faster.' },
  ]

  for (const r of csatResponses) {
    if (!members[r.member] || !csatSurveyId) continue
    const result = await api('POST', `/v1/public/surveys/${csatSurveyId}/respond`, {
      memberEmail: members[r.member].email,
      answers: { q1: r.score, q2: r.q2 },
      score: r.score,
      channel: 'link',
    })
    const emoji = r.score >= 4 ? '🟢' : r.score >= 3 ? '🟡' : '🔴'
    console.log(`  ${emoji} ${members[r.member].firstName}: CSAT ${r.score} — ${result?.responseId ? 'submitted' : 'skipped'}`)
  }

  console.log('')

  // ─── Summary ────────────────────────────────────────────────────────────
  console.log('✨ Demo data seeded successfully!\n')
  console.log('📋 Demo URLs:')
  console.log(`   Admin:        http://localhost:3003/admin/programs`)
  console.log(`   Surveys:      http://localhost:3003/admin/surveys`)
  console.log(`   Analytics:    http://localhost:3003/admin/analytics`)
  console.log(`   CX Insights:  http://localhost:3003/admin/analytics/cx`)
  console.log(`   Alert Cases:  http://localhost:3003/admin/alerts/cases`)
  console.log(`   Themes:       http://localhost:3003/admin/settings/themes`)
  if (npsSurveyId) {
    console.log(`   Public NPS:   http://localhost:3003/survey/${npsSurveyId}`)
  }
  if (csatSurveyId) {
    console.log(`   Public CSAT:  http://localhost:3003/survey/${csatSurveyId}`)
  }
  console.log(`   Builder:      http://localhost:3003/admin/survey-builder`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })

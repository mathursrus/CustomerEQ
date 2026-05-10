#!/usr/bin/env node
// Seed an Acme Coffee brand + all dependencies (program, rewards, surveys,
// external signal source, alert rule, KB article) into the local CustomerEQ
// Postgres. Outputs a .env snippet so you can wire the Acme demo app into
// this freshly seeded brand with zero manual ID copying.
//
// Usage:
//   node examples/acme-coffee-demo/seed-acme.mjs
//
// Prereqs:
//   - Local Postgres running (matches DATABASE_URL)
//   - Prisma client generated (pnpm db:generate from repo root)

// Import the prisma singleton directly from the workspace — the demo app
// intentionally isn't in the pnpm workspace, so we can't resolve via the
// package name. Relative path into the built dist works.
import { prisma } from '../../packages/database/dist/index.js'

// Pre-created Clerk org "Acme Coffee" — org_3CGYVSGeKGVml2WRl2sxG0YLqlE
// Pre-created brand — acme-coffee-brand
// The seed re-uses the existing brand and just adds program/survey/rule data.
const ACME_BRAND_ID = 'acme-coffee-brand'
const ACME_BRAND_NAME = 'Acme Coffee'
const ACME_API_KEY = 'acme-demo-key-change-me'

async function cleanupPreviousAcme() {
  const prior = await prisma.brand.findMany({ where: { name: ACME_BRAND_NAME }, select: { id: true } })
  if (prior.length === 0) return
  console.log(`  🧹 Cleaning ${prior.length} previous Acme brand(s)...`)
  for (const { id } of prior) {
    // Delete in dependency order. Models with FK → brandId.
    await prisma.externalSignal.deleteMany({ where: { brandId: id } })
    await prisma.externalSignalSource.deleteMany({ where: { brandId: id } })
    await prisma.caseFollowUp.deleteMany({ where: { brandId: id } })
    await prisma.alertRule.deleteMany({ where: { brandId: id } })
    await prisma.surveyResponse.deleteMany({ where: { brandId: id } })
    await prisma.surveyRule.deleteMany({ where: { brandId: id } })
    await prisma.campaignEvent.deleteMany({ where: { brandId: id } })
    await prisma.campaign.deleteMany({ where: { brandId: id } })
    await prisma.survey.deleteMany({ where: { brandId: id } })
    await prisma.surveyTheme.deleteMany({ where: { brandId: id } })
    await prisma.redemption.deleteMany({ where: { brandId: id } })
    await prisma.reward.deleteMany({ where: { brandId: id } })
    await prisma.loyaltyEvent.deleteMany({ where: { brandId: id } })
    await prisma.memberNote.deleteMany({ where: { brandId: id } })
    await prisma.tier.deleteMany({ where: { brandId: id } })
    await prisma.member.deleteMany({ where: { brandId: id } })
    await prisma.earningRule.deleteMany({ where: { brandId: id } })
    await prisma.program.deleteMany({ where: { brandId: id } })
    try { await prisma.kBArticle.deleteMany({ where: { brandId: id } }) } catch { /* table may not exist locally */ }
    await prisma.brand.delete({ where: { id } })
  }
}

async function main() {
  console.log('🌱 Seeding Acme Coffee brand + dependencies...\n')

  // Use the pre-created brand (mapped to Clerk org)
  const brand = await prisma.brand.findUnique({ where: { id: ACME_BRAND_ID } })
  if (!brand) throw new Error(`Brand ${ACME_BRAND_ID} not found — run Clerk org setup first`)
  console.log(`  ✅ Brand:   ${brand.id}  (${brand.name})`)

  // ── 2. Loyalty Program ───────────────────────────────────────────────
  const program = await prisma.program.create({
    data: {
      brandId: brand.id,
      name: 'Acme Rewards',
      slug: `acme-rewards-${Date.now()}`,
      description: 'Earn Beans for every coffee you buy',
      pointCurrencyName: 'Beans',
      pointToCurrencyRatio: 0.01,
      status: 'ACTIVE',
      type: 'POINTS',
    },
  })
  console.log(`  ✅ Program: ${program.id}  (slug: ${program.slug})`)

  // ── 3. Earning Rule ──────────────────────────────────────────────────
  // 50 Beans flat per purchase keeps the demo short: a single checkout
  // gives the member enough to redeem the 30-pt discount reward live.
  // Real integrations would use conditions/payload.amount to scale with
  // dollar value; doing that here would make the seed more complex than
  // it needs to be for demo purposes.
  await prisma.earningRule.create({
    data: {
      brandId: brand.id,
      programId: program.id,
      name: '50 Beans per purchase',
      triggerEvent: 'purchase',
      pointsAwarded: 50,
      multiplier: 1.0,
      priority: 0,
      stackable: false,
    },
  })
  console.log(`  ✅ Earning rule: 50 Beans per purchase`)

  // ── 4. Rewards ───────────────────────────────────────────────────────
  const rewards = await Promise.all([
    prisma.reward.create({
      data: {
        brandId: brand.id,
        programId: program.id,
        name: 'Free House Blend bag',
        description: 'Redeem a full bag of Acme House Blend',
        pointsCost: 50,
        type: 'FREE_ITEM',
        isAvailable: true,
      },
    }),
    prisma.reward.create({
      data: {
        brandId: brand.id,
        programId: program.id,
        name: '20% off next order',
        description: 'Discount code for your next purchase',
        pointsCost: 30,
        type: 'DISCOUNT',
        isAvailable: true,
      },
    }),
    prisma.reward.create({
      data: {
        brandId: brand.id,
        programId: program.id,
        name: 'Roastery tour experience',
        description: 'Private tour + tasting at the Acme roastery',
        pointsCost: 500,
        type: 'EXPERIENCE',
        isAvailable: true,
      },
    }),
  ])
  console.log(`  ✅ Rewards: ${rewards.length} created`)

  // ── 5. Brand theme (Issue #291 — was SurveyTheme; brand-level visual identity only) ─
  const theme = await prisma.brandTheme.create({
    data: {
      brandId: brand.id,
      name: 'Acme Coffee Theme',
      primaryColor: '#d97706',
      backgroundColor: '#faf8f4',
      fontFamily: 'Inter, system-ui, sans-serif',
    },
  })

  // ── 6. NPS + CSAT surveys ────────────────────────────────────────────
  const npsSurvey = await prisma.survey.create({
    data: {
      brandId: brand.id,
      programId: program.id,
      name: 'Post-Purchase NPS',
      type: 'NPS',
      status: 'ACTIVE',
      incentivePoints: 10,
      themeId: theme.id,
      questions: [
        {
          id: 'q1',
          type: 'rating', // widget.js only handles 'rating'|'text'|'choice' — NPS range comes from survey.type
          text: 'How likely are you to recommend Acme Coffee to a friend?',
          required: true,
        },
        {
          id: 'q2',
          type: 'text',
          text: 'Tell us more about your experience',
          required: false,
        },
      ],
      settings: { channel: 'in_app' },
    },
  })
  console.log(`  ✅ NPS survey:  ${npsSurvey.id}`)

  const csatSurvey = await prisma.survey.create({
    data: {
      brandId: brand.id,
      programId: program.id,
      name: 'Support Ticket CSAT',
      type: 'CSAT',
      status: 'ACTIVE',
      incentivePoints: 5,
      themeId: theme.id,
      questions: [
        {
          id: 'q1',
          type: 'rating',
          text: 'How satisfied were you with our support?',
          required: true,
        },
      ],
      settings: { channel: 'email' },
    },
  })
  console.log(`  ✅ CSAT survey: ${csatSurvey.id}`)

  // ── 7. Alert rule for detractors ─────────────────────────────────────
  await prisma.alertRule.create({
    data: {
      brandId: brand.id,
      name: 'NPS Detractor Alert',
      status: 'ACTIVE',
      surveyTypes: ['NPS'],
      scoreMin: 0,
      scoreMax: 6,
      emailRecipients: ['cx@acmecoffee.io'],
      defaultAssignee: 'cx-lead@acmecoffee.io',
      slaHours: 4,
    },
  })
  console.log(`  ✅ Alert rule: NPS 0-6 → case follow-up (4h SLA)`)

  // ── 8. External signal source (Google reviews) ───────────────────────
  const reviewSource = await prisma.externalSignalSource.create({
    data: {
      brandId: brand.id,
      name: 'Acme Google Business Profile',
      sourceType: 'GOOGLE_BUSINESS_PROFILE',
      connectionMethod: 'webhook',
      syncMode: 'WEBHOOK',
      enabled: true,
      scopeConfig: { locationId: 'fake-acme-location' },
      matchingConfig: { memberResolutionEnabled: true },
      credentialRef: 'acme-review-source-secret',
    },
  })
  console.log(`  ✅ Review source: ${reviewSource.id}`)

  // ── 9. KB article for RAG search ─────────────────────────────────────
  // Gracefully degrade if the local DB doesn't have the kb_articles table
  // (requires pgvector extension). On prod or any DB with pgvector this
  // will succeed; locally without pgvector we skip and the KB search
  // endpoint just returns empty results during the demo.
  try {
    await prisma.kBArticle.create({
      data: {
        brandId: brand.id,
        title: 'How to redeem Beans rewards',
        body: `Redeeming your Beans is easy! Log into your Acme Coffee account, navigate to the Rewards page, and pick any reward you can afford with your current Beans balance. Free items ship with your next order. Discount codes are emailed instantly. Experiences are booked through our concierge team within 48 hours.`,
        category: 'PRODUCT_GUIDE',
        tags: ['rewards', 'redemption', 'loyalty'],
        status: 'PUBLISHED',
      },
    })
    console.log(`  ✅ KB article: "How to redeem Beans rewards"`)
  } catch {
    console.log(`  ⚠️  KB article skipped (local DB missing kb_articles/pgvector — not blocking)`)
  }
  console.log(`  ✅ KB article: "How to redeem Beans rewards"`)

  // ── Output ──────────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🎉 Acme Coffee brand seeded! Copy this into your .env:')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  console.log(`CUSTOMEREQ_API_URL="http://localhost:4001"`)
  console.log(`CUSTOMEREQ_API_KEY="${ACME_API_KEY}"`)
  console.log(`CUSTOMEREQ_BRAND_ID="${brand.id}"`)
  console.log(`CUSTOMEREQ_PROGRAM_SLUG="${program.slug}"`)
  console.log(`CUSTOMEREQ_NPS_SURVEY_ID="${npsSurvey.id}"`)
  console.log(`CUSTOMEREQ_CSAT_SURVEY_ID="${csatSurvey.id}"`)
  console.log(`CUSTOMEREQ_REVIEW_SOURCE_ID="${reviewSource.id}"`)
  console.log(`CUSTOMEREQ_REVIEW_SOURCE_SECRET="acme-review-source-secret"`)
  console.log(`PORT=5050\n`)
  console.log('And launch the dedicated demo API server with matching env:')
  console.log(`  QUEUE_MODE=inline MCP_API_KEY="${ACME_API_KEY}" MCP_BRAND_ID="${brand.id}" API_PORT=4001 pnpm --filter @customerEQ/api dev\n`)
}

main()
  .catch((err) => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())

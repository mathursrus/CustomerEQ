#!/usr/bin/env node
/**
 * Seed realistic rep-notes demo data to illustrate the full CRM flow:
 * plain notes, sentiment-tagged notes that move health scores, and
 * scenarios that produce both inconsistency flags.
 */
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { PrismaClient } = require('../node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma/client')

const p = new PrismaClient({
  datasources: { db: { url: 'postgresql://customereq:peHVp0K5plRlGZN9cJi04G8URubH2Wc@customereq-db.postgres.database.azure.com:5432/customereq?sslmode=require' } },
})

const BRAND_ID = '2f33570b-d0dc-467c-a3c3-bfc9f32d99e8'

async function main() {
  console.log('Seeding CRM notes demo data...\n')

  // Pick scenarios: 2 auto_healthy_rep_concerned, 2 auto_weak_rep_positive,
  // 3 concordant positive, 2 concordant negative, 4 untagged notes
  const healthy = await p.$queryRawUnsafe(`
    SELECT id FROM members
    WHERE "brandId" = $1
      AND "healthScoreBreakdown" IS NOT NULL
      AND ("healthScoreBreakdown"->>'baseScore')::int >= 70
      AND ("healthScoreBreakdown"->>'noteModifier')::int = 0
    ORDER BY random() LIMIT 5
  `, BRAND_ID)

  const weak = await p.$queryRawUnsafe(`
    SELECT id FROM members
    WHERE "brandId" = $1
      AND "healthScoreBreakdown" IS NOT NULL
      AND ("healthScoreBreakdown"->>'baseScore')::int <= 40
      AND ("healthScoreBreakdown"->>'noteModifier')::int = 0
    ORDER BY random() LIMIT 5
  `, BRAND_ID)

  const mid = await p.$queryRawUnsafe(`
    SELECT id FROM members
    WHERE "brandId" = $1
      AND "healthScoreBreakdown" IS NOT NULL
      AND ("healthScoreBreakdown"->>'baseScore')::int BETWEEN 50 AND 70
      AND ("healthScoreBreakdown"->>'noteModifier')::int = 0
    ORDER BY random() LIMIT 6
  `, BRAND_ID)

  const scenarios = [
    // Healthy + rep says churn → auto_healthy_rep_concerned
    { memberId: healthy[0]?.id, body: 'Long-time customer reached out furious about the last billing change. Says if we do not reverse it, they will walk. Their auto-renewal is in 45 days. Flagging as churn risk and escalating to account team.', category: 'call', sentiment: 'very_negative', author: 'sarah.k@customereq.demo' },
    { memberId: healthy[1]?.id, body: 'Quarterly check-in call turned sour fast - they have shopped around and a competitor is offering 30% less for similar capability. Customer wants a firm "why stay" answer by end of week.', category: 'meeting', sentiment: 'negative', author: 'account-exec@customereq.demo' },

    // Weak + rep says happy → auto_weak_rep_positive
    { memberId: weak[0]?.id, body: 'Expansion call went great. Customer is delegating day-to-day usage to a new junior team member (explains the low engagement signals) but is super happy with the strategic outcomes. Renewing for 2 more years and buying additional seats.', category: 'meeting', sentiment: 'very_positive', author: 'csm@customereq.demo' },
    { memberId: weak[1]?.id, body: 'Customer has been quiet but that is because they are in a heads-down phase - they confirmed the product is working as expected and they expect activity to spike after their Q2 launch.', category: 'email', sentiment: 'positive', author: 'support@customereq.demo' },

    // Concordant positive (no flag)
    { memberId: mid[0]?.id, body: 'Customer volunteered a testimonial for our case-study program. Will connect us with their CMO next week.', category: 'call', sentiment: 'very_positive', author: 'marketing@customereq.demo' },
    { memberId: mid[1]?.id, body: 'Checked in after their first month - onboarding smooth, adoption ahead of plan. No blockers.', category: 'email', sentiment: 'positive', author: 'csm@customereq.demo' },
    { memberId: mid[2]?.id, body: 'Proactively flagged an edge case in their workflow - our team shipped a fix within 48 hours. Customer grateful.', category: 'note', sentiment: 'positive', author: 'support@customereq.demo' },

    // Concordant negative (no flag - auto signals already say weak)
    { memberId: weak[2]?.id, body: 'Third unresolved ticket in two weeks. Customer is losing patience. Need engineering attention.', category: 'escalation', sentiment: 'negative', author: 'support-lead@customereq.demo' },
    { memberId: weak[3]?.id, body: 'Customer missed last two payments and has not responded to reach-outs. At risk of involuntary churn.', category: 'escalation', sentiment: 'very_negative', author: 'finance@customereq.demo' },

    // Untagged notes (no health-score impact)
    { memberId: mid[3]?.id, body: 'Moved contact from Mike to Priya after reorg. Updated primary POC.', category: 'note', sentiment: null, author: 'csm@customereq.demo' },
    { memberId: mid[4]?.id, body: 'Customer attended our webinar on advanced workflows.', category: 'note', sentiment: null, author: 'marketing@customereq.demo' },
    { memberId: mid[5]?.id, body: 'Invoice #2026-0412 sent, due by month end.', category: 'email', sentiment: null, author: 'finance@customereq.demo' },
    { memberId: healthy[2]?.id, body: 'Added to beta program invite list for Q3 feature launches.', category: 'note', sentiment: null, author: 'product@customereq.demo' },
  ].filter((s) => s.memberId)

  console.log(`Creating ${scenarios.length} notes...`)
  const now = Date.now()
  for (const s of scenarios) {
    const ageHours = Math.floor(Math.random() * 48)
    await p.memberNote.create({
      data: {
        brandId: BRAND_ID,
        memberId: s.memberId,
        body: s.body,
        author: s.author,
        category: s.category,
        sentiment: s.sentiment,
        createdAt: new Date(now - ageHours * 60 * 60 * 1000),
      },
    })
  }
  console.log(`Created ${scenarios.length} notes.\n`)

  // Now recompute health scores for all members that got sentiment-tagged notes
  const impactedIds = [...new Set(scenarios.filter((s) => s.sentiment).map((s) => s.memberId))]
  console.log(`Recomputing health scores for ${impactedIds.length} impacted customers...`)

  // Reuse the live endpoint via its inline mode for correctness
  const { processHealthScoreComputation } = await import('../apps/api/dist/queues/healthScore.js').catch(() => ({}))
  if (processHealthScoreComputation) {
    for (const id of impactedIds) {
      await processHealthScoreComputation({ brandId: BRAND_ID, memberId: id })
    }
  } else {
    // Fallback: call API directly
    const API = 'https://customereq-api.salmonsea-4eb14bdc.eastus.azurecontainerapps.io'
    const K = 'ceq_c3697a733b642e66a36a0230a91392c0b87417a2362fd924e6fece60ad8b71ec'
    for (const id of impactedIds) {
      await fetch(`${API}/v1/admin/health-scores/recompute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': K },
        body: JSON.stringify({ memberId: id }),
      })
      await new Promise((r) => setTimeout(r, 500))
    }
  }
  console.log('Recompute done.\n')

  // Summary
  const inconsistencies = await p.$queryRawUnsafe(`
    SELECT "healthScoreBreakdown"->>'inconsistency' as flag, COUNT(*)::int as c
    FROM members WHERE "brandId" = $1
      AND "healthScoreBreakdown"->>'inconsistency' IS NOT NULL
      AND "healthScoreBreakdown"->>'inconsistency' != 'null'
    GROUP BY 1
  `, BRAND_ID)
  console.log('Inconsistency flags in prod:', inconsistencies)
  const totalNotes = await p.memberNote.count({ where: { brandId: BRAND_ID } })
  const tagged = await p.memberNote.count({ where: { brandId: BRAND_ID, sentiment: { not: null } } })
  console.log(`Total notes: ${totalNotes} (${tagged} sentiment-tagged)`)

  await p.$disconnect()
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })

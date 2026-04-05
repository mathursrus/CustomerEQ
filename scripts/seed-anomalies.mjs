#!/usr/bin/env node
/**
 * Inject realistic anomaly detection results so the CX Insights page shows
 * the anomaly detection feature end-to-end. Writes FeedbackAnomaly records
 * tied to existing clusters and marks recent snapshots as anomalous.
 */
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { PrismaClient } = require('../node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma/client')

const p = new PrismaClient({
  datasources: { db: { url: 'postgresql://customereq:peHVp0K5plRlGZN9cJi04G8URubH2Wc@customereq-db.postgres.database.azure.com:5432/customereq?sslmode=require' } },
})

const BRAND_ID = '2f33570b-d0dc-467c-a3c3-bfc9f32d99e8'

async function main() {
  console.log('🚨 Injecting feedback anomalies...\n')

  const clusters = await p.feedbackCluster.findMany({
    where: { brandId: BRAND_ID },
    select: { id: true, label: true },
  })
  const byLabel = Object.fromEntries(clusters.map(c => [c.label, c.id]))
  console.log('  Clusters found:', Object.keys(byLabel).join(', '))

  const now = new Date()
  const daysAgo = (n) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000)

  // Scenario-driven anomalies
  const anomalies = [
    {
      clusterId: byLabel['Shipping Delays'],
      type: 'volume_spike',
      severity: 'high',
      summary: 'Shipping complaints spiked 3.4x in the last 3 days — 42 responses vs. 12/day baseline.',
      detectedAt: daysAgo(1),
      metadata: { zScore: 3.8, observedVolume: 42, baselineVolume: 12, windowDays: 3 },
    },
    {
      clusterId: byLabel['Customer Support'],
      type: 'sentiment_drop',
      severity: 'high',
      summary: 'Customer Support sentiment dropped from -0.02 to -0.31 over 7 days (Δ -0.29).',
      detectedAt: daysAgo(2),
      metadata: { zScore: -2.9, currentSentiment: -0.31, baselineSentiment: -0.02, windowDays: 7 },
    },
    {
      clusterId: byLabel['Product Quality'],
      type: 'new_theme',
      severity: 'medium',
      summary: 'New sub-theme "defective after 1 week" emerging — 18 responses in last 5 days.',
      detectedAt: daysAgo(3),
      metadata: { zScore: 2.4, emergingKeywords: ['defective', 'broke', 'week'], volumeDelta: 18 },
    },
    {
      clusterId: byLabel['Website & App UX'],
      type: 'volume_decline',
      severity: 'low',
      summary: 'Website UX complaints dropped 47% after checkout redesign — healthy trend.',
      detectedAt: daysAgo(5),
      resolvedAt: daysAgo(5), // positive anomaly, already acknowledged
      metadata: { zScore: -2.1, currentVolume: 14, baselineVolume: 26, percentChange: -47 },
    },
    {
      clusterId: null, // brand-level anomaly
      type: 'volume_spike',
      severity: 'medium',
      summary: 'Overall survey response volume up 28% week-over-week — likely post-campaign effect.',
      detectedAt: daysAgo(4),
      metadata: { zScore: 2.2, currentVolume: 187, baselineVolume: 146 },
    },
  ]

  let created = 0
  for (const a of anomalies) {
    if (a.clusterId === undefined) continue // label not found
    await p.feedbackAnomaly.create({
      data: { brandId: BRAND_ID, ...a },
    })
    created++
    console.log(`  ✓ [${a.severity}] ${a.type}: ${a.summary.slice(0, 70)}...`)
  }

  // Mark the most recent snapshots for Shipping Delays + Customer Support as anomalous
  if (byLabel['Shipping Delays']) {
    const updated = await p.clusterSnapshot.updateMany({
      where: {
        brandId: BRAND_ID,
        clusterId: byLabel['Shipping Delays'],
        bucketDate: { gte: daysAgo(3) },
      },
      data: { isAnomaly: true, zScore: 3.8 },
    })
    console.log(`\n  ✓ Marked ${updated.count} Shipping snapshots as anomalous`)
  }
  if (byLabel['Customer Support']) {
    const updated = await p.clusterSnapshot.updateMany({
      where: {
        brandId: BRAND_ID,
        clusterId: byLabel['Customer Support'],
        bucketDate: { gte: daysAgo(2) },
      },
      data: { isAnomaly: true, zScore: -2.9 },
    })
    console.log(`  ✓ Marked ${updated.count} Customer Support snapshots as anomalous`)
  }

  console.log(`\n✨ Created ${created} anomalies`)
  await p.$disconnect()
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })

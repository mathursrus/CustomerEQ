#!/usr/bin/env node
/**
 * Direct DB seed for loyalty events + member balances.
 * /v1/events HTTP path is queue-gated on Redis, which is disabled in prod.
 * Writes directly to loyalty_events and updates member pointsBalance.
 */
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { PrismaClient } = require('../node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma/client')

const p = new PrismaClient({
  datasources: { db: { url: 'postgresql://customereq:peHVp0K5plRlGZN9cJi04G8URubH2Wc@customereq-db.postgres.database.azure.com:5432/customereq?sslmode=require' } },
})

const BRAND_ID = '2f33570b-d0dc-467c-a3c3-bfc9f32d99e8'

const EVENT_DEFS = [
  { type: 'purchase.completed', points: () => 50 + Math.floor(Math.random() * 200), payload: () => ({ orderId: `ord_${Math.random().toString(36).slice(2, 10)}`, orderValue: 20 + Math.floor(Math.random() * 200), items: 1 + Math.floor(Math.random() * 4) }) },
  { type: 'member.referred', points: () => 200, payload: () => ({ referredEmail: `friend${Math.floor(Math.random() * 1000)}@example.com` }) },
  { type: 'app.engagement', points: () => 10, payload: () => ({ action: ['login', 'browse', 'wishlist_add', 'review_posted'][Math.floor(Math.random() * 4)] }) },
  { type: 'reward.redeemed', points: () => -[250, 500, 750, 1000][Math.floor(Math.random() * 4)], payload: () => ({ rewardName: ['$5 off', '$10 off', 'Free shipping'][Math.floor(Math.random() * 3)] }) },
  { type: 'review.posted', points: () => 25, payload: () => ({ rating: 3 + Math.floor(Math.random() * 3), productId: `prod_${Math.floor(Math.random() * 100)}` }) },
  { type: 'tier.upgraded', points: () => 0, payload: () => ({ fromTier: 'Silver', toTier: 'Gold' }) },
]

async function main() {
  console.log('💎 Seeding loyalty events directly into DB...')

  const members = await p.member.findMany({
    where: { brandId: BRAND_ID, deletedAt: null, consentGivenAt: { not: null } },
    select: { id: true, pointsBalance: true },
    take: 80,
    orderBy: { createdAt: 'desc' },
  })
  console.log(`  Members eligible: ${members.length}`)

  // ~5 events per member with varied types & ages
  const events = []
  const balanceDeltas = new Map()
  const now = Date.now()
  for (const m of members) {
    const count = 3 + Math.floor(Math.random() * 5) // 3-7 events
    for (let i = 0; i < count; i++) {
      const def = EVENT_DEFS[Math.floor(Math.random() * EVENT_DEFS.length)]
      const points = def.points()
      const ageMinutes = Math.floor(Math.random() * 60 * 24 * 45) // spread over 45 days
      const createdAt = new Date(now - ageMinutes * 60 * 1000)
      events.push({
        brandId: BRAND_ID,
        memberId: m.id,
        eventType: def.type,
        payload: def.payload(),
        pointsEarned: points,
        idempotencyKey: `seed:${m.id}:${def.type}:${i}:${createdAt.getTime()}`,
        createdAt,
        processedAt: createdAt,
        rulesApplied: [],
      })
      balanceDeltas.set(m.id, (balanceDeltas.get(m.id) ?? 0) + points)
    }
  }

  console.log(`  Creating ${events.length} loyalty_events...`)
  // Bulk insert
  let inserted = 0
  const BATCH = 50
  for (let i = 0; i < events.length; i += BATCH) {
    const batch = events.slice(i, i + BATCH)
    const r = await p.loyaltyEvent.createMany({ data: batch, skipDuplicates: true })
    inserted += r.count
  }
  console.log(`  ✅ Inserted ${inserted} events`)

  console.log(`  Updating ${balanceDeltas.size} member balances...`)
  for (const [memberId, delta] of balanceDeltas) {
    const m = members.find(x => x.id === memberId)
    const newBalance = Math.max(0, m.pointsBalance + delta)
    await p.member.update({ where: { id: memberId }, data: { pointsBalance: newBalance } })
  }
  console.log(`  ✅ Balances updated`)

  // Summary
  const byType = await p.$queryRawUnsafe(`SELECT "eventType", COUNT(*)::int as c FROM loyalty_events WHERE "brandId"='${BRAND_ID}' GROUP BY 1 ORDER BY 2 DESC`)
  console.log('\n  Final by type:', byType)
  const topBalances = await p.$queryRawUnsafe(`SELECT email, "pointsBalance" FROM members WHERE "brandId"='${BRAND_ID}' AND "pointsBalance" > 0 ORDER BY "pointsBalance" DESC LIMIT 5`)
  console.log('  Top 5 balances:', topBalances)

  await p.$disconnect()
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })

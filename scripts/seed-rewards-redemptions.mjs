#!/usr/bin/env node
/**
 * Seed Diamond Loyalty rewards + corresponding Redemption records so
 * /v1/analytics/program-health shows a realistic redemption rate and
 * top-rewards chart has data.
 */
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { PrismaClient } = require('../node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma/client')

const p = new PrismaClient({
  datasources: { db: { url: 'postgresql://customereq:peHVp0K5plRlGZN9cJi04G8URubH2Wc@customereq-db.postgres.database.azure.com:5432/customereq?sslmode=require' } },
})

const BRAND_ID = '2f33570b-d0dc-467c-a3c3-bfc9f32d99e8'
const DIAMOND_PROGRAM_ID = 'cmn9kiqjs000110d1p5ikp3kr'

const REWARDS = [
  { name: '$5 Off Next Order', pointsCost: 250, type: 'DISCOUNT', description: 'Save $5 on your next purchase' },
  { name: '$10 Off Next Order', pointsCost: 500, type: 'DISCOUNT', description: 'Save $10 on your next purchase' },
  { name: '$25 Amazon Gift Card', pointsCost: 1000, type: 'VOUCHER', description: 'Delivered via email within minutes' },
  { name: 'Free Express Shipping', pointsCost: 300, type: 'DISCOUNT', description: 'Upgrade one order to 2-day shipping' },
  { name: 'Free Product Sample Kit', pointsCost: 750, type: 'FREE_ITEM', description: 'Curated 3-item sample kit' },
  { name: 'Early Access to New Arrivals', pointsCost: 100, type: 'EXPERIENCE', description: '48-hour early access for Gold+ members' },
  { name: '$50 Off Order $200+', pointsCost: 2500, type: 'DISCOUNT', description: 'Big-ticket discount' },
]

async function main() {
  console.log('🎁 Seeding Diamond rewards + redemptions...\n')

  // Create rewards (idempotent by name within program)
  const rewardMap = {}
  for (const r of REWARDS) {
    const existing = await p.reward.findFirst({ where: { brandId: BRAND_ID, programId: DIAMOND_PROGRAM_ID, name: r.name } })
    if (existing) { rewardMap[r.name] = existing; console.log(`  = ${r.name} (existed)`); continue }
    const created = await p.reward.create({
      data: { brandId: BRAND_ID, programId: DIAMOND_PROGRAM_ID, ...r, isAvailable: true, eligibleTierIds: [] },
    })
    rewardMap[r.name] = created
    console.log(`  ✓ ${r.name} (${r.pointsCost} pts)`)
  }

  // Seed redemptions: a realistic distribution over the last 30 days
  const members = await p.member.findMany({
    where: { brandId: BRAND_ID, deletedAt: null, pointsBalance: { gt: 0 } },
    select: { id: true, pointsBalance: true },
    take: 80,
    orderBy: { pointsBalance: 'desc' },
  })
  console.log(`\n  ${members.length} members with balances`)

  // Distribution: Some rewards are popular, others rare
  const weightedRewards = [
    { reward: rewardMap['$5 Off Next Order'], weight: 40, status: 'FULFILLED' },
    { reward: rewardMap['$10 Off Next Order'], weight: 25, status: 'FULFILLED' },
    { reward: rewardMap['Early Access to New Arrivals'], weight: 20, status: 'FULFILLED' },
    { reward: rewardMap['Free Express Shipping'], weight: 15, status: 'FULFILLED' },
    { reward: rewardMap['$25 Amazon Gift Card'], weight: 8, status: 'FULFILLED' },
    { reward: rewardMap['Free Product Sample Kit'], weight: 6, status: 'PENDING' },
    { reward: rewardMap['$50 Off Order $200+'], weight: 2, status: 'FULFILLED' },
  ]
  const totalW = weightedRewards.reduce((s, w) => s + w.weight, 0)
  const pick = () => {
    let r = Math.random() * totalW
    for (const w of weightedRewards) { r -= w.weight; if (r <= 0) return w }
    return weightedRewards[0]
  }

  const now = Date.now()
  const toCreate = []
  for (const m of members) {
    const count = Math.floor(Math.random() * 3) // 0-2 redemptions per member
    for (let i = 0; i < count; i++) {
      const w = pick()
      const ageDays = Math.floor(Math.random() * 30)
      toCreate.push({
        brandId: BRAND_ID,
        memberId: m.id,
        rewardId: w.reward.id,
        pointsSpent: w.reward.pointsCost,
        status: w.status,
        createdAt: new Date(now - ageDays * 24 * 60 * 60 * 1000),
      })
    }
  }
  const result = await p.redemption.createMany({ data: toCreate })
  console.log(`  ✓ ${result.count} redemptions created`)

  // Summary
  const byReward = await p.$queryRawUnsafe(`
    SELECT r.name, COUNT(*)::int as c, SUM(rd."pointsSpent")::int as pts
    FROM redemptions rd JOIN rewards r ON rd."rewardId" = r.id
    WHERE rd."brandId" = '${BRAND_ID}'
    GROUP BY r.name ORDER BY c DESC
  `)
  console.log('\n  Top rewards:')
  for (const r of byReward) console.log(`    ${r.name}: ${r.c} redemptions, ${r.pts} pts spent`)

  await p.$disconnect()
  console.log('\n✨ Done')
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })

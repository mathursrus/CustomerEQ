// Seed CX analytics mock data for the CustomerEQ Dev Org
// Run: node scripts/seed-cx-data.mjs

import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { PrismaClient } = require('../node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma/client')

const p = new PrismaClient({
  datasources: { db: { url: 'postgresql://customereq:customereq@localhost:5432/customereq' } },
})

const BRAND_ID = 'cmn689ibu000089tqad1g234t'

async function seed() {
  // Create members
  const memberEmails = [
    'bob@example.com', 'carol@example.com', 'dave@example.com', 'eve@example.com',
    'frank@example.com', 'grace@example.com', 'hank@example.com', 'iris@example.com',
    'jack@example.com', 'kate@example.com',
  ]
  const members = []
  for (const email of memberEmails) {
    const m = await p.member.upsert({
      where: { brandId_email: { brandId: BRAND_ID, email } },
      update: {},
      create: {
        brandId: BRAND_ID, email,
        firstName: email.split('@')[0],
        lastName: 'Test',
        consentGivenAt: new Date(),
      },
    })
    members.push(m)
  }
  console.log('Members:', members.length)

  // Get a program for the survey
  const program = await p.program.findFirst({ where: { brandId: BRAND_ID } })
  if (!program) { console.error('No program found for brand'); return }

  // Create NPS survey
  let survey = await p.survey.findFirst({ where: { brandId: BRAND_ID, name: 'Customer NPS Q1 2026' } })
  if (!survey) {
    survey = await p.survey.create({
      data: {
        brandId: BRAND_ID,
        programId: program.id,
        name: 'Customer NPS Q1 2026',
        type: 'NPS',
        status: 'ACTIVE',
        questions: [
          { id: 'q1', text: 'How likely to recommend? (0-10)', type: 'rating', required: true },
          { id: 'q2', text: 'Tell us more', type: 'text', required: false },
        ],
        incentivePoints: 25,
      },
    })
  }
  console.log('Survey:', survey.id)

  // Create clusters
  const clusterDefs = [
    { label: 'Shipping Delays', description: 'Complaints about long delivery times and tracking issues', keywords: ['shipping', 'delivery', 'slow', 'tracking', 'weeks'] },
    { label: 'Product Quality', description: 'Feedback about product defects, durability, and quality', keywords: ['quality', 'broken', 'defective', 'damaged', 'excellent'] },
    { label: 'Customer Support', description: 'Experiences with the support team and response times', keywords: ['support', 'agent', 'help', 'hold', 'resolved'] },
    { label: 'Pricing & Value', description: 'Concerns about pricing tiers and value for money', keywords: ['price', 'expensive', 'value', 'billing', 'cost'] },
    { label: 'Website & App UX', description: 'Issues with checkout, mobile app, and navigation', keywords: ['checkout', 'mobile', 'app', 'crash', 'confusing'] },
    { label: 'Loyalty Rewards', description: 'Feedback about the rewards program and point redemption', keywords: ['rewards', 'points', 'loyalty', 'redeem', 'earned'] },
  ]

  const clusters = []
  for (const def of clusterDefs) {
    const c = await p.feedbackCluster.upsert({
      where: { brandId_label: { brandId: BRAND_ID, label: def.label } },
      update: { description: def.description, keywords: def.keywords },
      create: { brandId: BRAND_ID, ...def },
    })
    clusters.push(c)
  }
  console.log('Clusters:', clusters.length)

  // Create survey responses
  const feedbackSamples = [
    { text: 'Shipping took 3 weeks, unacceptable for a local order', sentiment: -0.7, score: 3, topics: ['shipping delays'], cluster: 'Shipping Delays' },
    { text: 'Product quality is outstanding, exactly as described', sentiment: 0.9, score: 9, topics: ['product quality'], cluster: 'Product Quality' },
    { text: 'Support agent was incredibly helpful and resolved my issue in 5 minutes', sentiment: 0.85, score: 10, topics: ['customer support'], cluster: 'Customer Support' },
    { text: 'Way too expensive for what you get. Competitors are half the price.', sentiment: -0.5, score: 4, topics: ['pricing'], cluster: 'Pricing & Value' },
    { text: 'Mobile app crashes every time I try to checkout. Very frustrating.', sentiment: -0.8, score: 2, topics: ['website experience', 'checkout'], cluster: 'Website & App UX' },
    { text: 'Love the rewards program! Earned enough for a free item already', sentiment: 0.9, score: 10, topics: ['rewards program'], cluster: 'Loyalty Rewards' },
    { text: 'Package arrived damaged and open. Had to initiate a return.', sentiment: -0.6, score: 3, topics: ['shipping', 'product quality'], cluster: 'Shipping Delays' },
    { text: 'Great product overall but delivery took too long', sentiment: 0.1, score: 6, topics: ['product quality', 'shipping'], cluster: 'Shipping Delays' },
    { text: 'Called support three times, still no resolution. Terrible.', sentiment: -0.9, score: 1, topics: ['customer support'], cluster: 'Customer Support' },
    { text: 'Checkout process is confusing, almost gave up and left', sentiment: -0.4, score: 5, topics: ['website experience'], cluster: 'Website & App UX' },
  ]

  for (let i = 0; i < feedbackSamples.length; i++) {
    const fb = feedbackSamples[i]
    const member = members[i % members.length]
    const cluster = clusters.find(c => c.label === fb.cluster)
    const daysAgo = Math.floor(Math.random() * 25)
    const completedAt = new Date()
    completedAt.setDate(completedAt.getDate() - daysAgo)

    await p.surveyResponse.upsert({
      where: { surveyId_memberId: { surveyId: survey.id, memberId: member.id } },
      update: {},
      create: {
        surveyId: survey.id,
        memberId: member.id,
        brandId: BRAND_ID,
        answers: { q1: fb.score, q2: fb.text },
        score: fb.score,
        sentiment: fb.sentiment,
        confidence: +(0.85 + Math.random() * 0.1).toFixed(2),
        topics: fb.topics,
        summary: fb.text.slice(0, 80),
        clusterId: cluster?.id ?? null,
        channel: ['email', 'link', 'in_app'][Math.floor(Math.random() * 3)],
        completedAt,
      },
    })
  }
  console.log('Responses:', feedbackSamples.length)

  // Update cluster stats
  for (const cluster of clusters) {
    const agg = await p.surveyResponse.aggregate({
      where: { clusterId: cluster.id },
      _count: true,
      _avg: { sentiment: true },
    })
    await p.feedbackCluster.update({
      where: { id: cluster.id },
      data: { responseCount: agg._count, avgSentiment: agg._avg.sentiment },
    })
  }
  console.log('Cluster stats updated')

  // Create 30 days of cluster snapshots
  for (const cluster of clusters) {
    const baseVolume = cluster.label === 'Shipping Delays' ? 5 : cluster.label === 'Product Quality' ? 3 : 2
    for (let day = 29; day >= 0; day--) {
      const bucketDate = new Date()
      bucketDate.setDate(bucketDate.getDate() - day)
      bucketDate.setHours(0, 0, 0, 0)

      let volume = baseVolume + Math.floor(Math.random() * 3)
      let isAnomaly = false
      let zScoreVal = null

      // Simulate spike in Shipping Delays in last 3 days
      if (cluster.label === 'Shipping Delays' && day < 3) {
        volume = baseVolume * 4 + Math.floor(Math.random() * 5)
        isAnomaly = true
        zScoreVal = +(2.5 + Math.random()).toFixed(2)
      }

      await p.clusterSnapshot.upsert({
        where: { clusterId_bucketDate: { clusterId: cluster.id, bucketDate } },
        update: { volume, avgSentiment: +(-0.3 + Math.random() * 0.6).toFixed(2), isAnomaly, zScore: zScoreVal },
        create: {
          clusterId: cluster.id,
          brandId: BRAND_ID,
          bucketDate,
          volume,
          avgSentiment: +(-0.3 + Math.random() * 0.6).toFixed(2),
          isAnomaly,
          zScore: zScoreVal,
        },
      })
    }
  }
  console.log('Snapshots: 30 days x 6 clusters = 180')

  // Create anomalies
  const shippingCluster = clusters.find(c => c.label === 'Shipping Delays')
  const uxCluster = clusters.find(c => c.label === 'Website & App UX')

  await p.feedbackAnomaly.createMany({
    data: [
      {
        brandId: BRAND_ID,
        clusterId: shippingCluster?.id,
        type: 'volume_spike',
        severity: 'high',
        summary: 'Shipping Delays cluster saw a 4x spike in the last 3 days (from avg 5/day to 20+/day). This correlates with the holiday shipping season. Recommend investigating carrier performance.',
      },
      {
        brandId: BRAND_ID,
        clusterId: uxCluster?.id,
        type: 'sentiment_drop',
        severity: 'medium',
        summary: 'Website & App UX cluster sentiment dropped from -0.2 to -0.6 over the past week. Multiple reports of checkout crashes on mobile. Recommend urgent mobile QA.',
      },
    ],
  })
  console.log('Anomalies: 2')

  await p.$disconnect()
  console.log('Done!')
}

seed().catch(e => { console.error(e); process.exit(1) })

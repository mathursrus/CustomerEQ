import type { PrismaClient } from '@prisma/client'
import { getTestPrisma } from './setup.js'

export interface SeedResult {
  brand: { id: string; clerkOrgId: string; name: string }
  program: { id: string; name: string; status: string }
  earningRule: { id: string; triggerEvent: string; pointsAwarded: number }
}

/**
 * Seeds the test database with 1 brand, 1 active program, and 1 earning rule.
 * Call in beforeEach() to get a clean state for each test.
 */
export async function seedTestDb(prisma?: PrismaClient): Promise<SeedResult> {
  prisma = prisma ?? getTestPrisma()
  // Clean all tenant data in order (foreign key safe)
  // Use try/catch for each in case a table doesn't exist in this test schema
  const deleteAll = async (model: { deleteMany: () => Promise<unknown> }) => {
    try { await model.deleteMany() } catch { /* table may not exist */ }
  }
  await deleteAll(prisma.auditEvent)
  await deleteAll((prisma as any).caseFollowUp)
  await deleteAll((prisma as any).alertRule)
  await deleteAll((prisma as any).questionTemplate)
  await deleteAll((prisma as any).brandTheme)
  await deleteAll(prisma.campaignEvent)
  await deleteAll(prisma.loyaltyEvent)
  await deleteAll(prisma.redemption)
  await deleteAll(prisma.reward)
  await deleteAll((prisma as any).surveyRule)  // must precede campaign (campaignId FK → campaigns RESTRICT)
  await deleteAll(prisma.campaign)
  await deleteAll(prisma.earningRule)
  await deleteAll(prisma.programVersion)
  await deleteAll(prisma.tier)
  await deleteAll(prisma.clusterSnapshot)
  await deleteAll(prisma.feedbackAnomaly)
  await deleteAll(prisma.surveyResponse)
  await deleteAll((prisma as any).surveyImportBatch)
  await deleteAll(prisma.feedbackCluster)
  await deleteAll(prisma.survey)
  await deleteAll((prisma as any).message)
  await deleteAll((prisma as any).conversation)
  await deleteAll((prisma as any).memberNote)
  await deleteAll((prisma as any).externalSignal)  // has memberId FK → must precede member
  await deleteAll(prisma.member)
  await deleteAll((prisma as any).cxPlaybook)
  await deleteAll(prisma.program)
  await deleteAll((prisma as any).webhookDeliveryLog)
  await deleteAll((prisma as any).webhookEndpoint)
  await deleteAll((prisma as any).externalSignalSource)
  await deleteAll((prisma as any).kBChunk)
  await deleteAll((prisma as any).kBArticle)
  await deleteAll((prisma as any).kBSource)
  await deleteAll((prisma as any).supportRule)
  await deleteAll((prisma as any).supportWidgetConfig)
  await deleteAll((prisma as any).mcpOAuthCode)
  await deleteAll((prisma as any).apiKey)
  await deleteAll(prisma.brand)
  await deleteAll(prisma.demoRequest)

  const brand = await prisma.brand.create({
    data: { clerkOrgId: 'org_test_seed', name: 'Test Brand' },
  })

  const program = await prisma.program.create({
    data: {
      brandId: brand.id,
      name: 'Test Loyalty Program',
      pointCurrencyName: 'Points',
      pointToCurrencyRatio: 0.01,
      status: 'ACTIVE',
    },
  })

  const earningRule = await prisma.earningRule.create({
    data: {
      brandId: brand.id,
      programId: program.id,
      name: 'Purchase Points',
      triggerEvent: 'purchase',
      pointsAwarded: 100,
      multiplier: 1.0,
      status: 'ACTIVE',
    },
  })

  return {
    brand: { id: brand.id, clerkOrgId: brand.clerkOrgId, name: brand.name },
    program: { id: program.id, name: program.name, status: program.status },
    earningRule: { id: earningRule.id, triggerEvent: earningRule.triggerEvent, pointsAwarded: earningRule.pointsAwarded },
  }
}

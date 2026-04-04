import type { Prisma } from '@prisma/client'
import { getTestPrisma } from '../db/setup.js'

let counter = 0

export async function createConversation(opts: {
  brandId: string
  memberId: string
  status?: 'ACTIVE' | 'WAITING_ON_CUSTOMER' | 'ESCALATED' | 'RESOLVED' | 'CLOSED'
  intent?: string
  confidence?: number
  topic?: string
  assignee?: string
}) {
  const prisma = getTestPrisma()
  counter++

  return prisma.conversation.create({
    data: {
      brandId: opts.brandId,
      memberId: opts.memberId,
      status: opts.status ?? 'ACTIVE',
      intent: opts.intent,
      confidence: opts.confidence,
      topic: opts.topic,
      assignee: opts.assignee,
    },
  })
}

export async function createMessage(opts: {
  conversationId: string
  role: 'CUSTOMER' | 'AI' | 'AGENT'
  content: string
  metadata?: Record<string, unknown>
}) {
  const prisma = getTestPrisma()

  return prisma.message.create({
    data: {
      conversationId: opts.conversationId,
      role: opts.role,
      content: opts.content,
      metadata: opts.metadata as Prisma.InputJsonValue ?? undefined,
    },
  })
}

export async function createSupportRule(opts: {
  brandId: string
  name?: string
  status?: string
  priority?: number
  intentFilters?: string[]
  tierFilters?: string[]
  healthScoreMin?: number | null
  healthScoreMax?: number | null
  topicFilters?: string[]
  conditions?: Record<string, unknown>
  autoRespondArticleId?: string | null
  escalateToAssignee?: string | null
  awardPoints?: number | null
  triggerSurveyId?: string | null
}) {
  const prisma = getTestPrisma()
  counter++

  return prisma.supportRule.create({
    data: {
      brandId: opts.brandId,
      name: opts.name ?? `Test Support Rule ${counter}`,
      status: opts.status ?? 'ACTIVE',
      priority: opts.priority ?? 0,
      intentFilters: opts.intentFilters ?? [],
      tierFilters: opts.tierFilters ?? [],
      healthScoreMin: opts.healthScoreMin ?? null,
      healthScoreMax: opts.healthScoreMax ?? null,
      topicFilters: opts.topicFilters ?? [],
      conditions: (opts.conditions ?? {}) as Prisma.InputJsonValue,
      autoRespondArticleId: opts.autoRespondArticleId ?? null,
      escalateToAssignee: opts.escalateToAssignee ?? null,
      awardPoints: opts.awardPoints ?? null,
      triggerSurveyId: opts.triggerSurveyId ?? null,
    },
  })
}

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
  channel?: 'WIDGET' | 'SLACK'
  anonId?: string | null
  email?: string | null
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
      channel: opts.channel ?? 'WIDGET',
      anonId: opts.anonId ?? null,
      email: opts.email ?? null,
    },
  })
}

export async function createMessage(opts: {
  conversationId: string
  role: 'CUSTOMER' | 'AI' | 'AGENT'
  content: string
  metadata?: Record<string, unknown>
  aiConfidence?: number | null
  aiSources?: Record<string, unknown> | null
  draftedByAi?: boolean
}) {
  const prisma = getTestPrisma()

  return prisma.message.create({
    data: {
      conversationId: opts.conversationId,
      role: opts.role,
      content: opts.content,
      metadata: opts.metadata as Prisma.InputJsonValue ?? undefined,
      aiConfidence: opts.aiConfidence ?? null,
      aiSources: opts.aiSources as Prisma.InputJsonValue ?? undefined,
      draftedByAi: opts.draftedByAi ?? false,
    },
  })
}

export async function createSupportRule(opts: {
  brandId: string
  name?: string
  status?: string
  priority?: number
  intentFilters?: string[]
  topicFilters?: string[]
  tierFilters?: string[]
  healthScoreMin?: number | null
  healthScoreMax?: number | null
  conditions?: Record<string, unknown>
  actionMode?: 'AUTO_REPLY' | 'DRAFT_FOR_AGENT' | 'ESCALATE'
  confidenceThreshold?: number
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
      name: opts.name ?? `rule_${counter}`,
      status: opts.status ?? 'ACTIVE',
      priority: opts.priority ?? 0,
      intentFilters: opts.intentFilters ?? [],
      topicFilters: opts.topicFilters ?? [],
      tierFilters: opts.tierFilters ?? [],
      healthScoreMin: opts.healthScoreMin ?? null,
      healthScoreMax: opts.healthScoreMax ?? null,
      conditions: (opts.conditions ?? {}) as Prisma.InputJsonValue,
      actionMode: opts.actionMode ?? 'ESCALATE',
      confidenceThreshold: opts.confidenceThreshold ?? 0.8,
      autoRespondArticleId: opts.autoRespondArticleId ?? null,
      escalateToAssignee: opts.escalateToAssignee ?? null,
      awardPoints: opts.awardPoints ?? null,
      triggerSurveyId: opts.triggerSurveyId ?? null,
    },
  })
}

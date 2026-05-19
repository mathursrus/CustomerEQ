import type { Job, ConnectionOptions } from 'bullmq'
import { Queue } from 'bullmq'
import { Redis } from 'ioredis'
import pino from 'pino'
import { prisma } from '@customerEQ/database'
import {
  evaluateSupportRules,
  type SupportRuleInput,
  type SupportRuleMatch,
  type SupportOrchestrationPayload,
  type KBChunkRetrieved,
  type SlackOutboundPayload,
  QUEUES,
} from '@customerEQ/shared'
import { classifySupportIntent } from '@customerEQ/ai/src/support/intent.js'
import { draftSupportReply } from '@customerEQ/ai/src/support/reply.js'
import { generateEmbedding } from '@customerEQ/ai/src/analysis/embeddings.js'
import { withConversationLock } from '../lib/conversationLock.js'

const logger = pino({ name: 'support-orchestration' })

const TOP_K = 5
const SIMILARITY_THRESHOLD = 0.7

const LOCK_TTL_MS = 60_000
const LOCK_RETRY_DELAY_MS = 250
const LOCK_MAX_RETRIES = 60

let _redis: Redis | null = null
function getRedis(): Redis {
  if (_redis) return _redis
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379'
  _redis = new Redis(url, { maxRetriesPerRequest: null })
  return _redis
}

let _slackQueue: Queue | null = null
function getSlackQueue(): Queue {
  if (!_slackQueue) {
    _slackQueue = new Queue(QUEUES.SLACK_OUTBOUND, { connection: getRedis() })
  }
  return _slackQueue
}

async function enqueueSlackOutbound(payload: SlackOutboundPayload): Promise<void> {
  await getSlackQueue().add('notify', payload)
}

export function createSupportOrchestrationProcessor(_connection: ConnectionOptions) {
  return (job: Job<SupportOrchestrationPayload>) => processSupportOrchestration(job)
}

export async function processSupportOrchestration(
  job: Job<SupportOrchestrationPayload>,
): Promise<void> {
  const { conversationId, brandId, memberId, messageContent } = job.data
  const redis = getRedis()

  return withConversationLock(
    redis,
    conversationId,
    () => runOrchestration({ conversationId, brandId, memberId, messageContent }),
    { ttlMs: LOCK_TTL_MS, retryDelayMs: LOCK_RETRY_DELAY_MS, maxRetries: LOCK_MAX_RETRIES },
  )
}

interface OrchestrationCtx {
  conversationId: string
  brandId: string
  memberId: string | null
  messageContent: string
}

async function runOrchestration(ctx: OrchestrationCtx): Promise<void> {
  const { conversationId, brandId, memberId, messageContent } = ctx
  logger.info({ conversationId, brandId, memberId }, 'orchestration start')

  const conversation = await prisma.conversation.findUniqueOrThrow({
    where: { id: conversationId },
    select: { id: true, brandId: true, memberId: true, status: true },
  })
  if (conversation.brandId !== brandId) {
    throw new Error(`tenant mismatch: job brandId=${brandId} convo brandId=${conversation.brandId}`)
  }

  const history = (await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    select: { role: true, content: true },
  })) as Array<{ role: 'CUSTOMER' | 'AI' | 'AGENT'; content: string }>

  const intent = await classifySupportIntent({ message: messageContent, history })
  logger.info({ conversationId, intent: intent.intent, sensitivity: intent.sensitivity, conf: intent.confidence }, 'intent classified')

  const kbChunks = await retrieveKBChunks(brandId, messageContent)
  const customer360 = memberId ? await loadCustomer360(memberId) : null

  const rules = await prisma.supportRule.findMany({
    where: { brandId, status: 'ACTIVE' },
    orderBy: { priority: 'asc' },
  })
  const ruleInputs: SupportRuleInput[] = rules.map((r) => ({
    id: r.id,
    status: r.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
    priority: r.priority,
    intentFilters: r.intentFilters,
    tierFilters: r.tierFilters,
    healthScoreMin: r.healthScoreMin,
    healthScoreMax: r.healthScoreMax,
    topicFilters: r.topicFilters,
    conditions: (r.conditions ?? {}) as Record<string, unknown>,
    actionMode: r.actionMode,
    confidenceThreshold: r.confidenceThreshold,
    autoRespondArticleId: r.autoRespondArticleId,
    escalateToAssignee: r.escalateToAssignee,
    awardPoints: r.awardPoints,
    triggerSurveyId: r.triggerSurveyId,
  }))
  const ruleResult = evaluateSupportRules(ruleInputs, {
    intent: intent.intent,
    tier: customer360?.currentTier ?? null,
    // TODO(slice-2+): wire member.healthScore here once Customer360 is fully shaped
    healthScore: undefined,
    topics: [intent.topic],
  })

  const brandRow = await prisma.brand.findUnique({ where: { id: brandId }, select: { name: true } })
  const brandVoice = `Friendly, concise, professional. Brand: ${brandRow?.name ?? 'this brand'}.`
  const draft = await draftSupportReply({
    message: messageContent,
    history,
    kbChunks,
    customer360,
    brandVoice,
  })

  for (const match of ruleResult.matchedRules) {
    if (await dispatchTier(match, { conversationId, brandId, intent, draft })) {
      logger.info({ conversationId, ruleId: match.ruleId, tier: match.actionMode }, 'dispatched')
      return
    }
  }

  logger.warn({ conversationId }, 'no rule produced a viable tier; defaulting to ESCALATE')
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { status: 'ESCALATED', escalatedAt: new Date() },
  })
}

async function dispatchTier(
  match: SupportRuleMatch,
  args: {
    conversationId: string
    brandId: string
    intent: { intent: string; topic: string }
    draft: { reply: string; citedChunkIds: string[]; confidence: number; shouldEscalate: boolean }
  },
): Promise<boolean> {
  const { conversationId, brandId, intent, draft } = args
  switch (match.actionMode) {
    case 'AUTO_REPLY': {
      if (draft.confidence < match.confidenceThreshold || draft.shouldEscalate) return false
      await prisma.message.create({
        data: {
          conversationId,
          role: 'AI',
          content: draft.reply,
          aiConfidence: draft.confidence,
          aiSources: draft.citedChunkIds,
          draftedByAi: false,
        },
      })
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { intent: intent.intent, topic: intent.topic, rulesMatched: { push: match.ruleId } },
      })
      return true
    }
    case 'DRAFT_FOR_AGENT': {
      await prisma.message.create({
        data: {
          conversationId,
          role: 'AI',
          content: draft.reply,
          aiConfidence: draft.confidence,
          aiSources: draft.citedChunkIds,
          draftedByAi: true,
        },
      })
      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          intent: intent.intent,
          topic: intent.topic,
          status: 'WAITING_ON_CUSTOMER',
          assignee: match.escalateToAssignee ?? undefined,
          rulesMatched: { push: match.ruleId },
        },
      })
      await enqueueSlackOutbound({
        brandId,
        conversationId,
        kind: 'DRAFT_READY',
        text: 'AI draft ready for review',
      })
      logger.info({ conversationId, assignee: match.escalateToAssignee }, 'agent draft ready')
      return true
    }
    case 'ESCALATE': {
      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          status: 'ESCALATED',
          escalatedAt: new Date(),
          assignee: match.escalateToAssignee ?? undefined,
          intent: intent.intent,
          topic: intent.topic,
          rulesMatched: { push: match.ruleId },
        },
      })
      await enqueueSlackOutbound({
        brandId,
        conversationId,
        kind: 'ESCALATED',
        text: 'Conversation escalated; please follow up',
      })
      return true
    }
    default: {
      const _exhaustive: never = match.actionMode
      throw new Error(`Unhandled actionMode: ${String(_exhaustive)}`)
    }
  }
}

async function retrieveKBChunks(brandId: string, query: string): Promise<KBChunkRetrieved[]> {
  const embedding = await generateEmbedding(query)
  const vec = `[${embedding.join(',')}]`
  // Use an interactive transaction so we can prepend SET search_path to include
  // `public`. The pgvector <=> operator lives in `public`, and in test environments
  // Prisma's ?schema= URL scopes search_path to only the test schema, hiding the
  // operator. Prepending the SET within the same connection guarantees the operator
  // is found both in production (search_path unchanged) and in test schemas.
  const rows = await prisma.$transaction(async (tx) => {
    // Determine the current schema first, then expand search_path to also include public.
    const schemaResult = await tx.$queryRaw<Array<{ current_schema: string }>>`SELECT current_schema()`
    const currentSchema = schemaResult[0]?.current_schema ?? 'public'
    await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${currentSchema}", public`)
    return tx.$queryRaw<Array<{ id: string; articleId: string; chunkIndex: number; content: string; similarity: number }>>`
      SELECT id, "articleId", "chunkIndex", content, 1 - (embedding <=> ${vec}::vector) AS similarity
      FROM "kb_chunks"
      WHERE "brandId" = ${brandId} AND "embedStatus" = 'EMBEDDED'
      ORDER BY embedding <=> ${vec}::vector
      LIMIT ${TOP_K}
    `
  })
  return rows.filter((r) => r.similarity >= SIMILARITY_THRESHOLD)
}

interface MemberWithTier {
  id: string
  email: string | null
  pointsBalance: number
  currentTier: { name: string } | null
}

async function loadCustomer360(memberId: string) {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: {
      id: true,
      email: true,
      currentTier: { select: { name: true } },
      pointsBalance: true,
    },
  })
  if (!member) return null
  const m = member as unknown as MemberWithTier
  return {
    memberId: m.id,
    email: m.email,
    currentTier: m.currentTier?.name ?? null,
    pointsBalance: m.pointsBalance ?? 0,
    recentOrderSummary: null,
  }
}

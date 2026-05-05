import { Queue, type Job, type ConnectionOptions } from 'bullmq'
import {
  QUEUES,
  type LoyaltyEventPayload,
  type CampaignTriggerPayload,
  type NotificationPayload,
  type SentimentAnalysisPayload,
  type FeedbackClusteringPayload,
  type SupportOrchestrationPayload,
  type EmbeddingGenerationPayload,
  type HealthScoreComputationPayload,
  type ExternalSignalSyncPayload,
  type ExternalSignalIngestionPayload,
  type WebhookDeliveryPayload,
  type SurveyImportRowPayload,
  extractExternalSignalDeliveries,
  normalizeExternalSignalCandidate,
  deriveExternalSignalStatus,
  evaluateConditions,
  evaluateSupportRules,
} from '@customerEQ/shared'
import type { ConditionGroup } from '@customerEQ/shared'
import type { SupportRuleInput } from '@customerEQ/shared'
import { processSentimentForResponse, discoverClusters, detectAnomalies, generateEmbedding, generateSupportResponse as aiGenerateSupportResponse } from '@customerEQ/ai'
import { processHealthScoreComputation } from './healthScore.js'
import { resolveOrEnrollMember } from '../services/memberResolution.js'
import type { ClusterDefinition, ClusterTrend } from '@customerEQ/ai'
import { prisma } from '@customerEQ/database'
import { Prisma } from '@prisma/client'
import pino from 'pino'
import { scheduleInline } from './inlineRuntime.js'

// QUEUE_MODE=inline  → skip Redis, run processor logic synchronously
// QUEUE_MODE=redis   → use BullMQ queues (default)
const QUEUE_MODE = process.env.QUEUE_MODE ?? 'redis'
const log = pino({ name: 'inline-queue' })

let _loyaltyEventsQueue: Queue | null = null
let _campaignTriggersQueue: Queue | null = null
let _notificationsQueue: Queue | null = null
let _sentimentAnalysisQueue: Queue | null = null
let _feedbackClusteringQueue: Queue | null = null
let _alertEvaluationQueue: Queue | null = null
let _supportOrchestrationQueue: Queue | null = null
let _embeddingGenerationQueue: Queue | null = null
let _healthScoreQueue: Queue | null = null
let _externalSignalSyncQueue: Queue | null = null
let _externalSignalIngestionQueue: Queue | null = null
let _webhookDeliveryQueue: Queue | null = null
let _surveyImportQueue: Queue | null = null

export function initQueues(redis: ConnectionOptions): void {
  if (QUEUE_MODE === 'inline') return

  const connection = redis
  _loyaltyEventsQueue = new Queue(QUEUES.LOYALTY_EVENTS, { connection })
  _campaignTriggersQueue = new Queue(QUEUES.CAMPAIGN_TRIGGERS, { connection })
  _notificationsQueue = new Queue(QUEUES.NOTIFICATIONS, { connection })
  _sentimentAnalysisQueue = new Queue(QUEUES.SENTIMENT_ANALYSIS, { connection })
  _feedbackClusteringQueue = new Queue(QUEUES.FEEDBACK_CLUSTERING, { connection })
  _alertEvaluationQueue = new Queue(QUEUES.ALERT_EVALUATION, { connection })
  _supportOrchestrationQueue = new Queue(QUEUES.SUPPORT_ORCHESTRATION, { connection })
  _embeddingGenerationQueue = new Queue(QUEUES.EMBEDDING_GENERATION, { connection })
  _healthScoreQueue = new Queue(QUEUES.HEALTH_SCORE_COMPUTATION, { connection })
  _externalSignalSyncQueue = new Queue(QUEUES.EXTERNAL_SIGNAL_SYNC, { connection })
  _externalSignalIngestionQueue = new Queue(QUEUES.EXTERNAL_SIGNAL_INGESTION, { connection })
  _webhookDeliveryQueue = new Queue(QUEUES.WEBHOOK_DELIVERY, { connection })
  _surveyImportQueue = new Queue(QUEUES.SURVEY_IMPORT, { connection })
}

const INLINE_STUB = { id: 'inline' } as unknown as Job

function getLoyaltyEventsQueue(): Queue {
  if (!_loyaltyEventsQueue) throw new Error('Queues not initialized. Call initQueues(redis) first.')
  return _loyaltyEventsQueue
}
function getCampaignTriggersQueue(): Queue {
  if (!_campaignTriggersQueue) throw new Error('Queues not initialized.')
  return _campaignTriggersQueue
}
function getNotificationsQueue(): Queue {
  if (!_notificationsQueue) throw new Error('Queues not initialized.')
  return _notificationsQueue
}
function getSentimentAnalysisQueue(): Queue {
  if (!_sentimentAnalysisQueue) throw new Error('Queues not initialized.')
  return _sentimentAnalysisQueue
}
function getFeedbackClusteringQueue(): Queue {
  if (!_feedbackClusteringQueue) throw new Error('Queues not initialized.')
  return _feedbackClusteringQueue
}
function getAlertEvaluationQueue(): Queue {
  if (!_alertEvaluationQueue) throw new Error('Queues not initialized.')
  return _alertEvaluationQueue
}
function getSupportOrchestrationQueue(): Queue {
  if (!_supportOrchestrationQueue) throw new Error('Queues not initialized.')
  return _supportOrchestrationQueue
}
function getEmbeddingGenerationQueue(): Queue {
  if (!_embeddingGenerationQueue) throw new Error('Queues not initialized.')
  return _embeddingGenerationQueue
}
function getHealthScoreQueue(): Queue {
  if (!_healthScoreQueue) throw new Error('Queues not initialized.')
  return _healthScoreQueue
}
function getExternalSignalSyncQueue(): Queue {
  if (!_externalSignalSyncQueue) throw new Error('Queues not initialized.')
  return _externalSignalSyncQueue
}
function getExternalSignalIngestionQueue(): Queue {
  if (!_externalSignalIngestionQueue) throw new Error('Queues not initialized.')
  return _externalSignalIngestionQueue
}
function getWebhookDeliveryQueue(): Queue {
  if (!_webhookDeliveryQueue) throw new Error('Queues not initialized.')
  return _webhookDeliveryQueue
}
function getSurveyImportQueue(): Queue {
  if (!_surveyImportQueue) throw new Error('Queues not initialized.')
  return _surveyImportQueue
}

// ═══════════════════════════════════════════════════════════════════════════
// Inline processor logic — mirrors worker processors without BullMQ/Redis
// ═══════════════════════════════════════════════════════════════════════════

async function inlineLoyaltyEvent(p: LoyaltyEventPayload) {
  const { brandId, memberId, eventType, payload, idempotencyKey } = p

  if (idempotencyKey) {
    const existing = await prisma.loyaltyEvent.findFirst({ where: { idempotencyKey }, select: { id: true } })
    if (existing) return { pointsAwarded: 0, skipped: true }
  }

  const earningRules = await prisma.earningRule.findMany({
    where: { brandId, status: 'ACTIVE', program: { status: 'ACTIVE' } },
    select: {
      id: true, triggerEvent: true, pointsAwarded: true, multiplier: true,
      maxUsesPerMember: true, status: true, priority: true, stackable: true,
      conditions: true, budgetCapPoints: true, budgetUsedPoints: true,
    },
  })

  const usageRecords = await prisma.loyaltyEvent.findMany({
    where: { memberId, brandId, rulesApplied: { isEmpty: false } },
    select: { rulesApplied: true },
  })
  const memberRuleUsage: Record<string, number> = {}
  for (const rec of usageRecords) {
    for (const ruleId of rec.rulesApplied) {
      memberRuleUsage[ruleId] = (memberRuleUsage[ruleId] ?? 0) + 1
    }
  }

  // Evaluate rules (priority order, stackable semantics)
  const sorted = [...earningRules].sort((a, b) => a.priority - b.priority)
  const firedRules: { ruleId: string; points: number }[] = []
  let firstMatchSeen = false

  for (const rule of sorted) {
    if (rule.status !== 'ACTIVE' || rule.triggerEvent !== eventType) continue
    if (firstMatchSeen && !rule.stackable) continue
    if (rule.budgetCapPoints !== null && rule.budgetUsedPoints >= rule.budgetCapPoints) continue
    const usage = memberRuleUsage[rule.id] ?? 0
    if (rule.maxUsesPerMember !== null && usage >= rule.maxUsesPerMember) continue
    if (!evaluateConditions(rule.conditions as ConditionGroup | null, payload)) continue

    firedRules.push({ ruleId: rule.id, points: Math.round(rule.pointsAwarded * rule.multiplier) })
    if (!rule.stackable) firstMatchSeen = true
  }

  const totalPoints = firedRules.reduce((sum, r) => sum + r.points, 0)
  if (totalPoints > 0) {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.loyaltyEvent.create({
        data: { brandId, memberId, eventType, pointsEarned: totalPoints, payload: payload as Prisma.InputJsonValue, idempotencyKey: idempotencyKey ?? null, rulesApplied: firedRules.map((r) => r.ruleId) },
      })
      await tx.member.update({ where: { id: memberId }, data: { pointsBalance: { increment: totalPoints } } })
    })
  }
  return { pointsAwarded: totalPoints }
}

async function inlineCampaignTrigger(p: CampaignTriggerPayload) {
  const { campaignId, memberId, brandId, eventIngestedAt } = p

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { program: { select: { pointToCurrencyRatio: true } } },
  })
  if (!campaign || campaign.status !== 'ACTIVE') return

  const points = (campaign.actionConfig as { points?: number }).points ?? 0
  if (campaign.budgetCap !== null) {
    const costUsd = points * campaign.program.pointToCurrencyRatio
    if (campaign.budgetSpent + costUsd > campaign.budgetCap) {
      await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'PAUSED' } })
      return
    }
  }

  const latencyMs = Date.now() - new Date(eventIngestedAt).getTime()
  // Race-safe dedup: rely on the @@unique([campaignId, memberId]) constraint
  // on CampaignEvent. Two concurrent triggers for the same (campaign, member)
  // will both attempt the create; one wins, the loser raises P2002 and we
  // treat that as a silent dedup — same outcome as Redis SET NX.
  try {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.campaignEvent.create({ data: { campaignId, memberId, brandId, executedAt: new Date(), latencyMs, status: 'executed' } })
      await tx.loyaltyEvent.create({ data: { memberId, brandId, eventType: 'campaign_award', pointsEarned: points, campaignId, rulesApplied: [] } })
      await tx.member.update({ where: { id: memberId }, data: { pointsBalance: { increment: points } } })
      const costUsd = points * campaign.program.pointToCurrencyRatio
      await tx.campaign.update({ where: { id: campaignId }, data: { budgetSpent: { increment: costUsd } } })
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return { points: 0, latencyMs, deduped: true }
    }
    throw err
  }
  return { points, latencyMs }
}

async function inlineAlertEvaluation(p: AlertEvaluationPayload) {
  const { brandId, surveyResponseId, surveyType, score, sentiment, topics, memberId } = p

  const rules = await prisma.alertRule.findMany({ where: { brandId, status: 'ACTIVE' } })
  let casesCreated = 0

  for (const rule of rules) {
    // Survey type filter
    if (rule.surveyTypes.length > 0 && !rule.surveyTypes.includes(surveyType)) continue
    // Score range
    if (rule.scoreMin !== null && score !== null && score < rule.scoreMin) continue
    if (rule.scoreMax !== null && score !== null && score > rule.scoreMax) continue
    if ((rule.scoreMin !== null || rule.scoreMax !== null) && score === null) continue
    // Sentiment threshold
    if (rule.sentimentThreshold !== null) {
      if (sentiment === null || sentiment > rule.sentimentThreshold) continue
    }
    // Topic filter
    if (rule.topicFilters.length > 0) {
      if (!rule.topicFilters.some((t) => topics.some((rt) => rt.toLowerCase().includes(t.toLowerCase())))) continue
    }

    // Idempotency
    const existing = await prisma.caseFollowUp.findFirst({ where: { alertRuleId: rule.id, surveyResponseId } })
    if (existing) continue

    // Resolve assignee
    const assignments = (rule.assignmentRules as Array<{ topic: string; assignee: string }>) ?? []
    let assignee = rule.defaultAssignee
    for (const ar of assignments) {
      if (topics.some((t) => t.toLowerCase().includes(ar.topic.toLowerCase()))) { assignee = ar.assignee; break }
    }

    const slaDeadline = rule.slaHours ? new Date(Date.now() + rule.slaHours * 60 * 60 * 1000) : null
    const priority = score !== null && score <= 2 ? 'CRITICAL' : score !== null && score <= 4 ? 'HIGH' : sentiment !== null && sentiment <= -0.7 ? 'HIGH' : score !== null && score <= 6 ? 'MEDIUM' : 'LOW'

    await prisma.caseFollowUp.create({
      data: {
        brandId, alertRuleId: rule.id, surveyResponseId, memberId, status: 'OPEN', assignee, priority, slaDeadline,
        notes: [{ text: `Case opened — Alert triggered by rule "${rule.name}"`, author: 'system', timestamp: new Date().toISOString() }] as unknown as Prisma.InputJsonValue,
      },
    })
    casesCreated++

    // Email alerts (console log — same as worker)
    for (const email of rule.emailRecipients) {
      log.info({ email, rule: rule.name, surveyResponseId }, 'Alert email (inline)')
    }
  }
  return { casesCreated }
}

function extractText(answers: unknown): string {
  if (!answers || typeof answers !== 'object') return ''
  return Object.values(answers as Record<string, unknown>).filter((v): v is string => typeof v === 'string').join(' ').trim()
}

async function inlineFeedbackClustering(p: FeedbackClusteringPayload) {
  const { brandId } = p

  const existingDbClusters = await prisma.feedbackCluster.findMany({
    where: { brandId, isActive: true },
    select: { id: true, label: true, description: true, keywords: true },
  })
  const existingClusters: ClusterDefinition[] = existingDbClusters.map((c) => ({
    id: c.id, label: c.label, description: c.description ?? '', keywords: c.keywords,
  }))

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const unassigned = await prisma.surveyResponse.findMany({
    where: { brandId, clusterId: null, completedAt: { gte: thirtyDaysAgo } },
    select: { id: true, answers: true, sentiment: true },
  })

  let newClustersCreated = 0
  let responsesAssigned = 0

  if (unassigned.length > 0) {
    const feedbackItems = unassigned.map((r) => ({ id: r.id, text: extractText(r.answers), sentiment: r.sentiment ?? 0 }))
    const result = await discoverClusters(feedbackItems, existingClusters)

    const labelToId = new Map<string, string>()
    for (const c of existingDbClusters) labelToId.set(c.label, c.id)

    for (const nc of result.newClusters) {
      const created = await prisma.feedbackCluster.create({ data: { brandId, label: nc.label, description: nc.description, keywords: nc.keywords, responseCount: 0 } })
      labelToId.set(nc.label, created.id)
      newClustersCreated++
    }

    for (const a of result.assignments) {
      const cId = labelToId.get(a.clusterLabel)
      if (!cId) continue
      await prisma.surveyResponse.update({ where: { id: a.feedbackId }, data: { clusterId: cId } })
      responsesAssigned++
    }
  }

  // Update cluster stats
  const allClusters = await prisma.feedbackCluster.findMany({ where: { brandId, isActive: true }, select: { id: true, label: true, description: true } })
  for (const cluster of allClusters) {
    const agg = await prisma.surveyResponse.aggregate({ where: { clusterId: cluster.id }, _count: { id: true }, _avg: { sentiment: true } })
    await prisma.feedbackCluster.update({ where: { id: cluster.id }, data: { responseCount: agg._count.id, avgSentiment: agg._avg.sentiment } })
  }

  // Daily snapshots
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  let snapshotsCreated = 0
  for (const cluster of allClusters) {
    const agg = await prisma.surveyResponse.aggregate({ where: { clusterId: cluster.id, completedAt: { gte: today } }, _count: { id: true }, _avg: { sentiment: true } })
    await prisma.clusterSnapshot.upsert({
      where: { clusterId_bucketDate: { clusterId: cluster.id, bucketDate: today } },
      create: { clusterId: cluster.id, brandId, bucketDate: today, volume: agg._count.id, avgSentiment: agg._avg.sentiment },
      update: { volume: agg._count.id, avgSentiment: agg._avg.sentiment },
    })
    snapshotsCreated++
  }

  // Anomaly detection
  const sixtyDaysAgo = new Date()
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)
  const clusterTrends: ClusterTrend[] = []
  let totalLast30 = 0
  let totalPrev30 = 0

  for (const cluster of allClusters) {
    const snaps = await prisma.clusterSnapshot.findMany({
      where: { clusterId: cluster.id, bucketDate: { gte: sixtyDaysAgo } },
      orderBy: { bucketDate: 'asc' },
      select: { bucketDate: true, volume: true, avgSentiment: true },
    })
    const dailyVolumes: number[] = []
    const dailyAvgSentiment: number[] = []
    let last30 = 0
    let prev30 = 0
    for (const s of snaps) {
      if (new Date(s.bucketDate) >= thirtyDaysAgo) { dailyVolumes.push(s.volume); dailyAvgSentiment.push(s.avgSentiment ?? 0); last30 += s.volume }
      else prev30 += s.volume
    }
    totalLast30 += last30
    totalPrev30 += prev30
    clusterTrends.push({ clusterLabel: cluster.label, clusterDescription: cluster.description ?? '', dailyVolumes, dailyAvgSentiment, totalResponses: last30 })
  }

  let anomaliesDetected = 0
  if (clusterTrends.length > 0) {
    const report = await detectAnomalies(clusterTrends, totalLast30, totalPrev30)
    for (const a of report.anomalies) {
      let anomalyClusterId: string | null = null
      if (a.clusterLabel) {
        const match = allClusters.find((c) => c.label === a.clusterLabel)
        if (match) anomalyClusterId = match.id
      }
      await prisma.feedbackAnomaly.create({ data: { brandId, clusterId: anomalyClusterId, type: a.type, severity: a.severity, summary: a.summary, metadata: { overallSummary: report.overallSummary } } })
      anomaliesDetected++
    }
  }

  return { newClustersCreated, responsesAssigned, snapshotsCreated, anomaliesDetected }
}

async function resolveExternalSignalMember(
  brandId: string,
  sourceMatchingConfig: Prisma.JsonValue | null | undefined,
  memberEmail: string | null,
) {
  const matchingConfig = (sourceMatchingConfig ?? {}) as Record<string, unknown>
  if (matchingConfig.memberResolutionEnabled === false || !memberEmail) {
    return {
      memberId: null,
      matchStatus: 'UNMATCHED' as const,
      matchConfidence: null,
      matchMethod: null,
    }
  }

  // #231 PR2: switch to canonical externalId lookup (R5 case-insensitive).
  const member = await prisma.member.findUnique({
    where: { brandId_externalId: { brandId, externalId: memberEmail.trim().toLowerCase() } },
    select: { id: true, consentGivenAt: true },
  })

  if (!member || !member.consentGivenAt) {
    return {
      memberId: null,
      matchStatus: 'UNMATCHED' as const,
      matchConfidence: null,
      matchMethod: null,
    }
  }

  return {
    memberId: member.id,
    matchStatus: 'MATCHED' as const,
    matchConfidence: 1,
    matchMethod: 'email_exact',
  }
}

async function inlineExternalSignalIngestion(p: ExternalSignalIngestionPayload) {
  const source = await prisma.externalSignalSource.findFirst({
    where: { id: p.sourceId, brandId: p.brandId },
  })
  if (!source) {
    throw new Error(`External signal source ${p.sourceId} not found`)
  }

  await prisma.externalSignalSource.update({
    where: { id: source.id },
    data: { lastSyncAt: new Date(p.receivedAt) },
  })

  const deliveries = extractExternalSignalDeliveries(p.deliveries)
  let importedCount = 0

  for (const record of deliveries) {
    const candidate = normalizeExternalSignalCandidate(record)
    const body = candidate.body || candidate.summary || '[No body provided]'
    const match = await resolveExternalSignalMember(
      p.brandId,
      source.matchingConfig,
      candidate.memberEmail,
    )

    const existing = await prisma.externalSignal.findUnique({
      where: {
        sourceId_externalId: {
          sourceId: source.id,
          externalId: candidate.externalId,
        },
      },
      select: {
        id: true,
        providerStatus: true,
        statusHistory: true,
      },
    })

    const nextStatus = deriveExternalSignalStatus(candidate.providerStatus)
    const nextStatusHistory = Array.isArray(existing?.statusHistory)
      ? [...existing.statusHistory]
      : []

    if (candidate.providerStatus && existing?.providerStatus !== candidate.providerStatus) {
      nextStatusHistory.push({
        providerStatus: candidate.providerStatus,
        changedAt: new Date(p.receivedAt).toISOString(),
      })
    }

    if (existing) {
      await prisma.externalSignal.update({
        where: { id: existing.id },
        data: {
          memberId: match.memberId,
          status: nextStatus,
          matchStatus: match.matchStatus,
          matchConfidence: match.matchConfidence,
          matchMethod: match.matchMethod,
          body,
          summary: candidate.summary,
          rating: candidate.rating,
          sentiment: candidate.sentiment,
          confidence: candidate.confidence,
          topics: candidate.topics,
          canonicalUrl: candidate.canonicalUrl,
          externalAuthorHandle: candidate.externalAuthorHandle,
          externalAuthorLabel: candidate.externalAuthorLabel,
          subjectType: candidate.subjectType,
          subjectKey: candidate.subjectKey,
          subjectLabel: candidate.subjectLabel,
          providerStatus: candidate.providerStatus,
          providerMetadata:
            candidate.providerMetadata == null
              ? Prisma.JsonNull
              : (candidate.providerMetadata as Prisma.InputJsonValue),
          rawPayload: candidate.rawPayload as Prisma.InputJsonValue,
          postedAt: candidate.postedAt ? new Date(candidate.postedAt) : null,
          statusHistory: nextStatusHistory as Prisma.InputJsonValue,
        },
      })
    } else {
      await prisma.externalSignal.create({
        data: {
          brandId: p.brandId,
          sourceId: source.id,
          memberId: match.memberId,
          sourceType: source.sourceType,
          externalId: candidate.externalId,
          status: nextStatus,
          matchStatus: match.matchStatus,
          matchConfidence: match.matchConfidence,
          matchMethod: match.matchMethod,
          body,
          summary: candidate.summary,
          rating: candidate.rating,
          sentiment: candidate.sentiment,
          confidence: candidate.confidence,
          topics: candidate.topics,
          canonicalUrl: candidate.canonicalUrl,
          externalAuthorHandle: candidate.externalAuthorHandle,
          externalAuthorLabel: candidate.externalAuthorLabel,
          subjectType: candidate.subjectType,
          subjectKey: candidate.subjectKey,
          subjectLabel: candidate.subjectLabel,
          providerStatus: candidate.providerStatus,
          statusHistory: nextStatusHistory as Prisma.InputJsonValue,
          providerMetadata:
            candidate.providerMetadata == null
              ? Prisma.JsonNull
              : (candidate.providerMetadata as Prisma.InputJsonValue),
          rawPayload: candidate.rawPayload as Prisma.InputJsonValue,
          postedAt: candidate.postedAt ? new Date(candidate.postedAt) : null,
          ingestedAt: new Date(p.receivedAt),
        },
      })
    }

    importedCount += 1
  }

  await prisma.externalSignalSource.update({
    where: { id: source.id },
    data: {
      healthStatus: 'healthy',
      lastSuccessAt: new Date(p.receivedAt),
      lastImportCount: importedCount,
      lastError: null,
      lastErrorAt: null,
    },
  })

  return { importedCount }
}

async function inlineExternalSignalSync(p: ExternalSignalSyncPayload) {
  const source = await prisma.externalSignalSource.findFirst({
    where: { id: p.sourceId, brandId: p.brandId },
    select: { id: true, sourceType: true, scopeConfig: true, credentialRef: true, lastCursor: true },
  })
  if (!source) {
    throw new Error(`External signal source ${p.sourceId} not found`)
  }

  const scopeConfig = (source.scopeConfig ?? {}) as Record<string, unknown>

  // Try native connector first (Google, Reddit, X, LinkedIn)
  let deliveries: Record<string, unknown>[]
  let nextCursor: Record<string, unknown> | null = null
  let updatedCredentials: Record<string, unknown> | undefined

  try {
    const { CONNECTORS } = await import('@customerEQ/connectors')
    const connector = CONNECTORS[source.sourceType]

    if (connector) {
      const result = await connector({
        sourceId: source.id,
        brandId: p.brandId,
        scopeConfig,
        lastCursor: (source.lastCursor ?? null) as Record<string, unknown> | null,
        credentialRef: source.credentialRef,
      })
      deliveries = result.deliveries
      nextCursor = result.nextCursor
      updatedCredentials = result.updatedCredentials
    } else {
      // Fallback: samplePayloads for generic sources
      deliveries = extractExternalSignalDeliveries(
        scopeConfig.samplePayloads ?? scopeConfig.seedSignals ?? [],
      )
    }
  } catch (err) {
    // Mirror worker semantics so inline mode is functionally equivalent:
    //   - Auth errors: mark `auth_error`, swallow (human must reconnect OAuth)
    //   - Rate-limit errors: rethrow so the inline runtime applies backoff retry
    //   - Other errors: mark `error`, rethrow for retry
    const errName = err instanceof Error ? err.name : ''
    if (errName === 'ConnectorAuthError') {
      await prisma.externalSignalSource.update({
        where: { id: source.id },
        data: {
          healthStatus: 'auth_error',
          lastError: err instanceof Error ? err.message : 'Sync failed',
          lastErrorAt: new Date(),
          lastSyncAt: new Date(),
        },
      })
      log.error({ sourceId: source.id, err }, 'Inline external signal sync auth error')
      return { importedCount: 0, queued: 0, error: err instanceof Error ? err.message : 'Auth failed' }
    }

    if (errName === 'ConnectorRateLimitError') {
      log.warn({ sourceId: source.id, err }, 'Inline external signal sync rate limited — will retry')
      throw err
    }

    await prisma.externalSignalSource.update({
      where: { id: source.id },
      data: {
        healthStatus: 'error',
        lastError: err instanceof Error ? err.message : 'Sync failed',
        lastErrorAt: new Date(),
        lastSyncAt: new Date(),
      },
    })
    throw err
  }

  if (deliveries.length === 0) {
    const updateData: Record<string, unknown> = { lastSyncAt: new Date() }
    if (nextCursor) updateData.lastCursor = nextCursor
    await prisma.externalSignalSource.update({
      where: { id: source.id },
      data: updateData,
    })
    return { importedCount: 0, queued: 0 }
  }

  const result = await inlineExternalSignalIngestion({
    brandId: p.brandId,
    sourceId: p.sourceId,
    deliveries,
    receivedAt: new Date().toISOString(),
    deliveryType: 'sync',
  })

  // Persist cursor and refreshed credentials
  const updateData: Record<string, unknown> = { lastSyncAt: new Date() }
  if (nextCursor) updateData.lastCursor = nextCursor
  if (updatedCredentials) {
    updateData.scopeConfig = { ...scopeConfig, credentials: updatedCredentials }
  }
  await prisma.externalSignalSource.update({
    where: { id: source.id },
    data: updateData,
  })

  return { ...result, queued: deliveries.length }
}

// ═══════════════════════════════════════════════════════════════════════════
// Public enqueue functions
// ═══════════════════════════════════════════════════════════════════════════

export async function enqueueEvent(payload: LoyaltyEventPayload): Promise<Job> {
  if (QUEUE_MODE === 'inline') {
    scheduleInline('loyalty-event', payload, inlineLoyaltyEvent)
    return INLINE_STUB
  }
  return getLoyaltyEventsQueue().add('process', payload)
}

export async function enqueueCampaignTrigger(payload: CampaignTriggerPayload): Promise<Job> {
  if (QUEUE_MODE === 'inline') {
    scheduleInline('campaign-trigger', payload, inlineCampaignTrigger)
    return INLINE_STUB
  }
  return getCampaignTriggersQueue().add('trigger', payload, { priority: 10 })
}

async function inlineNotification(payload: NotificationPayload): Promise<{ sent: boolean; reason?: string }> {
  // Mirrors apps/worker/src/processors/notifications.ts processNotification
  // exactly so both modes follow the same code path. Today both are stubs;
  // when EMAIL_PROVIDER is wired up to a real provider, both modes pick up
  // the change with no further refactor.
  if (process.env.EMAIL_PROVIDER === 'stub' || !process.env.EMAIL_PROVIDER) {
    log.info({ memberId: payload.memberId, channel: payload.channel }, 'Notification (stub provider)')
    return { sent: false, reason: 'stub_provider' }
  }
  return { sent: true }
}

export async function enqueueNotification(payload: NotificationPayload): Promise<Job> {
  if (QUEUE_MODE === 'inline') {
    scheduleInline('notification', payload, inlineNotification)
    return INLINE_STUB
  }
  return getNotificationsQueue().add('send', payload)
}

export async function enqueueSentimentAnalysis(payload: SentimentAnalysisPayload): Promise<Job> {
  if (QUEUE_MODE === 'inline') {
    scheduleInline('sentiment-analysis', payload, async (p) => {
      return processSentimentForResponse(
        { surveyResponseId: p.surveyResponseId, brandId: p.brandId, memberId: p.memberId, text: p.text, eventType: p.eventType, score: p.score },
        prisma,
      )
    })
    return INLINE_STUB
  }
  return getSentimentAnalysisQueue().add('analyze', payload)
}

export async function enqueueFeedbackClustering(payload: FeedbackClusteringPayload): Promise<Job> {
  if (QUEUE_MODE === 'inline') {
    scheduleInline('feedback-clustering', payload, inlineFeedbackClustering)
    return INLINE_STUB
  }
  return getFeedbackClusteringQueue().add('cluster', payload)
}

export interface AlertEvaluationPayload {
  surveyResponseId: string
  brandId: string
  memberId: string
  surveyId: string
  surveyType: string
  score: number | null
  sentiment: number | null
  topics: string[]
}

async function inlineEmbeddingGeneration(p: EmbeddingGenerationPayload) {
  const { articleId, brandId, text } = p
  try {
    const embedding = await generateEmbedding(text)
    const vectorStr = `[${embedding.join(',')}]`
    await prisma.$executeRawUnsafe(
      `UPDATE kb_articles SET embedding = $1::vector WHERE id = $2`,
      vectorStr,
      articleId,
    )
    log.info({ brandId, articleId, embeddingDimensions: embedding.length }, 'Inline embedding generated')
  } catch (err) {
    log.error({ err, brandId, articleId }, 'Inline embedding generation failed')
    throw err
  }
}

export async function enqueueEmbeddingGeneration(payload: EmbeddingGenerationPayload): Promise<Job> {
  if (QUEUE_MODE === 'inline') {
    scheduleInline('embedding-generation', payload, inlineEmbeddingGeneration, { attempts: 3, backoffMs: 1000 })
    return INLINE_STUB
  }
  return getEmbeddingGenerationQueue().add('generate', payload, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
  })
}

export async function enqueueAlertEvaluation(payload: AlertEvaluationPayload): Promise<Job> {
  if (QUEUE_MODE === 'inline') {
    scheduleInline('alert-evaluation', payload, inlineAlertEvaluation)
    return INLINE_STUB
  }
  return getAlertEvaluationQueue().add('evaluate', payload, { priority: 10 })
}

// ═══════════════════════════════════════════════════════════════════════════
// Support Orchestration — inline processor
// ═══════════════════════════════════════════════════════════════════════════

async function inlineSupportOrchestration(p: SupportOrchestrationPayload) {
  const { conversationId, brandId, memberId, messageContent } = p

  // 1. Load member context
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: { id: true, firstName: true, lastName: true, email: true, currentTier: true, pointsBalance: true },
  })
  if (!member) throw new Error(`Member ${memberId} not found`)

  const brand = await prisma.brand.findUnique({ where: { id: brandId }, select: { name: true } })

  // 2. Load conversation history
  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    select: { role: true, content: true },
  })
  const conversationHistory = messages.map((m) => `${m.role}: ${m.content}`).join('\n')

  // 3. Classify intent (graceful degradation — Phase C dependency)
  let intent = 'unknown'
  let confidence = 0
  let topics: string[] = []
  try {
    // ClassifyIntent is a Phase C prerequisite; if not available, degrade gracefully
    // For now, use simple keyword-based fallback
    intent = classifyIntentFallback(messageContent)
    confidence = 0.5
    topics = extractTopicsFallback(messageContent)
  } catch (err) {
    log.warn({ err, conversationId }, 'Intent classification failed, using fallback')
  }

  // Update conversation with intent
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { intent, confidence, topic: topics[0] ?? null },
  })

  // 4. Evaluate support rules
  const rules = await prisma.supportRule.findMany({
    where: { brandId, status: 'ACTIVE' },
    orderBy: { priority: 'asc' },
  })
  const ruleInputs: SupportRuleInput[] = rules.map((r) => ({
    id: r.id,
    intentFilters: r.intentFilters,
    tierFilters: r.tierFilters,
    healthScoreMin: r.healthScoreMin,
    healthScoreMax: r.healthScoreMax,
    topicFilters: r.topicFilters,
    conditions: r.conditions,
    autoRespondArticleId: r.autoRespondArticleId,
    escalateToAssignee: r.escalateToAssignee,
    awardPoints: r.awardPoints,
    triggerSurveyId: r.triggerSurveyId,
  }))
  const matchedRules = evaluateSupportRules(ruleInputs, {
    intent,
    tier: (member.currentTier as { name?: string } | null)?.name,
    healthScore: undefined, // Phase B dependency — not available yet
    topics,
  })

  // Update conversation with matched rules
  if (matchedRules.ruleIds.length > 0) {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { rulesMatched: matchedRules.ruleIds },
    })
  }

  // 5. KB context (Phase C dependency — graceful degradation)
  const kbContext = '' // No KB available yet

  // 6. Customer 360 context (Phase A dependency — graceful degradation)
  const customerContext = [
    member.firstName ? `Name: ${member.firstName} ${member.lastName ?? ''}`.trim() : '',
    (member.currentTier as { name?: string } | null)?.name ? `Tier: ${(member.currentTier as { name?: string }).name}` : '',
    `Points: ${member.pointsBalance}`,
  ].filter(Boolean).join(', ')

  // 7. Generate response (fallback if BAML/LLM not available)
  const aiResult = await (async () => {
    try {
      const result = await aiGenerateSupportResponse(
        messageContent,
        conversationHistory,
        intent,
        kbContext,
        customerContext,
        brand?.name ?? 'Support',
        matchedRules.autoResponseContent ?? undefined,
      )
      return {
        responseContent: result.response,
        responseConfidence: result.confidence,
        shouldEscalate: result.shouldEscalate,
        escalationReason: result.escalationReason ?? undefined as string | undefined,
      }
    } catch (err) {
      log.warn({ err, conversationId }, 'LLM response generation failed, using fallback')
      return {
        responseContent: generateFallbackResponse(intent, member.firstName ?? 'there', brand?.name ?? 'us'),
        responseConfidence: 0.5,
        shouldEscalate: true,
        escalationReason: 'LLM unavailable — auto-escalating to human agent' as string | undefined,
      }
    }
  })()
  const { responseContent, responseConfidence, shouldEscalate, escalationReason } = aiResult

  // 8. Store AI message
  await prisma.message.create({
    data: {
      conversationId,
      role: 'AI',
      content: responseContent,
      metadata: {
        intentResult: { intent, confidence, topics },
        responseConfidence: responseConfidence,
        rulesMatched: matchedRules.ruleIds,
      },
    },
  })

  // 9. Execute rule actions
  for (const rule of matchedRules.rules) {
    if (rule.awardPoints && rule.awardPoints > 0) {
      await enqueueEvent({
        brandId,
        memberId,
        eventType: 'support_apology_points',
        payload: { conversationId, ruleId: rule.id, points: rule.awardPoints },
        ingestedAt: new Date().toISOString(),
      })
      log.info({ conversationId, ruleId: rule.id, points: rule.awardPoints }, 'Support rule awarded points')
    }
  }

  // 10. Escalate if needed
  if (shouldEscalate || matchedRules.shouldEscalate) {
    const assignee = matchedRules.escalateToAssignee ?? undefined
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        status: 'ESCALATED',
        assignee,
        escalatedAt: new Date(),
      },
    })
    log.info({ conversationId, assignee, escalationReason }, 'Conversation escalated')
  }

  return { intent, matchedRules: matchedRules.ruleIds.length, shouldEscalate }
}

/** Simple keyword-based intent classification fallback (Phase C not yet available) */
function classifyIntentFallback(message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes('charge') || lower.includes('bill') || lower.includes('invoice') || lower.includes('payment') || lower.includes('refund')) return 'billing'
  if (lower.includes('ship') || lower.includes('deliver') || lower.includes('track') || lower.includes('package')) return 'shipping'
  if (lower.includes('return') || lower.includes('exchange')) return 'returns'
  if (lower.includes('account') || lower.includes('password') || lower.includes('login') || lower.includes('sign in')) return 'account'
  if (lower.includes('broken') || lower.includes('defect') || lower.includes('quality') || lower.includes('damage')) return 'complaint'
  if (lower.includes('feature') || lower.includes('suggest') || lower.includes('wish') || lower.includes('would be nice')) return 'feature_request'
  if (lower.includes('thank') || lower.includes('great') || lower.includes('love') || lower.includes('excellent') || lower.includes('awesome')) return 'praise'
  return 'other'
}

/** Extract topics from message text (simple fallback) */
function extractTopicsFallback(message: string): string[] {
  const topics: string[] = []
  const lower = message.toLowerCase()
  if (lower.includes('order')) topics.push('order')
  if (lower.includes('points') || lower.includes('reward')) topics.push('loyalty')
  if (lower.includes('price') || lower.includes('cost') || lower.includes('charge')) topics.push('pricing')
  if (lower.includes('product') || lower.includes('item')) topics.push('product')
  if (lower.includes('service') || lower.includes('support')) topics.push('service')
  return topics.length > 0 ? topics : ['general']
}

/** Fallback response when LLM is unavailable */
function generateFallbackResponse(intent: string, firstName: string, brandName: string): string {
  const intents: Record<string, string> = {
    billing: `Hi ${firstName}, I understand you have a billing concern. Let me connect you with our billing team who can help resolve this for you.`,
    shipping: `Hi ${firstName}, I see you have a shipping question. Let me look into this and get back to you shortly.`,
    returns: `Hi ${firstName}, I'd be happy to help with your return. Let me connect you with our returns team.`,
    account: `Hi ${firstName}, I can help with your account question. For security, let me connect you with our account support team.`,
    complaint: `Hi ${firstName}, I'm sorry to hear about your experience. Your feedback is important to us, and I'm connecting you with a specialist who can help.`,
    praise: `Hi ${firstName}, thank you so much for the kind words! We really appreciate your support of ${brandName}.`,
  }
  return intents[intent] ?? `Hi ${firstName}, thank you for reaching out to ${brandName}. A team member will be with you shortly to assist.`
}

export async function enqueueSupportOrchestration(payload: SupportOrchestrationPayload): Promise<Job> {
  if (QUEUE_MODE === 'inline') {
    scheduleInline('support-orchestration', payload, inlineSupportOrchestration)
    return INLINE_STUB
  }
  return getSupportOrchestrationQueue().add('orchestrate', payload)
}

export async function enqueueHealthScoreComputation(payload: HealthScoreComputationPayload): Promise<Job> {
  if (QUEUE_MODE === 'inline') {
    scheduleInline('health-score-computation', payload, processHealthScoreComputation)
    return INLINE_STUB
  }
  return getHealthScoreQueue().add('compute', payload)
}

export async function enqueueExternalSignalSync(payload: ExternalSignalSyncPayload): Promise<Job> {
  if (QUEUE_MODE === 'inline') {
    scheduleInline('external-signal-sync', payload, inlineExternalSignalSync)
    return INLINE_STUB
  }
  return getExternalSignalSyncQueue().add('sync', payload)
}

export async function enqueueExternalSignalIngestion(payload: ExternalSignalIngestionPayload): Promise<Job> {
  if (QUEUE_MODE === 'inline') {
    scheduleInline('external-signal-ingestion', payload, inlineExternalSignalIngestion)
    return INLINE_STUB
  }
  return getExternalSignalIngestionQueue().add('ingest', payload)
}

// ═══════════════════════════════════════════════════════════════════════════
// Webhook Delivery
// ═══════════════════════════════════════════════════════════════════════════

async function inlineWebhookDelivery(p: WebhookDeliveryPayload) {
  const { webhookEndpointId, brandId, event, caseId, data } = p

  const endpoint = await prisma.webhookEndpoint.findFirst({ where: { id: webhookEndpointId, brandId } })
  if (!endpoint || !endpoint.active) return { success: false, latencyMs: 0 }

  const { createHmac } = await import('node:crypto')
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const requestPayload = { id: `inline-${Date.now()}`, event, timestamp, data: { caseId, brandId, ...data } }
  const body = JSON.stringify(requestPayload)
  const signedString = `${timestamp}.${body}`
  const signature = `sha256=${createHmac('sha256', endpoint.signingSecret).update(signedString).digest('hex')}`

  const startMs = Date.now()
  let httpStatus: number | undefined
  let responseBody: string | undefined
  let success!: boolean

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10_000)
    let res: Response
    try {
      res = await fetch(endpoint.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CustomerEQ-Signature': signature, 'X-CustomerEQ-Timestamp': timestamp },
        body,
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeoutId)
    }
    httpStatus = res.status
    try { responseBody = await res.text() } catch { /* ignore */ }
    success = res.ok
  } catch (err) {
    const latencyMs = Date.now() - startMs
    await prisma.webhookDeliveryLog.create({ data: { webhookEndpointId, brandId, event, caseId, success: false, attempt: 1, requestPayload: requestPayload as never, responseBody: err instanceof Error ? err.message : String(err), latencyMs } })
    throw err
  }

  const latencyMs = Date.now() - startMs
  await prisma.webhookDeliveryLog.create({ data: { webhookEndpointId, brandId, event, caseId, httpStatus, latencyMs, success, attempt: 1, requestPayload: requestPayload as never, responseBody: responseBody ?? null } })
  if (!success) throw new Error(`Webhook delivery failed: HTTP ${httpStatus}`)
  return { success: true, httpStatus, latencyMs }
}

// ═══════════════════════════════════════════════════════════════════════════
// Survey Import — inline processor
// ═══════════════════════════════════════════════════════════════════════════

async function inlineSurveyImportRow(p: SurveyImportRowPayload) {
  const { batchId, surveyId, brandId, email, score, verbatim, completedAt, channel, externalId, rawAnswers } = p

  // Resolve or auto-enroll member using the shared memberResolution service (#231)
  let memberId: string | null = null
  if (email) {
    const result = await resolveOrEnrollMember(prisma, brandId, {
      memberId: email,
      email,
      enrolledVia: 'BULK_IMPORT',
    })
    if (result.ok && result.member.consentGivenAt) {
      memberId = result.member.id
    }
  }
  // Google Reviews: email=null → always anonymous (memberId stays null)

  // Dedup on externalId within this survey (covers re-imports of the same source data)
  if (externalId) {
    const existing = await prisma.surveyResponse.findFirst({
      where: { surveyId, externalRespondentId: externalId },
      select: { id: true },
    })
    if (existing) {
      await prisma.surveyImportBatch.update({
        where: { id: batchId },
        data: { processedRows: { increment: 1 } },
      })
      return { skipped: true, reason: 'duplicate_external_id' }
    }
  }

  const response = await prisma.surveyResponse.create({
    data: {
      surveyId,
      brandId,
      memberId,
      answers: (rawAnswers ?? {}) as Prisma.InputJsonValue,
      score: score ?? null,
      channel,
      completedAt: new Date(completedAt),
      importBatchId: batchId,
      importedAt: new Date(),
      externalRespondentId: externalId ?? null,
    },
  })

  // Only enqueue sentiment when there is text and a resolvable member
  if (verbatim && memberId) {
    enqueueSentimentAnalysis({
      surveyResponseId: response.id,
      brandId,
      memberId,
      surveyId,
      text: verbatim,
      eventType: 'cx.survey_imported',
      score: score ?? undefined,
    }).catch((err: unknown) => {
      log.error({ err, surveyId, batchId }, 'Failed to enqueue sentiment for imported row')
    })
  }

  await prisma.surveyImportBatch.update({
    where: { id: batchId },
    data: { processedRows: { increment: 1 } },
  })

  return { responseId: response.id }
}

export async function enqueueSurveyImportRow(payload: SurveyImportRowPayload): Promise<Job> {
  if (QUEUE_MODE === 'inline') {
    scheduleInline(QUEUES.SURVEY_IMPORT, payload, inlineSurveyImportRow)
    return INLINE_STUB
  }
  return getSurveyImportQueue().add(QUEUES.SURVEY_IMPORT, payload)
}

export async function enqueueWebhookDelivery(payload: WebhookDeliveryPayload): Promise<Job> {
  if (QUEUE_MODE === 'inline') {
    scheduleInline('webhook-delivery', payload, inlineWebhookDelivery, { attempts: 5, backoffMs: 1000 })
    return INLINE_STUB
  }
  return getWebhookDeliveryQueue().add('deliver', payload, {
    attempts: 5,
    backoff: { type: 'exponential', delay: 1000 },
  })
}

// @ts-nocheck — AlertRule/CaseFollowUp models require prisma generate (blocked by OneDrive file lock locally)
import type { Job } from 'bullmq'
import type { PrismaClient } from '@prisma/client'
import type { Prisma } from '@prisma/client'

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

/**
 * Alert Evaluation Processor
 *
 * Evaluates active alert rules against a survey response.
 * For each matching rule: creates a CaseFollowUp, delivers alerts via webhooks/email.
 */
export async function processAlertEvaluation(
  job: Job<AlertEvaluationPayload>,
  prisma: PrismaClient,
): Promise<{ casesCreated: number; alertsSent: number }> {
  const { brandId, surveyResponseId, surveyType, score, sentiment, topics } = job.data

  // Fetch active alert rules for this brand
  const rules = await prisma.alertRule.findMany({
    where: { brandId, status: 'ACTIVE' },
  })

  let casesCreated = 0
  let alertsSent = 0

  for (const rule of rules) {
    if (!matchesRule(rule, surveyType, score, sentiment, topics)) continue

    // Check if a case already exists for this response + rule (idempotency)
    const existing = await prisma.caseFollowUp.findFirst({
      where: { alertRuleId: rule.id, surveyResponseId },
    })
    if (existing) continue

    // Determine assignee from assignment rules
    const assignee = resolveAssignee(rule, topics)

    // Calculate SLA deadline
    const slaDeadline = rule.slaHours
      ? new Date(Date.now() + rule.slaHours * 60 * 60 * 1000)
      : null

    // Determine priority based on score
    const priority = determinePriority(score, sentiment)

    // Create case
    const caseRecord = await prisma.caseFollowUp.create({
      data: {
        brandId,
        alertRuleId: rule.id,
        surveyResponseId,
        memberId: job.data.memberId,
        status: 'OPEN',
        assignee,
        priority,
        slaDeadline,
        notes: [{
          text: `Case opened — Alert triggered by rule "${rule.name}"`,
          author: 'system',
          timestamp: new Date().toISOString(),
        }] as unknown as Prisma.InputJsonValue,
      },
    })
    casesCreated++

    // Deliver alerts (non-blocking, best-effort)
    const alertResults = await deliverAlerts(rule, job.data, caseRecord.id)
    alertsSent += alertResults.sent

    // Update case with delivery metadata
    const notes = (caseRecord.notes as Array<Record<string, unknown>>) ?? []
    for (const result of alertResults.details) {
      notes.push({
        text: `${result.channel} alert ${result.success ? 'delivered' : 'failed'}: ${result.target}`,
        author: 'system',
        timestamp: new Date().toISOString(),
      })
    }
    await prisma.caseFollowUp.update({
      where: { id: caseRecord.id },
      data: { notes: notes as unknown as Prisma.InputJsonValue },
    })
  }

  return { casesCreated, alertsSent }
}

// ─── Rule Matching ───────────────────────────────────────────────────────────

interface RuleLike {
  surveyTypes: string[]
  scoreMin: number | null
  scoreMax: number | null
  sentimentThreshold: number | null
  topicFilters: string[]
}

function matchesRule(
  rule: RuleLike,
  surveyType: string,
  score: number | null,
  sentiment: number | null,
  topics: string[],
): boolean {
  // Survey type filter (empty = match all)
  if (rule.surveyTypes.length > 0 && !rule.surveyTypes.includes(surveyType)) {
    return false
  }

  // Score range filter
  if (rule.scoreMin !== null && score !== null && score < rule.scoreMin) return false
  if (rule.scoreMax !== null && score !== null && score > rule.scoreMax) return false
  // If rule has score filter but response has no score, skip
  if ((rule.scoreMin !== null || rule.scoreMax !== null) && score === null) return false

  // Sentiment threshold filter (alert if sentiment is BELOW threshold)
  if (rule.sentimentThreshold !== null) {
    if (sentiment === null) return false // can't evaluate without sentiment
    if (sentiment > rule.sentimentThreshold) return false
  }

  // Topic filter (match if response has ANY of the required topics)
  if (rule.topicFilters.length > 0) {
    const hasMatch = rule.topicFilters.some((t) =>
      topics.some((rt) => rt.toLowerCase().includes(t.toLowerCase())),
    )
    if (!hasMatch) return false
  }

  return true
}

// ─── Assignment Resolution ───────────────────────────────────────────────────

interface AssignableRule {
  defaultAssignee: string
  assignmentRules: unknown // Json
}

function resolveAssignee(rule: AssignableRule, topics: string[]): string {
  const assignments = (rule.assignmentRules as Array<{ topic: string; assignee: string }>) ?? []
  for (const ar of assignments) {
    if (topics.some((t) => t.toLowerCase().includes(ar.topic.toLowerCase()))) {
      return ar.assignee
    }
  }
  return rule.defaultAssignee
}

// ─── Priority Determination ──────────────────────────────────────────────────

function determinePriority(score: number | null, sentiment: number | null): string {
  if (score !== null && score <= 2) return 'CRITICAL'
  if (score !== null && score <= 4) return 'HIGH'
  if (sentiment !== null && sentiment <= -0.7) return 'HIGH'
  if (score !== null && score <= 6) return 'MEDIUM'
  return 'LOW'
}

// ─── Alert Delivery ──────────────────────────────────────────────────────────

interface DeliveryResult {
  sent: number
  details: Array<{ channel: string; target: string; success: boolean }>
}

async function deliverAlerts(
  rule: {
    slackWebhookUrl: string | null
    slackChannelName: string | null
    emailRecipients: string[]
    teamsWebhookUrl: string | null
    name: string
  },
  payload: AlertEvaluationPayload,
  caseId: string,
): Promise<DeliveryResult> {
  const details: DeliveryResult['details'] = []

  const message = formatAlertMessage(rule.name, payload, caseId)

  // Slack
  if (rule.slackWebhookUrl) {
    try {
      const res = await fetch(rule.slackWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: message,
          channel: rule.slackChannelName || undefined,
        }),
      })
      details.push({ channel: 'Slack', target: rule.slackChannelName ?? 'default', success: res.ok })
    } catch {
      details.push({ channel: 'Slack', target: rule.slackChannelName ?? 'default', success: false })
    }
  }

  // Teams
  if (rule.teamsWebhookUrl) {
    try {
      const res = await fetch(rule.teamsWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          '@type': 'MessageCard',
          summary: `CX Alert: ${rule.name}`,
          text: message,
        }),
      })
      details.push({ channel: 'Teams', target: 'webhook', success: res.ok })
    } catch {
      details.push({ channel: 'Teams', target: 'webhook', success: false })
    }
  }

  // Email (via console log for now — notification queue integration in v2)
  for (const email of rule.emailRecipients) {
    console.log(`[ALERT EMAIL] To: ${email} | ${message}`)
    details.push({ channel: 'Email', target: email, success: true })
  }

  return { sent: details.filter((d) => d.success).length, details }
}

function formatAlertMessage(
  ruleName: string,
  payload: AlertEvaluationPayload,
  caseId: string,
): string {
  const parts = [`🚨 *CX Alert: ${ruleName}*`]
  if (payload.score !== null) parts.push(`Score: ${payload.score}/10`)
  if (payload.sentiment !== null) parts.push(`Sentiment: ${payload.sentiment.toFixed(2)}`)
  if (payload.topics.length > 0) parts.push(`Topics: ${payload.topics.join(', ')}`)
  parts.push(`Survey: ${payload.surveyType}`)
  parts.push(`Case: ${caseId}`)
  return parts.join(' | ')
}

// Export for testing
export { matchesRule, resolveAssignee, determinePriority }

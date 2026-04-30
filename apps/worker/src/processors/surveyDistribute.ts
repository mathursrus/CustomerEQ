import type { Job } from 'bullmq'
import { prisma } from '@customerEQ/database'
import type { SurveyDistributePayload } from '@customerEQ/shared'

// ---------------------------------------------------------------------------
// BullMQ processor — Issue #117
// Sends a triggered survey to a member and records the distribution.
// ---------------------------------------------------------------------------

export async function processSurveyDistribute(job: Job<SurveyDistributePayload>): Promise<{
  sent: boolean
  reason?: string
  surveyId: string
  memberId: string
}> {
  const { surveyId, memberId, brandId, triggerKey, surveyLink, cooldownDays } = job.data

  // Verify survey is still ACTIVE (may have been paused since job was enqueued)
  const survey = await prisma.survey.findFirst({
    where: { id: surveyId, brandId, status: 'ACTIVE' },
    select: { id: true },
  })
  if (!survey) {
    return { sent: false, reason: 'survey_inactive_or_missing', surveyId, memberId }
  }

  // Cooldown check: has this member received this survey within cooldownDays?
  const cooldownCutoff = new Date()
  cooldownCutoff.setDate(cooldownCutoff.getDate() - cooldownDays)

  const existing = await prisma.surveyDistribution.findFirst({
    where: {
      surveyId,
      memberId,
      sentAt: { gte: cooldownCutoff },
    },
    select: { id: true },
  })
  if (existing) {
    return { sent: false, reason: 'cooldown_active', surveyId, memberId }
  }

  // Upsert distribution record — use upsert to guard against race conditions
  await prisma.surveyDistribution.upsert({
    where: { surveyId_memberId: { surveyId, memberId } },
    update: { sentAt: new Date() },
    create: { surveyId, memberId, brandId },
  })

  // Increment distributionCount on survey
  await prisma.survey.update({
    where: { id: surveyId },
    data: { distributionCount: { increment: 1 } },
  })

  // MVP: stub notification — real delivery goes through notifications queue
  // In production, enqueue to NOTIFICATIONS queue with survey link in message
  if (process.env.NODE_ENV !== 'test') {
    // Log the distribution (real email delivery is post-MVP via notifications queue)
    job.log(`Survey ${surveyId} distributed to member ${memberId} via trigger ${triggerKey}: ${surveyLink}`)
  }

  return { sent: true, surveyId, memberId }
}

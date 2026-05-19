import type { Job } from 'bullmq'
import { prisma } from '@customerEQ/database'
import { deliverNotification } from '@customerEQ/connectors'
import type { NotificationPayload } from '@customerEQ/shared'

export async function processNotification(job: Job<NotificationPayload>): Promise<{
  sent: boolean
  reason?: string
  memberId: string
  channel: string
}> {
  const result = await deliverNotification(job.data, {
    resolveRecipientEmail: async (payload) => {
      const member = await prisma.member.findUnique({
        where: { id: payload.memberId },
        select: { email: true },
      })
      return member?.email ?? null
    },
  })

  return {
    sent: result.sent,
    reason: result.reason,
    memberId: result.memberId,
    channel: result.channel,
  }
}

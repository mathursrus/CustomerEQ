import type { Job, ConnectionOptions } from 'bullmq'
import pino from 'pino'
import { prisma } from '@customerEQ/database'
import { type SlackOutboundPayload } from '@customerEQ/shared'

const logger = pino({ name: 'slack-outbound' })

export function createSlackOutboundProcessor(_conn: ConnectionOptions) {
  return (job: Job<SlackOutboundPayload>) => processSlackOutbound(job)
}

export async function processSlackOutbound(job: Job<SlackOutboundPayload>): Promise<void> {
  const { brandId, conversationId, kind, text } = job.data
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: { slackSupportWebhookUrl: true, name: true },
  })
  if (!brand?.slackSupportWebhookUrl) {
    logger.info({ brandId, conversationId }, 'no Slack webhook configured; skipping')
    return
  }
  const res = await fetch(brand.slackSupportWebhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `[${brand.name}] ${kind}: ${text}\nConversation: ${conversationId}`,
    }),
  })
  if (!res.ok) {
    throw new Error(`Slack webhook returned ${res.status}`)
  }
}

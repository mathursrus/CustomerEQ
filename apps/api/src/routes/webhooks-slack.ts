import type { FastifyPluginAsync } from 'fastify'
import { verifySlackSignature } from '../lib/slackSignature.js'

interface SlackEventBody {
  type?: string
  challenge?: string
  event?: {
    type?: string
    thread_ts?: string
    text?: string
    user?: string
  }
  team_id?: string
}

const webhooksSlackRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/v1/webhooks/slack/events', { config: { public: true } }, async (request, reply) => {
    const body = request.body as SlackEventBody

    // Slack URL verification challenge — no signature needed
    if (body.type === 'url_verification' && body.challenge) {
      return reply.status(200).send({ challenge: body.challenge })
    }

    const brandIdHeader = request.headers['x-brand-id']
    if (!brandIdHeader || typeof brandIdHeader !== 'string') {
      return reply.status(400).send({ error: 'X-Brand-Id required (team_id mapping deferred)' })
    }

    const brand = await fastify.prisma.brand.findUnique({
      where: { id: brandIdHeader },
      select: { slackSigningSecret: true },
    })
    if (!brand?.slackSigningSecret) {
      return reply.status(403).send({ error: 'Slack not configured for this brand' })
    }

    const ts = request.headers['x-slack-request-timestamp']
    const sig = request.headers['x-slack-signature']
    if (typeof ts !== 'string' || typeof sig !== 'string') {
      return reply.status(401).send({ error: 'Missing Slack signature headers' })
    }

    const ok = verifySlackSignature({
      signingSecret: brand.slackSigningSecret,
      timestamp: ts,
      rawBody: JSON.stringify(request.body),
      signature: sig,
    })
    if (!ok) {
      return reply.status(401).send({ error: 'Bad signature' })
    }

    // Handle thread-reply event
    if (body.event?.type === 'message' && body.event.thread_ts && body.event.text) {
      const threadMsg = await fastify.prisma.message.findFirst({
        where: { slackTs: body.event.thread_ts },
        select: { conversationId: true },
      })
      if (threadMsg) {
        await fastify.prisma.message.create({
          data: {
            conversationId: threadMsg.conversationId,
            role: 'AGENT',
            content: body.event.text,
            slackTs: body.event.thread_ts,
          },
        })
      }
    }

    return reply.status(200).send({ ok: true })
  })
}

export default webhooksSlackRoutes

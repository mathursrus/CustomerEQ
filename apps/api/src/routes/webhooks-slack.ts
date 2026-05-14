import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
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

type RequestWithRawBody = FastifyRequest & { rawBody?: string }

const webhooksSlackRoutes: FastifyPluginAsync = async (fastify) => {
  // Slack's HMAC is computed over the EXACT raw HTTP body bytes. Fastify's
  // default JSON parser produces an object; re-stringifying it would change
  // whitespace + key order vs what Slack sent, so the HMAC would never match
  // a real Slack payload. Replace the JSON parser within this plugin's scope
  // so request.rawBody holds the raw string while request.body still works.
  fastify.removeAllContentTypeParsers()
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    function (req, body, done) {
      ;(req as RequestWithRawBody).rawBody = typeof body === 'string' ? body : body.toString('utf8')
      try {
        const json = body && (body as string).length ? JSON.parse(body as string) : {}
        done(null, json)
      } catch (err) {
        done(err as Error, undefined)
      }
    },
  )

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

    // Use the raw HTTP body captured by our scoped content-type parser. If the
    // raw body is missing (e.g. an internal call that bypassed the parser),
    // fall back to JSON.stringify — but log a warning so we know about it.
    const rawBody = (request as RequestWithRawBody).rawBody
    if (rawBody === undefined) {
      fastify.log.warn(
        { route: '/v1/webhooks/slack/events' },
        'rawBody missing from request; Slack signature check will use re-stringified body which may mismatch in production',
      )
    }
    const ok = verifySlackSignature({
      signingSecret: brand.slackSigningSecret,
      timestamp: ts,
      rawBody: rawBody ?? JSON.stringify(request.body),
      signature: sig,
    })
    if (!ok) {
      return reply.status(401).send({ error: 'Bad signature' })
    }

    // Handle thread-reply event.
    // CRITICAL: Look up the thread by slackTs AND verify the parent conversation belongs
    // to the brand that signed this webhook. Without this check, an attacker controlling
    // brand A's Slack workspace could forge a thread_ts that matches a Message.slackTs from
    // brand B, signed with brand A's own secret, and inject AGENT messages into brand B's
    // conversation. See docs/evidence/support-revamp-design-review.md C1.
    if (body.event?.type === 'message' && body.event.thread_ts && body.event.text) {
      const threadMsg = await fastify.prisma.message.findFirst({
        where: { slackTs: body.event.thread_ts },
        select: {
          conversationId: true,
          conversation: { select: { brandId: true } },
        },
      })
      if (threadMsg && threadMsg.conversation.brandId !== brandIdHeader) {
        return reply.status(403).send({ error: 'Thread does not belong to this brand' })
      }
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

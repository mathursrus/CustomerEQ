import type { FastifyPluginAsync } from 'fastify'
import { CreateConversationSchema, SendMessageSchema, StartConversationPublicSchema } from '@customerEQ/shared'
import { enqueueSupportOrchestration } from '../queues/bullmq.js'

const supportPublicRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /v1/public/support/conversations — create a new conversation
  fastify.post(
    '/public/support/conversations',
    { config: { public: true } },
    async (request, reply) => {
      const authHeader = request.headers.authorization
      const hasBearer = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')

      if (!hasBearer) {
        // Anonymous flow — no Bearer token
        const brandIdHeader = request.headers['x-brand-id']
        if (!brandIdHeader || typeof brandIdHeader !== 'string') {
          return reply.status(400).send({ error: 'X-Brand-Id header required for anonymous flow' })
        }
        const brand = await fastify.prisma.brand.findUnique({
          where: { id: brandIdHeader },
          select: {
            id: true,
            consentMode: true,
            supportWidgetConfig: { select: { anonAllowed: true } },
          },
        })
        if (!brand) return reply.status(404).send({ error: 'Brand not found' })

        const anonAllowed = brand.supportWidgetConfig?.anonAllowed ?? true
        if (!anonAllowed) return reply.status(403).send({ error: 'Anonymous chat is disabled for this brand' })

        const parse = StartConversationPublicSchema.safeParse(request.body)
        if (!parse.success) return reply.status(422).send({ error: 'Validation failed', issues: parse.error.issues })

        const { anonId, email, initialMessage, consent } = parse.data
        if (!anonId) return reply.status(400).send({ error: 'anonId required for anonymous flow' })

        // Compliance gate (Brand.consentMode = EXPLICIT): if the widget is
        // capturing PII (email) from an anonymous visitor, the host page must
        // also pass `consent: true` proving the visitor ticked the disclosure
        // checkbox. For IMPLIED_ON_SUBMIT brands or pure-anonymous (no email)
        // conversations, the implicit-acceptance model from the surveys module
        // applies and no checkbox is needed.
        if (email && brand.consentMode === 'EXPLICIT' && consent !== true) {
          return reply.status(400).send({
            error: 'CONSENT_REQUIRED',
            message: 'This brand requires explicit consent before email capture. Set consent: true in the request body after the visitor acknowledges the disclosure.',
          })
        }

        const { conversation, message } = await fastify.prisma.$transaction(async (tx) => {
          const conv = await tx.conversation.create({
            data: {
              brandId: brand.id,
              memberId: null,
              anonId,
              email: email ?? null,
              channel: 'WIDGET',
              status: 'ACTIVE',
            },
          })
          const msg = await tx.message.create({
            data: { conversationId: conv.id, role: 'CUSTOMER', content: initialMessage },
          })
          return { conversation: conv, message: msg }
        })

        await enqueueSupportOrchestration({
          conversationId: conversation.id,
          brandId: brand.id,
          memberId: null,
          messageId: message.id,
          messageContent: initialMessage,
        })

        return reply.status(201).send({
          conversationId: conversation.id,
          status: conversation.status,
          streamUrl: `/v1/public/support/conversations/${conversation.id}/stream`,
        })
      }

      // Bearer-flow (email-based MVP auth, same as campaignPlay)
      if (!authHeader?.startsWith('Bearer ')) {
        return reply.status(401).send({ error: 'Authentication required' })
      }
      const memberEmail = authHeader.slice(7).trim()
      if (!memberEmail || !memberEmail.includes('@')) {
        return reply.status(401).send({ error: 'Invalid authentication token' })
      }

      const parse = CreateConversationSchema.safeParse(request.body)
      if (!parse.success) {
        return reply.status(422).send({
          error: 'Validation failed',
          message: parse.error.errors.map((e) => e.message).join(', '),
          details: parse.error.errors,
        })
      }

      const { initialMessage } = parse.data

      // Bearer flow requires X-Brand-Id so we can do the canonical
      // brandId_externalId lookup. The widget always knows its brandId.
      const bearerBrandHeader = request.headers['x-brand-id']
      if (!bearerBrandHeader || typeof bearerBrandHeader !== 'string') {
        return reply.status(400).send({ error: 'X-Brand-Id header required for Bearer flow' })
      }
      const bearerBrand = await fastify.prisma.brand.findUnique({
        where: { id: bearerBrandHeader },
        select: { id: true, memberIdentifierKind: true },
      })
      if (!bearerBrand) {
        return reply.status(404).send({ error: 'Brand not found' })
      }

      // v1 supports EMAIL brands only. Brands keyed by phone/customerId hit a
      // 422 (vs 404) so the widget can fall through to the anonymous flow
      // rather than failing silently.
      if (bearerBrand.memberIdentifierKind !== 'EMAIL') {
        return reply.status(422).send({
          error: 'IDENTIFIER_KIND_UNSUPPORTED',
          message: 'This brand uses a non-email member identifier. The Bearer/identify path supports EMAIL brands only in v1.',
        })
      }

      // Canonical member lookup: brandId + externalId (lowercased+trimmed email).
      // Replaces the older `findFirst({ where: { email, deletedAt: null, ... } })`
      // pattern which was tenant-unsafe across brands sharing an email value.
      const member = await fastify.prisma.member.findUnique({
        where: {
          brandId_externalId: {
            brandId: bearerBrand.id,
            externalId: memberEmail.toLowerCase().trim(),
          },
        },
        select: { id: true, brandId: true, deletedAt: true, erased: true },
      })
      if (!member || member.deletedAt || member.erased) {
        return reply.status(404).send({ error: 'Member not found' })
      }

      // Create conversation + initial message in transaction
      const { conversation, message } = await fastify.prisma.$transaction(async (tx) => {
        const conv = await tx.conversation.create({
          data: { brandId: member.brandId, memberId: member.id, status: 'ACTIVE' },
        })
        const msg = await tx.message.create({
          data: { conversationId: conv.id, role: 'CUSTOMER', content: initialMessage },
        })
        return { conversation: conv, message: msg }
      })

      // Enqueue orchestration pipeline (async)
      await enqueueSupportOrchestration({
        conversationId: conversation.id,
        brandId: member.brandId,
        memberId: member.id,
        messageId: message.id,
        messageContent: initialMessage,
      })

      return reply.status(201).send({
        conversationId: conversation.id,
        status: 'ACTIVE',
        streamUrl: `/v1/public/support/conversations/${conversation.id}/stream`,
      })
    },
  )

  // POST /v1/public/support/conversations/:id/messages — send a message (Bearer or anonymous)
  fastify.post(
    '/public/support/conversations/:id/messages',
    { config: { public: true } },
    async (request, reply) => {
      const authHeader = request.headers.authorization
      const hasBearer = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      const { id: conversationId } = request.params as { id: string }

      const parse = SendMessageSchema.safeParse(request.body)
      if (!parse.success) {
        return reply.status(422).send({
          error: 'Validation failed',
          message: parse.error.errors.map((e) => e.message).join(', '),
          details: parse.error.errors,
        })
      }

      if (!hasBearer) {
        // Anonymous flow — look up conversation by ID and verify it's an anon conversation
        const body = request.body as Record<string, unknown>
        const anonId = typeof body.anonId === 'string' ? body.anonId : undefined

        const conversation = await fastify.prisma.conversation.findFirst({
          where: { id: conversationId, memberId: null },
          select: { id: true, brandId: true, status: true, anonId: true },
        })
        if (!conversation) {
          return reply.status(404).send({ error: 'Conversation not found' })
        }
        // Soft ownership check: if the conversation has an anonId, require it to match
        if (conversation.anonId && anonId && conversation.anonId !== anonId) {
          return reply.status(403).send({ error: 'Forbidden' })
        }
        if (conversation.status === 'CLOSED' || conversation.status === 'RESOLVED') {
          return reply.status(409).send({ error: 'Conversation is closed' })
        }

        const message = await fastify.prisma.message.create({
          data: { conversationId, role: 'CUSTOMER', content: parse.data.content },
        })

        await enqueueSupportOrchestration({
          conversationId,
          brandId: conversation.brandId,
          memberId: null,
          messageId: message.id,
          messageContent: parse.data.content,
        })

        return reply.status(201).send({
          messageId: message.id,
          role: message.role,
          content: message.content,
          createdAt: message.createdAt,
        })
      }

      // Bearer-flow (email-based auth)
      const memberEmail = authHeader!.slice(7).trim()
      if (!memberEmail || !memberEmail.includes('@')) {
        return reply.status(401).send({ error: 'Invalid authentication token' })
      }

      // Verify member exists and conversation belongs to them
      const member = await fastify.prisma.member.findFirst({
        where: { email: memberEmail, deletedAt: null, erased: false },
        select: { id: true, brandId: true },
      })
      if (!member) {
        return reply.status(404).send({ error: 'Member not found' })
      }

      const conversation = await fastify.prisma.conversation.findFirst({
        where: { id: conversationId, memberId: member.id },
      })
      if (!conversation) {
        return reply.status(404).send({ error: 'Conversation not found' })
      }

      // Reject messages to closed/resolved conversations
      if (conversation.status === 'CLOSED' || conversation.status === 'RESOLVED') {
        return reply.status(409).send({ error: 'Conversation is closed' })
      }

      // Create message
      const message = await fastify.prisma.message.create({
        data: {
          conversationId,
          role: 'CUSTOMER',
          content: parse.data.content,
        },
      })

      // Re-trigger orchestration for the new message
      await enqueueSupportOrchestration({
        conversationId,
        brandId: member.brandId,
        memberId: member.id,
        messageId: message.id,
        messageContent: parse.data.content,
      })

      return reply.status(201).send({
        messageId: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
      })
    },
  )

  // GET /v1/public/support/conversations/:id/messages — fetch conversation messages
  fastify.get(
    '/public/support/conversations/:id/messages',
    { config: { public: true } },
    async (request, reply) => {
      const authHeader = request.headers.authorization
      if (!authHeader?.startsWith('Bearer ')) {
        return reply.status(401).send({ error: 'Authentication required' })
      }
      const memberEmail = authHeader.slice(7).trim()
      if (!memberEmail || !memberEmail.includes('@')) {
        return reply.status(401).send({ error: 'Invalid authentication token' })
      }

      const { id: conversationId } = request.params as { id: string }

      // Verify member and conversation ownership
      const member = await fastify.prisma.member.findFirst({
        where: { email: memberEmail, deletedAt: null, erased: false },
        select: { id: true },
      })
      if (!member) {
        return reply.status(404).send({ error: 'Member not found' })
      }

      const conversation = await fastify.prisma.conversation.findFirst({
        where: { id: conversationId, memberId: member.id },
      })
      if (!conversation) {
        return reply.status(404).send({ error: 'Conversation not found' })
      }

      const { limit: limitStr } = request.query as { limit?: string }
      const limit = Math.min(200, Math.max(1, parseInt(limitStr ?? '100', 10) || 100))

      const messages = await fastify.prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        take: limit,
        select: {
          id: true,
          role: true,
          content: true,
          createdAt: true,
        },
      })

      return reply.status(200).send({ messages })
    },
  )

  // GET /v1/public/support/conversations/:id/stream — SSE endpoint
  fastify.get(
    '/public/support/conversations/:id/stream',
    { config: { public: true } },
    async (request, reply) => {
      const { id: conversationId } = request.params as { id: string }
      const { token } = request.query as { token?: string }

      // Auth via query param (SSE does not support custom headers)
      const memberEmail = token
      if (!memberEmail || !memberEmail.includes('@')) {
        return reply.status(401).send({ error: 'Authentication required' })
      }

      const member = await fastify.prisma.member.findFirst({
        where: { email: memberEmail, deletedAt: null, erased: false },
        select: { id: true },
      })
      if (!member) {
        return reply.status(404).send({ error: 'Member not found' })
      }

      const conversation = await fastify.prisma.conversation.findFirst({
        where: { id: conversationId, memberId: member.id },
      })
      if (!conversation) {
        return reply.status(404).send({ error: 'Conversation not found' })
      }

      // Set SSE headers. We call reply.raw.writeHead() directly (bypassing
      // fastify.reply) so fastify-cors's onRequest/onSend hooks never get
      // a chance to add Access-Control-Allow-Origin. Mirror the CORS policy
      // from app.ts (localhost, *.azurecontainerapps.io, *.wellnessatwork.me)
      // manually so cross-origin SSE consumers (embed widget, demo apps)
      // aren't blocked by the browser.
      const requestOrigin = (request.headers.origin as string | undefined) ?? ''
      const corsOk = [/localhost/, /\.azurecontainerapps\.io$/, /\.wellnessatwork\.me$/].some((p) => p.test(requestOrigin))
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        ...(corsOk ? { 'Access-Control-Allow-Origin': requestOrigin, 'Access-Control-Allow-Credentials': 'true' } : {}),
      })

      // If Redis is available, subscribe to pub/sub channel
      if (fastify.redis) {
        const channel = `support:conversation:${conversationId}`
        const subscriber = fastify.redis.duplicate()
        await subscriber.subscribe(channel)

        subscriber.on('message', (_ch: string, data: string) => {
          reply.raw.write(`data: ${data}\n\n`)
        })

        // Cleanup on disconnect
        request.raw.on('close', () => {
          subscriber.unsubscribe(channel)
          subscriber.quit()
        })
      } else {
        // No Redis — poll for new messages (simplified fallback)
        reply.raw.write(`data: ${JSON.stringify({ type: 'info', message: 'SSE connected (polling mode)' })}\n\n`)
        request.raw.on('close', () => {
          // Cleanup
        })
      }
    },
  )
  // GET /v1/public/support/conversations/:id — minimal status endpoint for widget polling
  // Returns { id, status } only — no PII, public-readable so the widget can poll for escalation
  fastify.get(
    '/public/support/conversations/:id',
    { config: { public: true } },
    async (request, reply) => {
      const { id: conversationId } = request.params as { id: string }
      const conversation = await fastify.prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { id: true, status: true },
      })
      if (!conversation) {
        return reply.status(404).send({ error: 'Conversation not found' })
      }
      return reply.status(200).send({ id: conversation.id, status: conversation.status })
    },
  )
}

export default supportPublicRoutes

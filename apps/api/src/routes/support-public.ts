import type { FastifyPluginAsync } from 'fastify'
import { CreateConversationSchema, SendMessageSchema } from '@customerEQ/shared'
import { enqueueSupportOrchestration } from '../queues/bullmq.js'

const supportPublicRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /v1/public/support/conversations — create a new conversation
  fastify.post(
    '/public/support/conversations',
    { config: { public: true } },
    async (request, reply) => {
      // Authenticate member via Bearer token (email-based MVP auth, same as campaignPlay)
      const authHeader = request.headers.authorization
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

      // Look up member by email
      const member = await fastify.prisma.member.findFirst({
        where: { email: memberEmail, deletedAt: null, erased: false },
        select: { id: true, brandId: true },
      })
      if (!member) {
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

  // POST /v1/public/support/conversations/:id/messages — send a message
  fastify.post(
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

      const parse = SendMessageSchema.safeParse(request.body)
      if (!parse.success) {
        return reply.status(422).send({
          error: 'Validation failed',
          message: parse.error.errors.map((e) => e.message).join(', '),
          details: parse.error.errors,
        })
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
}

export default supportPublicRoutes

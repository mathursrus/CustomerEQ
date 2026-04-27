// /v1/api-keys — admin-facing CRUD for developer API keys. Backs the
// Developer page in the admin UI (`/admin/developer`). Plaintext keys are
// shown only once at creation time; after that, only the prefix + metadata
// are queryable.

import type { FastifyPluginAsync } from 'fastify'
import { createHash, randomBytes } from 'node:crypto'
import { CreateApiKeySchema } from '@customerEQ/shared'

function generatePlaintextKey(): string {
  // 32 bytes → 43-char base64url. Prefixed with `ceq_` so customers can
  // recognize it in their env files + git diffs.
  return `ceq_${randomBytes(32).toString('base64url')}`
}

function hashKey(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex')
}

const apiKeysRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /v1/api-keys — list keys for the authenticated brand
  fastify.get('/api-keys', async (request) => {
    const keys = await fastify.prisma.apiKey.findMany({
      where: { brandId: request.brandId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        createdAt: true,
        lastUsedAt: true,
        revokedAt: true,
      },
    })
    return {
      keys: keys.map((k) => ({
        id: k.id,
        name: k.name,
        keyPrefix: k.keyPrefix,
        createdAt: k.createdAt.toISOString(),
        lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
        revokedAt: k.revokedAt?.toISOString() ?? null,
      })),
    }
  })

  // POST /v1/api-keys — create a new key. Plaintext returned once.
  fastify.post('/api-keys', async (request, reply) => {
    const parse = CreateApiKeySchema.safeParse(request.body)
    if (!parse.success) {
      return reply.status(422).send({
        error: 'Validation failed',
        message: parse.error.errors.map((e) => e.message).join(', '),
      })
    }
    const plaintext = generatePlaintextKey()
    const created = await fastify.prisma.apiKey.create({
      data: {
        brandId: request.brandId,
        name: parse.data.name,
        keyPrefix: plaintext.slice(0, 12), // e.g. "ceq_abcdefgh"
        keyHash: hashKey(plaintext),
        createdBy: request.clerkUserId,
      },
    })
    return reply.status(201).send({
      id: created.id,
      name: created.name,
      keyPrefix: created.keyPrefix,
      createdAt: created.createdAt.toISOString(),
      lastUsedAt: null,
      revokedAt: null,
      key: plaintext, // ONLY returned on create — can never be retrieved again
    })
  })

  // DELETE /v1/api-keys/:id — soft revoke
  fastify.delete<{ Params: { id: string } }>('/api-keys/:id', async (request, reply) => {
    const existing = await fastify.prisma.apiKey.findFirst({
      where: { id: request.params.id, brandId: request.brandId },
      select: { id: true, revokedAt: true },
    })
    if (!existing) return reply.status(404).send({ error: 'API key not found' })
    if (existing.revokedAt) return reply.status(200).send({ revoked: true })
    await fastify.prisma.apiKey.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    })
    return reply.status(200).send({ revoked: true })
  })
}

export default apiKeysRoutes

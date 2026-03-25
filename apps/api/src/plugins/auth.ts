import fp from 'fastify-plugin'
import { verifyToken } from '@clerk/backend'
import type { FastifyPluginAsync } from 'fastify'

declare module 'fastify' {
  interface FastifyRequest {
    brandId: string
    clerkUserId: string
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', async (request, reply) => {
    // Skip CORS preflight requests — they never carry Authorization
    if (request.method === 'OPTIONS') return

    const authHeader = request.headers.authorization

    // Skip auth for public routes that have no Authorization header
    if (!authHeader) {
      if ((request.routeOptions?.config as unknown as Record<string, unknown>)?.public === true) {
        return
      }
      return reply
        .status(401)
        .send({ error: 'Authorization header is required' })
    }

    const token = authHeader.replace(/^Bearer\s+/i, '')

    let payload: Awaited<ReturnType<typeof verifyToken>>
    try {
      payload = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY,
      })
    } catch {
      return reply
        .status(401)
        .send({ error: 'Invalid or expired token' })
    }

    const raw = payload as unknown as Record<string, unknown>
    // Clerk JWT v2 nests org under `o.id`; v1 uses top-level `org_id`
    const orgId =
      (raw.org_id as string | undefined) ??
      ((raw.o as Record<string, string> | undefined)?.id)
    if (!orgId) {
      return reply
        .status(401)
        .send({ error: 'Token does not contain an organization ID' })
    }

    const brand = await fastify.prisma.brand.findUnique({
      where: { clerkOrgId: orgId },
      select: { id: true },
    })

    if (!brand) {
      return reply
        .status(401)
        .send({ error: 'Brand not found for the provided organization' })
    }

    request.brandId = brand.id
    request.clerkUserId = payload.sub
  })
}

export default fp(authPlugin, {
  name: 'auth',
  dependencies: ['prisma'],
})

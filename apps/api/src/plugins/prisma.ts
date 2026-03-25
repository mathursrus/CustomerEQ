import fp from 'fastify-plugin'
import { prisma } from '@customerEQ/database'
import type { FastifyPluginAsync } from 'fastify'

type PrismaInstance = typeof prisma

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaInstance
  }
}

const prismaPlugin: FastifyPluginAsync = async (fastify) => {
  await prisma.$connect()
  fastify.decorate('prisma', prisma)
  fastify.addHook('onClose', async () => {
    await prisma.$disconnect()
  })
}

export default fp(prismaPlugin, { name: 'prisma' })

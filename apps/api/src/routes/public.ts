import type { FastifyPluginAsync } from 'fastify'
import { DemoRequestSchema } from '@customerEQ/shared'

const API_BASE_URL =
  process.env.API_BASE_URL ?? 'https://api.customerEQ.io'

const publicRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /v1/public/demo-requests — no auth required
  fastify.post(
    '/public/demo-requests',
    { config: { public: true } },
    async (request, reply) => {
      const parse = DemoRequestSchema.safeParse(request.body)
      if (!parse.success) {
        return reply.status(422).send({
          error: 'Validation failed',
          message: parse.error.errors.map((e) => e.message).join(', '),
          details: parse.error.errors,
        })
      }

      const data = parse.data
      const demoRequest = await fastify.prisma.demoRequest.create({
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          workEmail: data.workEmail,
          companyName: data.companyName,
          companySize: data.companySize ?? undefined,
          message: data.message ?? undefined,
        },
      })

      return reply.status(201).send(demoRequest)
    },
  )

  // GET /v1/admin/demo-requests — admin JWT required
  fastify.get('/admin/demo-requests', async (_request, reply) => {
    const demoRequests = await fastify.prisma.demoRequest.findMany({
      orderBy: { createdAt: 'desc' },
    })

    return reply.status(200).send(demoRequests)
  })

  // GET /v1/admin/integrations — admin JWT required
  fastify.get('/admin/integrations', async (_request, reply) => {
    return reply.status(200).send({
      salesforce: `${API_BASE_URL}/v1/integrations/webhooks/salesforce`,
      hubspot: `${API_BASE_URL}/v1/integrations/webhooks/hubspot`,
    })
  })
}

export default publicRoutes

// /v1/developer/config — one-call fetch for everything the admin's
// developer page needs. Returns brand info, active surveys with their
// embed snippets, external signal sources with their webhook URLs, and
// ready-to-paste code snippets. Scoped to the authenticated brand.

import type { FastifyPluginAsync } from 'fastify'

const API_BASE_URL = process.env.API_BASE_URL ?? 'https://api.customerEQ.io'
const WEB_BASE_URL = process.env.ADMIN_UI_BASE_URL ?? 'http://localhost:3000'

const developerRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/developer/config', async (request) => {
    const [brand, surveys, signalSources] = await Promise.all([
      fastify.prisma.brand.findUnique({
        where: { id: request.brandId },
        select: { id: true, name: true },
      }),
      fastify.prisma.survey.findMany({
        where: { brandId: request.brandId, status: 'ACTIVE' },
        select: { id: true, name: true, type: true },
        orderBy: { createdAt: 'desc' },
      }),
      fastify.prisma.externalSignalSource.findMany({
        where: { brandId: request.brandId, enabled: true },
        select: {
          id: true,
          name: true,
          sourceType: true,
          syncMode: true,
          credentialRef: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    return {
      brand: brand ?? { id: request.brandId, name: '' },
      apiBaseUrl: API_BASE_URL,
      surveys: surveys.map((s) => ({
        id: s.id,
        name: s.name,
        type: s.type,
        shareUrl: `${WEB_BASE_URL}/survey/${s.id}`,
        embedSnippet: `<script src="${API_BASE_URL}/v1/public/surveys/${s.id}/widget.js"></script>`,
      })),
      externalSignalSources: signalSources.map((s) => ({
        id: s.id,
        name: s.name,
        sourceType: s.sourceType,
        syncMode: s.syncMode,
        webhookUrl: `${API_BASE_URL}/v1/integrations/webhooks/external-signals/${s.id}`,
        hasSharedSecret: s.credentialRef !== null,
      })),
      codeSnippets: {
        curlIngestEvent: [
          `curl -X POST "${API_BASE_URL}/v1/events" \\`,
          `  -H "X-Api-Key: <YOUR_API_KEY>" \\`,
          `  -H "Content-Type: application/json" \\`,
          `  -d '{`,
          `    "memberId": "<MEMBER_ID>",`,
          `    "eventType": "purchase",`,
          `    "payload": { "amount": 49.99, "orderId": "order_123" },`,
          `    "idempotencyKey": "order_123"`,
          `  }'`,
        ].join('\n'),
        curlEnrollMember: [
          `curl -X POST "${API_BASE_URL}/v1/members/enroll" \\`,
          `  -H "Content-Type: application/json" \\`,
          `  -d '{`,
          `    "memberId": "customer@example.com",`,
          `    "firstName": "Jane",`,
          `    "programId": "<PROGRAM_ID>",`,
          `    "consentGivenAt": "${new Date().toISOString()}"`,
          `  }'`,
        ].join('\n'),
      },
    }
  })
}

export default developerRoutes

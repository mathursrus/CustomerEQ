/// <reference types="vitest" />
import { describe, it, expect, vi, afterEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import developerRoutes from './developer.js'

function buildApp(options: {
  brand: { id: string; name: string } | null
  surveys: Array<{ id: string; name: string; type: string; incentivePoints: number | null }>
  sources: Array<{
    id: string
    name: string
    sourceType: string
    syncMode: string
    credentialRef: string | null
  }>
  brandId?: string
}) {
  const app = Fastify()

  app.register(
    fp(
      async (fastify) => {
        fastify.decorate('prisma', {
          brand: {
            findUnique: vi.fn(async () => options.brand),
          },
          survey: {
            findMany: vi.fn(async () => options.surveys),
          },
          externalSignalSource: {
            findMany: vi.fn(async () => options.sources),
          },
        } as never)
      },
      { name: 'prisma' },
    ),
  )

  app.register(
    fp(
      async (fastify) => {
        fastify.addHook('preHandler', async (req) => {
          req.brandId = options.brandId ?? 'brand_acme'
          req.clerkUserId = 'user_test'
        })
      },
      { name: 'auth' },
    ),
  )

  return app
}

describe('developerRoutes', () => {
  let app: FastifyInstance | null = null

  afterEach(async () => {
    if (app) await app.close()
    app = null
  })

  it('returns brand info, surveys, signal sources, and snippets', async () => {
    app = buildApp({
      brand: { id: 'brand_acme', name: 'Acme Coffee' },
      surveys: [
        { id: 'srv_1', name: 'Post-Purchase NPS', type: 'NPS', incentivePoints: 50 },
      ],
      sources: [
        { id: 'src_1', name: 'Google Reviews', sourceType: 'GOOGLE_BUSINESS_PROFILE', syncMode: 'WEBHOOK', credentialRef: 'secret_123' },
      ],
    })
    await app.register(developerRoutes)
    await app.ready()

    const res = await app.inject({ method: 'GET', url: '/developer/config' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)

    expect(body.brand).toEqual({ id: 'brand_acme', name: 'Acme Coffee' })
    expect(body.apiBaseUrl).toBeTruthy()

    expect(body.surveys).toHaveLength(1)
    expect(body.surveys[0]).toMatchObject({
      id: 'srv_1',
      name: 'Post-Purchase NPS',
      type: 'NPS',
      incentivePoints: 50,
    })
    // Embed snippet is a proper <script> tag pointing at widget.js
    expect(body.surveys[0].embedSnippet).toContain('<script')
    expect(body.surveys[0].embedSnippet).toContain('/v1/public/surveys/srv_1/widget.js')
    expect(body.surveys[0].shareUrl).toContain('/survey/srv_1')

    expect(body.externalSignalSources).toHaveLength(1)
    expect(body.externalSignalSources[0]).toMatchObject({
      id: 'src_1',
      name: 'Google Reviews',
      sourceType: 'GOOGLE_BUSINESS_PROFILE',
      hasSharedSecret: true,
    })
    expect(body.externalSignalSources[0].webhookUrl).toContain('/v1/integrations/webhooks/external-signals/src_1')

    // Code snippets include curl commands for the core integrations
    expect(body.codeSnippets.curlIngestEvent).toContain('curl -X POST')
    expect(body.codeSnippets.curlIngestEvent).toContain('/v1/events')
    expect(body.codeSnippets.curlIngestEvent).toContain('X-Api-Key')
    expect(body.codeSnippets.curlEnrollMember).toContain('/v1/members/enroll')
  })

  it('returns empty arrays (not null) when nothing is configured', async () => {
    app = buildApp({
      brand: { id: 'brand_new', name: 'Brand new' },
      surveys: [],
      sources: [],
    })
    await app.register(developerRoutes)
    await app.ready()

    const res = await app.inject({ method: 'GET', url: '/developer/config' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.surveys).toEqual([])
    expect(body.externalSignalSources).toEqual([])
  })

  it('falls back to brandId when brand record is missing', async () => {
    app = buildApp({
      brand: null,
      surveys: [],
      sources: [],
      brandId: 'brand_orphan',
    })
    await app.register(developerRoutes)
    await app.ready()

    const res = await app.inject({ method: 'GET', url: '/developer/config' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.brand.id).toBe('brand_orphan')
  })

  it('marks external signal sources without credentialRef as hasSharedSecret=false', async () => {
    app = buildApp({
      brand: { id: 'brand_acme', name: 'Acme Coffee' },
      surveys: [],
      sources: [
        { id: 'src_1', name: 'Open webhook', sourceType: 'GENERIC_WEBHOOK', syncMode: 'WEBHOOK', credentialRef: null },
      ],
    })
    await app.register(developerRoutes)
    await app.ready()

    const res = await app.inject({ method: 'GET', url: '/developer/config' })
    const body = JSON.parse(res.body)
    expect(body.externalSignalSources[0].hasSharedSecret).toBe(false)
  })
})

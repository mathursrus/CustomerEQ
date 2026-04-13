/// <reference types="vitest" />
import { describe, it, expect, vi, afterEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'

// Mock @customerEQ/ai so we don't need OPENAI_API_KEY in unit tests.
// The module is imported by members.ts for sentiment analysis on note creation.
vi.mock('@customerEQ/ai', () => ({
  analyzeResponse: vi.fn(),
}))

import { analyzeResponse } from '@customerEQ/ai'
import membersRoutes from './members.js'

// Simple Prisma mock builder. Uses fn() so we can assert on calls + control
// return values per test, and a small in-memory `notes` array so we can
// verify the row actually got written with the sentiment we expect.
interface NoteRow {
  id: string
  brandId: string
  memberId: string
  body: string
  author: string
  category: string | null
  sentiment: string | null
  createdAt: Date
  updatedAt: Date
}

function buildApp(opts: { memberExists?: boolean; brandId?: string } = {}) {
  const app = Fastify()
  const notes: NoteRow[] = []
  const auditEvents: Array<{ action: string; metadata: unknown }> = []
  let nextNoteId = 1

  app.register(
    fp(
      async (fastify) => {
        fastify.decorate('prisma', {
          member: {
            findFirst: vi.fn(async () =>
              opts.memberExists === false ? null : { id: 'member_1' },
            ),
          },
          memberNote: {
            create: vi.fn(async ({ data }: { data: Omit<NoteRow, 'id' | 'createdAt' | 'updatedAt'> }) => {
              const row: NoteRow = {
                ...data,
                id: `note_${nextNoteId++}`,
                createdAt: new Date('2026-04-13T00:00:00Z'),
                updatedAt: new Date('2026-04-13T00:00:00Z'),
              }
              notes.push(row)
              return row
            }),
            findMany: vi.fn(async () => notes),
            findFirst: vi.fn(async () => null),
            update: vi.fn(async () => notes[0]),
            delete: vi.fn(async () => notes[0]),
          },
          auditEvent: {
            create: vi.fn(async ({ data }: { data: { action: string; metadata: unknown } }) => {
              auditEvents.push({ action: data.action, metadata: data.metadata })
              return data
            }),
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
          req.brandId = opts.brandId ?? 'brand_acme'
          req.clerkUserId = 'test-admin@example.com'
        })
      },
      { name: 'auth' },
    ),
  )

  return { app, notes, auditEvents }
}

describe('POST /v1/members/:id/notes — auto sentiment (#141)', () => {
  let app: FastifyInstance | null = null

  afterEach(async () => {
    if (app) await app.close()
    app = null
    vi.mocked(analyzeResponse).mockReset()
  })

  it('auto-computes sentiment from note body when not provided', async () => {
    vi.mocked(analyzeResponse).mockResolvedValue({
      sentiment: 0.75, // very positive
      confidence: 0.92,
      topics: [],
      summary: '',
      assignedClusterLabel: null,
      suggestedNewClusterLabel: null,
    })

    const built = buildApp()
    app = built.app
    await app.register(membersRoutes, { prefix: '/v1' })
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/v1/members/member_1/notes',
      headers: { 'content-type': 'application/json' },
      payload: {
        body: 'Customer is absolutely thrilled with the new rewards program!',
      },
    })

    expect(res.statusCode).toBe(201)
    const body = JSON.parse(res.body)
    expect(body.sentiment).toBe('very_positive')
    expect(body.sentimentAuto).toBe(true)
    // The AI was actually called
    expect(analyzeResponse).toHaveBeenCalledOnce()
    expect(analyzeResponse).toHaveBeenCalledWith(
      'Customer is absolutely thrilled with the new rewards program!',
      expect.objectContaining({ surveyType: 'note' }),
    )
    // Row in DB carries the computed bucket
    expect(built.notes[0].sentiment).toBe('very_positive')
  })

  it('maps negative AI scores to negative buckets', async () => {
    vi.mocked(analyzeResponse).mockResolvedValue({
      sentiment: -0.4,
      confidence: 0.88,
      topics: [],
      summary: '',
      assignedClusterLabel: null,
      suggestedNewClusterLabel: null,
    })

    const built = buildApp()
    app = built.app
    await app.register(membersRoutes, { prefix: '/v1' })
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/v1/members/member_1/notes',
      headers: { 'content-type': 'application/json' },
      payload: { body: 'Customer complained about shipping delay.' },
    })

    expect(res.statusCode).toBe(201)
    const body = JSON.parse(res.body)
    expect(body.sentiment).toBe('negative')
    expect(body.sentimentAuto).toBe(true)
  })

  it('manual sentiment overrides auto-compute (respects explicit caller input)', async () => {
    // Even if the AI would compute positive, an explicit override wins and
    // the AI is not called at all.
    const built = buildApp()
    app = built.app
    await app.register(membersRoutes, { prefix: '/v1' })
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/v1/members/member_1/notes',
      headers: { 'content-type': 'application/json' },
      payload: {
        body: 'Customer was happy but we suspect churn risk.',
        sentiment: 'very_negative', // rep override
      },
    })

    expect(res.statusCode).toBe(201)
    const body = JSON.parse(res.body)
    expect(body.sentiment).toBe('very_negative')
    expect(body.sentimentAuto).toBe(false)
    expect(analyzeResponse).not.toHaveBeenCalled()
    expect(built.notes[0].sentiment).toBe('very_negative')
  })

  it('falls back to null sentiment when AI call throws (graceful degradation)', async () => {
    vi.mocked(analyzeResponse).mockRejectedValue(new Error('OpenAI rate limit'))

    const built = buildApp()
    app = built.app
    await app.register(membersRoutes, { prefix: '/v1' })
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/v1/members/member_1/notes',
      headers: { 'content-type': 'application/json' },
      payload: { body: 'Called customer about their concern.' },
    })

    // Note still saved, just without sentiment
    expect(res.statusCode).toBe(201)
    const body = JSON.parse(res.body)
    expect(body.sentiment).toBeNull()
    expect(body.sentimentAuto).toBe(false)
    expect(built.notes[0].sentiment).toBeNull()
  })

  it('writes an audit event that records the auto-computed sentiment', async () => {
    vi.mocked(analyzeResponse).mockResolvedValue({
      sentiment: 0.3,
      confidence: 0.8,
      topics: [],
      summary: '',
      assignedClusterLabel: null,
      suggestedNewClusterLabel: null,
    })

    const built = buildApp()
    app = built.app
    await app.register(membersRoutes, { prefix: '/v1' })
    await app.ready()

    await app.inject({
      method: 'POST',
      url: '/v1/members/member_1/notes',
      headers: { 'content-type': 'application/json' },
      payload: { body: 'Followed up on shipping question.' },
    })

    expect(built.auditEvents).toHaveLength(1)
    expect(built.auditEvents[0].action).toBe('member_note.create')
    expect((built.auditEvents[0].metadata as { sentiment: string }).sentiment).toBe('positive')
  })

  it('returns 404 when member does not belong to the brand', async () => {
    const built = buildApp({ memberExists: false })
    app = built.app
    await app.register(membersRoutes, { prefix: '/v1' })
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/v1/members/member_1/notes',
      headers: { 'content-type': 'application/json' },
      payload: { body: 'Test' },
    })
    expect(res.statusCode).toBe(404)
    expect(analyzeResponse).not.toHaveBeenCalled()
  })
})

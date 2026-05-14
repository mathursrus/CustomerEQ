// Issue #371 — /admin/surveys/new server-component error handling.
//
// Covers:
//   T1 — programs fetch rejection      → ?error=programs-fetch-failed
//   T2 — auth() rejection              → ?error=auth-failed
//   T3 — empty programs list           → ?error=no-program  (parity with main)
//   T4 — survey POST !res.ok           → ?error=create-failed (parity with main)
//   T5 — survey POST rejection         → ?error=create-failed
//   T6 — happy path                    → redirect /admin/surveys/<id>/edit?tab=basics
//                                         + POST body shape (name '', type NPS, 2 questions)
//   T7 — question-id stability         → two consecutive renders produce
//                                         DIFFERENT question IDs (proves freshPresetFor
//                                         is called per-request, not at module load)
//
// Mocks `redirect` to throw a sentinel `Error('REDIRECT:<url>')` so the test
// can assert which branch fired. This mirrors the production
// next/navigation.redirect() behavior of throwing NEXT_REDIRECT to short-
// circuit the rest of the render function.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

const mockAuth = vi.mocked(auth)
const mockRedirect = vi.mocked(redirect)

const originalFetch = globalThis.fetch

interface CapturedRequest {
  url: string
  method: string
  body: unknown
}

function installFetchMock(handler: (req: CapturedRequest) => Response | Promise<Response>) {
  const captured: CapturedRequest[] = []
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    const method = init?.method ?? 'GET'
    const body = init?.body ? JSON.parse(init.body as string) : undefined
    const req = { url, method, body }
    captured.push(req)
    return handler(req)
  }) as unknown as typeof fetch
  return captured
}

beforeEach(() => {
  mockAuth.mockResolvedValue({
    getToken: async () => 'test-token',
  } as unknown as Awaited<ReturnType<typeof auth>>)
  mockRedirect.mockImplementation(((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }) as unknown as typeof redirect)
})

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.clearAllMocks()
  vi.resetModules()
})

async function loadPage() {
  const mod = await import('./page')
  return mod.default
}

describe('/admin/surveys/new · server-component error handling (#371)', () => {
  it('T1 — redirects with ?error=programs-fetch-failed when GET /v1/programs rejects', async () => {
    installFetchMock(async ({ url }) => {
      if (url.endsWith('/v1/programs')) throw new Error('simulated network failure')
      return new Response('not found', { status: 404 })
    })
    const Page = await loadPage()
    await expect(Page()).rejects.toThrow(/REDIRECT:\/admin\/surveys\?error=programs-fetch-failed/)
  })

  it('T2 — redirects with ?error=auth-failed when auth() rejects', async () => {
    mockAuth.mockRejectedValueOnce(new Error('clerk infra unavailable'))
    installFetchMock(async () => new Response('should-not-be-called', { status: 500 }))
    const Page = await loadPage()
    await expect(Page()).rejects.toThrow(/REDIRECT:\/admin\/surveys\?error=auth-failed/)
  })

  it('T3 — redirects with ?error=no-program when programs list is empty', async () => {
    installFetchMock(async ({ url }) => {
      if (url.endsWith('/v1/programs')) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 })
      }
      return new Response('not found', { status: 404 })
    })
    const Page = await loadPage()
    await expect(Page()).rejects.toThrow(/REDIRECT:\/admin\/surveys\?error=no-program/)
  })

  it('T4 — redirects with ?error=create-failed when POST /v1/surveys returns !ok', async () => {
    installFetchMock(async ({ url }) => {
      if (url.endsWith('/v1/programs')) {
        return new Response(JSON.stringify({ data: [{ id: 'prg_1', name: 'Default' }] }), {
          status: 200,
        })
      }
      if (url.endsWith('/v1/surveys')) {
        return new Response(JSON.stringify({ error: 'bad request' }), { status: 400 })
      }
      return new Response('not found', { status: 404 })
    })
    const Page = await loadPage()
    await expect(Page()).rejects.toThrow(/REDIRECT:\/admin\/surveys\?error=create-failed/)
  })

  it('T5 — redirects with ?error=create-failed when POST /v1/surveys rejects', async () => {
    installFetchMock(async ({ url }) => {
      if (url.endsWith('/v1/programs')) {
        return new Response(JSON.stringify({ data: [{ id: 'prg_1', name: 'Default' }] }), {
          status: 200,
        })
      }
      if (url.endsWith('/v1/surveys')) throw new Error('connection reset')
      return new Response('not found', { status: 404 })
    })
    const Page = await loadPage()
    await expect(Page()).rejects.toThrow(/REDIRECT:\/admin\/surveys\?error=create-failed/)
  })

  it('T6 — happy path: redirects to /admin/surveys/<id>/edit?tab=basics with correct POST body', async () => {
    const captured = installFetchMock(async ({ url }) => {
      if (url.endsWith('/v1/programs')) {
        return new Response(JSON.stringify({ data: [{ id: 'prg_abc', name: 'NPS Program' }] }), {
          status: 200,
        })
      }
      if (url.endsWith('/v1/surveys')) {
        return new Response(JSON.stringify({ survey: { id: 'srv_xyz' } }), { status: 201 })
      }
      return new Response('not found', { status: 404 })
    })
    const Page = await loadPage()
    await expect(Page()).rejects.toThrow(/REDIRECT:\/admin\/surveys\/srv_xyz\/edit\?tab=basics/)

    const post = captured.find((r) => r.method === 'POST' && r.url.endsWith('/v1/surveys'))
    expect(post).toBeDefined()
    const body = post!.body as { name: string; programId: string; type: string; questions: unknown[] }
    expect(body.name).toBe('')
    expect(body.programId).toBe('prg_abc')
    expect(body.type).toBe('NPS')
    expect(body.questions).toHaveLength(2)
  })

  it('T7 — question-id stability: two consecutive renders produce different question IDs', async () => {
    const captured = installFetchMock(async ({ url }) => {
      if (url.endsWith('/v1/programs')) {
        return new Response(JSON.stringify({ data: [{ id: 'prg_abc', name: 'NPS' }] }), {
          status: 200,
        })
      }
      if (url.endsWith('/v1/surveys')) {
        return new Response(JSON.stringify({ survey: { id: 'srv_1' } }), { status: 201 })
      }
      return new Response('not found', { status: 404 })
    })

    const Page = await loadPage()
    await expect(Page()).rejects.toThrow(/REDIRECT:/)
    await expect(Page()).rejects.toThrow(/REDIRECT:/)

    const posts = captured.filter((r) => r.method === 'POST' && r.url.endsWith('/v1/surveys'))
    expect(posts).toHaveLength(2)
    const ids1 = (posts[0].body as { questions: { id: string }[] }).questions.map((q) => q.id)
    const ids2 = (posts[1].body as { questions: { id: string }[] }).questions.map((q) => q.id)
    expect(ids1).not.toEqual(ids2)
  })
})

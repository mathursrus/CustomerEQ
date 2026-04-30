/// <reference types="vitest" />
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import type { IdentityProvider } from '../auth/identity-provider.js'

// Mock the activation-step helper so route tests don't need to assert against
// the full transaction shape — the helper has its own dedicated unit tests.
vi.mock('../services/onboarding.js', () => ({
  emitActivationStep: vi.fn(async () => {}),
}))

import authRoutes from './auth.js'
import { emitActivationStep } from '../services/onboarding.js'

const mockedEmit = vi.mocked(emitActivationStep)

interface BuildOptions {
  identityProvider?: Partial<IdentityProvider>
  brandFromCreate?: { id: string }
  // Pre-populate session decoration for /signup/finish (allowNoOrg simulation)
  presetClerkUserId?: string
  // App origin allowlist used by the SEC-170-002 returnTo origin check
  appOrigins?: string[]
}

function buildApp(opts: BuildOptions = {}) {
  const app = Fastify()

  const brandCreate = vi.fn(async () => opts.brandFromCreate ?? { id: 'brand_created' })
  const onboardingStateCreate = vi.fn(async () => ({ id: 'os_created' }))

  const prismaSurface = {
    brand: { create: brandCreate, findFirst: vi.fn(async () => null) },
    onboardingState: { create: onboardingStateCreate },
    onboardingActivationEvent: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async () => ({ id: 'oae_created' })),
    },
    auditEvent: { create: vi.fn(async () => ({ id: 'ae_created' })) },
  }

  // Pass the same prisma surface to the transaction callback so `tx.brand.create`,
  // `tx.onboardingState.create`, etc. resolve through the same mocks.
  const transactionFn = vi.fn(
    async (cb: (tx: typeof prismaSurface) => Promise<unknown>) => cb(prismaSurface),
  )

  // Fake prisma plugin
  app.register(
    fp(
      async (fastify) => {
        fastify.decorate('prisma', {
          $transaction: transactionFn,
          ...prismaSurface,
        } as never)
      },
      { name: 'prisma' },
    ),
  )

  // Fake identity-provider plugin with overridable methods
  const ip: Partial<IdentityProvider> = {
    createUserWithOrg: vi.fn(),
    beginOAuth: vi.fn(),
    listSupportedOAuthProviders: vi.fn(async () => ['google', 'github']),
    createOrgForUser: vi.fn(),
    getUser: vi.fn(),
    getSession: vi.fn(),
    ...opts.identityProvider,
  }
  app.register(
    fp(
      async (fastify) => {
        fastify.decorate('identityProvider', ip as IdentityProvider)
      },
      { name: 'identityProvider' },
    ),
  )

  // Fake auth plugin: skip for public, decorate clerkUserId for allowNoOrg
  app.register(
    fp(
      async (fastify) => {
        fastify.addHook('preHandler', async (request) => {
          const config = request.routeOptions?.config as
            | { public?: boolean; allowNoOrg?: boolean }
            | undefined
          if (config?.public) return
          if (config?.allowNoOrg) {
            // Simulate the post-OAuth-no-org session
            ;(request as unknown as { clerkUserId: string }).clerkUserId =
              opts.presetClerkUserId ?? 'user_oauth_fresh'
            return
          }
        })
      },
      { name: 'auth' },
    ),
  )

  return Object.assign(app, {
    _ip: ip,
    _brandCreate: brandCreate,
    _onboardingStateCreate: onboardingStateCreate,
    _transaction: transactionFn,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/auth/signup', () => {
  let app: FastifyInstance

  afterEach(async () => {
    await app.close()
  })

  const validBody = {
    email: 'admin@acme.test',
    password: 'pw12345678',
    name: 'Ada Lovelace',
    orgName: 'Acme',
    agreedToTos: true,
  }

  it('returns 200 with redirectTo on the happy path', async () => {
    const built = buildApp()
    app = built
    ;(built._ip.createUserWithOrg as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      userId: 'user_new',
      orgId: 'org_new',
    })
    await app.register(authRoutes)
    await app.ready()

    const res = await app.inject({ method: 'POST', url: '/api/auth/signup', payload: validBody })

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ redirectTo: '/admin/onboarding/profile' })
    expect(built._ip.createUserWithOrg).toHaveBeenCalledWith({
      email: validBody.email,
      password: validBody.password,
      name: validBody.name,
      orgName: validBody.orgName,
    })
  })

  it('writes Brand + OnboardingState in a transaction and emits account_created', async () => {
    const built = buildApp()
    app = built
    ;(built._ip.createUserWithOrg as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      userId: 'user_tx',
      orgId: 'org_tx',
    })
    await app.register(authRoutes)
    await app.ready()

    await app.inject({ method: 'POST', url: '/api/auth/signup', payload: validBody })

    expect(built._transaction).toHaveBeenCalledOnce()
    expect(built._brandCreate).toHaveBeenCalledOnce()
    expect(built._brandCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ clerkOrgId: 'org_tx', name: 'Acme' }),
      }),
    )

    expect(built._onboardingStateCreate).toHaveBeenCalledOnce()
    expect(mockedEmit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        brandId: expect.any(String),
        step: 'account_created',
        metadata: expect.objectContaining({ source: 'email_password' }),
      }),
    )
  })

  it('returns 400 on Zod validation failure (missing agreedToTos)', async () => {
    app = buildApp()
    await app.register(authRoutes)
    await app.ready()
    const { agreedToTos: _drop, ...invalidBody } = validBody

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      payload: invalidBody,
    })

    expect(res.statusCode).toBe(400)
  })

  it('returns 409 on Clerk duplicate-email error (D3=(a) error mapping)', async () => {
    const built = buildApp()
    app = built
    const dupErr = Object.assign(new Error('Email already taken'), {
      status: 422,
      clerkError: true,
      errors: [{ code: 'form_identifier_exists' }],
    })
    ;(built._ip.createUserWithOrg as ReturnType<typeof vi.fn>).mockRejectedValueOnce(dupErr)
    await app.register(authRoutes)
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      payload: validBody,
    })

    expect(res.statusCode).toBe(409)
    const body = JSON.parse(res.body)
    expect(body.error).toMatch(/already/i)
  })

  it('returns 429 on Clerk rate-limit', async () => {
    const built = buildApp()
    app = built
    const rateErr = Object.assign(new Error('rate limited'), { status: 429 })
    ;(built._ip.createUserWithOrg as ReturnType<typeof vi.fn>).mockRejectedValueOnce(rateErr)
    await app.register(authRoutes)
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      payload: validBody,
    })

    expect(res.statusCode).toBe(429)
  })

  it('returns 500 on unexpected provider failure (Brand row not created — transaction rolls back)', async () => {
    const built = buildApp()
    app = built
    ;(built._ip.createUserWithOrg as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('totally unexpected'),
    )
    await app.register(authRoutes)
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      payload: validBody,
    })

    expect(res.statusCode).toBe(500)
    expect(built._brandCreate).not.toHaveBeenCalled()
  })
})

describe('GET /api/auth/oauth/:provider/start', () => {
  let app: FastifyInstance

  afterEach(async () => {
    await app.close()
  })

  it('redirects 302 to the provider authorization URL on the happy path', async () => {
    const built = buildApp()
    app = built
    ;(built._ip.beginOAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      authorizationUrl: 'https://accounts.clerk.dev/v1/oauth/authorize?provider=oauth_google',
    })
    await app.register(authRoutes)
    await app.ready()

    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/oauth/google/start?returnTo=%2Fadmin',
    })

    expect(res.statusCode).toBe(302)
    expect(res.headers.location).toMatch(/oauth_google/)
    expect(built._ip.beginOAuth).toHaveBeenCalledWith({
      provider: 'google',
      returnTo: '/admin',
    })
  })

  it('falls back to /admin when returnTo is omitted', async () => {
    const built = buildApp()
    app = built
    ;(built._ip.beginOAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      authorizationUrl: 'https://example/oauth',
    })
    await app.register(authRoutes)
    await app.ready()

    await app.inject({ method: 'GET', url: '/api/auth/oauth/google/start' })

    expect(built._ip.beginOAuth).toHaveBeenCalledWith({
      provider: 'google',
      returnTo: '/admin',
    })
  })

  it('rejects 400 on returnTo that is not /admin or same-origin (SEC-170-002)', async () => {
    app = buildApp()
    await app.register(authRoutes)
    await app.ready()

    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/oauth/google/start?returnTo=https%3A%2F%2Fevil.test%2Fphish',
    })

    expect(res.statusCode).toBe(400)
  })

  it('rejects 400 on relative path that is not under /admin', async () => {
    app = buildApp()
    await app.register(authRoutes)
    await app.ready()

    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/oauth/google/start?returnTo=%2Fetc%2Fpasswd',
    })

    expect(res.statusCode).toBe(400)
  })

  it('rejects 400 on unsupported provider', async () => {
    const built = buildApp()
    app = built
    // listSupportedOAuthProviders defaults to google + github; ask for facebook
    await app.register(authRoutes)
    await app.ready()

    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/oauth/facebook/start?returnTo=%2Fadmin',
    })

    expect(res.statusCode).toBe(400)
    expect(built._ip.beginOAuth).not.toHaveBeenCalled()
  })

  it('rejects 400 on path-param shaped wrong (uppercase / hyphen)', async () => {
    app = buildApp()
    await app.register(authRoutes)
    await app.ready()

    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/oauth/Google/start?returnTo=%2Fadmin',
    })

    expect(res.statusCode).toBe(400)
  })
})

describe('POST /api/auth/signup/finish (allowNoOrg)', () => {
  let app: FastifyInstance

  afterEach(async () => {
    await app.close()
  })

  it('returns 200 with redirectTo on the happy path (creates org + brand for the OAuth user)', async () => {
    const built = buildApp({ presetClerkUserId: 'user_oauth_done' })
    app = built
    ;(built._ip.getUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      email: 'oauth@user.test',
      name: 'OAuth User',
    })
    ;(built._ip.createOrgForUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      orgId: 'org_just_made',
    })
    await app.register(authRoutes)
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/signup/finish',
      payload: { orgName: 'OAuthCo' },
    })

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ redirectTo: '/admin/onboarding/profile' })
    expect(built._ip.getUser).toHaveBeenCalledWith('user_oauth_done')
    expect(built._ip.createOrgForUser).toHaveBeenCalledWith({
      userId: 'user_oauth_done',
      orgName: 'OAuthCo',
    })
  })

  it('writes Brand + OnboardingState in a transaction and emits account_created with oauth source', async () => {
    const built = buildApp({ presetClerkUserId: 'user_oauth_2' })
    app = built
    ;(built._ip.getUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      email: 'a@b.test',
      name: 'A B',
    })
    ;(built._ip.createOrgForUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      orgId: 'org_oauth',
    })
    await app.register(authRoutes)
    await app.ready()

    await app.inject({
      method: 'POST',
      url: '/api/auth/signup/finish',
      payload: { orgName: 'AcmeOAuth' },
    })

    expect(built._transaction).toHaveBeenCalledOnce()
    expect(built._brandCreate).toHaveBeenCalledOnce()
    expect(mockedEmit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        step: 'account_created',
        metadata: expect.objectContaining({ source: expect.stringMatching(/^oauth/) }),
      }),
    )
  })

  it('returns 404 when getUser returns null (Clerk lost the user between OAuth and finish)', async () => {
    const built = buildApp({ presetClerkUserId: 'user_gone' })
    app = built
    ;(built._ip.getUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)
    await app.register(authRoutes)
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/signup/finish',
      payload: { orgName: 'Acme' },
    })

    expect(res.statusCode).toBe(404)
    expect(built._ip.createOrgForUser).not.toHaveBeenCalled()
  })

  it('returns 400 on missing orgName', async () => {
    app = buildApp({ presetClerkUserId: 'user_x' })
    await app.register(authRoutes)
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/signup/finish',
      payload: {},
    })

    expect(res.statusCode).toBe(400)
  })

  it('returns 500 if createOrgForUser fails (transaction rolled back; user keeps no brand)', async () => {
    const built = buildApp({ presetClerkUserId: 'user_orgfail' })
    app = built
    ;(built._ip.getUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      email: 'a@b.test',
      name: 'A B',
    })
    ;(built._ip.createOrgForUser as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('clerk org create failed'),
    )
    await app.register(authRoutes)
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/signup/finish',
      payload: { orgName: 'Acme' },
    })

    expect(res.statusCode).toBe(500)
    expect(built._brandCreate).not.toHaveBeenCalled()
  })
})

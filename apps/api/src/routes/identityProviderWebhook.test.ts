/// <reference types="vitest" />
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import type { IdentityProvider, NormalizedProviderEvent } from '../auth/identity-provider.js'

vi.mock('../services/onboarding.js', () => ({
  emitActivationStep: vi.fn(async () => {}),
}))

import identityProviderWebhookRoutes from './identityProviderWebhook.js'
import { emitActivationStep } from '../services/onboarding.js'

const mockedEmit = vi.mocked(emitActivationStep)

interface BuildOptions {
  parseWebhookResult?: NormalizedProviderEvent | null
  parseWebhookError?: Error
}

function buildApp(opts: BuildOptions = {}) {
  const app = Fastify()

  const brandUpsert = vi.fn(async () => ({ id: 'brand_upserted', isCreated: false }))
  const brandFindUnique = vi.fn(async () => null as { id: string; deletedAt: Date | null } | null)
  const brandUpdate = vi.fn(async () => ({ id: 'brand_updated' }))
  const onboardingStateCreate = vi.fn(async () => ({ id: 'os_new' }))

  const prismaSurface = {
    brand: { upsert: brandUpsert, findUnique: brandFindUnique, update: brandUpdate },
    onboardingState: {
      create: onboardingStateCreate,
      findUnique: vi.fn(async () => null),
    },
    onboardingActivationEvent: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async () => ({ id: 'oae_new' })),
    },
    auditEvent: { create: vi.fn(async () => ({ id: 'ae_new' })) },
  }

  const transactionFn = vi.fn(
    async (cb: (tx: typeof prismaSurface) => Promise<unknown>) => cb(prismaSurface),
  )

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

  const parseWebhook = vi.fn(async () => {
    if (opts.parseWebhookError) throw opts.parseWebhookError
    return opts.parseWebhookResult ?? null
  }) as unknown as IdentityProvider['parseWebhook']

  app.register(
    fp(
      async (fastify) => {
        fastify.decorate('identityProvider', { parseWebhook } as IdentityProvider)
      },
      { name: 'identityProvider' },
    ),
  )

  // Public route shim — the webhook route is `config: { public: true }` so the
  // real auth plugin would skip it; the test app doesn't register auth at all.

  return Object.assign(app, {
    _parseWebhook: parseWebhook as unknown as ReturnType<typeof vi.fn>,
    _brandUpsert: brandUpsert,
    _brandFindUnique: brandFindUnique,
    _brandUpdate: brandUpdate,
    _onboardingStateCreate: onboardingStateCreate,
    _onboardingStateFindUnique: prismaSurface.onboardingState.findUnique,
    _transaction: transactionFn,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/webhooks/identity-provider', () => {
  let app: FastifyInstance

  afterEach(async () => {
    await app.close()
  })

  // -------------------------------------------------------------------------
  // Signature verification (delegated to parseWebhook)
  // -------------------------------------------------------------------------

  it('returns 401 when parseWebhook throws (invalid signature)', async () => {
    const built = buildApp({ parseWebhookError: new Error('Invalid signature') })
    app = built
    await app.register(identityProviderWebhookRoutes)
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/identity-provider',
      headers: {
        'svix-id': 'msg_bad',
        'svix-timestamp': '1700000000',
        'svix-signature': 'v1,bogus',
        'content-type': 'application/json',
      },
      payload: '{"type":"organization.created","data":{"id":"org_x","name":"X"}}',
    })

    expect(res.statusCode).toBe(401)
    expect(built._brandUpsert).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // organization.created — idempotent upsert + first activation event
  // -------------------------------------------------------------------------

  it('upserts Brand on organization.created', async () => {
    const built = buildApp({
      parseWebhookResult: {
        type: 'organization.created',
        orgId: 'org_wh',
        orgName: 'Wh Org',
        createdByUserId: 'user_wh',
      },
    })
    app = built
    await app.register(identityProviderWebhookRoutes)
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/identity-provider',
      headers: {
        'svix-id': 'msg_1',
        'svix-timestamp': '1700000000',
        'svix-signature': 'v1,abc',
        'content-type': 'application/json',
      },
      payload: '{}',
    })

    expect(res.statusCode).toBe(200)
    expect(built._brandUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clerkOrgId: 'org_wh' },
        create: expect.objectContaining({ clerkOrgId: 'org_wh', name: 'Wh Org' }),
      }),
    )
  })

  it('emits account_created activation event when Brand is freshly created via webhook', async () => {
    const built = buildApp({
      parseWebhookResult: {
        type: 'organization.created',
        orgId: 'org_fresh_wh',
        orgName: 'Fresh',
        createdByUserId: 'user_creator',
      },
    })
    app = built
    built._brandUpsert.mockResolvedValueOnce({ id: 'brand_fresh', isCreated: true })
    await app.register(identityProviderWebhookRoutes)
    await app.ready()

    await app.inject({
      method: 'POST',
      url: '/api/webhooks/identity-provider',
      headers: {
        'svix-id': 'm',
        'svix-timestamp': 't',
        'svix-signature': 's',
        'content-type': 'application/json',
      },
      payload: '{}',
    })

    expect(mockedEmit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        brandId: 'brand_fresh',
        step: 'account_created',
        metadata: expect.objectContaining({ source: 'webhook' }),
      }),
    )
  })

  it('does NOT emit account_created when Brand already existed (sync signup raced webhook)', async () => {
    const built = buildApp({
      parseWebhookResult: {
        type: 'organization.created',
        orgId: 'org_existing',
        orgName: 'Already',
        createdByUserId: 'user_x',
      },
    })
    app = built
    built._brandUpsert.mockResolvedValueOnce({ id: 'brand_existing', isCreated: false })
    // Brand already has an OnboardingState row → sync signup ran first.
    // Webhook handler detects this and skips the activation event emission.
    ;(built._onboardingStateFindUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 'os_existing',
    })
    await app.register(identityProviderWebhookRoutes)
    await app.ready()

    await app.inject({
      method: 'POST',
      url: '/api/webhooks/identity-provider',
      headers: {
        'svix-id': 'm',
        'svix-timestamp': 't',
        'svix-signature': 's',
        'content-type': 'application/json',
      },
      payload: '{}',
    })

    expect(mockedEmit).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // organization.updated — DB is source of truth; no name sync from provider
  // -------------------------------------------------------------------------

  it('does NOT sync Brand.name on organization.updated (DB is source of truth per RFC)', async () => {
    const built = buildApp({
      parseWebhookResult: {
        type: 'organization.updated',
        orgId: 'org_renamed',
        orgName: 'Renamed In Clerk',
      },
    })
    app = built
    await app.register(identityProviderWebhookRoutes)
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/identity-provider',
      headers: {
        'svix-id': 'm',
        'svix-timestamp': 't',
        'svix-signature': 's',
        'content-type': 'application/json',
      },
      payload: '{}',
    })

    expect(res.statusCode).toBe(200)
    expect(built._brandUpdate).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // organization.deleted — soft-delete the Brand
  // -------------------------------------------------------------------------

  it('returns 200 on organization.deleted and logs the event (soft-delete deferred to PR 6)', async () => {
    // PR 2 carry-forward: `Brand.deletedAt` field doesn't exist on the schema
    // yet (would be a PR 6 GDPR-cascade addition per R21). PR 2 only logs
    // the deletion intent. Asserting we DO NOT call brandUpdate is the
    // primary contract.
    const built = buildApp({
      parseWebhookResult: { type: 'organization.deleted', orgId: 'org_gone' },
    })
    app = built
    built._brandFindUnique.mockResolvedValueOnce({ id: 'brand_gone', deletedAt: null })
    await app.register(identityProviderWebhookRoutes)
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/identity-provider',
      headers: {
        'svix-id': 'm',
        'svix-timestamp': 't',
        'svix-signature': 's',
        'content-type': 'application/json',
      },
      payload: '{}',
    })

    expect(res.statusCode).toBe(200)
    // PR 2 does NOT call brandUpdate — soft-delete is deferred to PR 6.
    expect(built._brandUpdate).not.toHaveBeenCalled()
  })

  it('returns 200 on organization.deleted even when Brand row does not exist (already gone)', async () => {
    const built = buildApp({
      parseWebhookResult: { type: 'organization.deleted', orgId: 'org_unknown' },
    })
    app = built
    built._brandFindUnique.mockResolvedValueOnce(null)
    await app.register(identityProviderWebhookRoutes)
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/identity-provider',
      headers: {
        'svix-id': 'm',
        'svix-timestamp': 't',
        'svix-signature': 's',
        'content-type': 'application/json',
      },
      payload: '{}',
    })

    expect(res.statusCode).toBe(200)
    expect(built._brandUpdate).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // user.created / user.deleted — spine no-ops; spec leaves these to #189 / GDPR
  // -------------------------------------------------------------------------

  it('returns 200 no-op on user.created (PR 1 spine does not act on this; #189 will)', async () => {
    const built = buildApp({
      parseWebhookResult: {
        type: 'user.created',
        userId: 'user_wh_new',
        email: 'new@user.test',
      },
    })
    app = built
    await app.register(identityProviderWebhookRoutes)
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/identity-provider',
      headers: {
        'svix-id': 'm',
        'svix-timestamp': 't',
        'svix-signature': 's',
        'content-type': 'application/json',
      },
      payload: '{}',
    })

    expect(res.statusCode).toBe(200)
    expect(built._brandUpsert).not.toHaveBeenCalled()
    expect(built._brandUpdate).not.toHaveBeenCalled()
  })

  it('returns 200 on user.deleted (spine logs only; GDPR cascade in PR 6)', async () => {
    const built = buildApp({
      parseWebhookResult: {
        type: 'user.deleted',
        userId: 'user_wh_dead',
      },
    })
    app = built
    await app.register(identityProviderWebhookRoutes)
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/identity-provider',
      headers: {
        'svix-id': 'm',
        'svix-timestamp': 't',
        'svix-signature': 's',
        'content-type': 'application/json',
      },
      payload: '{}',
    })

    expect(res.statusCode).toBe(200)
    expect(built._brandUpdate).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // Unhandled event type — parseWebhook returns null
  // -------------------------------------------------------------------------

  it('returns 200 no-op when parseWebhook returns null (unrecognized event type)', async () => {
    const built = buildApp({ parseWebhookResult: null })
    app = built
    await app.register(identityProviderWebhookRoutes)
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/identity-provider',
      headers: {
        'svix-id': 'm',
        'svix-timestamp': 't',
        'svix-signature': 's',
        'content-type': 'application/json',
      },
      payload: '{}',
    })

    expect(res.statusCode).toBe(200)
    expect(built._brandUpsert).not.toHaveBeenCalled()
    expect(built._brandUpdate).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // SEC-170-001 carry-over: rawBody is what gets passed to parseWebhook
  // -------------------------------------------------------------------------

  it('passes the raw request body string (not parsed JSON) to parseWebhook (SEC-170-001)', async () => {
    const built = buildApp({
      parseWebhookResult: {
        type: 'organization.created',
        orgId: 'org_raw',
        orgName: 'Raw',
        createdByUserId: 'u',
      },
    })
    app = built
    await app.register(identityProviderWebhookRoutes)
    await app.ready()

    // A payload with non-canonical key ordering — proves rawBody is preserved
    // verbatim rather than re-serialized. If the route stringified parsed
    // JSON, key order would be normalized and svix.verify (in real runtime)
    // would fail.
    const exactBytes = '{"data":{"name":"Raw","id":"org_raw","created_by":"u"},"type":"organization.created"}'
    await app.inject({
      method: 'POST',
      url: '/api/webhooks/identity-provider',
      headers: {
        'svix-id': 'm',
        'svix-timestamp': 't',
        'svix-signature': 's',
        'content-type': 'application/json',
      },
      payload: exactBytes,
    })

    expect(built._parseWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        rawBody: exactBytes,
      }),
    )
  })
})

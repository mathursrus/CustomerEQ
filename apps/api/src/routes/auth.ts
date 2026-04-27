// Issue #170 PR 2 — Auth API routes.
//
// Three handlers, all under `/api/auth/*`:
//   POST /api/auth/signup            — public; create user + org via Clerk;
//                                      provision Brand + OnboardingState +
//                                      account_created event in one tx
//   GET  /api/auth/oauth/:provider/start
//                                    — public; validate returnTo; redirect 302
//                                      to provider's hosted-OAuth URL
//   POST /api/auth/signup/finish     — allowNoOrg session; OAuth new-user-
//                                      without-org convergence point;
//                                      provision Brand + OnboardingState +
//                                      account_created event in one tx
//
// Error mapping for Clerk failures from createUserWithOrg (PR 2 D3=(a)):
//   - Clerk 422 with code "form_identifier_exists" → HTTP 409
//   - Clerk 429                                    → HTTP 429
//   - Anything else                                → HTTP 500 (transaction
//                                                    rolls back; user-facing
//                                                    banner per RFC §10)

import type { FastifyPluginAsync } from 'fastify'
import {
  signupRequestSchema,
  oauthFinishRequestSchema,
  oauthStartQuerySchema,
  oauthProviderParamSchema,
} from '@customerEQ/shared'
import { emitActivationStep } from '../services/onboarding.js'

interface ClerkErrorShape {
  status?: number
  clerkError?: boolean
  errors?: Array<{ code?: string; message?: string }>
  message?: string
}

const baseChecklist = {
  brandCreated: true,
  dataSourceConnected: false,
  firstEventReceived: false,
  firstSurveyLive: false,
  firstActionTriggered: false,
  programCreated: false,
}

const authRoutes: FastifyPluginAsync = async (fastify) => {
  // ---------------------------------------------------------------------------
  // POST /api/auth/signup
  // ---------------------------------------------------------------------------
  fastify.post(
    '/api/auth/signup',
    { config: { public: true } },
    async (request, reply) => {
      const parse = signupRequestSchema.safeParse(request.body)
      if (!parse.success) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: parse.error.errors.map((e) => ({ path: e.path, message: e.message })),
        })
      }
      const data = parse.data

      let userId: string
      let orgId: string
      try {
        const created = await fastify.identityProvider.createUserWithOrg({
          email: data.email,
          password: data.password,
          name: data.name,
          orgName: data.orgName,
        })
        userId = created.userId
        orgId = created.orgId
      } catch (err) {
        const e = err as ClerkErrorShape
        if (
          e.status === 422 &&
          e.errors?.some((it) => it.code === 'form_identifier_exists')
        ) {
          return reply
            .status(409)
            .send({ error: 'Email is already registered. Try signing in instead.' })
        }
        if (e.status === 429) {
          return reply
            .status(429)
            .send({ error: 'Too many requests. Please try again in a moment.' })
        }
        fastify.log.error({ err }, 'createUserWithOrg failed on /api/auth/signup')
        return reply
          .status(500)
          .send({ error: "We can't create your account right now. Please try again." })
      }

      // Provision Brand + OnboardingState + first activation event in a
      // single transaction so a partial DB write can't leave a dangling
      // Clerk org without a brand row (the inverse partial-failure — Clerk
      // user/org without DB rows — is recoverable via the webhook handler's
      // idempotent upsert per RFC §5).
      const brand = await fastify.prisma.$transaction(async (tx) => {
        const b = await tx.brand.create({
          data: { clerkOrgId: orgId, name: data.orgName },
          select: { id: true },
        })
        await tx.onboardingState.create({
          data: { brandId: b.id, checklist: baseChecklist },
        })
        await emitActivationStep(tx as never, {
          brandId: b.id,
          step: 'account_created',
          metadata: { source: 'email_password' },
          actorId: userId,
        })
        return b
      })

      fastify.log.info(
        { brandId: brand.id, userId, orgId },
        '/api/auth/signup completed',
      )

      return reply.status(200).send({ redirectTo: '/admin/onboarding/profile' })
    },
  )

  // ---------------------------------------------------------------------------
  // GET /api/auth/oauth/:provider/start
  // ---------------------------------------------------------------------------
  fastify.get<{ Params: { provider: string }; Querystring: { returnTo?: string } }>(
    '/api/auth/oauth/:provider/start',
    { config: { public: true } },
    async (request, reply) => {
      const paramParse = oauthProviderParamSchema.safeParse(request.params)
      if (!paramParse.success) {
        return reply.status(400).send({ error: 'Invalid provider identifier' })
      }
      const queryParse = oauthStartQuerySchema.safeParse(request.query)
      if (!queryParse.success) {
        return reply
          .status(400)
          .send({ error: 'Invalid returnTo: must be /admin path or fully-qualified http(s) URL' })
      }
      const provider = paramParse.data.provider
      const returnTo = queryParse.data.returnTo ?? '/admin'

      // SEC-170-002 host-allowlist check for fully-qualified returnTo URLs.
      // The schema validates the URL is well-formed and uses http(s); the
      // route handler enforces the origin allowlist (set via APP_ORIGINS env,
      // comma-separated). Default-deny: if APP_ORIGINS is empty/unset, any
      // fully-qualified returnTo is rejected — relative /admin paths still
      // pass (safe by construction — the browser resolves against current
      // origin). This forces an explicit allowlist before bouncing through
      // arbitrary host origins.
      if (returnTo.startsWith('http')) {
        const allowedOrigins = (process.env.APP_ORIGINS ?? '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
        if (allowedOrigins.length === 0) {
          return reply.status(400).send({
            error:
              'returnTo must be a relative /admin path; APP_ORIGINS allowlist is not configured',
          })
        }
        try {
          const url = new URL(returnTo)
          const origin = `${url.protocol}//${url.host}`
          if (!allowedOrigins.includes(origin)) {
            return reply
              .status(400)
              .send({ error: 'returnTo origin is not in the allowlist' })
          }
        } catch {
          return reply.status(400).send({ error: 'Invalid returnTo URL' })
        }
      }

      const supported = await fastify.identityProvider.listSupportedOAuthProviders()
      if (!supported.includes(provider)) {
        return reply
          .status(400)
          .send({
            error: `Unsupported provider "${provider}". Supported: ${supported.join(', ')}`,
          })
      }

      const { authorizationUrl } = await fastify.identityProvider.beginOAuth({
        provider,
        returnTo,
      })

      return reply.redirect(authorizationUrl, 302)
    },
  )

  // ---------------------------------------------------------------------------
  // POST /api/auth/signup/finish (OAuth new-user-without-org convergence)
  // ---------------------------------------------------------------------------
  fastify.post(
    '/api/auth/signup/finish',
    { config: { allowNoOrg: true } as never },
    async (request, reply) => {
      const userId = request.clerkUserId
      if (!userId) {
        // Auth plugin should have decorated this — defensive guard.
        return reply.status(401).send({ error: 'Not authenticated' })
      }

      const parse = oauthFinishRequestSchema.safeParse(request.body)
      if (!parse.success) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: parse.error.errors.map((e) => ({ path: e.path, message: e.message })),
        })
      }
      const { orgName } = parse.data

      // Confirm the user exists in Clerk before creating an org for them —
      // protects against a race where the user is deleted between OAuth
      // redirect-back and this finish call.
      const profile = await fastify.identityProvider.getUser(userId)
      if (!profile) {
        return reply.status(404).send({ error: 'User not found in identity provider' })
      }

      let orgId: string
      try {
        const result = await fastify.identityProvider.createOrgForUser({ userId, orgName })
        orgId = result.orgId
      } catch (err) {
        fastify.log.error(
          { err, userId },
          'createOrgForUser failed on /api/auth/signup/finish',
        )
        return reply
          .status(500)
          .send({ error: "We can't finish creating your organization right now. Please try again." })
      }

      const brand = await fastify.prisma.$transaction(async (tx) => {
        const b = await tx.brand.create({
          data: { clerkOrgId: orgId, name: orgName },
          select: { id: true },
        })
        await tx.onboardingState.create({
          data: { brandId: b.id, checklist: baseChecklist },
        })
        await emitActivationStep(tx as never, {
          brandId: b.id,
          step: 'account_created',
          metadata: { source: 'oauth' },
          actorId: userId,
        })
        return b
      })

      fastify.log.info(
        { brandId: brand.id, userId, orgId },
        '/api/auth/signup/finish completed',
      )

      return reply.status(200).send({ redirectTo: '/admin/onboarding/profile' })
    },
  )
}

export default authRoutes

// Issue #170 PR 2 — Clerk webhook handler.
//
// POST /api/webhooks/identity-provider
//
// SECURITY (SEC-170-001 carry-over from PR 1):
//   The route registers a per-route raw-body content-type parser (D2=(a)) so
//   `request.body` is the unmodified bytes received over the wire. We pass
//   that string directly to `IdentityProvider.parseWebhook({ headers, rawBody })`
//   — re-stringified parsed JSON would not match the bytes Clerk signed,
//   and svix.verify would reject legitimate webhooks.
//
// Acted-on event types (RFC §5):
//   organization.created  → idempotent upsert Brand + first activation event
//                            (only when freshly created via webhook, not when
//                            sync signup raced ahead)
//   organization.updated  → log only; DB is source of truth (per RFC)
//   organization.deleted  → soft-delete Brand (idempotent)
//   user.created          → no-op (#189 will consume this)
//   user.deleted          → no-op (PR 6 GDPR cascade owns the deletion)

import type { FastifyPluginAsync } from 'fastify'
import { emitActivationStep } from '../services/onboarding.js'

const baseChecklist = {
  brandCreated: true,
  dataSourceConnected: false,
  firstEventReceived: false,
  firstSurveyLive: false,
  firstActionTriggered: false,
  programCreated: false,
}

const identityProviderWebhookRoutes: FastifyPluginAsync = async (fastify) => {
  // SEC-170-001 / PR 2 D2=(a): raw-body content-type parser scoped to this
  // plugin's encapsulation context. Fastify 5 requires explicitly removing the
  // parent-scope parser before overriding it — addContentTypeParser alone throws
  // FST_ERR_CTP_ALREADY_PRESENT even inside an encapsulated register() scope.
  // Routes outside this plugin keep the global JSON parser from app.ts.
  fastify.removeContentTypeParser('application/json')
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (_req, body, done) => {
      // Hand back the raw string verbatim. The route handler passes it to
      // `IdentityProvider.parseWebhook({ headers, rawBody })` so svix verifies
      // the exact bytes Clerk signed.
      done(null, body as string)
    },
  )

  fastify.post(
    '/api/webhooks/identity-provider',
    { config: { public: true } },
    async (request, reply) => {
      const rawBody = (request.body ?? '') as string

      let event
      try {
        event = await fastify.identityProvider.parseWebhook({
          headers: request.headers as Record<string, string | string[] | undefined>,
          rawBody,
        })
      } catch (err) {
        fastify.log.warn(
          { err, svixId: request.headers['svix-id'] },
          'webhook signature verification failed',
        )
        return reply.status(401).send({ error: 'Invalid webhook signature' })
      }

      if (!event) {
        // Unrecognized event type — accepted but no-op so the provider
        // doesn't retry indefinitely.
        return reply.status(200).send({ message: 'no-op' })
      }

      switch (event.type) {
        case 'organization.created': {
          // Idempotent upsert keyed on clerkOrgId. The transaction return
          // value indicates whether the row was freshly created; if so,
          // create OnboardingState + emit account_created. If not (sync
          // signup raced ahead), do nothing.
          const result = await fastify.prisma.$transaction(async (tx) => {
            // Prisma upsert doesn't natively report created vs updated;
            // we approximate with a findUnique + create-or-no-op pattern.
            const upserted = await tx.brand.upsert({
              where: { clerkOrgId: event.orgId },
              create: { clerkOrgId: event.orgId, name: event.orgName },
              update: {}, // never overwrite existing name from webhook
            })
            const existingState = await tx.onboardingState.findUnique({
              where: { brandId: upserted.id },
              select: { id: true },
            })
            const isCreated = !existingState
            if (isCreated) {
              await tx.onboardingState.create({
                data: { brandId: upserted.id, checklist: baseChecklist },
              })
              await emitActivationStep(tx as never, {
                brandId: upserted.id,
                step: 'account_created',
                metadata: { source: 'webhook' },
                actorId: event.createdByUserId,
              })
            }
            return { id: upserted.id, isCreated }
          })

          fastify.log.info(
            { brandId: result.id, orgId: event.orgId, isCreated: result.isCreated },
            'webhook organization.created processed',
          )
          return reply.status(200).send({ message: 'ok' })
        }

        case 'organization.updated': {
          // RFC: DB is source of truth — do not sync the name from the
          // provider. Log only for forensics.
          fastify.log.info(
            { orgId: event.orgId, providerName: event.orgName },
            'webhook organization.updated — name change ignored (DB is source of truth)',
          )
          return reply.status(200).send({ message: 'ok' })
        }

        case 'organization.deleted': {
          // PR 2 carry-forward: `Brand.deletedAt` is not on the schema yet —
          // adding it would expand PR 2 scope into the data layer (R21
          // branch-scope hygiene). The full GDPR cascade (`deletedAt` field
          // + cascade-deleting OnboardingState + OnboardingActivationEvent
          // + the erasure work item) lands in PR 6. PR 2 logs the event so
          // the audit trail captures the provider-side deletion intent.
          const brand = await fastify.prisma.brand.findUnique({
            where: { clerkOrgId: event.orgId },
            select: { id: true },
          })
          fastify.log.info(
            { brandId: brand?.id, orgId: event.orgId, deferred: 'PR 6 GDPR cascade' },
            'webhook organization.deleted — soft-delete deferred to PR 6',
          )
          return reply.status(200).send({ message: 'ok' })
        }

        case 'user.created':
          // Spine no-op; #189 consumes this for invited-admin acceptance.
          return reply.status(200).send({ message: 'no-op (user.created — #189)' })

        case 'user.deleted':
          // Spine no-op; PR 6 GDPR cascade will trigger erasure for owned brands.
          fastify.log.info(
            { userId: event.userId },
            'webhook user.deleted — erasure deferred to GDPR cascade (PR 6)',
          )
          return reply.status(200).send({ message: 'no-op (user.deleted — PR 6)' })

        default: {
          // Exhaustiveness check at compile time.
          const _exhaustive: never = event
          void _exhaustive
          return reply.status(200).send({ message: 'no-op' })
        }
      }
    },
  )
}

export default identityProviderWebhookRoutes

// Onboarding service helpers (Issue #170 PR 2 initial slice).
//
// `emitActivationStep` is the single ingress to OnboardingActivationEvent.
// PR 4 will extend this with cross-app emission (worker re-export via
// `packages/shared/src/onboarding/emit-activation-step.ts`) and the metadata
// allowlist enforcement called out in SEC-170-003. PR 2's slice covers the
// happy-path, idempotency, audit pairing, and dwellMs computation.

import type { PrismaClient, Prisma } from '@prisma/client'

type OnboardingStep =
  | 'account_created'
  | 'org_profile_completed'
  | 'path_chosen'
  | 'data_source_connected'
  | 'first_event_received'
  | 'first_survey_published'
  | 'program_created'
  | 'first_action_triggered'
  | 'activated'

interface EmitArgs {
  brandId: string
  step: OnboardingStep
  metadata?: Record<string, unknown>
  // The actor responsible for this transition. For webhook + signup events
  // we use 'system'; for admin-initiated transitions the route handler
  // passes the clerk userId.
  actorId?: string
}

// Acceptable metadata key allowlist for the audit event's resource-level
// metadata. Bounded keys prevent PII leaks (SEC-170-003 hardening lands in
// PR 4 inside the shared helper; PR 2's surface is small enough that we
// pass metadata through without filtering — and the only callsites in PR 2
// emit known shapes ({ source: 'email_password' }, { source: 'webhook' },
// { source: 'oauth' }).).

/**
 * Emit a single OnboardingActivationEvent for a brand, paired with an
 * AuditEvent for SOC2 forensics. Idempotent on (brandId, step) — the second
 * call is a silent no-op so cross-app emitters (worker → API) are safe under
 * retries.
 *
 * Both writes happen inside a single Prisma transaction; if either fails,
 * neither commits.
 */
export async function emitActivationStep(
  prisma: Pick<PrismaClient, '$transaction' | 'onboardingActivationEvent' | 'auditEvent'>,
  args: EmitArgs,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const txClient = tx as Pick<
      PrismaClient,
      'onboardingActivationEvent' | 'auditEvent'
    >

    // Idempotency: if an event for this (brandId, step) already exists, no-op.
    const existing = await txClient.onboardingActivationEvent.findFirst({
      where: { brandId: args.brandId, step: args.step },
      select: { id: true },
      orderBy: { occurredAt: 'desc' },
    })
    if (existing) return

    // Find the most-recent prior event for this brand to compute dwellMs.
    // (We could combine this with the existence check above, but the
    // existence check is cheaper to fail-fast and the prior-event lookup
    // is broader.)
    const prior = await txClient.onboardingActivationEvent.findFirst({
      where: { brandId: args.brandId },
      select: { step: true, occurredAt: true },
      orderBy: { occurredAt: 'desc' },
    })

    const now = new Date()
    const dwellMs = prior ? now.getTime() - new Date(prior.occurredAt).getTime() : null

    await txClient.onboardingActivationEvent.create({
      data: {
        brandId: args.brandId,
        step: args.step as Prisma.OnboardingActivationEventCreateInput['step'],
        previousStep: (prior?.step ?? null) as Prisma.OnboardingActivationEventCreateInput['previousStep'],
        occurredAt: now,
        dwellMs,
        metadata: (args.metadata ?? {}) as Prisma.JsonObject,
      },
    })

    await txClient.auditEvent.create({
      data: {
        brandId: args.brandId,
        actorId: args.actorId ?? 'system',
        action: `onboarding.${args.step}`,
        resourceType: 'OnboardingActivationEvent',
        resourceId: args.brandId,
        metadata: (args.metadata ?? {}) as Prisma.JsonObject,
      },
    })
  })
}

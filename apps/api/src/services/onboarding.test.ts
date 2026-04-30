/// <reference types="vitest" />
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Lightweight Prisma mock — only the surfaces emitActivationStep touches.
const prismaMock = {
  $transaction: vi.fn(),
  onboardingActivationEvent: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  auditEvent: {
    create: vi.fn(),
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  // Default: $transaction passes through, awaiting the async callback with the
  // same prisma client (matches Prisma's actual behavior — transactions reuse
  // the client surface).
  prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) => {
    return await fn(prismaMock)
  })
})

import { emitActivationStep } from './onboarding.js'

describe('emitActivationStep', () => {
  it('inserts a row with previousStep + dwellMs computed from the prior event', async () => {
    const earlier = new Date('2026-04-27T10:00:00Z')
    // Helper makes two findFirst calls: idempotency check (returns null since
    // the new step hasn't been emitted yet) then prior-event lookup.
    prismaMock.onboardingActivationEvent.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        step: 'account_created',
        occurredAt: earlier,
      })
    prismaMock.onboardingActivationEvent.create.mockResolvedValueOnce({ id: 'oae_1' })
    prismaMock.auditEvent.create.mockResolvedValueOnce({ id: 'ae_1' })

    const before = Date.now()
    await emitActivationStep(
      prismaMock as never,
      {
        brandId: 'brand_acme',
        step: 'org_profile_completed',
        metadata: { source: 'step_15_form' },
      },
    )
    const after = Date.now()

    expect(prismaMock.onboardingActivationEvent.create).toHaveBeenCalledOnce()
    const args = prismaMock.onboardingActivationEvent.create.mock.calls[0][0]
    expect(args.data.brandId).toBe('brand_acme')
    expect(args.data.step).toBe('org_profile_completed')
    expect(args.data.previousStep).toBe('account_created')
    expect(args.data.metadata).toEqual({ source: 'step_15_form' })
    // dwellMs is roughly (now - earlier); allow a window for clock drift
    expect(args.data.dwellMs).toBeGreaterThanOrEqual(before - earlier.getTime())
    expect(args.data.dwellMs).toBeLessThanOrEqual(after - earlier.getTime())
  })

  it('inserts the first event with previousStep null and dwellMs null', async () => {
    // Both findFirst calls return null (no prior event of any kind).
    prismaMock.onboardingActivationEvent.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
    prismaMock.onboardingActivationEvent.create.mockResolvedValueOnce({ id: 'oae_first' })
    prismaMock.auditEvent.create.mockResolvedValueOnce({ id: 'ae_first' })

    await emitActivationStep(
      prismaMock as never,
      { brandId: 'brand_new', step: 'account_created' },
    )

    const args = prismaMock.onboardingActivationEvent.create.mock.calls[0][0]
    expect(args.data.previousStep).toBeNull()
    expect(args.data.dwellMs).toBeNull()
  })

  it('also writes a paired AuditEvent with action "onboarding.<step>"', async () => {
    prismaMock.onboardingActivationEvent.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
    prismaMock.onboardingActivationEvent.create.mockResolvedValueOnce({ id: 'oae_2' })
    prismaMock.auditEvent.create.mockResolvedValueOnce({ id: 'ae_2' })

    await emitActivationStep(
      prismaMock as never,
      { brandId: 'brand_audit', step: 'path_chosen', metadata: { picked_path: 'api' } },
    )

    expect(prismaMock.auditEvent.create).toHaveBeenCalledOnce()
    const args = prismaMock.auditEvent.create.mock.calls[0][0]
    expect(args.data.action).toBe('onboarding.path_chosen')
    expect(args.data.brandId).toBe('brand_audit')
  })

  it('is idempotent on duplicate (brandId, step) — no-op on second call', async () => {
    // 1st call: idempotency check null (proceeds), prior null (no dwell), insert + audit
    // 2nd call: idempotency check finds existing row (returns no-op); no further DB writes
    prismaMock.onboardingActivationEvent.findFirst
      .mockResolvedValueOnce(null) // 1st invocation, idempotency check
      .mockResolvedValueOnce(null) // 1st invocation, prior-event lookup
      .mockResolvedValueOnce({ id: 'oae_first', step: 'account_created', occurredAt: new Date() }) // 2nd invocation, idempotency check → already exists
    prismaMock.onboardingActivationEvent.create.mockResolvedValueOnce({ id: 'oae_first' })
    prismaMock.auditEvent.create.mockResolvedValue({ id: 'ae' })

    // Second call would try to insert account_created again. The helper must
    // detect the existing row and skip both the activation event AND the audit
    // event write.
    await emitActivationStep(
      prismaMock as never,
      { brandId: 'brand_idem', step: 'account_created' },
    )
    await emitActivationStep(
      prismaMock as never,
      { brandId: 'brand_idem', step: 'account_created' },
    )

    // Insert called once (first), not twice
    expect(prismaMock.onboardingActivationEvent.create).toHaveBeenCalledTimes(1)
    // Audit also only once
    expect(prismaMock.auditEvent.create).toHaveBeenCalledTimes(1)
  })

  it('runs both writes inside a single $transaction', async () => {
    prismaMock.onboardingActivationEvent.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
    prismaMock.onboardingActivationEvent.create.mockResolvedValueOnce({ id: 'oae_tx' })
    prismaMock.auditEvent.create.mockResolvedValueOnce({ id: 'ae_tx' })

    await emitActivationStep(
      prismaMock as never,
      { brandId: 'brand_tx', step: 'account_created' },
    )

    expect(prismaMock.$transaction).toHaveBeenCalledOnce()
  })

  it('defaults metadata to {} when caller omits it', async () => {
    prismaMock.onboardingActivationEvent.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
    prismaMock.onboardingActivationEvent.create.mockResolvedValueOnce({ id: 'oae_meta' })
    prismaMock.auditEvent.create.mockResolvedValueOnce({ id: 'ae_meta' })

    await emitActivationStep(
      prismaMock as never,
      { brandId: 'brand_default_meta', step: 'account_created' },
    )

    const args = prismaMock.onboardingActivationEvent.create.mock.calls[0][0]
    expect(args.data.metadata).toEqual({})
  })
})

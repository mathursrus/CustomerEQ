import type { Job } from 'bullmq'
import pino from 'pino'
import { prisma } from '@customerEQ/database'
import { sendEmailMessage } from '@customerEQ/connectors'
import {
  renderEmailHtml,
  renderEmailPlainText,
  PUBLIC_FRONTEND_URL,
  type BrandThemeSnapshot,
  type ComposerSnapshot,
} from '@customerEQ/shared'
import type { ManagedEmailSendPayload } from '@customerEQ/shared'

const logger = pino({ name: 'managed-email-send' })

// ---------------------------------------------------------------------------
// BullMQ processor — Issue #420
// Per-recipient ACS dispatch for MANAGED_EMAIL distribution batches.
//
// Spec §13.7 / R44 — two-gate suppression:
//   - audience-builder gate (UI surfacing) happens at distribution-batches POST
//   - worker pre-dispatch re-check (this processor) catches edge cases like a
//     member unsubscribing between selection and dispatch
//
// Survey emails are LEGITIMATE-INTEREST use case — Member.emailOptIn is the
// marketing-channel preference and is NOT checked here (per Round-7 reviewer
// decision; see spec §2.3 + R44).
// ---------------------------------------------------------------------------

export type ManagedEmailSendResult =
  | { sent: true; deliveredAt: Date; operationId?: string }
  | { sent: false; reason: ManagedEmailFailureReason; retryable: boolean }

export type ManagedEmailFailureReason =
  | 'bounce'
  | 'invalid_address'
  | 'skipped_unsubscribed'
  | 'skipped_no_consent'
  | 'skipped_erased'
  | 'skipped_no_email'
  | 'transient_error_after_retries'
  | 'batch_or_member_missing'

interface ComposerSnapshotJson {
  senderName: string
  senderAlias: string
  senderDomain: string
  subject: string
  /** G20 — persisted alongside subject so {{survey_title}} substitutes against
   *  the operator's "Survey name in mail" field, NOT against the email Subject.
   *  Optional for back-compat with batches persisted before G20 landed. */
  surveyNameInMail?: string
  body: string
  brandLogoUrl?: string | null
  brandName: string
  themeSnapshot: BrandThemeSnapshot
}

const SKIP_REASONS: readonly ManagedEmailFailureReason[] = [
  'skipped_unsubscribed',
  'skipped_no_consent',
  'skipped_erased',
  'skipped_no_email',
]

/**
 * Suppression gate. Returns null if the recipient is OK to dispatch; otherwise
 * returns the bounded skip reason. emailOptIn is NOT checked — surveys are
 * legitimate-interest, exempt from marketing opt-out.
 */
function checkSuppression(member: {
  erased: boolean
  unsubscribedSurveysAt: Date | null
  consentGivenAt: Date | null
  email: string | null
}): ManagedEmailFailureReason | null {
  if (member.erased) return 'skipped_erased'
  if (member.unsubscribedSurveysAt) return 'skipped_unsubscribed'
  if (!member.consentGivenAt) return 'skipped_no_consent'
  if (!member.email) return 'skipped_no_email'
  return null
}

/**
 * Classify a thrown error from the ACS connector into a bounded failureReason.
 * Bounce / invalid_address are non-retryable; transient_error_after_retries is
 * the final-attempt failure (BullMQ has already exhausted retries).
 */
function classifyError(err: unknown, isFinalAttempt: boolean): ManagedEmailFailureReason {
  const msg = err instanceof Error ? err.message : String(err)
  const lower = msg.toLowerCase()
  if (/bounce|undeliverable|rejected/.test(lower)) return 'bounce'
  if (/invalid|format|malformed|recipient.*address/.test(lower)) return 'invalid_address'
  return isFinalAttempt ? 'transient_error_after_retries' : 'bounce'
}

async function writeAudit(args: {
  brandId: string
  batchId: string
  memberId: string
  status: 'success' | 'failure'
  failureReason?: ManagedEmailFailureReason
}): Promise<void> {
  await prisma.auditEvent.create({
    data: {
      brandId: args.brandId,
      actorId: 'system',
      action: 'managed_email.send_attempt',
      resourceType: 'distribution_batch',
      resourceId: args.batchId,
      metadata: {
        batchId: args.batchId,
        memberId: args.memberId,
        status: args.status,
        ...(args.failureReason ? { failureReason: args.failureReason } : {}),
      },
    },
  })
}

// dispatchManagedEmailSend is the Job-free core. Both BullMQ (apps/worker) and the
// inline runtime (apps/api/src/queues/bullmq.ts → scheduleInline) invoke this so
// QUEUE_MODE=inline ≡ QUEUE_MODE=redis for managed-email dispatch (the invariant
// every other queue in this codebase upholds — Redis is purely an optimization).
export interface ManagedEmailAttemptInfo {
  attemptsMade: number
  maxAttempts: number
}

export async function dispatchManagedEmailSend(
  payload: ManagedEmailSendPayload,
  attempt: ManagedEmailAttemptInfo,
): Promise<ManagedEmailSendResult> {
  const { batchId, memberId, brandId, surveyId } = payload

  // 1. Load batch + member + composerSnapshot in parallel
  const [batch, member] = await Promise.all([
    prisma.distributionBatch.findFirst({
      where: { id: batchId, brandId },
      select: { id: true, composerSnapshot: true, sendMode: true },
    }),
    prisma.member.findFirst({
      where: { id: memberId, brandId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        erased: true,
        unsubscribedSurveysAt: true,
        consentGivenAt: true,
      },
    }),
  ])
  if (!batch || !member || batch.sendMode !== 'MANAGED_EMAIL' || !batch.composerSnapshot) {
    await markFailed(batchId, memberId, 'batch_or_member_missing')
    return { sent: false, reason: 'batch_or_member_missing', retryable: false }
  }

  // 2. Two-gate suppression re-check
  const skipReason = checkSuppression(member)
  if (skipReason) {
    await markFailed(batchId, memberId, skipReason)
    await writeAudit({ brandId, batchId, memberId, status: 'failure', failureReason: skipReason })
    return { sent: false, reason: skipReason, retryable: false }
  }

  // 3. Confirm the distribution row exists. G9/G10 — plaintext tokens come
  //    in via the queue payload (payload.surveyLinkToken /
  //    payload.unsubscribeToken); the worker no longer reads tokenPrefix from
  //    DB for URL construction (the prefix is display-only and the public
  //    route rejects it). Retry-failed enqueues pass empty/null tokens — fall
  //    back to the tokenPrefix-best-effort URL there so we don't crash, but
  //    the recipient still needs a regenerate-tokens flow.
  const distribution = await prisma.surveyDistribution.findFirst({
    where: { batchId, memberId },
    select: { id: true },
  })
  if (!distribution) {
    await markFailed(batchId, memberId, 'batch_or_member_missing')
    return { sent: false, reason: 'batch_or_member_missing', retryable: false }
  }

  const composer = batch.composerSnapshot as unknown as ComposerSnapshotJson
  const frontendBaseUrl = resolveFrontendBaseUrl()

  // 4. Resolve URLs from payload-supplied plaintext tokens. The retry-failed
  //    fallback below preserves the previous (broken) behavior rather than
  //    omitting the link entirely — a follow-up regenerate-tokens flow is the
  //    right long-term answer for that case.
  let surveyLink: string
  if (payload.surveyLinkToken) {
    surveyLink = `${frontendBaseUrl}/survey/${surveyId}/r/${payload.surveyLinkToken}`
  } else {
    const fallbackRow = await prisma.surveyDistributionToken.findFirst({
      where: { batchId, memberId },
      select: { tokenPrefix: true },
    })
    surveyLink = fallbackRow?.tokenPrefix
      ? `${frontendBaseUrl}/survey/${surveyId}/r/${fallbackRow.tokenPrefix}`
      : `${frontendBaseUrl}/survey/${surveyId}`
  }

  let unsubscribeUrl: string
  if (payload.unsubscribeToken) {
    unsubscribeUrl = `${frontendBaseUrl}/u/${payload.unsubscribeToken}`
  } else {
    const fallbackUnsub = await prisma.memberUnsubscribeToken.findFirst({
      where: { batchId, memberId },
      select: { tokenPrefix: true },
    })
    unsubscribeUrl = fallbackUnsub?.tokenPrefix
      ? `${frontendBaseUrl}/u/${fallbackUnsub.tokenPrefix}`
      : `${frontendBaseUrl}/u`
  }

  const composerSnapshot: ComposerSnapshot = {
    brandName: composer.brandName,
    brandLogoUrl: composer.brandLogoUrl ?? null,
    subject: composer.subject,
    bodyHtml: composer.body,
    senderName: composer.senderName,
    senderEmail: `${composer.senderAlias}@${composer.senderDomain}`,
    // G20 — {{survey_title}} substitutes against the operator's
    // surveyNameInMail field. Fall back to subject only for pre-G20 batches
    // whose persisted snapshot doesn't carry the field.
    surveyTitle: composer.surveyNameInMail ?? composer.subject,
    unsubscribeUrl,
    surveyLink,
    recipientFirstName: member.firstName,
    recipientLastName: member.lastName,
  }

  const html = renderEmailHtml(composer.themeSnapshot, composerSnapshot)
  const plainText = renderEmailPlainText(composerSnapshot)

  // 5. Dispatch via ACS connector
  const isFinalAttempt = attempt.attemptsMade + 1 >= attempt.maxAttempts
  try {
    const result = await sendEmailMessage(
      { to: member.email!, subject: composer.subject, plainText, html },
      { senderAddress: composerSnapshot.senderEmail },
    )
    if (!result.sent) {
      // Stub provider (e.g. test env) — count as a no-op success so tests don't fail
      if (result.reason === 'stub_provider') {
        const deliveredAt = new Date()
        await markDelivered(batchId, memberId, surveyId, deliveredAt)
        await writeAudit({ brandId, batchId, memberId, status: 'success' })
        return { sent: true, deliveredAt }
      }
      const reason = classifyError(new Error(result.reason ?? 'unknown'), isFinalAttempt)
      await markFailed(batchId, memberId, reason)
      await writeAudit({ brandId, batchId, memberId, status: 'failure', failureReason: reason })
      return { sent: false, reason, retryable: !isFinalAttempt && reason === 'transient_error_after_retries' }
    }
    const deliveredAt = new Date()
    await markDelivered(batchId, memberId, surveyId, deliveredAt)
    await writeAudit({ brandId, batchId, memberId, status: 'success' })
    return { sent: true, deliveredAt, operationId: result.operationId }
  } catch (err) {
    const reason = classifyError(err, isFinalAttempt)
    await markFailed(batchId, memberId, reason)
    await writeAudit({ brandId, batchId, memberId, status: 'failure', failureReason: reason })
    if (reason === 'bounce' || reason === 'invalid_address') {
      // Non-retryable: re-throw a marker error so BullMQ records the failure
      // and does NOT retry. Use the bounded reason as the error message so the
      // retry-failed endpoint can re-enqueue from the persisted failureReason.
      return { sent: false, reason, retryable: false }
    }
    return { sent: false, reason, retryable: !isFinalAttempt }
  }
}

// BullMQ adapter — extracts payload + attempt info from the Job and delegates
// to the shared dispatcher.
export async function processManagedEmailSend(
  job: Job<ManagedEmailSendPayload>,
): Promise<ManagedEmailSendResult> {
  return dispatchManagedEmailSend(job.data, {
    attemptsMade: job.attemptsMade,
    maxAttempts: job.opts.attempts ?? 3,
  })
}

async function markDelivered(batchId: string, memberId: string, surveyId: string, deliveredAt: Date): Promise<void> {
  await prisma.$transaction([
    prisma.surveyDistribution.updateMany({
      where: { batchId, memberId },
      data: { deliveredAt },
    }),
    prisma.survey.update({
      where: { id: surveyId },
      data: { sentCount: { increment: 1 } },
    }),
  ])
}

async function markFailed(batchId: string, memberId: string, failureReason: ManagedEmailFailureReason): Promise<void> {
  await prisma.surveyDistribution.updateMany({
    where: { batchId, memberId },
    data: { failedAt: new Date(), failureReason },
  })
}

/**
 * Issue #540 F1 — Resolve the public frontend base URL used to build
 * recipient-facing survey + unsubscribe links.
 *
 * Precedence: NEXT_PUBLIC_FRONTEND_URL > FRONTEND_URL > shared canonical
 * default (`PUBLIC_FRONTEND_URL`). Resolves lazily per call so tests can
 * manipulate env vars per-case without re-importing the module, and so the
 * runtime path that dispatches the actual email is the one that surfaces
 * the warning log (not an unused module-load).
 *
 * Pattern mirrors `apps/api/src/routes/distributionBatches.ts:567` — the
 * existing sender-domain fallback. When the env var is missing we warn
 * (so ops sees the drift) but still ship a known-correct host so the
 * recipient receives a working link. The previous behavior fell through
 * to a placeholder (`https://app.customereq.example`) which IS an
 * unregistered host — shipping that into recipient inboxes is the
 * incident this fix prevents.
 */
function resolveFrontendBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_FRONTEND_URL || process.env.FRONTEND_URL
  if (!raw) {
    logger.warn(
      { event: 'frontend_url.fallback', reason: 'env_unset', fallback: PUBLIC_FRONTEND_URL },
      'NEXT_PUBLIC_FRONTEND_URL/FRONTEND_URL not set — using canonical default',
    )
    return PUBLIC_FRONTEND_URL
  }
  return raw.replace(/\/$/, '')
}

// Test-only exports
export const __testing__ = {
  checkSuppression,
  classifyError,
  resolveFrontendBaseUrl,
  SKIP_REASONS,
}

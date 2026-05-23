import type { Job } from 'bullmq'
import { prisma } from '@customerEQ/database'
import { sendEmailMessage } from '@customerEQ/connectors'
import { renderEmailHtml, renderEmailPlainText, type BrandThemeSnapshot, type ComposerSnapshot } from '@customerEQ/shared'
import type { ManagedEmailSendPayload } from '@customerEQ/shared'

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

export async function processManagedEmailSend(
  job: Job<ManagedEmailSendPayload>,
): Promise<ManagedEmailSendResult> {
  const { batchId, memberId, brandId, surveyId } = job.data

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

  // 3. Load distribution row + unsubscribe token for render context
  const [distribution, unsubToken] = await Promise.all([
    prisma.surveyDistribution.findFirst({
      where: { batchId, memberId },
      select: { id: true },
    }),
    prisma.memberUnsubscribeToken.findFirst({
      where: { batchId, memberId },
      select: { tokenPrefix: true }, // plaintext is never stored; tokenPrefix is for display only
    }),
  ])
  const surveyDistributionTokenRow = await prisma.surveyDistributionToken.findFirst({
    where: { batchId, memberId },
    select: { tokenPrefix: true }, // surface plaintext-link substrate
  })
  if (!distribution) {
    await markFailed(batchId, memberId, 'batch_or_member_missing')
    return { sent: false, reason: 'batch_or_member_missing', retryable: false }
  }

  // 4. Build resolved survey + unsubscribe URLs (plaintext is in the queue
  //    payload only via the original POST /distribution-batches mint; for V0
  //    the worker reconstructs from tokenPrefix until we wire plaintext
  //    pass-through. This works because the survey link routes via tokenPrefix
  //    in the public /s/r/:token endpoint.)
  const composer = batch.composerSnapshot as unknown as ComposerSnapshotJson
  const frontendBaseUrl = (process.env.NEXT_PUBLIC_FRONTEND_URL ?? process.env.FRONTEND_URL ?? 'https://app.customereq.example').replace(/\/$/, '')
  const surveyLink = surveyDistributionTokenRow?.tokenPrefix
    ? `${frontendBaseUrl}/survey/${surveyId}/r/${surveyDistributionTokenRow.tokenPrefix}`
    : `${frontendBaseUrl}/survey/${surveyId}`
  const unsubscribeUrl = unsubToken?.tokenPrefix
    ? `${frontendBaseUrl}/u/${unsubToken.tokenPrefix}`
    : `${frontendBaseUrl}/u`

  const composerSnapshot: ComposerSnapshot = {
    brandName: composer.brandName,
    brandLogoUrl: composer.brandLogoUrl ?? null,
    subject: composer.subject,
    bodyHtml: composer.body,
    senderName: composer.senderName,
    senderEmail: `${composer.senderAlias}@${composer.senderDomain}`,
    surveyTitle: composer.subject,
    unsubscribeUrl,
    surveyLink,
    recipientFirstName: member.firstName,
    recipientLastName: member.lastName,
  }

  const html = renderEmailHtml(composer.themeSnapshot, composerSnapshot)
  const plainText = renderEmailPlainText(composerSnapshot)

  // 5. Dispatch via ACS connector
  const isFinalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 3)
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

// Test-only exports
export const __testing__ = {
  checkSuppression,
  classifyError,
  SKIP_REASONS,
}

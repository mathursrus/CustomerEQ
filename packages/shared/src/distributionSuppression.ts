// Issue #420 — survey-send suppression derivation.
//
// Single source of truth for the per-member chip the audience-builder UI
// surfaces on Search results, Random Sample previews, and the accumulated
// audience list (spec §2.2 + R22/R43). The dispatcher worker re-checks the
// same four conditions at send time (spec §13.7 / R44) so this preview is
// safe even if the operator's view goes stale between selection and dispatch.
//
// R44 explicitly EXCLUDES Member.emailOptIn from the survey gate (surveys are
// a legitimate-interest use case exempt from the marketing-channel opt-out).
// Do NOT add emailOptIn here.

export type SurveySuppressionStatus =
  | 'OK'
  | 'UNSUBSCRIBED'
  | 'NO_CONSENT'
  | 'ERASED'
  | 'NO_EMAIL'

export interface SurveySuppressionInput {
  erased: boolean
  email: string | null
  consentGivenAt: Date | string | null
  unsubscribedSurveysAt: Date | string | null
}

export interface SurveySuppressionResult {
  status: SurveySuppressionStatus
  /** ISO timestamp tied to the chip — e.g. unsubscribedSurveysAt for
   * UNSUBSCRIBED, null when not applicable. */
  since: string | null
}

const toIso = (v: Date | string | null): string | null => {
  if (v == null) return null
  if (typeof v === 'string') return v
  return v.toISOString()
}

/**
 * Resolution order matches R44's dispatcher check: erased → email → consent →
 * unsubscribed. The earliest disqualifier wins so the operator sees the most
 * fundamental reason (e.g. an erased member without an email is "ERASED", not
 * "NO_EMAIL").
 */
export function deriveSurveySuppression(
  m: SurveySuppressionInput,
): SurveySuppressionResult {
  if (m.erased) return { status: 'ERASED', since: null }
  if (!m.email) return { status: 'NO_EMAIL', since: null }
  if (!m.consentGivenAt) return { status: 'NO_CONSENT', since: null }
  if (m.unsubscribedSurveysAt) {
    return { status: 'UNSUBSCRIBED', since: toIso(m.unsubscribedSurveysAt) }
  }
  return { status: 'OK', since: null }
}

/**
 * Human-readable tooltip body — used by the audience-list rows' `title=`
 * attribute and by the search-result inline suppression pill. Keep this in
 * sync with the mock at docs/feature-specs/mocks/420-send-via-customereq-acs.html
 * lines 485-500 (Scene 2 tooltip copy).
 */
export function suppressionTooltip(
  m: { firstName?: string | null; lastName?: string | null; identifier?: string | null },
  s: SurveySuppressionResult,
): string {
  const who =
    [m.firstName, m.lastName].filter(Boolean).join(' ').trim() ||
    m.identifier ||
    'This member'
  switch (s.status) {
    case 'UNSUBSCRIBED': {
      const when = s.since ? ` on ${s.since.slice(0, 10)}` : ''
      return `${who} unsubscribed from surveys${when}. Cannot receive survey emails until they resubscribe.`
    }
    case 'NO_CONSENT':
      return `${who} has not given general data-processing consent (Member.consentGivenAt IS NULL). Surveys require consentGivenAt — Member.emailOptIn (marketing-channel preference) is NOT checked.`
    case 'ERASED':
      return `${who} has been erased (GDPR Article 17). Cannot receive any further communication.`
    case 'NO_EMAIL':
      return `${who} has no email on file. Cannot receive survey emails.`
    case 'OK':
    default:
      return ''
  }
}

/** Operator-facing short label for the Status chip (matches mock §2.2 vocab). */
export function suppressionChipLabel(s: SurveySuppressionResult): string {
  switch (s.status) {
    case 'OK':
      return 'OK'
    case 'UNSUBSCRIBED':
      return s.since ? `Unsubscribed · ${s.since.slice(0, 10)}` : 'Unsubscribed'
    case 'NO_CONSENT':
      return 'No consent'
    case 'ERASED':
      return 'Erased'
    case 'NO_EMAIL':
      return 'No email'
  }
}

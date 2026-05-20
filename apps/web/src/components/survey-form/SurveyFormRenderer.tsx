// Issue #241 Slice 4a — pure survey-form renderer.
// Consumes a SurveyResolved-like input + answers state; emits the visual
// survey form per the BrandTheme R31 token contract. No data fetching.
// Skip rules filter visible questions per the answers state.

import { useState } from 'react'

import { ConsentDisclosure } from './ConsentDisclosure'
import { PoweredByFooter } from './PoweredByFooter'
import { QuestionRenderer } from './QuestionRenderer'
import { shouldShowQuestion } from './skip-rules.logic'
import { themeToCssVars } from './theme-to-css-vars'
import { DEFAULT_CHROME_MATRIX, type RendererInput, type ChromeMatrix } from './types'

export type SurveyFormRendererProps = RendererInput

function resolveChrome(input: RendererInput): ChromeMatrix[keyof ChromeMatrix] {
  const matrix = input.survey.settings?.chromeMatrix ?? DEFAULT_CHROME_MATRIX
  return matrix[input.channel]
}

// Inline-error line shared across the renderer's three error surfaces
// (question, consent, and the prefix-slot member-id field rendered by the
// respondent page). Exported so the respondent page can reuse the same
// pattern for the member-id field without duplicating the markup.
// Issue #336 Phase 12 Q12-001.
export function RendererErrorLine({
  slug,
  message,
  indent,
}: {
  slug: string
  message: string
  indent?: boolean
}) {
  return (
    <p
      role="alert"
      data-error={slug}
      style={{
        marginTop: '0.375rem',
        ...(indent ? { marginLeft: '1.625rem' } : null),
        color: '#dc2626',
        fontFamily: 'var(--ceq-font-family)',
        fontSize: 'var(--ceq-body-size)',
      }}
    >
      {message}
    </p>
  )
}

export function SurveyFormRenderer(props: SurveyFormRendererProps) {
  const { survey, theme, brand, channel, viewport, mode, readOnly, answers, onAnswerChange, prefixSlot, onSubmit, submitLabel, submitDisabled, consentChecked, onConsentCheckedChange, errors } = props

  // Component-local "answers state" is the parent's authoritative copy; the
  // renderer doesn't own the answers but mirrors them through onAnswerChange.
  // In preview mode there's no parent collecting answers, so we maintain a
  // local shadow so skip-rule evaluation can still react to user interaction.
  const [localAnswers, setLocalAnswers] = useState(answers)
  const currentAnswers = mode === 'live' ? answers : { ...localAnswers, ...answers }

  function setAnswer(questionId: string, value: unknown) {
    setLocalAnswers((prev) => ({ ...prev, [questionId]: value }))
    onAnswerChange?.(questionId, value)
  }

  const cssVars = themeToCssVars(theme)
  const chrome = resolveChrome(props)

  const consentText = survey.consentTextOverride ?? brand.consentTextDefault ?? ''
  // R14 — effective consent mode = survey override ?? brand default. Drives
  // the checkbox-vs-paragraph rendering. Mirrors the ConsentCollectionSubBlock
  // preview pattern in apps/web/.../edit/components/ConsentCollectionSubBlock.tsx.
  const effectiveConsentMode = survey.consentMode ?? brand.consentMode

  // Defensive: surveys created via legacy flows or mid-creation may not have a
  // questions array yet. Treat missing/null as empty so the renderer never throws.
  const visibleQuestions = (survey.questions ?? []).filter((q) => shouldShowQuestion(q, currentAnswers))

  return (
    <div
      className={`ceq-survey-card ceq-card-style-${theme.cardStyle}`}
      data-channel={channel}
      data-viewport={viewport}
      data-mode={mode}
      aria-readonly={readOnly ? 'true' : undefined}
      style={{
        ...cssVars,
        background: 'var(--ceq-background-color)',
        color: 'var(--ceq-text-color)',
        fontFamily: 'var(--ceq-font-family)',
        fontSize: 'var(--ceq-body-size)',
        borderRadius: 'var(--ceq-border-radius)',
        maxWidth: 'var(--ceq-max-width)',
        padding: '1.5rem',
        margin: '0 auto',
        boxShadow: theme.cardStyle === 'shadow' ? '0 4px 12px rgba(0,0,0,0.08)' : undefined,
        border: theme.cardStyle === 'border' ? '1px solid var(--ceq-secondary-color)' : undefined,
      }}
    >
      {chrome.logo && brand.logoUrl ? (
        <img
          src={brand.logoUrl}
          alt={brand.name}
          style={{ display: 'block', maxHeight: '2.5rem', marginBottom: '0.75rem' }}
        />
      ) : null}
      {chrome.name ? (
        <p
          className="ceq-survey-brand-name"
          style={{ color: 'var(--ceq-primary-color)', fontSize: 'var(--ceq-heading-size)', fontWeight: 600, margin: 0 }}
        >
          {brand.name}
        </p>
      ) : null}
      {chrome.title && survey.title ? (
        <h2
          className="ceq-survey-title"
          style={{ color: 'var(--ceq-text-color)', fontSize: 'var(--ceq-heading-size)', margin: '0.5rem 0 1.25rem' }}
        >
          {survey.title}
        </h2>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (mode === 'live' && !readOnly && !submitDisabled) onSubmit?.()
        }}
      >
        {prefixSlot ? <div style={{ marginBottom: '1.25rem' }}>{prefixSlot}</div> : null}
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {visibleQuestions.map((q) => {
            const qError = errors?.questions?.[q.id]
            return (
              <li key={q.id} data-question-wrapper={q.id}>
                <QuestionRenderer
                  question={q}
                  value={currentAnswers[q.id]}
                  onChange={(v) => setAnswer(q.id, v)}
                  mode={mode}
                  readOnly={readOnly}
                />
                {qError ? (
                  <RendererErrorLine slug={`question-${q.id}`} message={qError} />
                ) : null}
              </li>
            )
          })}
        </ul>

        {consentText ? (
          <div style={{ marginTop: '1.5rem' }} data-consent-wrapper="true">
            {effectiveConsentMode === 'EXPLICIT' ? (
              <label
                className="ceq-survey-consent"
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.5rem',
                  color: 'var(--ceq-text-color)',
                  fontSize: 'var(--ceq-body-size)',
                  cursor: mode === 'preview' || readOnly ? 'default' : 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={consentChecked === true}
                  disabled={mode === 'preview' || readOnly}
                  onChange={(e) => onConsentCheckedChange?.(e.target.checked)}
                  style={{ marginTop: '0.2rem', accentColor: 'var(--ceq-primary-color)' }}
                />
                <span>
                  <ConsentDisclosure
                    text={consentText}
                    privacyPolicyUrl={brand.privacyPolicyUrl}
                    termsUrl={brand.termsUrl}
                  />
                </span>
              </label>
            ) : (
              <ConsentDisclosure
                text={consentText}
                privacyPolicyUrl={brand.privacyPolicyUrl}
                termsUrl={brand.termsUrl}
              />
            )}
            {errors?.consent ? (
              <RendererErrorLine slug="consent" message={errors.consent} indent />
            ) : null}
          </div>
        ) : null}

        <div style={{ marginTop: '1.5rem' }}>
          <button
            type="submit"
            disabled={mode === 'preview' || readOnly || submitDisabled}
            style={{
              background: 'var(--ceq-button-color)',
              color: 'var(--ceq-button-text-color)',
              fontFamily: 'var(--ceq-font-family)',
              fontSize: 'var(--ceq-body-size)',
              padding: '0.625rem 1.25rem',
              border: 'none',
              borderRadius: 'var(--ceq-border-radius)',
              cursor: mode === 'preview' || readOnly || submitDisabled ? 'default' : 'pointer',
            }}
          >
            {submitLabel ?? 'Submit'}
          </button>
        </div>
      </form>

      {/* Issue #413 — "Powered by CustomerEQ" attribution footer.
       *
       * Themed variant sits inside the survey card so it inherits the brand
       * theme via the --ceq-* CSS variables set on this container's inline
       * style. Non-toggleable per R7 — no chrome-matrix gate, no
       * conditional render. Same DOM emits in both preview and live modes
       * per R9 (preview/live parity). UTM medium = 'link' for both the
       * standalone and tokenized React-rendered respondent surfaces.
       */}
      <PoweredByFooter variant="themed" channel="link" />
    </div>
  )
}

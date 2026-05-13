// Issue #241 Slice 4a — text summary for the Configuration section (R28).
//
// Round-2 feedback (#335 post-merge): the previous flat <dl> of seven rows
// didn't correlate visually with the survey editor's tab structure (Basics →
// Questions → Look & Feel → Points & Thank You per spec §2 / R3). Operators
// scanning the summary couldn't map which row belongs to which editor tab
// without re-reading the spec. Restructured into four subsections that
// match the editor tabs 1:1 — same order, same naming, same logical
// groupings. Each subsection has a small dl with its tab's settings.

'use client'

import type React from 'react'

import type { BrandLite, BrandThemeLite, SurveyResolved } from '@/components/survey-form/types'

export interface SurveyConfigDlProps {
  survey: SurveyResolved
  brand: BrandLite
  theme: BrandThemeLite
  programName: string | null
}

const TYPE_LABEL: Record<SurveyResolved['type'], string> = {
  NPS: 'Net Promoter Score (NPS)',
  CSAT: 'Customer Satisfaction (CSAT)',
  CES: 'Customer Effort Score (CES)',
  CUSTOM: 'Custom',
}

const RESPONSE_POLICY_LABEL: Record<SurveyResolved['responsePolicy'], string> = {
  MULTIPLE: 'Multiple responses allowed',
  ONCE: 'One response per member',
  LATEST_OVERWRITES: 'Latest response overwrites prior',
}

const MEMBER_ID_KIND_LABEL: Record<BrandLite['memberIdentifierKind'], string> = {
  email: 'Email',
  phone: 'Phone',
  external_id: 'External ID',
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)] gap-3 py-1">
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="text-xs text-gray-800 break-words">{value}</dd>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-gray-200 pt-3 pb-3 first:border-t-0 first:pt-0 last:pb-0">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-700 mb-2">{title}</h4>
      <dl className="text-sm">{children}</dl>
    </section>
  )
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return `${text.slice(0, max - 1)}…`
}

export function SurveyConfigDl({ survey, brand, theme, programName }: SurveyConfigDlProps) {
  // The Slice 1/2 API returns `settings: null` for surveys with no custom
  // settings (the column is nullable and not seeded with `{}` for legacy rows).
  // The local SurveyResolved type declares settings as always-present, which
  // diverges from runtime; tolerate the null at the boundary rather than
  // changing the type contract for the renderer family (Slice 4b will
  // tighten this in the editor's own type when settings becomes
  // editor-managed).
  const chrome = survey.settings?.chromeMatrix
  const standaloneChrome = chrome?.standalone
  const embeddedChrome = chrome?.embedded

  function chromeLine(c: { logo: boolean; name: boolean; title: boolean } | undefined): string {
    if (!c) {
      return 'Defaults (logo + name + title on Standalone; title only on Embedded)'
    }
    const on = [c.logo && 'Logo', c.name && 'Brand name', c.title && 'Title'].filter(Boolean)
    return on.length ? on.join(' · ') : 'No chrome'
  }

  return (
    <div className="flex flex-col gap-3">
      <Section title="Basics">
        <Row label="Title" value={survey.title ?? survey.name} />
        {survey.title && survey.title !== survey.name ? (
          <Row label="Internal name" value={survey.name} />
        ) : null}
        <Row label="Type" value={TYPE_LABEL[survey.type]} />
        <Row label="Program" value={programName ?? '—'} />
        <Row
          label="Response policy"
          value={RESPONSE_POLICY_LABEL[survey.responsePolicy ?? 'MULTIPLE']}
        />
        <Row
          label="Consent"
          value={
            survey.consentTextOverride !== null && survey.consentTextOverride !== undefined
              ? survey.consentTextOverride.trim() === ''
                ? 'Override · disclosure intentionally blank'
                : 'Override active'
              : 'Inherits brand default'
          }
        />
      </Section>

      <Section title="Questions">
        <Row
          label="Count"
          value={`${survey.questions.length} question${survey.questions.length === 1 ? '' : 's'}`}
        />
        <Row
          label="Preset"
          value={survey.type === 'CUSTOM' ? 'Custom (blank canvas)' : `${TYPE_LABEL[survey.type]} preset`}
        />
      </Section>

      <Section title="Look & Feel">
        <Row label="Theme" value={theme.name} />
        <Row
          label="Member identifier"
          value={MEMBER_ID_KIND_LABEL[brand.memberIdentifierKind]}
        />
        <Row label="Standalone chrome" value={chromeLine(standaloneChrome)} />
        <Row label="Embedded chrome" value={chromeLine(embeddedChrome)} />
      </Section>

      <Section title="Points & Thank You">
        <Row
          label="Points"
          value={
            <span className="italic text-gray-500">
              Set in the program ({programName ?? '—'})
            </span>
          }
        />
        <Row
          label="Thank-you copy"
          value={survey.thankYouMessage ? truncate(survey.thankYouMessage, 120) : '—'}
        />
        {survey.thankYouRedirectUrl ? (
          <Row
            label="Redirect URL"
            value={<span className="font-mono break-all">{survey.thankYouRedirectUrl}</span>}
          />
        ) : null}
      </Section>
    </div>
  )
}

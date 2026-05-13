// Issue #241 Slice 4a — header chrome for the detail page.
// Per spec §7: breadcrumb · type pill · status pill · audit badge (when
// consent overridden) · Edit (Link to /edit) · More menu (state-aware).
//
// Round-2 follow-up (#335 post-merge testing):
//   - Survey type is now rendered as a pill next to the name. Previously
//     it was only surfaced inside the Configuration summary section, so
//     an operator scanning the header couldn't tell NPS vs CSAT without
//     scrolling.
//   - Type and status use the same rounded-full footprint but a different
//     fill treatment: status is a SOLID pill (loud — it changes, gates
//     distribution, signals what the operator can act on); type is an
//     OUTLINED pill (quiet — set once, doesn't change). Same color
//     mapping as the list page's TYPE_PILL, just swapped from filled
//     bg-X-100 to border-X-300 transparent fill.
//   - A meta-line under the h1 surfaces `description · programName` —
//     same shape as the list page's Name-column second line so the two
//     surfaces read as the same survey at a glance.

'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'

import { StatusBadge } from '@/components/ui/status-badge'

import {
  SurveyDetailMoreMenu,
  type SurveyDetailMoreMenuProps,
} from './SurveyDetailMoreMenu'

type SurveyType = 'NPS' | 'CSAT' | 'CES' | 'CUSTOM'

const TYPE_PILL_OUTLINED: Record<SurveyType, string> = {
  NPS: 'border-indigo-300 text-indigo-700',
  CSAT: 'border-blue-300 text-blue-700',
  CES: 'border-purple-300 text-purple-700',
  CUSTOM: 'border-slate-300 text-slate-600',
}

const TYPE_LABEL: Record<SurveyType, string> = {
  NPS: 'NPS',
  CSAT: 'CSAT',
  CES: 'CES',
  CUSTOM: 'Custom',
}

function TypePill({ type }: { type: SurveyType }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border bg-white px-2.5 py-0.5 text-xs font-medium ${TYPE_PILL_OUTLINED[type]}`}
    >
      {TYPE_LABEL[type]}
    </span>
  )
}

export interface SurveyDetailShellProps {
  surveyId: string
  surveyName: string
  surveyType: SurveyType
  description: string | null
  programName: string | null
  status: SurveyDetailMoreMenuProps['state']
  hasConsentOverride: boolean
  callApi: SurveyDetailMoreMenuProps['callApi']
  onActionComplete: SurveyDetailMoreMenuProps['onActionComplete']
  children: ReactNode
}

export function SurveyDetailShell({
  surveyId,
  surveyName,
  surveyType,
  description,
  programName,
  status,
  hasConsentOverride,
  callApi,
  onActionComplete,
  children,
}: SurveyDetailShellProps) {
  const metaParts = [description, programName].filter(
    (p): p is string => typeof p === 'string' && p.trim().length > 0,
  )
  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <nav aria-label="Breadcrumb" className="text-sm text-gray-500 mb-1">
            <Link href="/admin/surveys" className="hover:underline">
              Surveys
            </Link>
            <span aria-hidden="true" className="mx-1.5">
              ›
            </span>
            <span className="text-gray-700">{surveyName}</span>
          </nav>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-gray-900">{surveyName}</h1>
            <TypePill type={surveyType} />
            <StatusBadge status={status} />
            {hasConsentOverride ? (
              <span
                aria-label="Consent mode overrides the brand default"
                className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 border border-amber-200"
              >
                Audit · consent override
              </span>
            ) : null}
          </div>
          {metaParts.length > 0 ? (
            <p className="mt-1 text-sm text-gray-500">
              {metaParts.map((part, i) => (
                <span key={i}>
                  {i > 0 ? <span aria-hidden="true" className="mx-1.5 text-gray-300">·</span> : null}
                  <span>{part}</span>
                </span>
              ))}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/surveys/${surveyId}/edit`}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Edit
          </Link>
          <SurveyDetailMoreMenu
            surveyId={surveyId}
            surveyName={surveyName}
            state={status}
            callApi={callApi}
            onActionComplete={onActionComplete}
          />
        </div>
      </div>
      {children}
    </div>
  )
}

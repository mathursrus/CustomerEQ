// Issue #241 Slice 4a — header chrome for the detail page.
// Per spec §7: breadcrumb · status pill · audit badge (when consent overridden)
// · Edit (Link to /edit) · More menu (state-aware).

'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'

import { StatusBadge } from '@/components/ui/status-badge'

import {
  SurveyDetailMoreMenu,
  type SurveyDetailMoreMenuProps,
} from './SurveyDetailMoreMenu'

export interface SurveyDetailShellProps {
  surveyId: string
  surveyName: string
  status: SurveyDetailMoreMenuProps['state']
  hasConsentOverride: boolean
  callApi: SurveyDetailMoreMenuProps['callApi']
  onActionComplete: SurveyDetailMoreMenuProps['onActionComplete']
  children: ReactNode
}

export function SurveyDetailShell({
  surveyId,
  surveyName,
  status,
  hasConsentOverride,
  callApi,
  onActionComplete,
  children,
}: SurveyDetailShellProps) {
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
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{surveyName}</h1>
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

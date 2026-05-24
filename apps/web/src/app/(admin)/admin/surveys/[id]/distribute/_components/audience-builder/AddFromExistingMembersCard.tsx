// Issue #420 — Add from Existing Members card (one of two side-by-side
// cards in the audience builder, R16). Two tabs: Search (wildcard) and
// Random Sample (count/percent).

'use client'

import { useState } from 'react'

import { SearchTab } from './SearchTab'
import { RandomSampleTab } from './RandomSampleTab'
import type { AudienceRow } from './types'

interface AddFromExistingMembersCardProps {
  surveyId: string
  surveyNameInMail: string
  expiresAtIso: string
  totalMemberCount: number
  alreadyAddedKeys: Set<string>
  onAddRows: (rows: AudienceRow[]) => void
}

export function AddFromExistingMembersCard({
  surveyId,
  surveyNameInMail,
  expiresAtIso,
  totalMemberCount,
  alreadyAddedKeys,
  onAddRows,
}: AddFromExistingMembersCardProps) {
  const [tab, setTab] = useState<'search' | 'random'>('search')

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-2">
        <h3 className="text-sm font-semibold text-gray-900">Add from Existing Members</h3>
      </div>
      <p className="mb-3 text-xs text-gray-600">
        Search the roster (wildcards supported) or take a random sample of eligible
        non-erased members.
      </p>

      <div role="tablist" aria-label="Add-method" className="mb-3 inline-flex overflow-hidden rounded-md border border-gray-200 bg-gray-50">
        {(['search', 'random'] as const).map((t) => {
          const active = tab === t
          return (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t)}
              className={`px-3 py-1 text-xs font-medium transition ${
                active ? 'bg-indigo-100 text-indigo-800' : 'bg-transparent text-gray-700 hover:bg-gray-100'
              }`}
            >
              {t === 'search' ? 'Search' : 'Random sample'}
            </button>
          )
        })}
      </div>

      {tab === 'search' ? (
        <SearchTab surveyId={surveyId} alreadyAddedKeys={alreadyAddedKeys} onAddRows={onAddRows} />
      ) : (
        <RandomSampleTab
          surveyId={surveyId}
          surveyNameInMail={surveyNameInMail}
          expiresAtIso={expiresAtIso}
          totalMemberCount={totalMemberCount}
          onAddRows={onAddRows}
        />
      )}
    </div>
  )
}

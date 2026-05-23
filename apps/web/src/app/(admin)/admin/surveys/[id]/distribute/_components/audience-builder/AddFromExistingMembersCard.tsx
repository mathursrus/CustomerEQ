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
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Add from Existing Members</h3>
        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-indigo-700">
          Shared
        </span>
      </div>
      <p className="mb-3 text-xs text-gray-600">
        Search the roster (wildcards supported) or take a random sample of eligible
        non-erased members.
      </p>

      <div className="mb-3 inline-flex overflow-hidden rounded-md border border-gray-300">
        {(['search', 'random'] as const).map((t) => {
          const active = tab === t
          return (
            <button
              key={t}
              type="button"
              aria-pressed={active}
              onClick={() => setTab(t)}
              className={`px-3 py-1 text-xs font-medium ${
                active ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {t === 'search' ? 'Search' : 'Random sample'}
            </button>
          )
        })}
      </div>

      {tab === 'search' ? (
        <SearchTab alreadyAddedKeys={alreadyAddedKeys} onAddRows={onAddRows} />
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

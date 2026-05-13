// Issue #241 Slice 4a — R26 platform-standard chevron-collapsible primitive
// for the detail-page sections. Owns its own toggle state; the parent
// supplies the initial expanded value only.
//
// Round-2 feedback (#335 post-merge testing): the original Unicode `▼` plus
// a bare <button> had poor affordance — users didn't see that the section
// could be collapsed. This version makes the whole header row clickable
// with a hover state, a cursor-pointer cue, and an SVG chevron that doesn't
// depend on font rendering. Behavior (open/close on click, aria-expanded)
// is unchanged.
//
// Round-2 follow-up: tightened header chrome (`px-5 py-3`, `text-sm`,
// `mb-3`) so a collapsed section header is ~52px (was ~73px). On
// ACTIVE-with-responses surveys where Distribution + Configuration
// summary are collapsed but Loop Monitor + Response are expanded, this
// keeps the hero pipeline content above the fold on common viewports
// without making the header feel cramped (reference: Stripe / Linear /
// Vercel section headers sit in the ~48-52px range).

'use client'

import { useState, type ReactNode } from 'react'

export interface CollapsibleSectionProps {
  title: string
  expandedDefault: boolean
  children: ReactNode
  rightSlot?: ReactNode
}

export function CollapsibleSection({ title, expandedDefault, children, rightSlot }: CollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(expandedDefault)

  return (
    <section className="rounded-xl border border-gray-200 bg-white overflow-hidden mb-3">
      <div className="flex items-stretch">
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          className="flex flex-1 items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-gray-50 focus:outline-none focus-visible:bg-gray-50 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-inset"
        >
          <svg
            aria-hidden="true"
            className="h-4 w-4 flex-shrink-0 text-gray-500 transition-transform"
            style={{ transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="3.5 6 8 10.5 12.5 6" />
          </svg>
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          <span className="ml-auto text-xs font-medium text-gray-400">
            {expanded ? 'Hide' : 'Show'}
          </span>
        </button>
        {rightSlot ? <div className="flex items-center pr-5">{rightSlot}</div> : null}
      </div>
      {expanded ? <div className="border-t border-gray-200 px-5 py-4">{children}</div> : null}
    </section>
  )
}

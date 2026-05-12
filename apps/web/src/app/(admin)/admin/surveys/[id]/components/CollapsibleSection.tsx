// Issue #241 Slice 4a — R26 platform-standard chevron-collapsible primitive
// for the 3 detail-page sections. Owns its own toggle state; the parent
// supplies the initial expanded value only.

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
    <section className="rounded-xl border border-gray-200 bg-white overflow-hidden mb-4">
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-2 text-left"
        >
          <span
            aria-hidden="true"
            className="inline-block transition-transform"
            style={{ transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}
          >
            ▼
          </span>
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        </button>
        {rightSlot}
      </header>
      {expanded ? <div className="px-6 py-4">{children}</div> : null}
    </section>
  )
}

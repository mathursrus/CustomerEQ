'use client'

// Issue #420 R27 — suggestion popover rendered when the operator types `{{`
// inside the TipTap composer. Filters the MUSTACHE_TOKENS palette by the
// current query and dispatches `command({ id, label })` to insert the token.
//
// Kept as a plain React component (not tippy.js-driven) so the popover lives
// inside the React tree where RTL can drive it in tests; tippy.js is bundled
// only because @tiptap/suggestion's @floating-ui dependency surfaces it as a
// peer when the suggestion plugin's `render()` hook isn't supplied.

import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'

import { MUSTACHE_TOKENS, type MustacheToken } from './mustacheTokens'

export interface MustacheSuggestionListProps {
  items: MustacheToken[]
  command: (token: { id: string; label: string }) => void
}

export interface MustacheSuggestionListHandle {
  onKeyDown: (event: { event: KeyboardEvent }) => boolean
}

export const MustacheSuggestionList = forwardRef<MustacheSuggestionListHandle, MustacheSuggestionListProps>(
  function MustacheSuggestionList({ items, command }, ref) {
    const [selectedIndex, setSelectedIndex] = useState(0)

    useEffect(() => {
      setSelectedIndex(0)
    }, [items])

    const selectItem = (index: number) => {
      const item = items[index]
      if (item) {
        command({ id: item.id, label: item.label })
      }
    }

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === 'ArrowDown') {
          setSelectedIndex((prev) => (prev + 1) % Math.max(items.length, 1))
          return true
        }
        if (event.key === 'ArrowUp') {
          setSelectedIndex((prev) => (prev + Math.max(items.length, 1) - 1) % Math.max(items.length, 1))
          return true
        }
        if (event.key === 'Enter') {
          selectItem(selectedIndex)
          return true
        }
        return false
      },
    }))

    if (items.length === 0) {
      return (
        <div
          role="listbox"
          aria-label="Mustache token palette"
          className="z-50 rounded-md border border-gray-300 bg-white px-3 py-2 text-xs text-gray-500 shadow-lg"
        >
          No matching tokens
        </div>
      )
    }

    return (
      <div
        role="listbox"
        aria-label="Mustache token palette"
        className="z-50 max-h-72 w-72 overflow-y-auto rounded-md border border-gray-300 bg-white py-1 shadow-lg"
      >
        {items.map((token, index) => {
          const active = index === selectedIndex
          return (
            <button
              key={token.id}
              role="option"
              type="button"
              aria-selected={active}
              onMouseEnter={() => setSelectedIndex(index)}
              onClick={() => selectItem(index)}
              className={`block w-full px-3 py-1.5 text-left text-xs transition-colors ${
                active ? 'bg-indigo-50' : 'bg-white hover:bg-gray-50'
              }`}
            >
              <span className="font-mono text-indigo-700">{`{{${token.id}}}`}</span>
              {token.required ? (
                <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
                  REQUIRED
                </span>
              ) : null}
              <span className="ml-2 text-gray-500">{token.description}</span>
            </button>
          )
        })}
      </div>
    )
  },
)

export function filterMustacheTokens(query: string): MustacheToken[] {
  const lower = query.toLowerCase()
  if (lower === '') return [...MUSTACHE_TOKENS]
  return MUSTACHE_TOKENS.filter(
    (t) => t.id.toLowerCase().includes(lower) || t.label.toLowerCase().includes(lower),
  )
}

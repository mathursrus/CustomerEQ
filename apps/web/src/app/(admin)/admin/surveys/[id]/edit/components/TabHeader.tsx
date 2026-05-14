// Issue #241 Slice 4b (#336) — TabHeader: numbered 4-tab nav.
//
// Tab order per Spec §2: Basics → Questions → Look & Feel → Points & Thank You.
// Rules tab is intentionally absent (D14 — Rules deferred to a future slice;
// §E hide-vs-stub: hide entirely, don't render a coming-soon stub).
//
// The page header (rendered above this component by SurveyEditorForm) owns
// the saved indicator + Discard / Activate buttons per mock §241 lines
// 533-545 — TabHeader is just the numbered tab nav.

'use client'

export type TabId = 'basics' | 'questions' | 'look-feel' | 'points-thank-you'

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'basics', label: 'Basics' },
  { id: 'questions', label: 'Questions' },
  { id: 'look-feel', label: 'Look & Feel' },
  { id: 'points-thank-you', label: 'Points & Thank You' },
]

export interface TabHeaderProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  tabDirty?: Partial<Record<TabId, boolean>>
}

export function TabHeader({
  activeTab,
  onTabChange,
  tabDirty,
}: TabHeaderProps) {
  return (
    <header className="border-b border-gray-200 bg-white px-6">
      <div role="tablist" aria-label="Survey editor tabs" className="flex items-center gap-1">
        {TABS.map((t, idx) => {
          const selected = activeTab === t.id
          const dirty = Boolean(tabDirty?.[t.id])
          return (
            <button
              key={t.id}
              role="tab"
              type="button"
              id={`survey-editor-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`survey-editor-panel-${t.id}`}
              data-tab-dirty={dirty ? 'true' : 'false'}
              tabIndex={selected ? 0 : -1}
              onClick={() => onTabChange(t.id)}
              className={`relative flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm transition-colors ${
                selected
                  ? 'border-indigo-600 font-medium text-indigo-700'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              <span
                aria-hidden="true"
                className={`flex h-[18px] w-[18px] items-center justify-center rounded-full text-[11px] font-semibold ${
                  selected
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {idx + 1}
              </span>
              <span>{t.label}</span>
              {dirty && (
                <span
                  aria-hidden="true"
                  className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-indigo-500 align-middle"
                />
              )}
            </button>
          )
        })}
      </div>
    </header>
  )
}

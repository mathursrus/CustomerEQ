// Issue #241 Slice 4b (#336) — TabHeader: 4-tab nav + auto-save indicator
// + persistent Activate button (R3 / R5).
//
// Tab order per Spec §2: Basics → Questions → Look & Feel → Points & Thank You.
// Rules tab is intentionally absent (D14 — Rules deferred to a future slice;
// §E hide-vs-stub: hide entirely, don't render a coming-soon stub).
//
// Indicator copy table (RFC §"Save behavior by state"):
//   DRAFT  + no savedAt     → "Draft"
//   DRAFT  + savedAt set    → "Saved · just now" (or relative time)
//   ACTIVE + isAnyTabDirty  → "Unsaved in <Tab>"
//   ACTIVE + clean          → "All changes saved"
//   STOPPED                 → "Stopped — Restart to edit"

'use client'

export type TabId = 'basics' | 'questions' | 'look-feel' | 'points-thank-you'
type SurveyStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'STOPPED'

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'basics', label: 'Basics' },
  { id: 'questions', label: 'Questions' },
  { id: 'look-feel', label: 'Look & Feel' },
  { id: 'points-thank-you', label: 'Points & Thank You' },
]

export interface TabHeaderProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  surveyStatus: SurveyStatus
  savedAt: string | null
  isAnyTabDirty: boolean
  onActivate: () => void
  tabDirty?: Partial<Record<TabId, boolean>>
}

const MINUTE_MS = 60_000
const MINUTES_PER_HOUR = 60

function formatSavedAt(savedAtIso: string): string {
  const elapsedMs = Date.now() - new Date(savedAtIso).getTime()
  if (!Number.isFinite(elapsedMs) || elapsedMs < MINUTE_MS) return 'Saved · just now'
  const minutes = Math.floor(elapsedMs / MINUTE_MS)
  if (minutes < MINUTES_PER_HOUR) return `Saved · ${minutes}m ago`
  const hours = Math.floor(minutes / MINUTES_PER_HOUR)
  return `Saved · ${hours}h ago`
}

function buildIndicator(
  status: SurveyStatus,
  savedAt: string | null,
  isAnyTabDirty: boolean,
  tabDirty: Partial<Record<TabId, boolean>> | undefined,
): string {
  if (status === 'STOPPED') return 'Stopped — Restart to edit'
  if (status === 'DRAFT') return savedAt ? formatSavedAt(savedAt) : 'Draft'
  if (!isAnyTabDirty) return 'All changes saved'
  const firstDirty = TABS.find((t) => tabDirty?.[t.id])
  return `Unsaved in ${firstDirty?.label ?? 'this tab'}`
}

export function TabHeader({
  activeTab,
  onTabChange,
  surveyStatus: _surveyStatus,
  savedAt: _savedAt,
  isAnyTabDirty: _isAnyTabDirty,
  onActivate: _onActivate,
  tabDirty,
}: TabHeaderProps) {
  void _surveyStatus
  void _savedAt
  void _isAnyTabDirty
  void _onActivate

  // The page header (rendered above this component by SurveyEditorForm)
  // owns the saved indicator + Discard / Activate buttons per mock §241
  // lines 533-545. TabHeader's job is just the numbered tab nav.
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

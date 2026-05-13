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

function formatSavedAt(savedAtIso: string): string {
  const elapsedMs = Date.now() - new Date(savedAtIso).getTime()
  if (!Number.isFinite(elapsedMs) || elapsedMs < 60_000) return 'Saved · just now'
  const minutes = Math.floor(elapsedMs / 60_000)
  if (minutes < 60) return `Saved · ${minutes}m ago`
  const hours = Math.floor(minutes / 60)
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
  surveyStatus,
  savedAt,
  isAnyTabDirty,
  onActivate,
  tabDirty,
}: TabHeaderProps) {
  const indicator = buildIndicator(surveyStatus, savedAt, isAnyTabDirty, tabDirty)

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3">
      <div role="tablist" aria-label="Survey editor tabs" className="flex items-center gap-1">
        {TABS.map((t) => {
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
              className={`relative rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                selected
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              {t.label}
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

      <div className="flex items-center gap-3">
        <span
          data-testid="autosave-indicator"
          className="text-xs font-medium text-gray-500"
        >
          {indicator}
        </span>
        <button
          type="button"
          onClick={onActivate}
          disabled={surveyStatus === 'STOPPED'}
          className="rounded-md bg-indigo-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          Activate
        </button>
      </div>
    </header>
  )
}

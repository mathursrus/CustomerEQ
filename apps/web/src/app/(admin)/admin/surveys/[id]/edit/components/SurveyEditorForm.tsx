// Issue #241 Slice 4b (#336) — SurveyEditorForm.
//
// Orchestrates the 4-tab editor experience:
//   - Per-tab dirty state via TAB_FIELDS (mirrors OrganizationSettingsForm's
//     SECTION_FIELDS at apps/.../OrganizationSettingsForm.tsx:174-177).
//   - State-aware save mode (RFC §"Save behavior by state"):
//       DRAFT          → autosave on field change (debounced 500ms via
//                        useAutoSave); no explicit Save button.
//       ACTIVE/PAUSED  → explicit "Save changes" button per tab; only the
//                        dirty fields of the visible tab go in the PATCH body.
//       STOPPED        → all inputs disabled, no Save button, indicator reads
//                        "Stopped — Restart to edit".
//   - Tab nav exposes per-tab data-tab-dirty so test code can observe the
//     dirty model without spying on internal state.

'use client'

import { useCallback, useMemo, useState } from 'react'

import { parseErrorResponse } from '@/lib/errors'
import type { BrandThemeLite } from '@/components/survey-form/types'

import { isFieldEditable } from '../../../_helpers/field-editability'
import type {
  EditorBrand,
  EditorSurvey,
  ProgramWithEarningRule,
} from '../__fixtures__/editor-fixtures'
import { useAutoSave } from '../hooks/useAutoSave'
import { ActivateModal } from './ActivateModal'
import { BasicsTab } from './BasicsTab'
import { ConsentAttestationModal } from './ConsentAttestationModal'
import { DiscardDraftModal } from './DiscardDraftModal'
import { LookFeelTab } from './LookFeelTab'
import { PointsAndThankYouTab } from './PointsAndThankYouTab'
import { QuestionsTab } from './QuestionsTab'
import { TabHeader, type TabId } from './TabHeader'

type ConsentModeValue = 'INHERIT' | 'EXPLICIT' | 'IMPLIED_ON_SUBMIT'
type EffectiveConsentMode = 'EXPLICIT' | 'IMPLIED_ON_SUBMIT'

const TAB_LABEL: Record<TabId, string> = {
  basics: 'Basics',
  questions: 'Questions',
  'look-feel': 'Look & Feel',
  'points-thank-you': 'Points & Thank You',
}

function buildHeaderIndicator(
  status: EditorSurvey['status'],
  savedAt: string | null,
  isAnyTabDirty: boolean,
  tabDirty: Partial<Record<TabId, boolean>>,
): string {
  if (status === 'STOPPED') return 'Stopped — Restart to edit'
  if (status === 'DRAFT') {
    if (!savedAt) return 'Draft'
    const elapsed = Date.now() - new Date(savedAt).getTime()
    if (!Number.isFinite(elapsed) || elapsed < 60_000) return 'Saved · just now'
    const mins = Math.floor(elapsed / 60_000)
    if (mins < 60) return `Saved · ${mins}m ago`
    return `Saved · ${Math.floor(mins / 60)}h ago`
  }
  if (!isAnyTabDirty) return 'All changes saved'
  const dirty = (Object.keys(tabDirty) as TabId[]).find((k) => tabDirty[k])
  return `Unsaved in ${dirty ? TAB_LABEL[dirty] : 'this tab'}`
}

function initialConsentMode(survey: EditorSurvey): ConsentModeValue {
  const stored = (survey as { consentMode?: ConsentModeValue | null }).consentMode
  if (stored === 'EXPLICIT' || stored === 'IMPLIED_ON_SUBMIT') return stored
  return 'INHERIT'
}

function resolveEffective(
  brandMode: EffectiveConsentMode,
  override: ConsentModeValue,
): EffectiveConsentMode {
  return override === 'INHERIT' ? brandMode : override
}

// R10: more-permissive override (drops the opt-in) requires attestation.
function isMorePermissiveOverride(
  brandMode: EffectiveConsentMode,
  nextOverride: ConsentModeValue,
): boolean {
  if (nextOverride === 'INHERIT') return false
  const effective = resolveEffective(brandMode, nextOverride)
  return brandMode === 'EXPLICIT' && effective === 'IMPLIED_ON_SUBMIT'
}

const TAB_FIELDS: Record<TabId, string[]> = {
  basics: [
    'name',
    'title',
    'description',
    'type',
    'programId',
    'responsePolicy',
    'consentMode',
    'consentTextOverride',
  ],
  questions: ['questions'],
  'look-feel': ['themeId', 'settings'],
  'points-thank-you': ['thankYouMessage', 'thankYouRedirectUrl'],
}

export interface SurveyEditorFormProps {
  survey: EditorSurvey
  brand: EditorBrand
  themes: BrandThemeLite[]
  /** Canonical brand-default theme id from Brand.defaultThemeId (GET /v1/themes
   *  response). Themes list is ordered by createdAt desc so themes[0] is the
   *  most recent theme, not the default. */
  defaultThemeId: string | null
  programs: ProgramWithEarningRule[]
  initialTab?: TabId
  attestedBy: string
  patchSurvey: (url: string, body: Record<string, unknown>) => Promise<Response>
  deleteSurvey: () => Promise<Response>
  /** PATCH /v1/surveys/:id/status — accepts any target status. ACTIVE
   *  flows through the ActivateModal (R23 gate); other transitions fire
   *  directly from the page header buttons. */
  activateSurvey: (id: string, status?: 'ACTIVE' | 'PAUSED' | 'STOPPED') => Promise<Response>
  patchConsentMode: (body: {
    consentMode: ConsentModeValue
    consentReason: string
    attestation: { confirmed: true; reason: string }
  }) => Promise<Response>
  onActivate?: () => void
  onDiscard?: () => void
}

const VALID_TABS: ReadonlyArray<TabId> = ['basics', 'questions', 'look-feel', 'points-thank-you']

function isTabId(value: string | null | undefined): value is TabId {
  return value !== null && value !== undefined && (VALID_TABS as readonly string[]).includes(value)
}

export function SurveyEditorForm({
  survey,
  brand,
  themes,
  defaultThemeId,
  programs,
  initialTab,
  attestedBy,
  patchSurvey,
  deleteSurvey,
  activateSurvey,
  patchConsentMode,
  onActivate,
  onDiscard,
}: SurveyEditorFormProps) {
  const [activeTab, setActiveTab] = useState<TabId>(isTabId(initialTab) ? initialTab : 'basics')
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [dirtyFields, setDirtyFields] = useState<Set<string>>(new Set())
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [activateOpen, setActivateOpen] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [consentMode, setConsentMode] = useState<ConsentModeValue>(initialConsentMode(survey))
  const [consentTextOverride, setConsentTextOverride] = useState<string | null>(
    survey.consentTextOverride,
  )
  const [pendingConsent, setPendingConsent] = useState<{
    nextMode: ConsentModeValue
    nextText: string | null
  } | null>(null)

  const isReadOnly = survey.status === 'STOPPED'
  const isAutoSaveMode = survey.status === 'DRAFT'
  const isManualSaveMode = survey.status === 'ACTIVE' || survey.status === 'PAUSED'

  // Tabs unmount on tab switch and re-seed their local state from the `survey`
  // prop. Merge in-flight `values` so edits survive: each tab sees its own
  // dirty values on remount, not the saved-record snapshot. Settings is
  // merged shallow so per-key patches (e.g. chromeMatrix from LookFeelTab)
  // do not drop sibling keys.
  const liveSurvey = useMemo<EditorSurvey>(() => {
    const merged = { ...survey, ...values } as EditorSurvey
    if (values.settings !== undefined) {
      merged.settings = {
        ...(survey.settings ?? {}),
        ...(values.settings as Record<string, unknown>),
      }
    }
    return merged
  }, [survey, values])

  const { triggerSave } = useAutoSave({
    surveyId: survey.id,
    surveyStatus: survey.status,
    patchFn: patchSurvey,
    onSaved: setSavedAt,
    onError: (err) => setSaveError(err instanceof Error ? err.message : 'Auto-save failed'),
  })

  const handleFieldChange = useCallback(
    (field: string, value: unknown) => {
      if (isReadOnly) return
      setValues((prev) => ({ ...prev, [field]: value }))
      setDirtyFields((prev) => {
        if (prev.has(field)) return prev
        const next = new Set(prev)
        next.add(field)
        return next
      })
      if (isAutoSaveMode) {
        triggerSave(field, value)
      }
    },
    [isReadOnly, isAutoSaveMode, triggerSave],
  )

  // R10: Operator picks a more-permissive consent override → gate behind the
  // attestation modal. The dropdown UI value updates so the operator sees their
  // selection reflected (and the amber callout in the sub-block), but no PATCH
  // fires until the modal is confirmed. Cancelling the modal reverts both
  // mode + text override to their last attested state.
  const handleConsentChange = useCallback(
    (next: { consentMode: ConsentModeValue; consentTextOverride: string | null }) => {
      if (isReadOnly) return
      const requiresAttestation = isMorePermissiveOverride(brand.consentMode, next.consentMode)
      // Reflect the operator's choice in the dropdown immediately.
      setConsentMode(next.consentMode)
      setConsentTextOverride(next.consentTextOverride)
      if (requiresAttestation) {
        setPendingConsent({ nextMode: next.consentMode, nextText: next.consentTextOverride })
        return
      }
      // Stricter or inherit: write straight through the normal save path.
      handleFieldChange('consentMode', next.consentMode)
      handleFieldChange('consentTextOverride', next.consentTextOverride)
    },
    [brand.consentMode, isReadOnly, handleFieldChange],
  )

  const submitConsentAttestation = useCallback(
    async (body: {
      consentMode: 'EXPLICIT' | 'IMPLIED_ON_SUBMIT'
      consentReason: string
      attestation: { confirmed: true; reason: string }
    }): Promise<Response> => {
      const res = await patchConsentMode(body)
      if (res.ok && pendingConsent) {
        // Persist alongside any text override the operator typed before opening the modal.
        setValues((prev) => ({
          ...prev,
          consentMode: pendingConsent.nextMode,
          consentTextOverride: pendingConsent.nextText,
        }))
        setDirtyFields((prev) => {
          const next = new Set(prev)
          next.delete('consentMode')
          next.delete('consentTextOverride')
          return next
        })
        setSavedAt(new Date().toISOString())
        setPendingConsent(null)
      }
      return res
    },
    [patchConsentMode, pendingConsent],
  )

  const cancelConsentAttestation = useCallback(() => {
    // Revert dropdown + text override to the survey's last-attested state.
    setConsentMode(initialConsentMode(survey))
    setConsentTextOverride(survey.consentTextOverride)
    setPendingConsent(null)
  }, [survey])

  const handleTypeChange = useCallback(
    (next: 'NPS' | 'CSAT' | 'CES' | 'CUSTOM') => {
      handleFieldChange('type', next)
    },
    [handleFieldChange],
  )

  const tabDirty = useMemo<Record<TabId, boolean>>(
    () => ({
      basics: TAB_FIELDS.basics.some((f) => dirtyFields.has(f)),
      questions: TAB_FIELDS.questions.some((f) => dirtyFields.has(f)),
      'look-feel': TAB_FIELDS['look-feel'].some((f) => dirtyFields.has(f)),
      'points-thank-you': TAB_FIELDS['points-thank-you'].some((f) => dirtyFields.has(f)),
    }),
    [dirtyFields],
  )

  const isCurrentTabDirty = tabDirty[activeTab]
  const isAnyTabDirty = Object.values(tabDirty).some(Boolean)

  async function handleSaveCurrentTab() {
    if (!isManualSaveMode || !isCurrentTabDirty || saving) return
    const fields = TAB_FIELDS[activeTab]
    // Filter by server-side editability + exclude consentMode (dedicated
    // endpoint). Belt-and-suspenders on top of the per-input disabled gates
    // — if a stale dirty field somehow lingers across a state transition,
    // we don't ship it and trigger 409 FIELD_NOT_EDITABLE_IN_STATE.
    const editCtx = { responsesCount }
    const body: Record<string, unknown> = {}
    for (const f of fields) {
      if (!dirtyFields.has(f)) continue
      if (FLUSH_EXCLUDED_FIELDS.has(f)) continue
      if (!isFieldEditable(f, survey.status, editCtx)) continue
      body[f] = values[f]
    }
    setSaveError(null)
    setSaving(true)
    try {
      const res = await patchSurvey(`/v1/surveys/${survey.id}`, body)
      if (!res.ok) {
        setSaveError(await parseErrorResponse(res))
        return
      }
      setDirtyFields((prev) => {
        const next = new Set(prev)
        for (const f of fields) next.delete(f)
        return next
      })
      setSavedAt(new Date().toISOString())
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const headerBanner = (() => {
    if (survey.status === 'ACTIVE') {
      return (
        <p className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-xs text-amber-800">
          This survey is live. Changes apply immediately on save.
        </p>
      )
    }
    if (survey.status === 'PAUSED') {
      return (
        <p className="border-b border-gray-100 bg-gray-50 px-4 py-2 text-xs text-gray-700">
          This survey is paused. Changes will apply on Restart.
        </p>
      )
    }
    return null
  })()

  const programForTab: ProgramWithEarningRule | undefined =
    programs.find((p) => p.id === liveSurvey.programId) ?? programs[0]

  const themeForActivate = themes.find((t) => t.id === liveSurvey.themeId) ?? themes[0] ?? null

  const responsesCount =
    (survey as { responsesCount?: number; _count?: { responses: number } }).responsesCount ??
    (survey as { _count?: { responses: number } })._count?.responses ??
    0

  // Fields that the dedicated PATCH endpoint (or no endpoint) handles — must
  // be excluded from the flush PATCH body so the strict() schema doesn't 422.
  const FLUSH_EXCLUDED_FIELDS = new Set(['consentMode'])

  async function flushPendingChanges(): Promise<void> {
    // Coalesce all currently-dirty editor fields into one PATCH so the
    // Activate modal (and the server-side activation gate) sees the
    // operator's in-flight state — not a 500ms-stale snapshot.
    if (dirtyFields.size === 0) return
    const editCtx = { responsesCount }
    const body: Record<string, unknown> = {}
    for (const f of dirtyFields) {
      if (FLUSH_EXCLUDED_FIELDS.has(f)) continue
      if (!isFieldEditable(f, survey.status, editCtx)) continue
      body[f] = values[f]
    }
    if (Object.keys(body).length === 0) return
    try {
      const res = await patchSurvey(`/v1/surveys/${survey.id}`, body)
      if (res.ok) {
        setDirtyFields((prev) => {
          const next = new Set(prev)
          for (const f of Object.keys(body)) next.delete(f)
          return next
        })
        setSavedAt(new Date().toISOString())
      } else {
        setSaveError(await parseErrorResponse(res))
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed')
    }
  }

  async function handleActivateClicked() {
    await flushPendingChanges()
    setActivateOpen(true)
  }

  function handleActivated() {
    setActivateOpen(false)
    onActivate?.()
  }

  // Pause and Stop transitions don't need the activation gate (no question /
  // title checks required to move to PAUSED or STOPPED) so they fire the
  // status PATCH directly. Stop is destructive (no more responses collected)
  // so we prompt via native confirm rather than a bespoke modal.
  const [transitioning, setTransitioning] = useState<'PAUSED' | 'STOPPED' | null>(null)
  async function transitionStatus(target: 'PAUSED' | 'STOPPED') {
    if (transitioning) return
    if (target === 'STOPPED') {
      const ok =
        typeof window !== 'undefined'
          ? window.confirm(
              'Stop this survey? New responses will be blocked. Existing responses are kept.',
            )
          : true
      if (!ok) return
    }
    setTransitioning(target)
    setSaveError(null)
    try {
      const res = await activateSurvey(survey.id, target)
      if (!res.ok) {
        setSaveError(await parseErrorResponse(res))
        return
      }
      // Status changed on the server — bounce out of the editor so the page
      // reloads the survey with the new status. The detail page is the
      // canonical home after a state change.
      onActivate?.()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Status change failed')
    } finally {
      setTransitioning(null)
    }
  }

  function handleDiscarded() {
    setDiscardOpen(false)
    onDiscard?.()
  }

  // Page-header indicator — same status copy as the inline TabHeader
  // indicator used previously. Pulled into the page header per mock §241
  // lines 535-545 (breadcrumb + H1 + saved-state + actions row above tabs).
  const headerIndicator = buildHeaderIndicator(survey.status, savedAt, isAnyTabDirty, tabDirty)
  const statusBadgeStyles: Record<EditorSurvey['status'], string> = {
    DRAFT: 'bg-gray-100 text-gray-700',
    ACTIVE: 'bg-green-100 text-green-800',
    PAUSED: 'bg-amber-100 text-amber-800',
    STOPPED: 'bg-gray-100 text-gray-600',
  }

  return (
    // h-full + flex-col anchors the editor to <main>'s height exactly so
    // the only scroll container is the tabpanel below. Without h-full the
    // form sized to its natural content (~1090px), overflowed <main>'s
    // 687px clientHeight, and Chromium leaked that logical extent up to
    // documentElement.scrollHeight (~1106) — producing a second html-level
    // scrollbar plus a programmatic scrollIntoView that yanked the page
    // when controls were clicked. (Issue #336 Phase 11 — Playwright repro
    // captured the regression at apps/web/test/e2e history.)
    <div className="flex h-full flex-col bg-white">
      {/* Page header — per mock §241 lines 533-545. */}
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        {/* Breadcrumb: Surveys → <Survey Name> → Edit. The survey name links
            back to the detail page so the operator can return to the parent
            context. "Edit" itself is implicit (we're on the edit page) but
            shown unlinked to preserve the trail. */}
        <nav aria-label="Breadcrumb" className="text-xs text-gray-500">
          <a href="/admin/surveys" className="hover:text-gray-700 hover:underline">
            Surveys
          </a>
          <span aria-hidden="true" className="mx-2">/</span>
          <a
            href={`/admin/surveys/${survey.id}`}
            className="hover:text-gray-700 hover:underline"
          >
            {liveSurvey.name || 'Untitled survey'}
          </a>
          <span aria-hidden="true" className="mx-2">/</span>
          <span className="text-gray-700">Edit</span>
        </nav>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-3 text-xl font-bold text-gray-900">
              <span>{liveSurvey.name || 'Untitled survey'}</span>
              <span
                data-testid="survey-status-badge"
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${statusBadgeStyles[survey.status]}`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                {survey.status.charAt(0) + survey.status.slice(1).toLowerCase()}
              </span>
            </h1>
            <p
              data-testid="autosave-indicator"
              className="mt-1 inline-flex items-center gap-1.5 text-xs text-gray-500"
            >
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 rounded-full ${
                  isAnyTabDirty && survey.status !== 'DRAFT' ? 'bg-amber-500' : 'bg-green-500'
                }`}
              />
              {headerIndicator}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {survey.status === 'DRAFT' && (
              <>
                <button
                  type="button"
                  data-testid="discard-draft-btn"
                  onClick={() => setDiscardOpen(true)}
                  className="rounded-md border border-gray-300 bg-white px-3.5 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Discard draft
                </button>
                <button
                  type="button"
                  data-testid="activate-btn"
                  onClick={handleActivateClicked}
                  className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
                >
                  Activate →
                </button>
              </>
            )}
            {survey.status === 'ACTIVE' && (
              <>
                <button
                  type="button"
                  data-testid="pause-btn"
                  disabled={transitioning !== null}
                  onClick={() => transitionStatus('PAUSED')}
                  className="rounded-md border border-gray-300 bg-white px-3.5 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {transitioning === 'PAUSED' ? 'Pausing…' : 'Pause'}
                </button>
                <button
                  type="button"
                  data-testid="stop-btn"
                  disabled={transitioning !== null}
                  onClick={() => transitionStatus('STOPPED')}
                  className="rounded-md border border-red-300 bg-white px-3.5 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {transitioning === 'STOPPED' ? 'Stopping…' : 'Stop'}
                </button>
              </>
            )}
            {survey.status === 'PAUSED' && (
              <>
                <button
                  type="button"
                  data-testid="resume-btn"
                  onClick={handleActivateClicked}
                  className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
                >
                  Resume →
                </button>
                <button
                  type="button"
                  data-testid="stop-btn"
                  disabled={transitioning !== null}
                  onClick={() => transitionStatus('STOPPED')}
                  className="rounded-md border border-red-300 bg-white px-3.5 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {transitioning === 'STOPPED' ? 'Stopping…' : 'Stop'}
                </button>
              </>
            )}
            {survey.status === 'STOPPED' && (
              <button
                type="button"
                data-testid="restart-btn"
                onClick={handleActivateClicked}
                className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
              >
                Restart →
              </button>
            )}
          </div>
        </div>
      </div>

      <TabHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        surveyStatus={survey.status}
        savedAt={savedAt}
        isAnyTabDirty={isAnyTabDirty}
        onActivate={handleActivateClicked}
        tabDirty={tabDirty}
      />

      {headerBanner}

      {saveError && (
        <p
          data-testid="editor-save-error"
          className="border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700"
        >
          {saveError}
        </p>
      )}

      <div
        role="tabpanel"
        id={`survey-editor-panel-${activeTab}`}
        aria-labelledby={`survey-editor-tab-${activeTab}`}
        // min-h-0 lets flex-1 actually shrink so overflow-y-auto can clip;
        // contain:layout isolates the tab content's layout extent so
        // Chromium does not leak the LookFeelTab's natural ~940px height
        // up to documentElement.scrollHeight — without containment,
        // getBoundingClientRect returned the un-clipped logical bounds
        // and produced a second body-level scrollbar (Issue #336 Phase 11
        // Playwright repro).
        className="flex-1 min-h-0 overflow-y-auto [contain:layout]"
      >
        {activeTab === 'basics' && (
          <BasicsTab
            survey={liveSurvey}
            brand={brand}
            programs={programs}
            consentMode={consentMode}
            consentTextOverride={consentTextOverride}
            onConsentChange={handleConsentChange}
            onFieldChange={handleFieldChange}
            onTypeChange={handleTypeChange}
            disabled={isReadOnly}
          />
        )}
        {activeTab === 'questions' && (
          <QuestionsTab
            survey={liveSurvey}
            onChange={(qs) => handleFieldChange('questions', qs)}
            disabled={isReadOnly}
          />
        )}
        {activeTab === 'look-feel' && (
          <LookFeelTab
            survey={liveSurvey}
            brand={brand}
            themes={themes}
            defaultThemeId={defaultThemeId}
            onChange={(patch) => {
              if (patch.themeId !== undefined) handleFieldChange('themeId', patch.themeId)
              if (patch.settings !== undefined) handleFieldChange('settings', patch.settings)
            }}
            disabled={isReadOnly}
          />
        )}
        {activeTab === 'points-thank-you' && (
          <PointsAndThankYouTab
            survey={liveSurvey}
            program={programForTab}
            onChange={(patch) => {
              if (patch.thankYouMessage !== undefined) {
                handleFieldChange('thankYouMessage', patch.thankYouMessage)
              }
              if (patch.thankYouRedirectUrl !== undefined) {
                handleFieldChange('thankYouRedirectUrl', patch.thankYouRedirectUrl)
              }
            }}
            disabled={isReadOnly}
          />
        )}
      </div>

      {isManualSaveMode && (
        <div className="flex items-center justify-end border-t border-gray-200 bg-white px-4 py-3">
          <button
            type="button"
            onClick={handleSaveCurrentTab}
            disabled={!isCurrentTabDirty || saving}
            className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      )}

      <ActivateModal
        open={activateOpen}
        survey={liveSurvey}
        brand={brand}
        theme={themeForActivate}
        activateSurvey={activateSurvey}
        onActivated={handleActivated}
        onClose={() => setActivateOpen(false)}
      />

      <DiscardDraftModal
        open={discardOpen}
        surveyId={survey.id}
        surveyName={survey.name}
        deleteSurvey={(_id) => deleteSurvey()}
        onDiscarded={handleDiscarded}
        onClose={() => setDiscardOpen(false)}
      />

      {pendingConsent !== null && pendingConsent.nextMode !== 'INHERIT' && (
        <ConsentAttestationModal
          open
          surveyId={survey.id}
          attestedBy={attestedBy}
          nextConsentMode={pendingConsent.nextMode as EffectiveConsentMode}
          onSubmit={submitConsentAttestation}
          onClose={cancelConsentAttestation}
        />
      )}
    </div>
  )
}

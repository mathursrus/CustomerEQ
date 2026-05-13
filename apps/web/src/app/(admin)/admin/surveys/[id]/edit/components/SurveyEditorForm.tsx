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

import type { BrandThemeLite } from '@/components/survey-form/types'

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
  programs: ProgramWithEarningRule[]
  initialTab?: TabId
  attestedBy: string
  patchSurvey: (url: string, body: Record<string, unknown>) => Promise<Response>
  deleteSurvey: () => Promise<Response>
  activateSurvey: (id: string) => Promise<Response>
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
    const body: Record<string, unknown> = {}
    for (const f of fields) {
      if (dirtyFields.has(f)) body[f] = values[f]
    }
    setSaveError(null)
    setSaving(true)
    try {
      const res = await patchSurvey(`/v1/surveys/${survey.id}`, body)
      if (!res.ok) {
        let message = `Save failed (HTTP ${res.status})`
        try {
          const parsed = (await res.json()) as { message?: string; error?: string }
          message = parsed.message ?? parsed.error ?? message
        } catch {
          // body wasn't JSON
        }
        setSaveError(message)
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
    programs.find((p) => p.id === ((values.programId as string | undefined) ?? survey.programId)) ??
    programs[0]

  const themeForActivate = themes.find((t) => t.id === survey.themeId) ?? themes[0] ?? null

  function handleActivateClicked() {
    setActivateOpen(true)
  }

  function handleActivated() {
    setActivateOpen(false)
    onActivate?.()
  }

  function handleDiscarded() {
    setDiscardOpen(false)
    onDiscard?.()
  }

  return (
    <div className="flex flex-col">
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
        className="flex-1"
      >
        {activeTab === 'basics' && (
          <BasicsTab
            survey={survey}
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
            survey={survey}
            onChange={(qs) => handleFieldChange('questions', qs)}
            disabled={isReadOnly}
          />
        )}
        {activeTab === 'look-feel' && (
          <LookFeelTab
            survey={survey}
            brand={brand}
            themes={themes}
            onChange={(patch) => {
              if (patch.themeId !== undefined) handleFieldChange('themeId', patch.themeId)
              if (patch.settings !== undefined) handleFieldChange('settings', patch.settings)
            }}
            disabled={isReadOnly}
          />
        )}
        {activeTab === 'points-thank-you' && (
          <PointsAndThankYouTab
            survey={survey}
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

      {survey.status === 'DRAFT' && (
        <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-3">
          <button
            type="button"
            data-testid="discard-draft-btn"
            onClick={() => setDiscardOpen(true)}
            className="text-sm font-medium text-red-600 hover:text-red-700"
          >
            Discard draft
          </button>
        </div>
      )}

      <ActivateModal
        open={activateOpen}
        survey={survey}
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

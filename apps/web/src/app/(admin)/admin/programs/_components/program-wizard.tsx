'use client'

import { useReducer, useCallback, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { API_URL } from '@/lib/config'
import { WizardStepper } from '@/components/ui/wizard-stepper'
import { ViewOnlyBanner } from '@/components/ui/view-only-banner'
import { Step1Type } from './wizard-steps/step1-type'
import { Step2BasicInfo } from './wizard-steps/step2-basic-info'
import { Step3EarningRules } from './wizard-steps/step3-earning-rules'
import { Step4Tiers } from './wizard-steps/step4-tiers'
import { Step5Rewards } from './wizard-steps/step5-rewards'
import { Step6Budget } from './wizard-steps/step6-budget'
import { Step7Preview } from './wizard-steps/step7-preview'
import { ActivateModal } from './modals/activate-modal'
import type React from 'react'

// ── Shared types (exported for use in step components) ────────────────────────

export type ProgramType = 'POINTS' | 'TIERED' | 'CASHBACK' | 'HYBRID'

export interface Condition {
  id: string
  field: string
  op: string
  value: string
}

export interface EarningRule {
  id: string
  trigger: string
  conditions: Condition[]
  conditionLogic: 'AND' | 'OR'
  action: 'AWARD_POINTS' | 'MULTIPLIER'
  actionValue: string
  budgetCapPoints: string
  priority: number
  stackable: boolean
}

export interface Tier {
  id: string
  name: string
  icon: string
  minPoints: string
  minSpend: string
  multiplier: string
  benefits: string
}

export interface Reward {
  id: string
  name: string
  description: string
  rewardType: string
  pointsCost: string
  stock: 'UNLIMITED' | 'LIMITED'
  stockQty: string
  eligibleTiers: string
  availability: 'ALWAYS' | 'DATES'
  availFrom: string
  availUntil: string
}

export interface WizardState {
  step: number
  programType: ProgramType | null
  name: string
  description: string
  startDate: string
  endDate: string
  currencyName: string
  currencyCustom: string
  earningRules: EarningRule[]
  tiers: Tier[]
  rewards: Reward[]
  totalBudget: string
  monthlyCap: string
  alertThreshold: string
  haltBehavior: string
  simBalance: number
  simResult: string | null
}

export type WizardAction =
  | { type: 'SET_STEP'; step: number }
  | { type: 'SET_TYPE'; programType: ProgramType }
  | { type: 'SET_FIELD'; field: keyof WizardState; value: unknown }
  | { type: 'ADD_RULE'; rule: EarningRule }
  | { type: 'UPDATE_RULE'; rule: EarningRule }
  | { type: 'REMOVE_RULE'; id: string }
  | { type: 'ADD_TIER'; tier: Tier }
  | { type: 'UPDATE_TIER'; tier: Tier }
  | { type: 'REMOVE_TIER'; id: string }
  | { type: 'REORDER_TIERS'; tiers: Tier[] }
  | { type: 'ADD_REWARD'; reward: Reward }
  | { type: 'UPDATE_REWARD'; reward: Reward }
  | { type: 'REMOVE_REWARD'; id: string }
  | { type: 'SET_SIM'; balance: number; result: string }
  | { type: 'LOAD'; state: WizardState }

// ── StepProps interface (exported for step components) ────────────────────────

export interface StepProps {
  state: WizardState
  dispatch: React.Dispatch<WizardAction>
  onNext: () => void
  onBack: () => void
  onSaveDraft: () => void
  isViewOnly: boolean
}

// ── Reducer ───────────────────────────────────────────────────────────────────

const INITIAL_STATE: WizardState = {
  step: 1,
  programType: null,
  name: '',
  description: '',
  startDate: '',
  endDate: '',
  currencyName: 'Stars',
  currencyCustom: '',
  earningRules: [],
  tiers: [],
  rewards: [],
  totalBudget: '',
  monthlyCap: '',
  alertThreshold: '80',
  haltBehavior: 'PAUSE_RULES',
  simBalance: 840,
  simResult: null,
}

export function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, step: action.step }
    case 'SET_TYPE':
      return { ...state, programType: action.programType }
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value }
    case 'ADD_RULE':
      return { ...state, earningRules: [...state.earningRules, action.rule] }
    case 'UPDATE_RULE':
      return { ...state, earningRules: state.earningRules.map(r => r.id === action.rule.id ? action.rule : r) }
    case 'REMOVE_RULE':
      return { ...state, earningRules: state.earningRules.filter(r => r.id !== action.id) }
    case 'ADD_TIER':
      return { ...state, tiers: [...state.tiers, action.tier] }
    case 'UPDATE_TIER':
      return { ...state, tiers: state.tiers.map(t => t.id === action.tier.id ? action.tier : t) }
    case 'REMOVE_TIER':
      return { ...state, tiers: state.tiers.filter(t => t.id !== action.id) }
    case 'REORDER_TIERS':
      return { ...state, tiers: action.tiers }
    case 'ADD_REWARD':
      return { ...state, rewards: [...state.rewards, action.reward] }
    case 'UPDATE_REWARD':
      return { ...state, rewards: state.rewards.map(r => r.id === action.reward.id ? action.reward : r) }
    case 'REMOVE_REWARD':
      return { ...state, rewards: state.rewards.filter(r => r.id !== action.id) }
    case 'SET_SIM':
      return { ...state, simBalance: action.balance, simResult: action.result }
    case 'LOAD':
      return action.state
    default:
      return state
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STEP_LABELS = [
  { label: 'Type' },
  { label: 'Basic Info' },
  { label: 'Earning Rules' },
  { label: 'Tiers' },
  { label: 'Rewards' },
  { label: 'Budget' },
  { label: 'Preview' },
]

// ── Component ─────────────────────────────────────────────────────────────────

interface ProgramWizardProps {
  mode: 'create' | 'edit' | 'view'
  programId?: string
  initialState?: Partial<WizardState>
}

export function ProgramWizard({ mode, programId, initialState }: ProgramWizardProps) {
  const router = useRouter()
  const { getToken } = useAuth()
  const [state, dispatch] = useReducer(wizardReducer, {
    ...INITIAL_STATE,
    ...initialState,
  })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [activateOpen, setActivateOpen] = useState(false)
  const isViewOnly = mode === 'view'

  function goToStep(step: number) {
    dispatch({ type: 'SET_STEP', step })
  }

  const saveDraft = useCallback(async () => {
    setSaving(true)
    setSaveError(null)
    try {
      const token = process.env.NEXT_PUBLIC_PLAYWRIGHT_TEST === 'true' ? null : await getToken()
      const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
      // <input type="date"> returns "YYYY-MM-DD"; API needs ISO datetime
      const toISO = (d: string) => d ? `${d}T00:00:00.000Z` : undefined
      const payload = {
        name: state.name,
        description: state.description,
        type: state.programType ?? undefined,
        startDate: toISO(state.startDate),
        endDate: toISO(state.endDate),
        pointCurrencyName:
          state.currencyName === 'Other (custom)…'
            ? state.currencyCustom
            : state.currencyName,
        budgetUsdCents: state.totalBudget
          ? Math.round(parseFloat(state.totalBudget) * 100)
          : undefined,
      }
      if (programId) {
        const res = await fetch(`${API_URL}/v1/programs/${programId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...authHeader },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as Record<string, unknown>
          setSaveError((body.error ?? body.message ?? 'Save failed') as string)
        }
      } else {
        const res = await fetch(`${API_URL}/v1/programs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeader },
          body: JSON.stringify(payload),
        })
        if (res.ok) {
          const created = await res.json()
          if (created.id) router.replace(`/admin/programs/${created.id}/edit`)
        } else {
          const body = await res.json().catch(() => ({})) as Record<string, unknown>
          setSaveError((body.error ?? body.message ?? 'Save failed') as string)
        }
      }
    } catch {
      setSaveError('Auto-save failed — please try again')
    } finally {
      setSaving(false)
    }
  }, [getToken, programId, router, state])

  async function apiError(res: Response, fallback: string): Promise<never> {
    const body = await res.json().catch(() => ({})) as Record<string, unknown>
    const msg = (body.error ?? body.message ?? fallback) as string
    throw new Error(`${msg} (HTTP ${res.status})`)
  }

  async function handleActivate() {
    setSaving(true)
    setSaveError(null)
    try {
    const token = process.env.NEXT_PUBLIC_PLAYWRIGHT_TEST === 'true' ? null : await getToken()
    const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}

    // Step 1: create program if it doesn't exist yet
    let pid = programId
    if (!pid) {
      const toISO = (d: string) => d ? `${d}T00:00:00.000Z` : undefined
      const res = await fetch(`${API_URL}/v1/programs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({
          name: state.name,
          type: state.programType ?? 'POINTS',
          pointCurrencyName:
            state.currencyName === 'Other (custom)…'
              ? state.currencyCustom
              : state.currencyName,
          startDate: toISO(state.startDate),
          endDate: toISO(state.endDate),
        }),
      })
      if (!res.ok) await apiError(res, 'Failed to create program')
      const created = await res.json()
      pid = created.id as string
    }

    // Step 2: persist earning rules
    for (const rule of state.earningRules) {
      const multiplierVal = rule.action === 'MULTIPLIER'
        ? parseFloat(rule.actionValue.replace('×', '')) || 1
        : 1
      const pointsVal = rule.action === 'AWARD_POINTS'
        ? parseInt(rule.actionValue) || 0
        : 0
      const res = await fetch(`${API_URL}/v1/programs/${pid}/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({
          name: `${rule.trigger} rule`,
          triggerEvent: rule.trigger,
          pointsAwarded: pointsVal,
          multiplier: multiplierVal,
          stackable: rule.stackable,
          priority: rule.priority,
          ...(rule.budgetCapPoints ? { budgetCapPoints: parseInt(rule.budgetCapPoints) } : {}),
          conditions: rule.conditions.length > 0
            ? { logic: rule.conditionLogic, conditions: rule.conditions }
            : undefined,
        }),
      })
      if (!res.ok) await apiError(res, 'Failed to save earning rule')
    }

    // Step 3: persist tiers (TIERED / HYBRID only)
    if (state.programType === 'TIERED' || state.programType === 'HYBRID') {
      for (let i = 0; i < state.tiers.length; i++) {
        const tier = state.tiers[i]
        const res = await fetch(`${API_URL}/v1/programs/${pid}/tiers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeader },
          body: JSON.stringify({
            name: tier.name,
            rank: i + 1,
            icon: tier.icon,
            minPoints: tier.minPoints ? parseInt(tier.minPoints) : 0,
            ...(tier.minSpend ? { minSpendCents: Math.round(parseFloat(tier.minSpend) * 100) } : {}),
            multiplier: parseFloat(tier.multiplier.replace('×', '')) || 1,
            benefits: tier.benefits.split('\n').map(b => b.trim()).filter(Boolean),
          }),
        })
        if (!res.ok) await apiError(res, 'Failed to save tier')
      }
    }

    // Step 4: persist rewards
    const rewardTypeMap: Record<string, string> = {
      'Discount Code': 'DISCOUNT',
      'Free Product': 'FREE_ITEM',
      'Cashback': 'VOUCHER',
      'Gift Card': 'VOUCHER',
      'Experience': 'EXPERIENCE',
    }
    for (const reward of state.rewards) {
      const res = await fetch(`${API_URL}/v1/rewards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({
          programId: pid,
          name: reward.name,
          description: reward.description || undefined,
          pointsCost: parseInt(reward.pointsCost) || 1,
          ...(reward.stock === 'LIMITED' && reward.stockQty
            ? { stock: parseInt(reward.stockQty) }
            : {}),
        }),
      })
      if (!res.ok) await apiError(res, 'Failed to save reward')
    }

    // Step 5: activate
    const res = await fetch(`${API_URL}/v1/programs/${pid}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify({ status: 'ACTIVE' }),
    })
    if (!res.ok) await apiError(res, 'Failed to activate program')

    router.push('/admin/programs')
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Activation failed — please try again')
    } finally {
      setSaving(false)
      setActivateOpen(false)
    }
  }

  // Date range display for header
  const showDateRange = state.name || mode !== 'create'
  const dateRangeText = (() => {
    if (!state.startDate && !state.endDate) return null
    const fmt = (d: string) =>
      new Date(d).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    if (state.startDate && state.endDate)
      return `${fmt(state.startDate)} – ${fmt(state.endDate)}`
    if (state.startDate) return `From ${fmt(state.startDate)} · Ongoing`
    return 'Ongoing'
  })()
  const showDate =
    showDateRange && dateRangeText && (mode !== 'create' || state.step > 2)

  const stepProps: StepProps = {
    state,
    dispatch,
    onNext: () => goToStep(state.step + 1),
    onBack: () => goToStep(state.step - 1),
    onSaveDraft: saveDraft,
    isViewOnly,
  }

  return (
    <div className="max-w-[900px]">
      {/* Breadcrumb + header */}
      <div className="mb-7">
        <div className="mb-1.5 text-xs text-slate-400">
          <Link
            href="/admin/programs"
            className="hover:text-indigo-600 transition-colors"
          >
            Programs
          </Link>
          {' › '}
          <span>
            {mode === 'create'
              ? 'Create New Program'
              : state.name || 'Program'}
          </span>
        </div>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-baseline gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-900">
                {state.name ||
                  (mode === 'create' ? 'Configure Loyalty Program' : 'Program')}
              </h1>
              {showDate && (
                <span className="text-sm text-slate-500 font-normal">
                  {dateRangeText}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {mode === 'create'
                ? 'Complete each step to set up your program. Progress is auto-saved.'
                : mode === 'view'
                  ? 'Viewing program in read-only mode.'
                  : 'Edit your loyalty program configuration.'}
            </p>
          </div>
          {mode === 'view' && programId && (
            <Link
              href={`/admin/programs/${programId}/edit`}
              className="ml-4 shrink-0 rounded-lg border border-indigo-600 px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 transition-colors"
            >
              ✏️ Edit Program
            </Link>
          )}
        </div>
      </div>

      {/* Save error / saving indicator */}
      {saveError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {saveError}
        </div>
      )}
      {saving && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          ✅ Saving draft…
        </div>
      )}

      {/* View-only banner */}
      {isViewOnly && programId && (
        <div className="mb-4">
          <ViewOnlyBanner
            onEdit={() => router.push(`/admin/programs/${programId}/edit`)}
          />
        </div>
      )}

      {/* Stepper */}
      <div className="mb-8 overflow-x-auto pb-2">
        <WizardStepper steps={STEP_LABELS} currentStep={state.step} onStepClick={isViewOnly ? undefined : goToStep} />
      </div>

      {/* Step panels */}
      {state.step === 1 && <Step1Type {...stepProps} />}
      {state.step === 2 && <Step2BasicInfo {...stepProps} />}
      {state.step === 3 && <Step3EarningRules {...stepProps} />}
      {state.step === 4 && <Step4Tiers {...stepProps} />}
      {state.step === 5 && <Step5Rewards {...stepProps} />}
      {state.step === 6 && <Step6Budget {...stepProps} />}
      {state.step === 7 && (
        <Step7Preview {...stepProps} onActivate={() => setActivateOpen(true)} />
      )}

      {/* Activate modal */}
      <ActivateModal
        open={activateOpen}
        onClose={() => setActivateOpen(false)}
        onConfirm={handleActivate}
        programName={state.name}
      />
    </div>
  )
}

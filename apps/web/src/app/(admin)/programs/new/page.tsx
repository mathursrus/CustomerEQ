'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

interface EarningRule {
  triggerEvent: string
  pointsAwarded: number
  multiplier: number
}

interface FormData {
  name: string
  description: string
  pointCurrencyName: string
  pointsPerDollar: number
  earningRules: EarningRule[]
  activateImmediately: boolean
}

const STEPS = ['Basic Info', 'Point Settings', 'Earning Rules', 'Review & Activate']

function StepIndicator({ current, steps }: { current: number; steps: string[] }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-colors ${
                i < current
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : i === current
                  ? 'border-indigo-600 text-indigo-600 bg-white'
                  : 'border-gray-300 text-gray-400 bg-white'
              }`}
            >
              {i < current ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              ) : (
                i + 1
              )}
            </div>
            <span className={`mt-1 text-xs font-medium whitespace-nowrap ${i === current ? 'text-indigo-600' : 'text-gray-400'}`}>
              {step}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`h-0.5 w-16 mt-[-12px] ${i < current ? 'bg-indigo-600' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

export default function NewProgramPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormData>({
    name: '',
    description: '',
    pointCurrencyName: 'Points',
    pointsPerDollar: 100,
    earningRules: [],
    activateImmediately: false,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  function validateStep(s: number): Record<string, string> {
    const errs: Record<string, string> = {}
    if (s === 0 && !form.name.trim()) errs.name = 'Program name is required'
    if (s === 1) {
      if (!form.pointCurrencyName.trim()) errs.pointCurrencyName = 'Currency name is required'
      if (form.pointsPerDollar <= 0) errs.pointsPerDollar = 'Must be greater than 0'
    }
    return errs
  }

  function handleNext() {
    const errs = validateStep(step)
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setErrors({})
    setStep((s) => s + 1)
  }

  function addEarningRule() {
    setForm((f) => ({
      ...f,
      earningRules: [...f.earningRules, { triggerEvent: '', pointsAwarded: 0, multiplier: 1 }],
    }))
  }

  function updateRule(index: number, field: keyof EarningRule, value: string | number) {
    setForm((f) => {
      const rules = [...f.earningRules]
      rules[index] = { ...rules[index], [field]: value }
      return { ...f, earningRules: rules }
    })
  }

  function removeRule(index: number) {
    setForm((f) => ({ ...f, earningRules: f.earningRules.filter((_, i) => i !== index) }))
  }

  async function handleSubmit() {
    setServerError(null)
    setSubmitting(true)
    try {
      const payload = {
        name: form.name,
        description: form.description,
        pointCurrencyName: form.pointCurrencyName,
        pointsPerDollar: form.pointsPerDollar,
        earningRules: form.earningRules,
      }
      const res = await fetch(`${API_URL}/v1/programs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.message ?? `Failed with status ${res.status}`)
      }
      const created = await res.json()
      const programId: string = created.id ?? created.program?.id

      if (form.activateImmediately && programId) {
        await fetch(`${API_URL}/v1/programs/${programId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'ACTIVE' }),
        })
      }

      router.push('/admin/programs')
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Create Program</h1>
        <p className="mt-1 text-sm text-gray-500">Set up a new loyalty program for your customers</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-8">
        <StepIndicator current={step} steps={STEPS} />

        {/* Step 0: Basic Info */}
        {step === 0 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-gray-900">Basic Information</h2>
            <div>
              <label htmlFor="programName" className="block text-sm font-medium text-gray-700 mb-1">
                Program Name <span className="text-red-500">*</span>
              </label>
              <input
                id="programName"
                type="text"
                data-testid="wizard-program-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.name ? 'border-red-400' : 'border-gray-300'}`}
                placeholder="e.g. Gold Rewards Program"
              />
              {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
            </div>
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Description <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Describe your loyalty program..."
              />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                data-testid="wizard-next-btn"
                onClick={handleNext}
                className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Step 1: Point Settings */}
        {step === 1 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-gray-900">Point Settings</h2>
            <div>
              <label htmlFor="currencyName" className="block text-sm font-medium text-gray-700 mb-1">
                Point Currency Name
              </label>
              <input
                id="currencyName"
                type="text"
                data-testid="wizard-currency-name"
                value={form.pointCurrencyName}
                onChange={(e) => setForm((f) => ({ ...f, pointCurrencyName: e.target.value }))}
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.pointCurrencyName ? 'border-red-400' : 'border-gray-300'}`}
                placeholder="Points"
              />
              {errors.pointCurrencyName && <p className="mt-1 text-xs text-red-600">{errors.pointCurrencyName}</p>}
            </div>
            <div>
              <label htmlFor="pointsPerDollar" className="block text-sm font-medium text-gray-700 mb-1">
                Points per Dollar
              </label>
              <input
                id="pointsPerDollar"
                type="number"
                data-testid="wizard-points-per-dollar"
                value={form.pointsPerDollar}
                min={1}
                onChange={(e) => setForm((f) => ({ ...f, pointsPerDollar: Number(e.target.value) }))}
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.pointsPerDollar ? 'border-red-400' : 'border-gray-300'}`}
              />
              {errors.pointsPerDollar && <p className="mt-1 text-xs text-red-600">{errors.pointsPerDollar}</p>}
            </div>
            <div className="flex justify-between">
              <button type="button" onClick={() => setStep(0)} className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                Back
              </button>
              <button
                type="button"
                data-testid="wizard-next-btn"
                onClick={handleNext}
                className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Earning Rules */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Earning Rules</h2>
              <span className="text-sm text-gray-400">Optional for MVP</span>
            </div>

            {form.earningRules.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center border border-dashed border-gray-300 rounded-lg">
                No earning rules added. You can skip this step.
              </p>
            ) : (
              <div className="space-y-4">
                {form.earningRules.map((rule, i) => (
                  <div key={i} className="rounded-lg border border-gray-200 p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">Rule {i + 1}</span>
                      <button type="button" onClick={() => removeRule(i)} className="text-xs text-red-500 hover:text-red-700">
                        Remove
                      </button>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Trigger Event</label>
                      <input
                        type="text"
                        value={rule.triggerEvent}
                        onChange={(e) => updateRule(i, 'triggerEvent', e.target.value)}
                        className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="e.g. purchase"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Points Awarded</label>
                        <input
                          type="number"
                          value={rule.pointsAwarded}
                          min={0}
                          onChange={(e) => updateRule(i, 'pointsAwarded', Number(e.target.value))}
                          className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Multiplier</label>
                        <input
                          type="number"
                          value={rule.multiplier}
                          min={0.1}
                          step={0.1}
                          onChange={(e) => updateRule(i, 'multiplier', Number(e.target.value))}
                          className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={addEarningRule}
              className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add rule
            </button>

            <div className="flex justify-between">
              <button type="button" onClick={() => setStep(1)} className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                Back
              </button>
              <button
                type="button"
                data-testid="wizard-next-btn"
                onClick={() => setStep(3)}
                className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Review & Activate */}
        {step === 3 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-gray-900">Review & Activate</h2>

            {serverError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {serverError}
              </div>
            )}

            <div className="rounded-lg border border-gray-200 divide-y divide-gray-100">
              <div className="px-4 py-3 flex justify-between">
                <span className="text-sm font-medium text-gray-500">Program Name</span>
                <span className="text-sm text-gray-900">{form.name}</span>
              </div>
              {form.description && (
                <div className="px-4 py-3 flex justify-between">
                  <span className="text-sm font-medium text-gray-500">Description</span>
                  <span className="text-sm text-gray-900 max-w-xs text-right">{form.description}</span>
                </div>
              )}
              <div className="px-4 py-3 flex justify-between">
                <span className="text-sm font-medium text-gray-500">Currency Name</span>
                <span className="text-sm text-gray-900">{form.pointCurrencyName}</span>
              </div>
              <div className="px-4 py-3 flex justify-between">
                <span className="text-sm font-medium text-gray-500">Points per Dollar</span>
                <span className="text-sm text-gray-900">{form.pointsPerDollar}</span>
              </div>
              <div className="px-4 py-3 flex justify-between">
                <span className="text-sm font-medium text-gray-500">Earning Rules</span>
                <span className="text-sm text-gray-900">{form.earningRules.length} rule(s)</span>
              </div>
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                data-testid="wizard-activate-checkbox"
                checked={form.activateImmediately}
                onChange={(e) => setForm((f) => ({ ...f, activateImmediately: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm font-medium text-gray-700">Activate Immediately</span>
            </label>

            <div className="flex justify-between">
              <button type="button" onClick={() => setStep(2)} className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                Back
              </button>
              <button
                type="button"
                data-testid="wizard-submit-btn"
                onClick={handleSubmit}
                disabled={submitting}
                className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? 'Creating...' : 'Create Program'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { API_URL } from '@/lib/config'

interface Program {
  id: string
  name: string
}

interface FormData {
  name: string
  programId: string
  triggerType: string
  conditionField: string
  conditionOperator: string
  conditionValue: string
  actionType: string
  actionPoints: string
  actionMessage: string
  budgetCap: string
  startDate: string
}

export default function NewCampaignPage() {
  const router = useRouter()
  const [programs, setPrograms] = useState<Program[]>([])
  const [form, setForm] = useState<FormData>({
    name: '',
    programId: '',
    triggerType: '',
    conditionField: '',
    conditionOperator: '',
    conditionValue: '',
    actionType: '',
    actionPoints: '',
    actionMessage: '',
    budgetCap: '',
    startDate: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${API_URL}/v1/programs`)
      .then((r) => r.json())
      .then((d) => setPrograms(d.programs ?? d ?? []))
      .catch(() => {})
  }, [])

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {}
    if (!form.name.trim()) errs.name = 'Campaign name is required'
    if (!form.programId) errs.programId = 'Please select a program'
    if (!form.triggerType) errs.triggerType = 'Please select a trigger type'
    if (!form.actionType) errs.actionType = 'Please select an action type'
    if (form.actionType === 'award_points' && (!form.actionPoints || Number(form.actionPoints) <= 0)) {
      errs.actionPoints = 'Points must be greater than 0'
    }
    if (form.actionType === 'send_message' && !form.actionMessage.trim()) {
      errs.actionMessage = 'Message is required'
    }
    if (!form.startDate) errs.startDate = 'Start date is required'
    return errs
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setErrors({})
    setSubmitting(true)

    try {
      const payload = {
        name: form.name,
        programId: form.programId,
        triggerType: form.triggerType,
        triggerCondition: form.conditionField
          ? { field: form.conditionField, operator: form.conditionOperator, value: form.conditionValue }
          : undefined,
        actionType: form.actionType,
        actionConfig: form.actionType === 'award_points'
          ? { points: Number(form.actionPoints) }
          : { message: form.actionMessage },
        budgetCap: form.budgetCap ? Number(form.budgetCap) : undefined,
        startDate: form.startDate,
      }

      const res = await fetch(`${API_URL}/v1/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.message ?? `Failed with status ${res.status}`)
      }
      router.push('/admin/campaigns')
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Create Campaign</h1>
        <p className="mt-1 text-sm text-gray-500">Build a CX-triggered loyalty campaign</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-8">
        {serverError && (
          <div className="mb-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {/* Campaign Name */}
          <div>
            <label htmlFor="campaignName" className="block text-sm font-medium text-gray-700 mb-1">
              Campaign Name <span className="text-red-500">*</span>
            </label>
            <input
              id="campaignName"
              type="text"
              data-testid="campaign-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.name ? 'border-red-400' : 'border-gray-300'}`}
              placeholder="e.g. NPS Detractor Recovery"
            />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
          </div>

          {/* Select Program */}
          <div>
            <label htmlFor="campaignProgram" className="block text-sm font-medium text-gray-700 mb-1">
              Program <span className="text-red-500">*</span>
            </label>
            <select
              id="campaignProgram"
              data-testid="campaign-program-select"
              value={form.programId}
              onChange={(e) => setForm((f) => ({ ...f, programId: e.target.value }))}
              className={`w-full rounded-lg border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.programId ? 'border-red-400' : 'border-gray-300'}`}
            >
              <option value="">Select a program</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {errors.programId && <p className="mt-1 text-xs text-red-600">{errors.programId}</p>}
          </div>

          {/* Trigger Type */}
          <div>
            <label htmlFor="triggerType" className="block text-sm font-medium text-gray-700 mb-1">
              Trigger Type <span className="text-red-500">*</span>
            </label>
            <select
              id="triggerType"
              data-testid="campaign-trigger-type"
              value={form.triggerType}
              onChange={(e) => setForm((f) => ({ ...f, triggerType: e.target.value }))}
              className={`w-full rounded-lg border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.triggerType ? 'border-red-400' : 'border-gray-300'}`}
            >
              <option value="">Select trigger type</option>
              <option value="cx.nps_submitted">cx.nps_submitted</option>
              <option value="cx.ticket_resolved">cx.ticket_resolved</option>
              <option value="purchase">purchase</option>
            </select>
            {errors.triggerType && <p className="mt-1 text-xs text-red-600">{errors.triggerType}</p>}
          </div>

          {/* Trigger Condition */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Trigger Condition <span className="text-gray-400 font-normal">(optional)</span></p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label htmlFor="conditionField" className="block text-xs text-gray-500 mb-1">Field</label>
                <input
                  id="conditionField"
                  type="text"
                  data-testid="campaign-condition-field"
                  value={form.conditionField}
                  onChange={(e) => setForm((f) => ({ ...f, conditionField: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. score"
                />
              </div>
              <div>
                <label htmlFor="conditionOp" className="block text-xs text-gray-500 mb-1">Operator</label>
                <select
                  id="conditionOp"
                  data-testid="campaign-condition-op"
                  value={form.conditionOperator}
                  onChange={(e) => setForm((f) => ({ ...f, conditionOperator: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">—</option>
                  <option value="lt">lt (&lt;)</option>
                  <option value="lte">lte (&le;)</option>
                  <option value="gt">gt (&gt;)</option>
                  <option value="gte">gte (&ge;)</option>
                  <option value="eq">eq (=)</option>
                </select>
              </div>
              <div>
                <label htmlFor="conditionValue" className="block text-xs text-gray-500 mb-1">Value</label>
                <input
                  id="conditionValue"
                  type="text"
                  data-testid="campaign-condition-value"
                  value={form.conditionValue}
                  onChange={(e) => setForm((f) => ({ ...f, conditionValue: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. 6"
                />
              </div>
            </div>
          </div>

          {/* Action Type */}
          <div>
            <label htmlFor="actionType" className="block text-sm font-medium text-gray-700 mb-1">
              Action Type <span className="text-red-500">*</span>
            </label>
            <select
              id="actionType"
              data-testid="campaign-action-type"
              value={form.actionType}
              onChange={(e) => setForm((f) => ({ ...f, actionType: e.target.value }))}
              className={`w-full rounded-lg border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.actionType ? 'border-red-400' : 'border-gray-300'}`}
            >
              <option value="">Select action type</option>
              <option value="award_points">Award Points</option>
              <option value="send_message">Send Message</option>
            </select>
            {errors.actionType && <p className="mt-1 text-xs text-red-600">{errors.actionType}</p>}
          </div>

          {/* Conditional Action Fields */}
          {form.actionType === 'award_points' && (
            <div>
              <label htmlFor="actionPoints" className="block text-sm font-medium text-gray-700 mb-1">
                Points to Award <span className="text-red-500">*</span>
              </label>
              <input
                id="actionPoints"
                type="number"
                data-testid="campaign-action-points"
                value={form.actionPoints}
                min={1}
                onChange={(e) => setForm((f) => ({ ...f, actionPoints: e.target.value }))}
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.actionPoints ? 'border-red-400' : 'border-gray-300'}`}
                placeholder="e.g. 500"
              />
              {errors.actionPoints && <p className="mt-1 text-xs text-red-600">{errors.actionPoints}</p>}
            </div>
          )}

          {form.actionType === 'send_message' && (
            <div>
              <label htmlFor="actionMessage" className="block text-sm font-medium text-gray-700 mb-1">
                Message <span className="text-red-500">*</span>
              </label>
              <textarea
                id="actionMessage"
                data-testid="campaign-action-message"
                value={form.actionMessage}
                onChange={(e) => setForm((f) => ({ ...f, actionMessage: e.target.value }))}
                rows={3}
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.actionMessage ? 'border-red-400' : 'border-gray-300'}`}
                placeholder="e.g. Thank you for your feedback! Here are 200 bonus points."
              />
              {errors.actionMessage && <p className="mt-1 text-xs text-red-600">{errors.actionMessage}</p>}
            </div>
          )}

          {/* Budget Cap */}
          <div>
            <label htmlFor="budgetCap" className="block text-sm font-medium text-gray-700 mb-1">
              Budget Cap <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              id="budgetCap"
              type="number"
              data-testid="campaign-budget-cap"
              value={form.budgetCap}
              min={0}
              onChange={(e) => setForm((f) => ({ ...f, budgetCap: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. 10000"
            />
          </div>

          {/* Start Date */}
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
              Start Date <span className="text-red-500">*</span>
            </label>
            <input
              id="startDate"
              type="date"
              data-testid="campaign-start-date"
              value={form.startDate}
              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.startDate ? 'border-red-400' : 'border-gray-300'}`}
            />
            {errors.startDate && <p className="mt-1 text-xs text-red-600">{errors.startDate}</p>}
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              data-testid="campaign-submit-btn"
              disabled={submitting}
              className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Creating...' : 'Create Campaign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

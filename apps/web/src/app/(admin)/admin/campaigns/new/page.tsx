'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { API_URL, getAuthToken } from '@/lib/config'

interface Program {
  id: string
  name: string
}

interface SpinSegment {
  rewardId?: string
  points: number
  probability: number
  label: string
  color: string
}

const DEFAULT_COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16']

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
  segments: SpinSegment[]
  wheelStyle: 'classic' | 'neon' | 'minimal'
}

export default function NewCampaignPage() {
  const router = useRouter()
  const { getToken } = useAuth()
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
    segments: [
      { points: 500, probability: 40, label: '500 Points!', color: '#4F46E5' },
      { points: 100, probability: 60, label: '100 Points', color: '#10B981' },
    ],
    wheelStyle: 'classic' as const,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    const fetchPrograms = async () => {
      const token = await getAuthToken(getToken)
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(`${API_URL}/v1/programs`, { headers })
      const d = await res.json()
      setPrograms(d.data ?? d.programs ?? [])
    }
    fetchPrograms().catch(() => {})
  }, [getToken])

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
    if (form.actionType === 'spin_wheel') {
      if (form.segments.length < 2) errs.segments = 'Wheel must have at least 2 segments'
      if (form.segments.length > 8) errs.segments = 'Wheel can have at most 8 segments'
      const probSum = form.segments.reduce((s, seg) => s + seg.probability, 0)
      if (Math.abs(probSum - 100) > 0.01) errs.segments = `Probabilities must sum to 100% (currently ${probSum.toFixed(1)}%)`
      if (form.segments.some((s) => !s.label.trim())) errs.segments = 'All segments must have a label'
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
      const token = await getAuthToken(getToken)
      const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
      const payload = {
        name: form.name,
        programId: form.programId,
        triggerType: form.triggerType,
        triggerCondition: form.conditionField
          ? { field: form.conditionField, op: form.conditionOperator, value: form.conditionValue }
          : undefined,
        actionType: form.actionType,
        actionConfig: form.actionType === 'spin_wheel'
          ? { segments: form.segments, wheelStyle: form.wheelStyle }
          : form.actionType === 'award_points'
            ? { points: Number(form.actionPoints) }
            : { message: form.actionMessage },
        budgetCap: form.budgetCap ? Number(form.budgetCap) : undefined,
        startDate: form.startDate ? new Date(form.startDate).toISOString() : form.startDate,
      }

      const res = await fetch(`${API_URL}/v1/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
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
              <option value="spin_wheel">Spin Wheel</option>
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

          {/* Spin Wheel Segment Builder */}
          {form.actionType === 'spin_wheel' && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">
                Wheel Segments <span className="text-red-500">*</span>
              </p>
              <div className="space-y-2">
                {form.segments.map((seg, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <input
                      type="color"
                      value={seg.color}
                      onChange={(e) => {
                        const updated = [...form.segments]
                        updated[idx] = { ...updated[idx], color: e.target.value }
                        setForm((f) => ({ ...f, segments: updated }))
                      }}
                      className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
                      data-testid={`segment-color-${idx}`}
                    />
                    <input
                      type="text"
                      value={seg.label}
                      onChange={(e) => {
                        const updated = [...form.segments]
                        updated[idx] = { ...updated[idx], label: e.target.value }
                        setForm((f) => ({ ...f, segments: updated }))
                      }}
                      className="flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Label"
                      data-testid={`segment-label-${idx}`}
                    />
                    <input
                      type="number"
                      value={seg.points}
                      min={0}
                      onChange={(e) => {
                        const updated = [...form.segments]
                        updated[idx] = { ...updated[idx], points: Number(e.target.value) }
                        setForm((f) => ({ ...f, segments: updated }))
                      }}
                      className="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Points"
                      data-testid={`segment-points-${idx}`}
                    />
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={seg.probability}
                        min={0}
                        max={100}
                        onChange={(e) => {
                          const updated = [...form.segments]
                          updated[idx] = { ...updated[idx], probability: Number(e.target.value) }
                          setForm((f) => ({ ...f, segments: updated }))
                        }}
                        className="w-16 rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        data-testid={`segment-prob-${idx}`}
                      />
                      <span className="text-xs text-gray-500">%</span>
                    </div>
                    {form.segments.length > 2 && (
                      <button
                        type="button"
                        onClick={() => {
                          const updated = form.segments.filter((_, i) => i !== idx)
                          setForm((f) => ({ ...f, segments: updated }))
                        }}
                        className="w-7 h-7 rounded border border-red-200 bg-red-50 text-red-500 text-sm flex items-center justify-center hover:bg-red-100"
                        data-testid={`segment-remove-${idx}`}
                      >
                        &times;
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {form.segments.length < 8 && (
                <button
                  type="button"
                  onClick={() => {
                    const nextColor = DEFAULT_COLORS[form.segments.length % DEFAULT_COLORS.length]
                    setForm((f) => ({
                      ...f,
                      segments: [...f.segments, { points: 100, probability: 0, label: '', color: nextColor }],
                    }))
                  }}
                  className="mt-2 w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
                  data-testid="add-segment-btn"
                >
                  + Add Segment
                </button>
              )}
              {(() => {
                const sum = form.segments.reduce((s, seg) => s + seg.probability, 0)
                const isValid = Math.abs(sum - 100) < 0.01
                return (
                  <p className={`mt-2 text-xs text-right ${isValid ? 'text-green-600' : 'text-red-600'}`}>
                    Total: {sum.toFixed(1)}% {isValid ? '\u2713' : '(must be 100%)'}
                  </p>
                )
              })()}
              {errors.segments && <p className="mt-1 text-xs text-red-600">{errors.segments}</p>}

              {/* Wheel Style */}
              <div className="mt-4">
                <p className="text-xs font-medium text-gray-500 mb-2">Style</p>
                <div className="flex gap-2">
                  {(['classic', 'neon', 'minimal'] as const).map((style) => (
                    <button
                      key={style}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, wheelStyle: style }))}
                      className={`flex-1 py-2 px-3 rounded-lg border text-sm capitalize transition-colors ${
                        form.wheelStyle === style
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </div>
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

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import { API_URL, getAuthToken } from '@/lib/config'
import {
  ConditionBuilder,
  type Condition,
  type AvailableField,
} from '@/components/ui/condition-builder'

/* ─── Types ────────────────────────────────────────────────────────────── */

interface SupportRule {
  id: string
  name: string
  description?: string | null
  status: string
  priority: number
  intentFilters: string[]
  tierFilters: string[]
  healthScoreMin?: number | null
  healthScoreMax?: number | null
  topicFilters: string[]
  conditions: { operator?: 'AND' | 'OR'; conditions?: Condition[] }
  autoRespondArticleId?: string | null
  escalateToAssignee?: string | null
  awardPoints?: number | null
  triggerSurveyId?: string | null
  createdAt: string
}

interface ActionConfig {
  autoRespond: boolean
  autoRespondArticleId: string
  escalate: boolean
  escalateToAssignee: string
  awardPoints: boolean
  awardPointsAmount: number
  triggerSurvey: boolean
  triggerSurveyId: string
}

const CONDITION_FIELDS: AvailableField[] = [
  { key: 'intent', label: 'Intent', type: 'string' },
  { key: 'tier', label: 'Tier', type: 'string' },
  { key: 'tierRank', label: 'Tier Rank', type: 'number' },
  { key: 'healthScore', label: 'Health Score', type: 'number' },
  { key: 'topic', label: 'Topic', type: 'string' },
  { key: 'sentiment', label: 'Sentiment', type: 'number' },
  { key: 'messageCount', label: 'Message Count', type: 'number' },
]

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  PAUSED: 'bg-yellow-100 text-yellow-800',
}

/* ─── Helpers ──────────────────────────────────────────────────────────── */

function actionBadges(rule: SupportRule) {
  const badges: { label: string; color: string }[] = []
  if (rule.autoRespondArticleId) badges.push({ label: 'Auto-respond', color: 'text-blue-700 bg-blue-50' })
  if (rule.escalateToAssignee) badges.push({ label: 'Escalate', color: 'text-red-700 bg-red-50' })
  if (rule.awardPoints) badges.push({ label: 'Award points', color: 'text-amber-700 bg-amber-50' })
  if (rule.triggerSurveyId) badges.push({ label: 'Trigger survey', color: 'text-purple-700 bg-purple-50' })
  return badges
}

function conditionsSummary(rule: SupportRule): string {
  const parts: string[] = []
  if (rule.intentFilters?.length) parts.push(`intent in [${rule.intentFilters.join(', ')}]`)
  if (rule.tierFilters?.length) parts.push(`tier in [${rule.tierFilters.join(', ')}]`)
  if (rule.healthScoreMin != null) parts.push(`healthScore >= ${rule.healthScoreMin}`)
  if (rule.healthScoreMax != null) parts.push(`healthScore <= ${rule.healthScoreMax}`)
  if (rule.topicFilters?.length) parts.push(`topic in [${rule.topicFilters.join(', ')}]`)
  const conds = rule.conditions?.conditions
  if (conds && Array.isArray(conds)) {
    const op = rule.conditions.operator ?? 'AND'
    conds.forEach((c) => parts.push(`${c.field} ${c.op} ${c.value}`))
    if (parts.length > 1) return parts.join(` ${op} `)
  }
  return parts.join(' AND ') || 'No conditions'
}

const emptyActions: ActionConfig = {
  autoRespond: false,
  autoRespondArticleId: '',
  escalate: false,
  escalateToAssignee: '',
  awardPoints: false,
  awardPointsAmount: 0,
  triggerSurvey: false,
  triggerSurveyId: '',
}

/* ─── Component ────────────────────────────────────────────────────────── */

export default function SupportRulesPage() {
  const { getToken } = useAuth()
  const [rules, setRules] = useState<SupportRule[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingRule, setEditingRule] = useState<SupportRule | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState(50)
  const [status, setStatus] = useState<'ACTIVE' | 'PAUSED'>('ACTIVE')
  const [conditionOp, setConditionOp] = useState<'AND' | 'OR'>('AND')
  const [conditions, setConditions] = useState<Condition[]>([
    { field: 'intent', op: 'eq', value: '' },
  ])
  const [actions, setActions] = useState<ActionConfig>({ ...emptyActions })

  const loadRules = useCallback(async () => {
    const token = await getAuthToken(getToken)
    try {
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(`${API_URL}/v1/support/rules`, { cache: 'no-store', headers })
      if (!res.ok) return
      const data = await res.json()
      setRules(data.rules ?? [])
    } catch {
      // ignore
    }
  }, [getToken])

  useEffect(() => {
    loadRules()
  }, [loadRules])

  function resetForm() {
    setName('')
    setDescription('')
    setPriority(50)
    setStatus('ACTIVE')
    setConditionOp('AND')
    setConditions([{ field: 'intent', op: 'eq', value: '' }])
    setActions({ ...emptyActions })
    setEditingRule(null)
  }

  function openCreate() {
    resetForm()
    setShowForm(true)
  }

  function openEdit(rule: SupportRule) {
    setEditingRule(rule)
    setName(rule.name)
    setDescription(rule.description ?? '')
    setPriority(rule.priority)
    setStatus(rule.status as 'ACTIVE' | 'PAUSED')
    setConditionOp(rule.conditions?.operator ?? 'AND')
    setConditions(
      rule.conditions?.conditions?.length
        ? rule.conditions.conditions
        : [{ field: 'intent', op: 'eq', value: '' }],
    )
    setActions({
      autoRespond: !!rule.autoRespondArticleId,
      autoRespondArticleId: rule.autoRespondArticleId ?? '',
      escalate: !!rule.escalateToAssignee,
      escalateToAssignee: rule.escalateToAssignee ?? '',
      awardPoints: !!rule.awardPoints,
      awardPointsAmount: rule.awardPoints ?? 0,
      triggerSurvey: !!rule.triggerSurveyId,
      triggerSurveyId: rule.triggerSurveyId ?? '',
    })
    setShowForm(true)
  }

  async function saveRule() {
    setSaving(true)
    try {
      const token = await getAuthToken(getToken)
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers.Authorization = `Bearer ${token}`

      const body = {
        name,
        description: description || undefined,
        priority,
        status,
        intentFilters: [] as string[],
        tierFilters: [] as string[],
        topicFilters: [] as string[],
        conditions: { operator: conditionOp, conditions },
        autoRespondArticleId: actions.autoRespond ? actions.autoRespondArticleId || undefined : undefined,
        escalateToAssignee: actions.escalate ? actions.escalateToAssignee || undefined : undefined,
        awardPoints: actions.awardPoints ? actions.awardPointsAmount || undefined : undefined,
        triggerSurveyId: actions.triggerSurvey ? actions.triggerSurveyId || undefined : undefined,
      }

      const url = editingRule
        ? `${API_URL}/v1/support/rules/${editingRule.id}`
        : `${API_URL}/v1/support/rules`
      const method = editingRule ? 'PUT' : 'POST'

      const res = await fetch(url, { method, headers, body: JSON.stringify(body) })
      if (res.ok) {
        setShowForm(false)
        resetForm()
        await loadRules()
      }
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  async function deleteRule(id: string) {
    const token = await getAuthToken(getToken)
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
    try {
      await fetch(`${API_URL}/v1/support/rules/${id}`, { method: 'DELETE', headers })
      await loadRules()
    } catch {
      // ignore
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Support Rules</h1>
          <p className="mt-1 text-sm text-gray-500">
            Configure automated responses and actions for incoming support messages
          </p>
        </div>
        <button
          onClick={openCreate}
          className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
        >
          + Create Rule
        </button>
      </div>

      {/* Rules Table */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Priority</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Conditions</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rules.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                  No support rules yet. Create your first rule to get started.
                </td>
              </tr>
            ) : (
              rules.map((rule) => (
                <tr key={rule.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{rule.name}</td>
                  <td className="px-4 py-3 text-gray-600">{rule.priority}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        statusColors[rule.status] ?? 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {rule.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">
                    {conditionsSummary(rule)}
                  </td>
                  <td className="px-4 py-3">
                    {actionBadges(rule).map((b) => (
                      <span
                        key={b.label}
                        className={`inline-flex items-center text-xs rounded px-1.5 py-0.5 mr-1 ${b.color}`}
                      >
                        {b.label}
                      </span>
                    ))}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => openEdit(rule)}
                      className="text-sm text-gray-400 hover:text-gray-600"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteRule(rule.id)}
                      className="text-sm text-red-400 hover:text-red-600"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            {editingRule ? 'Edit Support Rule' : 'Create Support Rule'}
          </h2>

          <div className="space-y-6">
            {/* Name + Priority + Status */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rule Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="e.g., VIP Billing Escalation"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority (1-100)</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={priority}
                  onChange={(e) => setPriority(parseInt(e.target.value, 10) || 50)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'PAUSED')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="PAUSED">PAUSED</option>
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Brief description of what this rule does"
              />
            </div>

            {/* Condition Builder */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Match Conditions</label>
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <ConditionBuilder
                  operator={conditionOp}
                  conditions={conditions}
                  availableFields={CONDITION_FIELDS}
                  onOperatorChange={setConditionOp}
                  onConditionsChange={setConditions}
                />
              </div>
            </div>

            {/* Actions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Actions (executed in order)</label>
              <div className="space-y-3">
                {/* Auto-respond */}
                {actions.autoRespond && (
                  <div className="border border-gray-200 rounded-lg p-4 bg-white">
                    <div className="flex items-center justify-between mb-2">
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-blue-700">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                        </svg>
                        Auto-respond
                      </span>
                      <button
                        type="button"
                        onClick={() => setActions((a) => ({ ...a, autoRespond: false, autoRespondArticleId: '' }))}
                        className="text-red-400 hover:text-red-600 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">KB Article ID</label>
                      <input
                        type="text"
                        value={actions.autoRespondArticleId}
                        onChange={(e) => setActions((a) => ({ ...a, autoRespondArticleId: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm mt-1"
                        placeholder="KB article ID for auto-response"
                      />
                    </div>
                  </div>
                )}

                {/* Escalate */}
                {actions.escalate && (
                  <div className="border border-gray-200 rounded-lg p-4 bg-white">
                    <div className="flex items-center justify-between mb-2">
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-red-700">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        Escalate
                      </span>
                      <button
                        type="button"
                        onClick={() => setActions((a) => ({ ...a, escalate: false, escalateToAssignee: '' }))}
                        className="text-red-400 hover:text-red-600 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Assignee Email</label>
                      <input
                        type="text"
                        value={actions.escalateToAssignee}
                        onChange={(e) => setActions((a) => ({ ...a, escalateToAssignee: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm mt-1"
                        placeholder="team@example.com"
                      />
                    </div>
                  </div>
                )}

                {/* Award Points */}
                {actions.awardPoints && (
                  <div className="border border-gray-200 rounded-lg p-4 bg-white">
                    <div className="flex items-center justify-between mb-2">
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-amber-700">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Award Points
                      </span>
                      <button
                        type="button"
                        onClick={() => setActions((a) => ({ ...a, awardPoints: false, awardPointsAmount: 0 }))}
                        className="text-red-400 hover:text-red-600 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Points Amount</label>
                      <input
                        type="number"
                        min={0}
                        value={actions.awardPointsAmount}
                        onChange={(e) => setActions((a) => ({ ...a, awardPointsAmount: parseInt(e.target.value, 10) || 0 }))}
                        className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm mt-1"
                        placeholder="100"
                      />
                    </div>
                  </div>
                )}

                {/* Trigger Survey */}
                {actions.triggerSurvey && (
                  <div className="border border-gray-200 rounded-lg p-4 bg-white">
                    <div className="flex items-center justify-between mb-2">
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-purple-700">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        Trigger Survey
                      </span>
                      <button
                        type="button"
                        onClick={() => setActions((a) => ({ ...a, triggerSurvey: false, triggerSurveyId: '' }))}
                        className="text-red-400 hover:text-red-600 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Survey ID</label>
                      <input
                        type="text"
                        value={actions.triggerSurveyId}
                        onChange={(e) => setActions((a) => ({ ...a, triggerSurveyId: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm mt-1"
                        placeholder="Survey ID"
                      />
                    </div>
                  </div>
                )}

                {/* Add action buttons */}
                <div className="flex gap-2">
                  {!actions.autoRespond && (
                    <button
                      type="button"
                      onClick={() => setActions((a) => ({ ...a, autoRespond: true }))}
                      className="text-sm text-indigo-600 font-medium border border-indigo-200 rounded-lg px-3 py-1.5 hover:bg-indigo-50"
                    >
                      + Auto-respond
                    </button>
                  )}
                  {!actions.escalate && (
                    <button
                      type="button"
                      onClick={() => setActions((a) => ({ ...a, escalate: true }))}
                      className="text-sm text-red-600 font-medium border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50"
                    >
                      + Escalate
                    </button>
                  )}
                  {!actions.awardPoints && (
                    <button
                      type="button"
                      onClick={() => setActions((a) => ({ ...a, awardPoints: true }))}
                      className="text-sm text-amber-600 font-medium border border-amber-200 rounded-lg px-3 py-1.5 hover:bg-amber-50"
                    >
                      + Award Points
                    </button>
                  )}
                  {!actions.triggerSurvey && (
                    <button
                      type="button"
                      onClick={() => setActions((a) => ({ ...a, triggerSurvey: true }))}
                      className="text-sm text-purple-600 font-medium border border-purple-200 rounded-lg px-3 py-1.5 hover:bg-purple-50"
                    >
                      + Trigger Survey
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Save buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => { setShowForm(false); resetForm() }}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveRule}
                disabled={saving || !name.trim()}
                className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors"
              >
                {saving ? 'Saving...' : editingRule ? 'Update Rule' : 'Save Rule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@clerk/nextjs'
import { API_URL, getAuthToken } from '@/lib/config'

interface AssignmentRule {
  topic: string
  assignee: string
}

interface FormData {
  name: string
  status: 'ACTIVE' | 'PAUSED'
  surveyTypes: string[]
  scoreMin: string
  scoreMax: string
  sentimentThreshold: string
  topicFilters: string
  slackWebhookUrl: string
  slackChannelName: string
  emailRecipients: string
  teamsWebhookUrl: string
  defaultAssignee: string
  assignmentRules: AssignmentRule[]
  slaHours: string
}

const SURVEY_TYPES = ['NPS', 'CSAT', 'CES', 'CUSTOM'] as const

export default function NewAlertRulePage() {
  const router = useRouter()
  const { getToken } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>({
    name: '',
    status: 'ACTIVE',
    surveyTypes: [],
    scoreMin: '',
    scoreMax: '',
    sentimentThreshold: '',
    topicFilters: '',
    slackWebhookUrl: '',
    slackChannelName: '',
    emailRecipients: '',
    teamsWebhookUrl: '',
    defaultAssignee: '',
    assignmentRules: [],
    slaHours: '24',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  function toggleSurveyType(type: string) {
    setForm((f) => ({
      ...f,
      surveyTypes: f.surveyTypes.includes(type)
        ? f.surveyTypes.filter((t) => t !== type)
        : [...f.surveyTypes, type],
    }))
  }

  function addAssignmentRule() {
    setForm((f) => ({
      ...f,
      assignmentRules: [...f.assignmentRules, { topic: '', assignee: '' }],
    }))
  }

  function removeAssignmentRule(index: number) {
    setForm((f) => ({
      ...f,
      assignmentRules: f.assignmentRules.filter((_, i) => i !== index),
    }))
  }

  function updateAssignmentRule(index: number, field: keyof AssignmentRule, value: string) {
    setForm((f) => ({
      ...f,
      assignmentRules: f.assignmentRules.map((r, i) =>
        i === index ? { ...r, [field]: value } : r
      ),
    }))
  }

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {}
    if (!form.name.trim()) errs.name = 'Rule name is required'
    if (form.surveyTypes.length === 0) errs.surveyTypes = 'Select at least one survey type'
    return errs
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setErrors({})
    setServerError(null)
    setSubmitting(true)

    try {
      const emailList = form.emailRecipients
        .split('\n')
        .map((e) => e.trim())
        .filter(Boolean)

      const topicList = form.topicFilters
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)

      const payload = {
        name: form.name,
        surveyTypes: form.surveyTypes,
        ...(form.scoreMin && { scoreMin: Number(form.scoreMin) }),
        ...(form.scoreMax && { scoreMax: Number(form.scoreMax) }),
        ...(form.sentimentThreshold && { sentimentThreshold: Number(form.sentimentThreshold) }),
        ...(topicList.length > 0 && { topicFilters: topicList }),
        ...(form.slackWebhookUrl && { slackWebhookUrl: form.slackWebhookUrl }),
        ...(form.slackChannelName && { slackChannelName: form.slackChannelName }),
        ...(emailList.length > 0 && { emailRecipients: emailList }),
        ...(form.teamsWebhookUrl && { teamsWebhookUrl: form.teamsWebhookUrl }),
        defaultAssignee: form.defaultAssignee || undefined,
        assignmentRules: form.assignmentRules.filter((r) => r.topic && r.assignee),
        slaHours: Number(form.slaHours) || 24,
      }

      const token = await getAuthToken(getToken)
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers.Authorization = `Bearer ${token}`

      const res = await fetch(`${API_URL}/v1/alert-rules`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.message ?? `Failed with status ${res.status}`)
      }

      router.push('/admin/alerts/rules')
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link
          href="/admin/alerts/rules"
          className="text-sm text-indigo-600 hover:text-indigo-700 hover:underline"
        >
          &larr; Back to Alert Rules
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Create Alert Rule</h1>
        <p className="mt-1 text-sm text-gray-500">Configure when and how to alert your team about feedback</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-8">
        {serverError && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* General */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">General</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="ruleName" className="block text-sm font-medium text-gray-700 mb-1">
                  Rule Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="ruleName"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.name ? 'border-red-400' : 'border-gray-300'}`}
                  placeholder="e.g. Low NPS Score Alert"
                />
                {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, status: f.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.status === 'ACTIVE' ? 'bg-indigo-600' : 'bg-gray-300'}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.status === 'ACTIVE' ? 'translate-x-6' : 'translate-x-1'}`}
                    />
                  </button>
                  <span className="text-sm text-gray-700">{form.status === 'ACTIVE' ? 'Active' : 'Paused'}</span>
                </div>
              </div>
            </div>
          </section>

          {/* Trigger Conditions */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Trigger Conditions</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Survey Types <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap gap-3">
                  {SURVEY_TYPES.map((type) => (
                    <label key={type} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.surveyTypes.includes(type)}
                        onChange={() => toggleSurveyType(type)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-gray-700">{type}</span>
                    </label>
                  ))}
                </div>
                {errors.surveyTypes && <p className="mt-1 text-xs text-red-600">{errors.surveyTypes}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="scoreMin" className="block text-sm font-medium text-gray-700 mb-1">
                    Score Min
                  </label>
                  <input
                    id="scoreMin"
                    type="number"
                    value={form.scoreMin}
                    onChange={(e) => setForm((f) => ({ ...f, scoreMin: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label htmlFor="scoreMax" className="block text-sm font-medium text-gray-700 mb-1">
                    Score Max
                  </label>
                  <input
                    id="scoreMax"
                    type="number"
                    value={form.scoreMax}
                    onChange={(e) => setForm((f) => ({ ...f, scoreMax: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="10"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="sentimentThreshold" className="block text-sm font-medium text-gray-700 mb-1">
                  Sentiment Threshold
                </label>
                <input
                  id="sentimentThreshold"
                  type="number"
                  step="0.01"
                  min="-1"
                  max="1"
                  value={form.sentimentThreshold}
                  onChange={(e) => setForm((f) => ({ ...f, sentimentThreshold: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. -0.5 (alert below this sentiment)"
                />
              </div>

              <div>
                <label htmlFor="topicFilters" className="block text-sm font-medium text-gray-700 mb-1">
                  Topic Filters <span className="text-gray-400 font-normal">(comma-separated)</span>
                </label>
                <input
                  id="topicFilters"
                  type="text"
                  value={form.topicFilters}
                  onChange={(e) => setForm((f) => ({ ...f, topicFilters: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. billing, support, onboarding"
                />
              </div>
            </div>
          </section>

          {/* Alert Channels */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Alert Channels</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="slackWebhookUrl" className="block text-sm font-medium text-gray-700 mb-1">
                  Slack Webhook URL
                </label>
                <input
                  id="slackWebhookUrl"
                  type="url"
                  value={form.slackWebhookUrl}
                  onChange={(e) => setForm((f) => ({ ...f, slackWebhookUrl: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="https://hooks.slack.com/services/..."
                />
              </div>
              <div>
                <label htmlFor="slackChannelName" className="block text-sm font-medium text-gray-700 mb-1">
                  Slack Channel Name
                </label>
                <input
                  id="slackChannelName"
                  type="text"
                  value={form.slackChannelName}
                  onChange={(e) => setForm((f) => ({ ...f, slackChannelName: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="#cx-alerts"
                />
              </div>
              <div>
                <label htmlFor="emailRecipients" className="block text-sm font-medium text-gray-700 mb-1">
                  Email Recipients <span className="text-gray-400 font-normal">(one per line)</span>
                </label>
                <textarea
                  id="emailRecipients"
                  rows={3}
                  value={form.emailRecipients}
                  onChange={(e) => setForm((f) => ({ ...f, emailRecipients: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder={"team@example.com\nmanager@example.com"}
                />
              </div>
              <div>
                <label htmlFor="teamsWebhookUrl" className="block text-sm font-medium text-gray-700 mb-1">
                  Microsoft Teams Webhook URL
                </label>
                <input
                  id="teamsWebhookUrl"
                  type="url"
                  value={form.teamsWebhookUrl}
                  onChange={(e) => setForm((f) => ({ ...f, teamsWebhookUrl: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="https://outlook.office.com/webhook/..."
                />
              </div>
            </div>
          </section>

          {/* Assignment */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Assignment</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="defaultAssignee" className="block text-sm font-medium text-gray-700 mb-1">
                  Default Assignee
                </label>
                <input
                  id="defaultAssignee"
                  type="text"
                  value={form.defaultAssignee}
                  onChange={(e) => setForm((f) => ({ ...f, defaultAssignee: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. cx-team@example.com"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Assignment Rules</label>
                  <button
                    type="button"
                    onClick={addAssignmentRule}
                    className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    + Add Rule
                  </button>
                </div>
                {form.assignmentRules.length === 0 && (
                  <p className="text-sm text-gray-400">No assignment rules. Cases will go to the default assignee.</p>
                )}
                <div className="space-y-2">
                  {form.assignmentRules.map((rule, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={rule.topic}
                        onChange={(e) => updateAssignmentRule(index, 'topic', e.target.value)}
                        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Topic (e.g. billing)"
                      />
                      <span className="text-gray-400 text-sm">&rarr;</span>
                      <input
                        type="text"
                        value={rule.assignee}
                        onChange={(e) => updateAssignmentRule(index, 'assignee', e.target.value)}
                        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Assignee"
                      />
                      <button
                        type="button"
                        onClick={() => removeAssignmentRule(index)}
                        className="text-red-400 hover:text-red-600 p-1"
                        title="Remove rule"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* SLA */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">SLA</h2>
            <div>
              <label htmlFor="slaHours" className="block text-sm font-medium text-gray-700 mb-1">
                SLA Hours
              </label>
              <input
                id="slaHours"
                type="number"
                min="1"
                value={form.slaHours}
                onChange={(e) => setForm((f) => ({ ...f, slaHours: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="24"
              />
              <p className="mt-1 text-xs text-gray-400">Hours to resolve a case before it becomes overdue</p>
            </div>
          </section>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Saving...' : 'Save Alert Rule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

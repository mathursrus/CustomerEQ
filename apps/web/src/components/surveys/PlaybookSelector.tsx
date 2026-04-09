'use client'

import { useState } from 'react'

interface CxPlaybook {
  id: string
  name: string
  surveyType: string
  rules: SurveyRuleInput[]
}

interface SurveyRuleInput {
  scoreMin: number
  scoreMax: number
  actionType: string
  actionConfig: Record<string, unknown>
  ruleLabel?: string
}

interface Props {
  playbooks: CxPlaybook[]
  onLoad: (rules: SurveyRuleInput[]) => void
}

export default function PlaybookSelector({ playbooks, onLoad }: Props) {
  const [selectedId, setSelectedId] = useState('')
  const [confirming, setConfirming] = useState(false)

  if (playbooks.length === 0) return null

  function handleSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    setSelectedId(e.target.value)
    setConfirming(false)
  }

  function handleLoad() {
    if (!selectedId) return
    setConfirming(true)
  }

  function handleConfirm() {
    const playbook = playbooks.find((p) => p.id === selectedId)
    if (playbook) {
      onLoad(playbook.rules)
    }
    setConfirming(false)
    setSelectedId('')
  }

  return (
    <div className="flex items-center gap-3">
      <select
        value={selectedId}
        onChange={handleSelect}
        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        data-testid="playbook-select"
      >
        <option value="">Load a playbook…</option>
        {playbooks.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>

      {selectedId && !confirming && (
        <button
          type="button"
          onClick={handleLoad}
          className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
          data-testid="playbook-load-btn"
        >
          Load
        </button>
      )}

      {confirming && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-amber-700">Replace current rules?</span>
          <button
            type="button"
            onClick={handleConfirm}
            className="font-medium text-indigo-600 hover:text-indigo-800"
            data-testid="playbook-confirm-btn"
          >
            Yes, replace
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}

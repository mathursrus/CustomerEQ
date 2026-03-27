'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'

interface ActivateModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
  programName: string
}

export function ActivateModal({ open, onClose, onConfirm, programName }: ActivateModalProps) {
  const [input, setInput] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canActivate = input.trim() === programName.trim() && !confirming

  async function handleConfirm() {
    setConfirming(true)
    setError(null)
    try {
      await onConfirm()
      setInput('')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Activation failed — please try again')
    } finally {
      setConfirming(false)
    }
  }

  if (!open) return null
  return (
    <Modal onClose={onClose} title="Activate Program" size="md"
      footer={
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={confirming} className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors">Cancel</button>
          <button type="button" onClick={handleConfirm} disabled={!canActivate} className="rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {confirming ? 'Activating…' : '🚀 Activate'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-500">Once activated, members can start earning points. Type the program name to confirm.</p>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ⚠️ This will make the program live immediately. Ensure all settings are correct before proceeding.
        </div>
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Type <strong className="text-gray-900">{programName || 'program name'}</strong> to confirm
          </label>
          <input
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={programName || 'Program name'}
          />
        </div>
      </div>
    </Modal>
  )
}

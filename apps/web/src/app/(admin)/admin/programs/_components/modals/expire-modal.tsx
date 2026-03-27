'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'

interface ExpireModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (option: 'NOW' | 'DATE', date?: string) => void
  rewardName?: string
}

export function ExpireModal({ open, onClose, onConfirm, rewardName }: ExpireModalProps) {
  const [option, setOption] = useState<'NOW' | 'DATE'>('NOW')
  const [date, setDate] = useState('')

  function handleConfirm() {
    onConfirm(option, option === 'DATE' ? date : undefined)
    onClose()
  }

  if (!open) return null
  return (
    <Modal onClose={onClose} title="Retire Reward" size="md"
      footer={
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
          <button type="button" onClick={handleConfirm} disabled={option === 'DATE' && !date} className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors">Confirm Retire</button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-500">
          {rewardName && <><strong className="text-gray-700">{rewardName}</strong> — </>}
          Choose when this reward becomes unavailable. Members with in-progress redemptions will be honored through completion.
        </p>
        <div className="space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="radio" name="expireOption" checked={option === 'NOW'} onChange={() => setOption('NOW')} className="mt-1 accent-indigo-600" />
            <div>
              <div className="text-sm font-semibold text-gray-900">Expire now</div>
              <div className="text-xs text-gray-500 mt-0.5">Reward becomes unavailable immediately. In-progress redemptions are honored.</div>
            </div>
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="radio" name="expireOption" checked={option === 'DATE'} onChange={() => setOption('DATE')} className="mt-1 accent-indigo-600" />
            <div>
              <div className="text-sm font-semibold text-gray-900">Expire on a future date</div>
              <div className="text-xs text-gray-500 mt-0.5">Reward stays active until the chosen date, then archives automatically.</div>
            </div>
          </label>
        </div>
        {option === 'DATE' && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Expiry Date *</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <p className="mt-1 text-xs text-gray-500">Reward will stop accepting new redemptions after this date.</p>
          </div>
        )}
      </div>
    </Modal>
  )
}

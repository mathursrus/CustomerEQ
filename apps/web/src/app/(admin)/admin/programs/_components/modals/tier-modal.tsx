'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/modal'
import type { Tier } from '../program-wizard'

const ICONS = ['🥉','🥈','🥇','💎','⭐','🏅','🎖️','🔥','👑','🚀','🌟','💠']

interface TierModalProps {
  open: boolean
  onClose: () => void
  onSave: (tier: Tier) => void
  initialTier?: Tier
}

export function TierModal({ open, onClose, onSave, initialTier }: TierModalProps) {
  if (!open) return null
  const [form, setForm] = useState<Omit<Tier, 'id'>>({
    name: '', icon: '🥉', minPoints: '', minSpend: '', multiplier: '1.0×', benefits: ''
  })

  useEffect(() => {
    if (initialTier) {
      setForm({ name: initialTier.name, icon: initialTier.icon, minPoints: initialTier.minPoints, minSpend: initialTier.minSpend, multiplier: initialTier.multiplier, benefits: initialTier.benefits })
    } else {
      setForm({ name: '', icon: '🥉', minPoints: '', minSpend: '', multiplier: '1.0×', benefits: '' })
    }
  }, [open, initialTier])

  function handleSave() {
    onSave({ id: initialTier?.id ?? crypto.randomUUID(), ...form })
    onClose()
  }

  const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500'

  return (
    <Modal
      onClose={onClose}
      title={initialTier ? 'Edit Tier' : 'Add Tier'}
      size="lg"
      footer={
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
          <button type="button" onClick={handleSave} disabled={!form.name.trim()} className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors">Save Tier</button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Tier Name *</label>
          <input className={inputCls} value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="e.g. Gold, Platinum, Diamond" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-2">Icon</label>
          <div className="flex flex-wrap gap-2">
            {ICONS.map(icon => (
              <button
                key={icon}
                type="button"
                onClick={() => setForm(f => ({...f, icon}))}
                className={`flex h-9 w-9 items-center justify-center rounded-lg border-2 text-lg transition-colors ${form.icon === icon ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300'}`}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Entry Criteria — Min Points</label>
            <input className={inputCls} value={form.minPoints} onChange={e => setForm(f => ({...f, minPoints: e.target.value}))} placeholder="e.g. 1000" />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Min Spend (USD, optional)</label>
            <input className={inputCls} value={form.minSpend} onChange={e => setForm(f => ({...f, minSpend: e.target.value}))} placeholder="e.g. 500" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Points Multiplier</label>
          <select className={inputCls} value={form.multiplier} onChange={e => setForm(f => ({...f, multiplier: e.target.value}))}>
            {['1.0×','1.25×','1.5×','2.0×','3.0×'].map(m => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Benefits (one per line)</label>
          <textarea className={inputCls + ' min-h-[80px] resize-y'} value={form.benefits} onChange={e => setForm(f => ({...f, benefits: e.target.value}))} placeholder={'Free shipping\n10% discount\nPriority support'} />
        </div>
      </div>
    </Modal>
  )
}

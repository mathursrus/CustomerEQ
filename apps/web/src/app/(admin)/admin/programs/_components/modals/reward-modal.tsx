'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/modal'
import type { Reward } from '../program-wizard'

interface RewardModalProps {
  open: boolean
  onClose: () => void
  onSave: (reward: Reward) => void
  initialReward?: Reward
}

export function RewardModal({ open, onClose, onSave, initialReward }: RewardModalProps) {
  const [form, setForm] = useState<Omit<Reward, 'id'>>({
    name: '', description: '', rewardType: 'Discount Code', pointsCost: '',
    stock: 'UNLIMITED', stockQty: '', eligibleTiers: 'All Tiers',
    availability: 'ALWAYS', availFrom: '', availUntil: ''
  })

  useEffect(() => {
    if (initialReward) {
      const { id: _, ...rest } = initialReward
      setForm(rest)
    } else {
      setForm({ name: '', description: '', rewardType: 'Discount Code', pointsCost: '', stock: 'UNLIMITED', stockQty: '', eligibleTiers: 'All Tiers', availability: 'ALWAYS', availFrom: '', availUntil: '' })
    }
  }, [open, initialReward])

  if (!open) return null
  const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500'

  return (
    <Modal onClose={onClose} title={initialReward ? 'Edit Reward' : 'Add Reward'} size="lg"
      footer={
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
          <button type="button" onClick={() => { onSave({ id: initialReward?.id ?? crypto.randomUUID(), ...form }); onClose() }} disabled={!form.name.trim() || !form.pointsCost.trim()} className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors">Save Reward</button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Reward Name *</label>
          <input className={inputCls} value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="e.g. 10% Discount Code" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
          <textarea className={inputCls + ' min-h-[52px] resize-y'} value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} placeholder="Shown to members on their rewards portal…" />
        </div>
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Type *</label>
            <select className={inputCls} value={form.rewardType} onChange={e => setForm(f => ({...f, rewardType: e.target.value}))}>
              {['Discount Code','Free Product','Cashback','Gift Card','Experience'].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Points Cost *</label>
            <input className={inputCls} value={form.pointsCost} onChange={e => setForm(f => ({...f, pointsCost: e.target.value}))} placeholder="e.g. 200" />
          </div>
        </div>
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Stock</label>
            <select className={inputCls} value={form.stock} onChange={e => setForm(f => ({...f, stock: e.target.value as 'UNLIMITED'|'LIMITED'}))}>
              <option value="UNLIMITED">Unlimited</option>
              <option value="LIMITED">Limited quantity</option>
            </select>
          </div>
          {form.stock === 'LIMITED' && (
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Quantity</label>
              <input className={inputCls} value={form.stockQty} onChange={e => setForm(f => ({...f, stockQty: e.target.value}))} placeholder="e.g. 100" />
            </div>
          )}
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Eligible Tiers</label>
            <select className={inputCls} value={form.eligibleTiers} onChange={e => setForm(f => ({...f, eligibleTiers: e.target.value}))}>
              {['All Tiers','Silver and above','Gold and above','Platinum only'].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Availability</label>
          <select className={inputCls} value={form.availability} onChange={e => setForm(f => ({...f, availability: e.target.value as 'ALWAYS'|'DATES'}))}>
            <option value="ALWAYS">Always active</option>
            <option value="DATES">Specific date range</option>
          </select>
        </div>
        {form.availability === 'DATES' && (
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Available From</label>
              <input type="date" className={inputCls} value={form.availFrom} onChange={e => setForm(f => ({...f, availFrom: e.target.value}))} />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Available Until</label>
              <input type="date" className={inputCls} value={form.availUntil} onChange={e => setForm(f => ({...f, availUntil: e.target.value}))} />
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

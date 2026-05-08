'use client'

import { useEffect, useRef, useState } from 'react'
import { PERSONAS, getPersonaEmail, setPersonaEmail, type Persona } from '@/lib/persona'

interface Props {
  onSelect?: (persona: Persona) => void
}

const NEW_CUSTOMER_VALUE = '__new__'

export function PersonaPicker({ onSelect }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ email: '', firstName: '', lastName: '' })
  const [enrolling, setEnrolling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const selectRef = useRef<HTMLSelectElement>(null)

  useEffect(() => {
    setSelected(getPersonaEmail())
    const handler = () => setSelected(getPersonaEmail())
    window.addEventListener('ceq_persona_changed', handler)
    return () => window.removeEventListener('ceq_persona_changed', handler)
  }, [])

  function handleChange(value: string) {
    if (value === NEW_CUSTOMER_VALUE) {
      // Reset select so it doesn't show "__new__" as selected
      if (selectRef.current) selectRef.current.value = selected ?? ''
      setForm({ email: '', firstName: '', lastName: '' })
      setError(null)
      setShowModal(true)
      return
    }
    setPersonaEmail(value)
    setSelected(value)
    const persona = PERSONAS.find((p) => p.email === value)
    if (persona) onSelect?.(persona)
  }

  async function handleEnroll(e: React.FormEvent) {
    e.preventDefault()
    setEnrolling(true)
    setError(null)
    try {
      const res = await fetch('/api/storefront/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json() as { error?: string; email?: string }
      if (!res.ok) {
        setError(data.error ?? 'Enrollment failed')
        return
      }
      setPersonaEmail(form.email)
      setSelected(form.email)
      setShowModal(false)
    } catch {
      setError('Network error — is the API reachable?')
    } finally {
      setEnrolling(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 font-medium whitespace-nowrap">Demo persona:</span>
        <select
          ref={selectRef}
          value={selected ?? ''}
          onChange={(e) => handleChange(e.target.value)}
          className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)] max-w-[180px]"
          aria-label="Select demo persona"
        >
          <option value="" disabled>— choose a persona —</option>
          {PERSONAS.map((p) => (
            <option key={p.email} value={p.email}>
              {p.firstName} {p.lastName}
            </option>
          ))}
          <option disabled>──────────</option>
          <option value={NEW_CUSTOMER_VALUE}>New customer…</option>
        </select>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowModal(false)}>
          <div
            className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-bold text-gray-900 mb-1">New customer sign-up</h2>
            <p className="text-xs text-gray-500 mb-4">Enroll a fresh member in StarBrew Rewards live.</p>

            <form onSubmit={(e) => void handleEnroll(e)} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">First name *</label>
                <input
                  type="text"
                  required
                  value={form.firstName}
                  onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1"
                  style={{ '--tw-ring-color': 'var(--brand-primary)' } as React.CSSProperties}
                  placeholder="e.g. Jordan"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Last name</label>
                <input
                  type="text"
                  value={form.lastName}
                  onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1"
                  style={{ '--tw-ring-color': 'var(--brand-primary)' } as React.CSSProperties}
                  placeholder="e.g. Lee"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1"
                  style={{ '--tw-ring-color': 'var(--brand-primary)' } as React.CSSProperties}
                  placeholder="e.g. jordan@example.com"
                />
              </div>

              {error && <p className="text-xs text-red-600">{error}</p>}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 text-sm font-medium text-gray-600 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={enrolling}
                  className="flex-1 text-sm font-semibold text-white py-2 rounded-lg cursor-pointer disabled:opacity-60"
                  style={{ backgroundColor: 'var(--brand-primary)' }}
                >
                  {enrolling ? 'Enrolling…' : 'Join StarBrew Rewards'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

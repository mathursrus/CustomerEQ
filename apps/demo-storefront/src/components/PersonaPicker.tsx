'use client'

import { useEffect, useState } from 'react'
import { PERSONAS, getPersonaEmail, setPersonaEmail, type Persona } from '@/lib/persona'

interface Props {
  onSelect?: (persona: Persona) => void
}

export function PersonaPicker({ onSelect }: Props) {
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    setSelected(getPersonaEmail())
    const handler = () => setSelected(getPersonaEmail())
    window.addEventListener('ceq_persona_changed', handler)
    return () => window.removeEventListener('ceq_persona_changed', handler)
  }, [])

  function handleChange(email: string) {
    setPersonaEmail(email)
    setSelected(email)
    const persona = PERSONAS.find((p) => p.email === email)
    if (persona) onSelect?.(persona)
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 font-medium whitespace-nowrap">Demo persona:</span>
      <select
        value={selected ?? ''}
        onChange={(e) => handleChange(e.target.value)}
        className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)] max-w-[180px]"
        aria-label="Select demo persona"
      >
        <option value="" disabled>
          — choose a persona —
        </option>
        {PERSONAS.map((p) => (
          <option key={p.email} value={p.email}>
            {p.firstName} {p.lastName}
          </option>
        ))}
      </select>
    </div>
  )
}

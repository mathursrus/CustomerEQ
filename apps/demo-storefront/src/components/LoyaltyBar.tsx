'use client'

import { useEffect, useState } from 'react'
import { getPersonaEmail } from '@/lib/persona'
import type { MemberData } from '@/app/api/storefront/member/route'

export function LoyaltyBar() {
  const [member, setMember] = useState<MemberData | null>(null)
  const [loading, setLoading] = useState(false)

  async function fetchMember(email: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/storefront/member?email=${encodeURIComponent(email)}`)
      if (res.ok) {
        setMember(await res.json() as MemberData)
      } else {
        setMember(null)
      }
    } catch {
      setMember(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const email = getPersonaEmail()
    if (email) void fetchMember(email)

    function onPersonaChange() {
      const e = getPersonaEmail()
      if (e) void fetchMember(e)
      else setMember(null)
    }
    window.addEventListener('ceq_persona_changed', onPersonaChange)
    return () => window.removeEventListener('ceq_persona_changed', onPersonaChange)
  }, [])

  // Re-fetch after a purchase event is recorded
  useEffect(() => {
    function onPurchase() {
      const email = getPersonaEmail()
      if (email) void fetchMember(email)
    }
    window.addEventListener('ceq_purchase_recorded', onPurchase)
    return () => window.removeEventListener('ceq_purchase_recorded', onPurchase)
  }, [])

  if (!member && !loading) {
    return (
      <div
        data-testid="ceq-widget"
        className="text-xs text-gray-400 italic hidden sm:block"
      >
        Select a persona to see loyalty status
      </div>
    )
  }

  if (loading) {
    return (
      <div data-testid="ceq-widget" className="text-xs text-gray-400 animate-pulse hidden sm:block">
        Loading…
      </div>
    )
  }

  return (
    <div
      data-testid="ceq-widget"
      className="flex items-center gap-3 bg-white rounded-lg px-3 py-1.5 border border-gray-100 shadow-sm hidden sm:flex"
      title="CustomerEQ Loyalty Widget"
    >
      <div className="flex flex-col items-end">
        <span className="text-xs font-semibold text-gray-800">
          {member!.pointsBalance.toLocaleString()} pts
        </span>
        {member!.firstName && (
          <span className="text-[10px] text-gray-500 leading-tight">
            {member!.firstName} {member!.lastName}
          </span>
        )}
      </div>
      <div
        className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
        style={{ backgroundColor: 'var(--brand-primary)' }}
      >
        {tierLabel(member!.pointsBalance)}
      </div>
    </div>
  )
}

function tierLabel(points: number): string {
  if (points >= 6000) return 'Platinum'
  if (points >= 2500) return 'Gold'
  return 'Bronze'
}

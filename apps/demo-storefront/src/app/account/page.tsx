'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getPersonaEmail, getPersona } from '@/lib/persona'
import type { MemberData } from '@/app/api/storefront/member/route'

// Note: demo-storefront simulates a 3rd-party customer storefront and
// deliberately has zero workspace dependencies. The literal here is the
// admin landing URL for the customer-facing portion of the demo flow;
// it is NOT coupled to packages/shared/PUBLIC_FRONTEND_URL on purpose.
const ADMIN_URL = process.env.NEXT_PUBLIC_DEMO_WEB_URL ?? 'https://customereq.wellnessatwork.me'

const TIER_THRESHOLDS = [
  { name: 'Bronze', min: 0, max: 2499, color: '#CD7F32' },
  { name: 'Gold', min: 2500, max: 5999, color: '#CBA258' },
  { name: 'Platinum', min: 6000, max: Infinity, color: '#4B5563' },
]

function tierInfo(points: number) {
  return TIER_THRESHOLDS.find((t) => points >= t.min && points <= t.max) ?? TIER_THRESHOLDS[0]
}

export default function AccountPage() {
  const [member, setMember] = useState<MemberData | null>(null)
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    async function load(e: string) {
      setLoading(true)
      try {
        const res = await fetch(`/api/storefront/member?email=${encodeURIComponent(e)}`)
        if (res.ok) setMember(await res.json() as MemberData)
        else setMember(null)
      } finally {
        setLoading(false)
      }
    }

    const e = getPersonaEmail()
    setEmail(e)
    if (e) void load(e)
    else setLoading(false)

    const handler = () => {
      const ne = getPersonaEmail()
      setEmail(ne)
      if (ne) void load(ne)
    }
    window.addEventListener('ceq_persona_changed', handler)
    window.addEventListener('ceq_purchase_recorded', () => {
      const cur = getPersonaEmail()
      if (cur) void load(cur)
    })
    return () => window.removeEventListener('ceq_persona_changed', handler)
  }, [])

  if (!email) {
    return (
      <div className="text-center py-20">
        <div className="text-5xl mb-4">👤</div>
        <h2 className="text-lg font-semibold text-gray-800 mb-2">No persona selected</h2>
        <p className="text-sm text-gray-500">Pick a demo persona from the header to see loyalty status.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-4 border-gray-200 rounded-full animate-spin" style={{ borderTopColor: 'var(--brand-primary)' }} />
      </div>
    )
  }

  if (!member) {
    return (
      <div className="text-center py-20">
        <div className="text-5xl mb-4">⚠️</div>
        <p className="text-sm text-red-600">Member not found. Run <code className="bg-gray-100 px-1 rounded">pnpm seed:demo</code> first.</p>
      </div>
    )
  }

  const persona = getPersona(email)
  const tier = tierInfo(member.pointsBalance)
  const nextTier = TIER_THRESHOLDS.find((t) => t.min > member.pointsBalance)
  const progressPct = nextTier
    ? Math.min(100, Math.round(((member.pointsBalance - tier.min) / (nextTier.min - tier.min)) * 100))
    : 100

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-6">My Account</h1>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-4">
        <div className="flex items-center gap-4 mb-5">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
            style={{ backgroundColor: 'var(--brand-primary)' }}
          >
            {member.firstName?.[0] ?? '?'}
          </div>
          <div>
            <p className="font-semibold text-gray-900">
              {member.firstName} {member.lastName}
            </p>
            <p className="text-xs text-gray-500">{member.email}</p>
            {persona && (
              <p className="text-xs text-gray-400 mt-0.5 italic">{persona.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-3xl font-bold text-gray-900" data-testid="points-balance">
            {member.pointsBalance.toLocaleString()}
          </span>
          <span className="text-sm text-gray-500">StarPoints</span>
          <span
            className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full text-white"
            style={{ backgroundColor: tier.color }}
          >
            {tier.name}
          </span>
        </div>

        {nextTier && (
          <div>
            <div className="w-full bg-gray-100 rounded-full h-1.5 mb-1">
              <div
                className="h-1.5 rounded-full transition-all"
                style={{ width: `${progressPct}%`, backgroundColor: 'var(--brand-primary)' }}
              />
            </div>
            <p className="text-xs text-gray-400">
              {(nextTier.min - member.pointsBalance).toLocaleString()} pts to {nextTier.name}
            </p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Redeem rewards</h2>
        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex justify-between">
            <span>🥤 Free Tall Coffee</span>
            <span className="font-semibold text-gray-900">500 pts</span>
          </div>
          <div className="flex justify-between">
            <span>🫐 Free Pastry</span>
            <span className="font-semibold text-gray-900">300 pts</span>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Visit the{' '}
          <a href={`${ADMIN_URL}/admin`} target="_blank" rel="noreferrer" className="underline">
            admin dashboard
          </a>{' '}
          to manage redemptions.
        </p>
      </div>

      <Link
        href="/"
        className="block text-center text-sm font-semibold text-white py-2.5 rounded-lg transition-colors"
        style={{ backgroundColor: 'var(--brand-primary)' }}
      >
        Order more drinks
      </Link>
    </div>
  )
}

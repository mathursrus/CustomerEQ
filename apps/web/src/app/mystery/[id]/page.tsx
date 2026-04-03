'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

interface PlayResponse {
  alreadyPlayed: boolean
  campaignType?: string
  boxStyle?: string
  prize?: { type: string; points: number; label: string; rewardId?: string | null }
}

export default function MemberMysteryPage() {
  const params = useParams()
  const campaignId = params.id as string

  const [memberEmail, setMemberEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<PlayResponse | null>(null)
  const [opened, setOpened] = useState(false)

  const prize = data?.prize

  async function handlePlay() {
    if (!memberEmail.includes('@')) { setError('Enter a valid email'); return }
    setLoading(true); setError(null)
    try {
      const res = await fetch(`${API_URL}/v1/public/campaigns/${campaignId}/play`, {
        method: 'POST', headers: { Authorization: `Bearer ${memberEmail}` },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Error ${res.status}`)
      }
      const result: PlayResponse = await res.json()
      setData(result); setSubmitted(true)
      if (result.alreadyPlayed) setOpened(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally { setLoading(false) }
  }

  function handleOpen() {
    if (opened) return
    setOpened(true)
  }

  // Email entry
  if (!submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)' }}>
        <div className="w-full max-w-sm p-8 text-center text-white">
          <div className="text-4xl mb-4">🎁</div>
          <h1 className="text-2xl font-bold mb-2">You Have a Mystery Reward!</h1>
          <p className="text-sm text-white/60 mb-6">Enter your email to claim your mystery box</p>
          <input type="email" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} placeholder="you@example.com" className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder:text-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 mb-4" onKeyDown={(e) => e.key === 'Enter' && handlePlay()} data-testid="member-email-input" />
          {error && <p className="text-red-300 text-xs mb-3">{error}</p>}
          <button onClick={handlePlay} disabled={loading} className="w-full py-3 bg-gradient-to-r from-amber-400 to-amber-500 text-indigo-950 rounded-lg font-semibold text-sm hover:from-amber-300 hover:to-amber-400 disabled:opacity-60 transition-all" data-testid="member-claim-btn">{loading ? 'Loading...' : 'Claim My Reward'}</button>
          <p className="mt-6 text-[10px] text-white/25">Powered by CustomerEQ</p>
        </div>
      </div>
    )
  }

  // Mystery box
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)' }}>
      <div className="w-full max-w-md p-6 text-center text-white">
        <h1 className="text-2xl font-bold mb-1">{data?.alreadyPlayed ? 'Your Mystery Reward' : 'Mystery Reward!'}</h1>
        <p className="text-sm text-white/60 mb-8">{data?.alreadyPlayed ? 'You already opened this!' : 'Tap the box to discover what\'s inside'}</p>

        {/* Gift box */}
        <div
          className="w-48 h-56 mx-auto mb-6 cursor-pointer select-none"
          onClick={handleOpen}
          style={{ perspective: '600px' }}
          data-testid="mystery-box"
        >
          <div className="relative w-full h-full">
            {/* Bow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-3 z-30 text-3xl" style={{ transition: 'opacity 0.3s', opacity: opened ? 0 : 1 }}>🎀</div>
            {/* Lid */}
            <div
              className="absolute top-2 left-[-4px] w-[200px] h-[48px] rounded-t-lg z-20"
              style={{
                background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
                transition: 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
                transformOrigin: 'bottom left',
                transform: opened ? 'rotate(-110deg) translateY(-20px)' : 'none',
              }}
            >
              <div className="absolute top-1/2 left-0 right-0 h-4 bg-amber-400 -translate-y-1/2" />
            </div>
            {/* Body */}
            <div className="absolute bottom-0 w-48 h-40 rounded-xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
              <div className="absolute top-1/2 left-0 right-0 h-5 bg-amber-400 -translate-y-1/2" />
              <div className="absolute top-0 bottom-0 left-1/2 w-5 bg-amber-400 -translate-x-1/2" />
            </div>
            {/* Prize emoji (pops up when opened) */}
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 text-5xl z-10"
              style={{
                transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s',
                opacity: opened ? 1 : 0,
                transform: `translateX(-50%) ${opened ? 'translateY(-40px)' : 'translateY(20px)'}`,
              }}
            >
              🎉
            </div>
          </div>
        </div>

        {!opened && !data?.alreadyPlayed && (
          <p className="text-sm text-white/40 animate-bounce">Tap to open!</p>
        )}

        {/* Result */}
        {opened && (
          <div className="bg-white rounded-2xl p-6 text-gray-900 mt-4 animate-[popIn_0.4s_cubic-bezier(0.34,1.56,0.64,1)]">
            <div className="text-4xl mb-2">🎉</div>
            <h2 className="text-lg font-bold text-emerald-600 mb-1">{data?.alreadyPlayed ? 'Your Prize' : 'Congratulations!'}</h2>
            <p className="text-xl font-semibold">{prize?.label ?? 'Mystery Prize'}</p>
            <p className="text-sm text-gray-500 mt-2">{data?.alreadyPlayed ? 'You already claimed this reward.' : 'Your reward has been added to your account.'}</p>
          </div>
        )}

        <p className="mt-6 text-[10px] text-white/25">Powered by CustomerEQ</p>
      </div>
    </div>
  )
}

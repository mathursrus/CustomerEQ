'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { API_URL } from '@/lib/config'

interface Segment {
  label: string
  color: string
  index: number
}

interface PlayResponse {
  alreadyPlayed: boolean
  campaignType?: string
  segments?: Segment[]
  winningIndex?: number
  wheelStyle?: string
  reward?: { type: string; points: number; label: string; rewardId?: string | null }
}

export default function MemberSpinPage() {
  const params = useParams()
  const campaignId = params.id as string

  const [memberEmail, setMemberEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<PlayResponse | null>(null)
  const [spinState, setSpinState] = useState<'ready' | 'spinning' | 'done'>('ready')
  const [winnerLabel, setWinnerLabel] = useState('')

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rotationRef = useRef(0)

  const segments = data?.segments ?? []

  const drawWheel = useCallback((rotation: number) => {
    const canvas = canvasRef.current
    if (!canvas || segments.length === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const cx = 160, cy = 160, r = 155
    ctx.clearRect(0, 0, 320, 320)
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate((rotation * Math.PI) / 180)

    const sliceAngle = (2 * Math.PI) / segments.length
    let startAngle = -Math.PI / 2

    for (const seg of segments) {
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.arc(0, 0, r, startAngle, startAngle + sliceAngle)
      ctx.closePath()
      ctx.fillStyle = seg.color
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'
      ctx.lineWidth = 2
      ctx.stroke()

      ctx.save()
      ctx.rotate(startAngle + sliceAngle / 2)
      ctx.textAlign = 'right'
      ctx.fillStyle = '#fff'
      ctx.font = `bold ${segments.length > 6 ? 11 : 13}px Inter, system-ui, sans-serif`
      ctx.shadowColor = 'rgba(0,0,0,0.3)'
      ctx.shadowBlur = 2
      ctx.fillText(seg.label.slice(0, 18), r - 16, 4)
      ctx.shadowBlur = 0
      ctx.restore()

      startAngle += sliceAngle
    }
    ctx.restore()
  }, [segments])

  useEffect(() => {
    if (segments.length > 0) drawWheel(rotationRef.current)
  }, [drawWheel, segments])

  async function handlePlay() {
    if (!memberEmail.includes('@')) { setError('Enter a valid email'); return }
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`${API_URL}/v1/public/campaigns/${campaignId}/play`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${memberEmail}` },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Error ${res.status}`)
      }
      const result: PlayResponse = await res.json()
      setData(result)
      setSubmitted(true)

      if (result.alreadyPlayed) {
        setSpinState('done')
        setWinnerLabel(result.reward?.label ?? 'Unknown')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  function handleSpin() {
    if (spinState !== 'ready' || data?.winningIndex === undefined) return
    setSpinState('spinning')

    const winIdx = data!.winningIndex!
    setWinnerLabel(data!.reward?.label ?? 'Unknown')

    const sliceAngle = 360 / segments.length
    const targetAngle = -(winIdx * sliceAngle + sliceAngle / 2)
    const totalRotation = 360 * 5 + targetAngle - (rotationRef.current % 360)
    const startRot = rotationRef.current
    const start = performance.now()
    const duration = 5000

    function animate(ts: number) {
      const elapsed = ts - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 4)
      rotationRef.current = startRot + totalRotation * eased
      drawWheel(rotationRef.current)
      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        setSpinState('done')
      }
    }
    requestAnimationFrame(animate)
  }

  // Step 1: Email entry
  if (!submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)' }}>
        <div className="w-full max-w-sm p-8 text-center text-white">
          <div className="text-4xl mb-4">🎡</div>
          <h1 className="text-2xl font-bold mb-2">Spin & Win!</h1>
          <p className="text-sm text-white/60 mb-6">Enter your email to claim your spin</p>

          <input
            type="email"
            value={memberEmail}
            onChange={(e) => setMemberEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder:text-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 mb-4"
            onKeyDown={(e) => e.key === 'Enter' && handlePlay()}
            data-testid="member-email-input"
          />

          {error && <p className="text-red-300 text-xs mb-3">{error}</p>}

          <button
            onClick={handlePlay}
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-amber-400 to-amber-500 text-indigo-950 rounded-lg font-semibold text-sm hover:from-amber-300 hover:to-amber-400 disabled:opacity-60 transition-all"
            data-testid="member-claim-spin-btn"
          >
            {loading ? 'Loading...' : 'Claim My Spin'}
          </button>

          <p className="mt-6 text-[10px] text-white/25">Powered by CustomerEQ</p>
        </div>
      </div>
    )
  }

  // Step 2: Spin the wheel
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)' }}>
      <div className="w-full max-w-md p-6 text-center text-white">
        <h1 className="text-2xl font-bold mb-1">Spin & Win!</h1>
        <p className="text-sm text-white/60 mb-6">
          {data?.alreadyPlayed ? 'You already played!' : 'Tap SPIN to reveal your reward'}
        </p>

        {/* Wheel */}
        <div className="relative w-[320px] h-[320px] mx-auto mb-4">
          <div className="absolute top-[-10px] left-1/2 -translate-x-1/2 z-10 w-0 h-0 border-l-[14px] border-r-[14px] border-t-[26px] border-l-transparent border-r-transparent border-t-amber-400 drop-shadow-md" />
          <div className="rounded-full p-1.5 bg-gradient-to-br from-amber-400 to-amber-500 shadow-[0_0_30px_rgba(251,191,36,0.25)]">
            <div className="rounded-full overflow-hidden">
              <canvas ref={canvasRef} width={320} height={320} />
            </div>
          </div>
          {!data?.alreadyPlayed && (
            <button
              onClick={handleSpin}
              disabled={spinState !== 'ready'}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-amber-500 border-[3px] border-white shadow-lg flex items-center justify-center text-[13px] font-bold text-indigo-950 uppercase tracking-wide z-20 hover:scale-105 active:scale-95 transition-transform disabled:opacity-70 disabled:cursor-not-allowed"
              data-testid="member-spin-btn"
            >
              {spinState === 'done' ? '✓' : spinState === 'spinning' ? '...' : 'SPIN'}
            </button>
          )}
        </div>

        {/* Result */}
        {spinState === 'done' && (
          <div className="bg-white rounded-2xl p-6 text-gray-900 mt-4">
            <div className="text-4xl mb-2">🎉</div>
            <h2 className="text-lg font-bold text-emerald-600 mb-1">
              {data?.alreadyPlayed ? 'Your Prize' : 'Congratulations!'}
            </h2>
            <p className="text-xl font-semibold">{winnerLabel}</p>
            <p className="text-sm text-gray-500 mt-2">
              {data?.alreadyPlayed
                ? 'You already claimed this reward.'
                : 'Your reward has been added to your account.'}
            </p>
          </div>
        )}

        <p className="mt-6 text-[10px] text-white/25">Powered by CustomerEQ</p>
      </div>
    </div>
  )
}

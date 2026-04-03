'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

interface PlayResponse {
  alreadyPlayed: boolean
  campaignType?: string
  cardStyle?: string
  scratchText?: string
  brandColor?: string | null
  prize?: { type: string; points: number; label: string; rewardId?: string | null }
}

export default function MemberScratchPage() {
  const params = useParams()
  const campaignId = params.id as string

  const [memberEmail, setMemberEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<PlayResponse | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [scratchPercent, setScratchPercent] = useState(0)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawingRef = useRef(false)

  const cardStyle = data?.cardStyle ?? 'gold'
  const scratchText = data?.scratchText ?? 'Scratch to reveal!'
  const prize = data?.prize

  const drawOverlay = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width, h = canvas.height
    const grad = ctx.createLinearGradient(0, 0, w, h)

    if (data?.brandColor) {
      ctx.fillStyle = data.brandColor
      ctx.fillRect(0, 0, w, h)
    } else if (cardStyle === 'silver') {
      grad.addColorStop(0, '#C0C0C0'); grad.addColorStop(0.3, '#E8E8E8')
      grad.addColorStop(0.5, '#C0C0C0'); grad.addColorStop(0.7, '#A8A8A8'); grad.addColorStop(1, '#C0C0C0')
      ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h)
    } else if (cardStyle === 'holiday') {
      grad.addColorStop(0, '#c41e3a'); grad.addColorStop(0.5, '#2d5a27'); grad.addColorStop(1, '#c41e3a')
      ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h)
    } else {
      grad.addColorStop(0, '#D4AF37'); grad.addColorStop(0.3, '#F5E6A3')
      grad.addColorStop(0.5, '#D4AF37'); grad.addColorStop(0.7, '#C5982C'); grad.addColorStop(1, '#D4AF37')
      ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h)
    }

    // Noise
    for (let i = 0; i < 1500; i++) {
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.12})`
      ctx.fillRect(Math.random() * w, Math.random() * h, 1, 1)
    }

    // Text
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.font = 'bold 16px Inter, system-ui, sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(scratchText, w / 2, h / 2)

    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 2
    ctx.strokeRect(6, 6, w - 12, h - 12)
  }, [cardStyle, scratchText, data?.brandColor])

  useEffect(() => {
    if (submitted && !data?.alreadyPlayed && canvasRef.current) drawOverlay()
  }, [submitted, data, drawOverlay])

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
      if (result.alreadyPlayed) setRevealed(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally { setLoading(false) }
  }

  function scratch(x: number, y: number) {
    if (revealed) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath(); ctx.arc(x, y, 20, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(x, y, 26, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fill()

    // Check percentage (sample every call — fast enough for touch)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    let transparent = 0
    for (let i = 3; i < imageData.data.length; i += 4) {
      if (imageData.data[i] === 0) transparent++
    }
    const pct = (transparent / (canvas.width * canvas.height)) * 100
    setScratchPercent(pct)

    if (pct >= 60 && !revealed) {
      setRevealed(true)
      canvas.style.transition = 'opacity 0.6s ease'
      canvas.style.opacity = '0'
    }
  }

  function handlePointerEvent(e: React.MouseEvent | React.TouchEvent, start = false) {
    if (start) isDrawingRef.current = true
    if (!isDrawingRef.current && !start) return
    const canvas = canvasRef.current
    if (!canvas) return
    const r = canvas.getBoundingClientRect()
    const pos = 'touches' in e ? e.touches[0] : e
    scratch(pos.clientX - r.left, pos.clientY - r.top)
  }

  // Email entry
  if (!submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)' }}>
        <div className="w-full max-w-sm p-8 text-center text-white">
          <div className="text-4xl mb-4">🎫</div>
          <h1 className="text-2xl font-bold mb-2">Scratch & Win!</h1>
          <p className="text-sm text-white/60 mb-6">Enter your email to claim your scratch card</p>
          <input type="email" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} placeholder="you@example.com" className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder:text-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 mb-4" onKeyDown={(e) => e.key === 'Enter' && handlePlay()} data-testid="member-email-input" />
          {error && <p className="text-red-300 text-xs mb-3">{error}</p>}
          <button onClick={handlePlay} disabled={loading} className="w-full py-3 bg-gradient-to-r from-amber-400 to-amber-500 text-indigo-950 rounded-lg font-semibold text-sm hover:from-amber-300 hover:to-amber-400 disabled:opacity-60 transition-all" data-testid="member-claim-btn">{loading ? 'Loading...' : 'Claim My Card'}</button>
          <p className="mt-6 text-[10px] text-white/25">Powered by CustomerEQ</p>
        </div>
      </div>
    )
  }

  // Scratch card
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)' }}>
      <div className="w-full max-w-md p-6 text-center text-white">
        <h1 className="text-2xl font-bold mb-1">Scratch & Win!</h1>
        <p className="text-sm text-white/60 mb-4">{data?.alreadyPlayed ? 'You already scratched!' : 'Scratch the card to reveal your prize'}</p>

        {!data?.alreadyPlayed && !revealed && (
          <div className="w-[320px] h-3 mx-auto mb-3 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${Math.min((scratchPercent / 60) * 100, 100)}%` }} />
          </div>
        )}

        <div className="relative w-[320px] h-[200px] mx-auto mb-4 rounded-2xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
          <div className="absolute inset-0 bg-white flex flex-col items-center justify-center">
            <span className="text-4xl mb-2">🎉</span>
            <span className="text-xl font-bold text-emerald-600">{prize?.label ?? 'Prize'}</span>
            <span className="text-xs text-gray-500 mt-1">Your reward has been added!</span>
          </div>
          {!data?.alreadyPlayed && (
            <canvas ref={canvasRef} width={320} height={200} className="absolute inset-0 cursor-crosshair" style={{ touchAction: 'none' }}
              onMouseDown={(e) => handlePointerEvent(e, true)}
              onMouseMove={handlePointerEvent}
              onMouseUp={() => { isDrawingRef.current = false }}
              onMouseLeave={() => { isDrawingRef.current = false }}
              onTouchStart={(e) => { e.preventDefault(); handlePointerEvent(e, true) }}
              onTouchMove={(e) => { e.preventDefault(); handlePointerEvent(e) }}
              onTouchEnd={() => { isDrawingRef.current = false }}
              data-testid="scratch-canvas"
            />
          )}
        </div>

        {revealed && (
          <div className="bg-white rounded-2xl p-6 text-gray-900 mt-4">
            <div className="text-4xl mb-2">🎉</div>
            <h2 className="text-lg font-bold text-emerald-600 mb-1">{data?.alreadyPlayed ? 'Your Prize' : 'Congratulations!'}</h2>
            <p className="text-xl font-semibold">{prize?.label}</p>
            <p className="text-sm text-gray-500 mt-2">{data?.alreadyPlayed ? 'You already claimed this reward.' : 'Your reward has been added to your account.'}</p>
          </div>
        )}

        <p className="mt-6 text-[10px] text-white/25">Powered by CustomerEQ</p>
      </div>
    </div>
  )
}

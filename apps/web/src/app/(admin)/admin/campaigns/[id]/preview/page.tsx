'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { API_URL, getAuthToken } from '@/lib/config'

interface Campaign {
  id: string
  name: string
  actionType: string
  actionConfig: {
    segments: Array<{ points?: number; rewardId?: string; probability: number; label: string; color: string }>
    wheelStyle?: string
  }
}

export default function CampaignPreviewPage() {
  const params = useParams()
  const router = useRouter()
  const { getToken } = useAuth()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [state, setState] = useState<'ready' | 'spinning' | 'done'>('ready')
  const [winnerLabel, setWinnerLabel] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rotationRef = useRef(0)

  useEffect(() => {
    async function load() {
      const token = await getAuthToken(getToken)
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(`${API_URL}/v1/campaigns/${params.id}`, { headers })
      if (!res.ok) { setError('Campaign not found'); setLoading(false); return }
      const data = await res.json()
      if (data.actionType !== 'spin_wheel') { setError('Not a spin wheel campaign'); setLoading(false); return }
      setCampaign(data)
      setLoading(false)
    }
    load()
  }, [params.id, getToken])

  const segments = campaign?.actionConfig?.segments ?? []
  const wheelStyle = campaign?.actionConfig?.wheelStyle ?? 'classic'

  const drawWheel = useCallback((rotation: number) => {
    const canvas = canvasRef.current
    if (!canvas || segments.length === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const cx = 160, cy = 160, r = 155
    ctx.clearRect(0, 0, 320, 320)

    if (wheelStyle === 'neon') {
      ctx.save()
      ctx.translate(cx, cy)
      ctx.beginPath()
      ctx.arc(0, 0, r + 6, 0, 2 * Math.PI)
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.4)'
      ctx.lineWidth = 8
      ctx.shadowColor = '#8B5CF6'
      ctx.shadowBlur = 15
      ctx.stroke()
      ctx.shadowBlur = 0
      ctx.restore()
    }

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
      ctx.strokeStyle = wheelStyle === 'neon' ? 'rgba(255,255,255,0.5)' : wheelStyle === 'minimal' ? '#e5e7eb' : '#fff'
      ctx.lineWidth = wheelStyle === 'minimal' ? 1 : 2
      ctx.stroke()

      ctx.save()
      ctx.rotate(startAngle + sliceAngle / 2)
      ctx.textAlign = 'right'
      ctx.fillStyle = wheelStyle === 'minimal' ? '#374151' : '#fff'
      ctx.font = `bold ${segments.length > 6 ? 11 : 13}px Inter, system-ui, sans-serif`
      ctx.shadowColor = wheelStyle === 'minimal' ? 'transparent' : 'rgba(0,0,0,0.3)'
      ctx.shadowBlur = wheelStyle === 'minimal' ? 0 : 2
      ctx.fillText(seg.label.slice(0, 18), r - 16, 4)
      ctx.shadowBlur = 0
      ctx.restore()

      startAngle += sliceAngle
    }
    ctx.restore()
  }, [segments, wheelStyle])

  useEffect(() => {
    if (segments.length > 0) drawWheel(rotationRef.current)
  }, [drawWheel, segments])

  function handleSpin() {
    if (state !== 'ready' || segments.length === 0) return
    setState('spinning')

    // Weighted random selection
    const totalProb = segments.reduce((s, seg) => s + seg.probability, 0)
    let roll = Math.random() * totalProb
    let winnerIdx = segments.length - 1
    for (let i = 0; i < segments.length; i++) {
      roll -= segments[i].probability
      if (roll <= 0) { winnerIdx = i; break }
    }

    setWinnerLabel(segments[winnerIdx].label)

    const sliceAngle = 360 / segments.length
    const targetAngle = -(winnerIdx * sliceAngle + sliceAngle / 2)
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
        setState('done')
      }
    }
    requestAnimationFrame(animate)
  }

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <p className="text-gray-400">Loading preview...</p>
      </div>
    )
  }

  if (error || !campaign) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error ?? 'Campaign not found'}</p>
          <button onClick={() => router.back()} className="text-indigo-600 hover:underline text-sm">Go back</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center -mt-8">
      <div className="w-full max-w-md">
        {/* Admin banner */}
        <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-xs text-amber-700 flex items-center justify-between">
          <span>Preview Mode — this is how members will see your campaign</span>
          <button onClick={() => router.push('/admin/campaigns')} className="font-medium hover:underline">Exit</button>
        </div>

        {/* Member experience */}
        <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)' }}>
          <div className="p-8 text-center text-white">
            <p className="text-xs font-medium tracking-widest uppercase text-white/50 mb-1">Your Brand</p>
            <h1 className="text-2xl font-bold mb-1">{campaign.name}</h1>
            <p className="text-sm text-white/60 mb-6">You earned a spin from your recent activity</p>

            {/* Wheel */}
            <div className="relative w-[320px] h-[320px] mx-auto mb-4">
              <div className="absolute top-[-10px] left-1/2 -translate-x-1/2 z-10 w-0 h-0 border-l-[14px] border-r-[14px] border-t-[26px] border-l-transparent border-r-transparent border-t-amber-400 drop-shadow-md" />
              <div className="rounded-full p-1.5 bg-gradient-to-br from-amber-400 to-amber-500 shadow-[0_0_30px_rgba(251,191,36,0.25),0_8px_32px_rgba(0,0,0,0.3)]">
                <div className="rounded-full overflow-hidden">
                  <canvas ref={canvasRef} width={320} height={320} />
                </div>
              </div>
              <button
                onClick={handleSpin}
                disabled={state !== 'ready'}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-amber-500 border-[3px] border-white shadow-lg flex items-center justify-center text-[13px] font-bold text-indigo-950 uppercase tracking-wide z-20 hover:scale-105 active:scale-95 transition-transform disabled:opacity-70 disabled:cursor-not-allowed"
                data-testid="member-spin-btn"
              >
                {state === 'done' ? '✓' : state === 'spinning' ? '...' : 'SPIN'}
              </button>
            </div>

            {state === 'ready' && (
              <p className="text-xs text-white/40">Tap SPIN to reveal your reward</p>
            )}
          </div>

          {/* Result overlay */}
          {state === 'done' && (
            <div className="bg-white rounded-t-2xl p-8 text-center">
              <div className="text-5xl mb-3">🎉</div>
              <h2 className="text-xl font-bold text-emerald-600 mb-1">Congratulations!</h2>
              <p className="text-lg font-semibold text-gray-900 mb-2">{winnerLabel}</p>
              <p className="text-sm text-gray-500 mb-6">Your reward has been added to your account.</p>
              <button
                onClick={() => { setState('ready'); setWinnerLabel('') }}
                className="px-8 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                data-testid="member-spin-again-btn"
              >
                Spin Again (Preview)
              </button>
            </div>
          )}

          {state !== 'done' && (
            <div className="py-3 text-center">
              <span className="text-[10px] text-white/25">Powered by CustomerEQ</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

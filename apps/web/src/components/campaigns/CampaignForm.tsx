'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { API_URL, getAuthToken } from '@/lib/config'

interface Program {
  id: string
  name: string
}

interface SpinSegment {
  rewardId?: string
  points: number
  probability: number
  label: string
  color: string
}

const DEFAULT_COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16']

interface ScratchPrize {
  rewardId?: string
  points: number
  probability: number
  label: string
}

interface FormData {
  name: string
  programId: string
  triggerType: string
  conditionField: string
  conditionOperator: string
  conditionValue: string
  actionType: string
  actionPoints: string
  actionMessage: string
  budgetCap: string
  startDate: string
  endDate: string
  segments: SpinSegment[]
  wheelStyle: 'classic' | 'neon' | 'minimal'
  prizes: ScratchPrize[]
  cardStyle: 'gold' | 'silver' | 'holiday' | 'branded'
  scratchText: string
}

// ─── Color Helpers ─────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

// ─── Shared Prize Simulator ────────────────────────────────────────────────

/** Weighted random selection matching server-side logic. Used by all previews. */
function selectRandomPrize(prizes: Array<{ probability: number; label: string }>): { index: number; label: string } {
  const total = prizes.reduce((s, p) => s + p.probability, 0)
  if (total <= 0) return { index: 0, label: prizes[0]?.label ?? 'Prize' }
  let roll = Math.random() * total
  for (let i = 0; i < prizes.length; i++) {
    roll -= prizes[i].probability
    if (roll <= 0) return { index: i, label: prizes[i].label }
  }
  return { index: prizes.length - 1, label: prizes[prizes.length - 1].label }
}

function adjustBrightness(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex)
  const clamp = (v: number) => Math.max(0, Math.min(255, v + amount))
  return `rgb(${clamp(r)}, ${clamp(g)}, ${clamp(b)})`
}

function adjustAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// ─── Wheel Canvas Preview ──────────────────────────────────────────────────

function WheelPreview({ segments, style }: { segments: SpinSegment[]; style: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rotationRef = useRef(0)
  const spinningRef = useRef(false)

  const drawWheel = useCallback((rotation: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const cx = 150, cy = 150, r = 145
    ctx.clearRect(0, 0, 300, 300)

    // Background circle for minimal/neon styles
    if (style === 'neon') {
      // Outer glow ring
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
      // Inner glow ring
      ctx.beginPath()
      ctx.arc(0, 0, r + 2, 0, 2 * Math.PI)
      ctx.strokeStyle = 'rgba(167, 139, 250, 0.6)'
      ctx.lineWidth = 3
      ctx.stroke()
      ctx.restore()
    }

    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate((rotation * Math.PI) / 180)

    // Equal-sized segments — probability does NOT affect visual size
    // This prevents users from seeing which segment is most likely
    const sliceAngle = (2 * Math.PI) / (segments.length || 1)
    let startAngle = -Math.PI / 2

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]

      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.arc(0, 0, r, startAngle, startAngle + sliceAngle)
      ctx.closePath()

      if (style === 'neon') {
        // Neon: darker base with vivid color, slight gradient
        const grad = ctx.createRadialGradient(0, 0, r * 0.3, 0, 0, r)
        grad.addColorStop(0, adjustBrightness(seg.color, -30))
        grad.addColorStop(1, seg.color)
        ctx.fillStyle = grad
      } else if (style === 'minimal') {
        // Minimal: muted/pastel version of the color
        ctx.fillStyle = adjustAlpha(seg.color, 0.7)
      } else {
        ctx.fillStyle = seg.color
      }
      ctx.fill()

      // Borders
      if (style === 'neon') {
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'
        ctx.lineWidth = 2
        ctx.shadowColor = '#fff'
        ctx.shadowBlur = 3
      } else if (style === 'minimal') {
        ctx.strokeStyle = '#e5e7eb'
        ctx.lineWidth = 1
        ctx.shadowBlur = 0
      } else {
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 2.5
        ctx.shadowBlur = 0
      }
      ctx.stroke()
      ctx.shadowBlur = 0

      // Label
      ctx.save()
      ctx.rotate(startAngle + sliceAngle / 2)
      ctx.textAlign = 'right'
      if (style === 'neon') {
        ctx.fillStyle = '#fff'
        ctx.shadowColor = seg.color
        ctx.shadowBlur = 6
      } else if (style === 'minimal') {
        ctx.fillStyle = '#374151'
        ctx.shadowBlur = 0
      } else {
        ctx.fillStyle = '#fff'
        ctx.shadowColor = 'rgba(0,0,0,0.4)'
        ctx.shadowBlur = 2
      }
      ctx.font = `bold ${segments.length > 6 ? 10 : 12}px Inter, system-ui, sans-serif`
      ctx.fillText(seg.label.slice(0, 15), r - 14, 4)
      ctx.shadowBlur = 0
      ctx.restore()

      startAngle += sliceAngle
    }

    // Minimal: thin outer ring
    if (style === 'minimal') {
      ctx.beginPath()
      ctx.arc(0, 0, r, 0, 2 * Math.PI)
      ctx.strokeStyle = '#d1d5db'
      ctx.lineWidth = 1.5
      ctx.stroke()
    }

    ctx.restore()
  }, [segments, style])

  useEffect(() => {
    drawWheel(rotationRef.current)
  }, [drawWheel])

  function handleTestSpin() {
    if (spinningRef.current || segments.length === 0) return
    spinningRef.current = true

    // Weighted random selection — shared with scratch card + mystery box
    const { index: winnerIdx } = selectRandomPrize(segments)

    // Calculate target angle: equal-size slices, land on winner's center
    const sliceAngle = 360 / segments.length
    const targetAngle = -(winnerIdx * sliceAngle + sliceAngle / 2)
    const totalRotation = 360 * 4 + targetAngle - (rotationRef.current % 360)
    const startRot = rotationRef.current
    const start = performance.now()
    const duration = 4000

    function animate(ts: number) {
      const elapsed = ts - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 4)
      rotationRef.current = startRot + totalRotation * eased
      drawWheel(rotationRef.current)
      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        spinningRef.current = false
      }
    }
    requestAnimationFrame(animate)
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-[300px] h-[300px]">
        {/* Pointer */}
        <div className="absolute top-[-8px] left-1/2 -translate-x-1/2 z-10 w-0 h-0 border-l-[12px] border-r-[12px] border-t-[22px] border-l-transparent border-r-transparent border-t-amber-400 drop-shadow-md" />
        <canvas
          ref={canvasRef}
          width={300}
          height={300}
          className="rounded-full shadow-lg"
          data-testid="wheel-preview-canvas"
        />
        {/* Center button */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-white rounded-full shadow-md flex items-center justify-center text-sm font-bold text-gray-400 z-10">
          &#127921;
        </div>
      </div>
      <button
        type="button"
        onClick={handleTestSpin}
        className="mt-4 px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        data-testid="test-spin-btn"
      >
        Test Spin
      </button>
      <p className="mt-2 text-xs text-gray-400">Click to preview the spin animation</p>
    </div>
  )
}

// ─── Scratch Card Preview ──────────────────────────────────────────────────

function drawCardOverlay(ctx: CanvasRenderingContext2D, w: number, h: number, cardStyle: string, text: string) {
  ctx.globalCompositeOperation = 'source-over'
  ctx.clearRect(0, 0, w, h)
  const grad = ctx.createLinearGradient(0, 0, w, h)
  if (cardStyle === 'silver') {
    grad.addColorStop(0, '#C0C0C0'); grad.addColorStop(0.3, '#E8E8E8'); grad.addColorStop(0.5, '#C0C0C0'); grad.addColorStop(1, '#A8A8A8')
  } else if (cardStyle === 'holiday') {
    grad.addColorStop(0, '#c41e3a'); grad.addColorStop(0.5, '#2d5a27'); grad.addColorStop(1, '#c41e3a')
  } else if (cardStyle === 'branded') {
    ctx.fillStyle = '#4f46e5'; ctx.fillRect(0, 0, w, h)
  } else {
    grad.addColorStop(0, '#D4AF37'); grad.addColorStop(0.3, '#F5E6A3'); grad.addColorStop(0.5, '#D4AF37'); grad.addColorStop(0.7, '#C5982C'); grad.addColorStop(1, '#D4AF37')
  }
  if (cardStyle !== 'branded') { ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h) }
  for (let i = 0; i < 800; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.1})`
    ctx.fillRect(Math.random() * w, Math.random() * h, 1, 1)
  }
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.font = 'bold 14px Inter, system-ui, sans-serif'
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(text || 'Scratch to reveal!', w / 2, h / 2)
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.5
  ctx.strokeRect(5, 5, w - 10, h - 10)
}

function ScratchCardPreview({ cardStyle, scratchText, prizes }: { cardStyle: string; scratchText: string; prizes: Array<{ probability: number; label: string }> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawingRef = useRef(false)
  const [currentPrize, setCurrentPrize] = useState(() => selectRandomPrize(prizes))
  const [revealed, setRevealed] = useState(false)
  const scratchCountRef = useRef(0)

  const resetCard = useCallback(() => {
    setCurrentPrize(selectRandomPrize(prizes))
    setRevealed(false)
    scratchCountRef.current = 0
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      if (ctx) drawCardOverlay(ctx, canvas.width, canvas.height, cardStyle, scratchText)
    }
  }, [prizes, cardStyle, scratchText])

  useEffect(() => { resetCard() }, [resetCard])

  function scratch(e: React.MouseEvent) {
    if (revealed) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const r = canvas.getBoundingClientRect()
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    ctx.arc(e.clientX - r.left, e.clientY - r.top, 16, 0, Math.PI * 2)
    ctx.fill()
    scratchCountRef.current++
    if (scratchCountRef.current > 40 && !revealed) {
      setRevealed(true)
      canvas.style.transition = 'opacity 0.4s'
      canvas.style.opacity = '0'
      setTimeout(() => { canvas.style.transition = ''; canvas.style.opacity = '1' }, 500)
    }
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-[300px] h-[180px] rounded-xl overflow-hidden shadow-lg" data-testid="scratch-preview">
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white">
          <span className="text-3xl mb-1">🎉</span>
          <span className="text-lg font-bold text-emerald-600">{currentPrize.label}</span>
        </div>
        <canvas ref={canvasRef} width={300} height={180} className="absolute inset-0 cursor-crosshair rounded-xl"
          onMouseDown={() => { isDrawingRef.current = true }}
          onMouseUp={() => { isDrawingRef.current = false }}
          onMouseLeave={() => { isDrawingRef.current = false }}
          onMouseMove={(e) => { if (isDrawingRef.current) scratch(e) }}
          data-testid="scratch-preview-canvas"
        />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <p className="text-xs text-gray-400">{revealed ? `Prize: ${currentPrize.label}` : 'Drag to scratch'}</p>
        <button type="button" onClick={resetCard} className="text-xs text-indigo-500 hover:text-indigo-700 font-medium" data-testid="scratch-reset-btn">Try Again</button>
      </div>
    </div>
  )
}

// ─── Mystery Box Preview ───────────────────────────────────────────────────

function MysteryBoxPreview({ prizes }: { prizes: Array<{ probability: number; label: string }> }) {
  const [opened, setOpened] = useState(false)
  const [currentPrize, setCurrentPrize] = useState(() => selectRandomPrize(prizes))

  function handleOpen() {
    if (opened) return
    setCurrentPrize(selectRandomPrize(prizes))
    setOpened(true)
  }

  function handleReset() {
    setOpened(false)
  }

  return (
    <div className="flex flex-col items-center" data-testid="mystery-box-preview">
      <div className="w-40 h-48 relative cursor-pointer select-none" onClick={handleOpen} style={{ perspective: '600px' }}>
        {/* Bow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-10 text-2xl" style={{ transition: 'opacity 0.3s', opacity: opened ? 0 : 1 }}>🎀</div>
        {/* Lid */}
        <div className="absolute top-1 left-[-3px] w-[166px] h-[38px] rounded-t-lg z-20" style={{
          background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
          transition: 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
          transformOrigin: 'bottom left',
          transform: opened ? 'rotate(-110deg) translateY(-16px)' : 'none',
        }}>
          <div className="absolute top-1/2 left-0 right-0 h-3 bg-amber-400 -translate-y-1/2" />
        </div>
        {/* Body */}
        <div className="absolute bottom-0 w-40 h-32 rounded-xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)', boxShadow: '0 6px 20px rgba(0,0,0,0.25)' }}>
          <div className="absolute top-1/2 left-0 right-0 h-3.5 bg-amber-400 -translate-y-1/2" />
          <div className="absolute top-0 bottom-0 left-1/2 w-3.5 bg-amber-400 -translate-x-1/2" />
        </div>
        {/* Prize emoji */}
        <div className="absolute top-0 left-1/2 text-3xl z-10" style={{
          transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s',
          opacity: opened ? 1 : 0,
          transform: `translateX(-50%) ${opened ? 'translateY(-30px)' : 'translateY(10px)'}`,
        }}>🎉</div>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <p className="text-xs text-gray-400">
          {opened ? `Prize: ${currentPrize.label}` : 'Click to open'}
        </p>
        {opened && (
          <button type="button" onClick={handleReset} className="text-xs text-indigo-500 hover:text-indigo-700 font-medium" data-testid="mystery-reset-btn">Try Again</button>
        )}
      </div>
    </div>
  )
}

// ─── Campaign Form Component ───────────────────────────────────────────────

export interface CampaignFormInitialData {
  name?: string
  programId?: string
  triggerType?: string
  conditionField?: string
  conditionOperator?: string
  conditionValue?: string
  actionType?: string
  actionPoints?: string
  actionMessage?: string
  budgetCap?: string
  startDate?: string
  endDate?: string
  segments?: SpinSegment[]
  wheelStyle?: 'classic' | 'neon' | 'minimal'
  prizes?: ScratchPrize[]
  cardStyle?: 'gold' | 'silver' | 'holiday' | 'branded'
  scratchText?: string
}

interface CampaignFormProps {
  initialData?: CampaignFormInitialData
  mode?: 'create' | 'edit'
  onSubmit: (payload: Record<string, unknown>) => Promise<{ id?: string } | void>
  title?: string
  subtitle?: string
  submitLabel?: string
  /** If true, actionType is locked (read-only) */
  lockActionType?: boolean
}

export default function CampaignForm({
  initialData,
  mode = 'create',
  onSubmit,
  title = 'Create Campaign',
  subtitle = 'Build a CX-triggered loyalty campaign',
  submitLabel,
  lockActionType = false,
}: CampaignFormProps) {
  const router = useRouter()
  const { getToken } = useAuth()
  const [programs, setPrograms] = useState<Program[]>([])
  const [createdCampaignId, setCreatedCampaignId] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>({
    name: initialData?.name ?? '',
    programId: initialData?.programId ?? '',
    triggerType: initialData?.triggerType ?? '',
    conditionField: initialData?.conditionField ?? '',
    conditionOperator: initialData?.conditionOperator ?? '',
    conditionValue: initialData?.conditionValue ?? '',
    actionType: initialData?.actionType ?? '',
    actionPoints: initialData?.actionPoints ?? '',
    actionMessage: initialData?.actionMessage ?? '',
    budgetCap: initialData?.budgetCap ?? '',
    startDate: initialData?.startDate ?? '',
    endDate: initialData?.endDate ?? '',
    segments: initialData?.segments ?? [
      { points: 500, probability: 40, label: '500 Points!', color: '#4F46E5' },
      { points: 100, probability: 60, label: '100 Points', color: '#10B981' },
    ],
    wheelStyle: initialData?.wheelStyle ?? 'classic' as const,
    prizes: initialData?.prizes ?? [
      { points: 500, probability: 30, label: '500 Points!' },
      { points: 50, probability: 70, label: '50 Points' },
    ],
    cardStyle: initialData?.cardStyle ?? 'gold' as const,
    scratchText: initialData?.scratchText ?? 'Scratch to reveal!',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    const fetchPrograms = async () => {
      const token = await getAuthToken(getToken)
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(`${API_URL}/v1/programs`, { headers })
      const d = await res.json()
      setPrograms(d.data ?? d.programs ?? [])
    }
    fetchPrograms().catch(() => {})
  }, [getToken])

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {}
    if (!form.name.trim()) errs.name = 'Campaign name is required'
    if (!form.programId) errs.programId = 'Please select a program'
    if (!form.triggerType) errs.triggerType = 'Please select a trigger type'
    if (!form.actionType) errs.actionType = 'Please select an action type'
    if (form.actionType === 'award_points' && (!form.actionPoints || Number(form.actionPoints) <= 0)) {
      errs.actionPoints = 'Points must be greater than 0'
    }
    if (form.actionType === 'send_message' && !form.actionMessage.trim()) {
      errs.actionMessage = 'Message is required'
    }
    if (form.actionType === 'spin_wheel') {
      if (form.segments.length < 2) errs.segments = 'Wheel must have at least 2 segments'
      if (form.segments.length > 8) errs.segments = 'Wheel can have at most 8 segments'
      const probSum = form.segments.reduce((s, seg) => s + seg.probability, 0)
      if (Math.abs(probSum - 100) > 0.01) errs.segments = `Probabilities must sum to 100% (currently ${probSum.toFixed(1)}%)`
      if (form.segments.some((s) => !s.label.trim())) errs.segments = 'All segments must have a label'
    }
    if (form.actionType === 'scratch_card' || form.actionType === 'mystery_box') {
      if (form.prizes.length < 2) errs.prizes = 'Must have at least 2 prizes'
      if (form.prizes.length > 8) errs.prizes = 'Can have at most 8 prizes'
      const probSum = form.prizes.reduce((s, p) => s + p.probability, 0)
      if (Math.abs(probSum - 100) > 0.01) errs.prizes = `Probabilities must sum to 100% (currently ${probSum.toFixed(1)}%)`
      if (form.prizes.some((p) => !p.label.trim())) errs.prizes = 'All prizes must have a label'
    }
    if (!form.startDate) errs.startDate = 'Start date is required'
    return errs
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setErrors({})
    setSubmitting(true)

    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        programId: form.programId,
        triggerType: form.triggerType,
        triggerCondition: form.conditionField
          ? { field: form.conditionField, op: form.conditionOperator, value: form.conditionValue }
          : undefined,
        actionType: form.actionType,
        actionConfig: form.actionType === 'spin_wheel'
          ? { segments: form.segments, wheelStyle: form.wheelStyle }
          : form.actionType === 'scratch_card'
            ? { prizes: form.prizes, cardStyle: form.cardStyle, scratchText: form.scratchText }
            : form.actionType === 'mystery_box'
              ? { prizes: form.prizes, boxStyle: form.cardStyle === 'silver' ? 'treasure' : form.cardStyle === 'branded' ? 'branded' : 'gift' }
              : form.actionType === 'award_points'
              ? { points: Number(form.actionPoints) }
              : { message: form.actionMessage },
        budgetCap: form.budgetCap ? Number(form.budgetCap) : undefined,
        startDate: form.startDate ? new Date(form.startDate).toISOString() : form.startDate,
        endDate: form.endDate ? new Date(form.endDate).toISOString() : undefined,
      }

      const result = await onSubmit(payload)
      const isInteractiveType = ['spin_wheel', 'scratch_card', 'mystery_box'].includes(form.actionType)
      if (mode === 'create' && isInteractiveType && result?.id) {
        setCreatedCampaignId(result.id)
      } else {
        router.push('/admin/campaigns')
      }
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  const isSpinWheel = form.actionType === 'spin_wheel'
  const isScratchCard = form.actionType === 'scratch_card'
  const isMysteryBox = form.actionType === 'mystery_box'
  const isInteractive = isSpinWheel || isScratchCard || isMysteryBox

  // After successful interactive campaign creation — show embed code
  if (createdCampaignId) {
    const componentName = form.actionType === 'scratch_card' ? 'ceq-scratch-card' : form.actionType === 'mystery_box' ? 'ceq-mystery-box' : 'ceq-spin-wheel'
    const memberPagePath = form.actionType === 'scratch_card' ? 'scratch' : form.actionType === 'mystery_box' ? 'mystery' : 'spin'
    return (
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Campaign Created!</h1>
          <p className="mt-1 text-sm text-gray-500">Your campaign is ready. Embed it on your site or share the link.</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Embed Code</h2>
          <div className="bg-gray-900 text-cyan-300 p-4 rounded-lg font-mono text-xs leading-relaxed relative">
            <button
              onClick={() => {
                navigator.clipboard.writeText(
                  `<script src="https://cdn.customereq.com/components/v1/ceq-components.js"></script>\n<${componentName} campaign-id="${createdCampaignId}" token="{{MEMBER_TOKEN}}"></${componentName}>`
                )
              }}
              className="absolute top-2 right-2 px-2 py-1 bg-gray-700 text-gray-300 rounded text-[10px] hover:bg-gray-600"
              data-testid="copy-embed-btn"
            >
              Copy
            </button>
            <div>&lt;script src=&quot;https://cdn.customereq.com/components/v1/ceq-components.js&quot;&gt;&lt;/script&gt;</div>
            <div className="mt-2">&lt;{componentName}</div>
            <div className="ml-4">campaign-id=&quot;{createdCampaignId}&quot;</div>
            <div className="ml-4">token=&quot;{'{{MEMBER_TOKEN}}'}&quot;&gt;</div>
            <div>&lt;/{componentName}&gt;</div>
          </div>
          <p className="mt-3 text-xs text-gray-500">
            Or use direct link: <code className="bg-gray-100 px-1 rounded">/{memberPagePath}/{createdCampaignId}</code>
          </p>
          <p className="mt-3 text-xs text-gray-500">
            Replace <code className="bg-gray-100 px-1 rounded">{'{{MEMBER_TOKEN}}'}</code> with the authenticated member&apos;s JWT token.
          </p>
          <div className="mt-6 flex gap-3">
            <button
              onClick={() => router.push('/admin/campaigns')}
              className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
              data-testid="go-to-campaigns-btn"
            >
              Go to Campaigns
            </button>
            <button
              onClick={() => { setCreatedCampaignId(null); setForm(f => ({ ...f, name: '' })) }}
              className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              Create Another
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={isInteractive ? 'max-w-5xl mx-auto' : 'max-w-2xl mx-auto'}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
      </div>

      <div className={isInteractive ? 'grid grid-cols-[1fr_380px] gap-8' : ''}>
        {/* Form Panel */}
        <div className="rounded-xl border border-gray-200 bg-white p-8">
          {serverError && (
            <div className="mb-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700" data-testid="server-error">
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Campaign Name */}
            <div>
              <label htmlFor="campaignName" className="block text-sm font-medium text-gray-700 mb-1">
                Campaign Name <span className="text-red-500">*</span>
              </label>
              <input
                id="campaignName"
                type="text"
                data-testid="campaign-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.name ? 'border-red-400' : 'border-gray-300'}`}
                placeholder="e.g. Holiday Spin & Win"
              />
              {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
            </div>

            {/* Program + Action Type row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="campaignProgram" className="block text-sm font-medium text-gray-700 mb-1">
                  Program <span className="text-red-500">*</span>
                </label>
                <select
                  id="campaignProgram"
                  data-testid="campaign-program-select"
                  value={form.programId}
                  onChange={(e) => setForm((f) => ({ ...f, programId: e.target.value }))}
                  className={`w-full rounded-lg border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.programId ? 'border-red-400' : 'border-gray-300'}`}
                >
                  <option value="">Select a program</option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                {errors.programId && <p className="mt-1 text-xs text-red-600">{errors.programId}</p>}
              </div>
              <div>
                <label htmlFor="actionType" className="block text-sm font-medium text-gray-700 mb-1">
                  Action Type <span className="text-red-500">*</span>
                </label>
                <select
                  id="actionType"
                  data-testid="campaign-action-type"
                  value={form.actionType}
                  disabled={lockActionType}
                  onChange={(e) => setForm((f) => ({ ...f, actionType: e.target.value }))}
                  className={`w-full rounded-lg border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.actionType ? 'border-red-400' : 'border-gray-300'}`}
                >
                  <option value="">Select action type</option>
                  <option value="award_points">Award Points</option>
                  <option value="send_message">Send Message</option>
                  <option value="spin_wheel">Spin Wheel</option>
              <option value="scratch_card">Scratch Card</option>
              <option value="mystery_box">Mystery Box</option>
                </select>
                {errors.actionType && <p className="mt-1 text-xs text-red-600">{errors.actionType}</p>}
              </div>
            </div>

            {/* Trigger Type + Budget row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="triggerType" className="block text-sm font-medium text-gray-700 mb-1">
                  Trigger Type <span className="text-red-500">*</span>
                </label>
                <select
                  id="triggerType"
                  data-testid="campaign-trigger-type"
                  value={form.triggerType}
                  onChange={(e) => setForm((f) => ({ ...f, triggerType: e.target.value }))}
                  className={`w-full rounded-lg border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.triggerType ? 'border-red-400' : 'border-gray-300'}`}
                >
                  <option value="">Select trigger type</option>
                  <option value="cx.nps_submitted">cx.nps_submitted</option>
                  <option value="cx.ticket_resolved">cx.ticket_resolved</option>
                  <option value="purchase">purchase</option>
                </select>
                {errors.triggerType && <p className="mt-1 text-xs text-red-600">{errors.triggerType}</p>}
              </div>
              <div>
                <label htmlFor="budgetCap" className="block text-sm font-medium text-gray-700 mb-1">
                  Budget Cap (USD) <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  id="budgetCap"
                  type="number"
                  data-testid="campaign-budget-cap"
                  value={form.budgetCap}
                  min={0}
                  onChange={(e) => setForm((f) => ({ ...f, budgetCap: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. 5000"
                />
              </div>
            </div>

            {/* Dates row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date <span className="text-red-500">*</span>
                </label>
                <input
                  id="startDate"
                  type="date"
                  data-testid="campaign-start-date"
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                  className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.startDate ? 'border-red-400' : 'border-gray-300'}`}
                />
                {errors.startDate && <p className="mt-1 text-xs text-red-600">{errors.startDate}</p>}
              </div>
              <div>
                <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
                  End Date <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  id="endDate"
                  type="date"
                  data-testid="campaign-end-date"
                  value={form.endDate}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Trigger Condition */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Trigger Condition <span className="text-gray-400 font-normal">(optional)</span></p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label htmlFor="conditionField" className="block text-xs text-gray-500 mb-1">Field</label>
                  <input id="conditionField" type="text" data-testid="campaign-condition-field" value={form.conditionField} onChange={(e) => setForm((f) => ({ ...f, conditionField: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. score" />
                </div>
                <div>
                  <label htmlFor="conditionOp" className="block text-xs text-gray-500 mb-1">Operator</label>
                  <select id="conditionOp" data-testid="campaign-condition-op" value={form.conditionOperator} onChange={(e) => setForm((f) => ({ ...f, conditionOperator: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">—</option>
                    <option value="lt">lt (&lt;)</option>
                    <option value="lte">lte (&le;)</option>
                    <option value="gt">gt (&gt;)</option>
                    <option value="gte">gte (&ge;)</option>
                    <option value="eq">eq (=)</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="conditionValue" className="block text-xs text-gray-500 mb-1">Value</label>
                  <input id="conditionValue" type="text" data-testid="campaign-condition-value" value={form.conditionValue} onChange={(e) => setForm((f) => ({ ...f, conditionValue: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. 6" />
                </div>
              </div>
            </div>

            {/* Award Points fields */}
            {form.actionType === 'award_points' && (
              <div>
                <label htmlFor="actionPoints" className="block text-sm font-medium text-gray-700 mb-1">Points to Award <span className="text-red-500">*</span></label>
                <input id="actionPoints" type="number" data-testid="campaign-action-points" value={form.actionPoints} min={1} onChange={(e) => setForm((f) => ({ ...f, actionPoints: e.target.value }))} className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.actionPoints ? 'border-red-400' : 'border-gray-300'}`} placeholder="e.g. 500" />
                {errors.actionPoints && <p className="mt-1 text-xs text-red-600">{errors.actionPoints}</p>}
              </div>
            )}

            {/* Send Message fields */}
            {form.actionType === 'send_message' && (
              <div>
                <label htmlFor="actionMessage" className="block text-sm font-medium text-gray-700 mb-1">Message <span className="text-red-500">*</span></label>
                <textarea id="actionMessage" data-testid="campaign-action-message" value={form.actionMessage} onChange={(e) => setForm((f) => ({ ...f, actionMessage: e.target.value }))} rows={3} className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.actionMessage ? 'border-red-400' : 'border-gray-300'}`} placeholder="e.g. Thank you for your feedback!" />
                {errors.actionMessage && <p className="mt-1 text-xs text-red-600">{errors.actionMessage}</p>}
              </div>
            )}

            {/* Spin Wheel Segment Builder */}
            {isSpinWheel && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-700">
                    Wheel Segments <span className="text-red-500">*</span>
                  </p>
                  <span className="text-xs text-gray-400">{form.segments.length}/8 segments</span>
                </div>

                {/* Column headers */}
                <div className="grid grid-cols-[32px_1fr_72px_1fr_56px_28px] gap-2 px-3 mb-1">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase">Color</span>
                  <span className="text-[10px] font-semibold text-gray-400 uppercase">Label</span>
                  <span className="text-[10px] font-semibold text-gray-400 uppercase">Points</span>
                  <span className="text-[10px] font-semibold text-gray-400 uppercase">Display Label</span>
                  <span className="text-[10px] font-semibold text-gray-400 uppercase">Prob</span>
                  <span />
                </div>

                <div className="space-y-2">
                  {form.segments.map((seg, idx) => (
                    <div key={idx} className="grid grid-cols-[32px_1fr_72px_56px_28px] items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <input
                        type="color"
                        value={seg.color}
                        onChange={(e) => {
                          const updated = [...form.segments]
                          updated[idx] = { ...updated[idx], color: e.target.value }
                          setForm((f) => ({ ...f, segments: updated }))
                        }}
                        className="w-8 h-8 rounded border border-gray-300 cursor-pointer p-0"
                        data-testid={`segment-color-${idx}`}
                      />
                      <input
                        type="text"
                        value={seg.label}
                        onChange={(e) => {
                          const updated = [...form.segments]
                          updated[idx] = { ...updated[idx], label: e.target.value }
                          setForm((f) => ({ ...f, segments: updated }))
                        }}
                        className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Label"
                        data-testid={`segment-label-${idx}`}
                      />
                      <input
                        type="number"
                        value={seg.points}
                        min={0}
                        onChange={(e) => {
                          const updated = [...form.segments]
                          updated[idx] = { ...updated[idx], points: Number(e.target.value) }
                          setForm((f) => ({ ...f, segments: updated }))
                        }}
                        className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Pts"
                        data-testid={`segment-points-${idx}`}
                      />
                      <div className="flex items-center gap-0.5">
                        <input
                          type="number"
                          value={seg.probability}
                          min={0}
                          max={100}
                          onChange={(e) => {
                            const updated = [...form.segments]
                            updated[idx] = { ...updated[idx], probability: Number(e.target.value) }
                            setForm((f) => ({ ...f, segments: updated }))
                          }}
                          className="w-14 rounded-lg border border-gray-300 px-1 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          data-testid={`segment-prob-${idx}`}
                        />
                        <span className="text-[10px] text-gray-400">%</span>
                      </div>
                      {form.segments.length > 2 ? (
                        <button
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, segments: f.segments.filter((_, i) => i !== idx) }))}
                          className="w-7 h-7 rounded border border-red-200 bg-red-50 text-red-500 text-sm flex items-center justify-center hover:bg-red-100"
                          data-testid={`segment-remove-${idx}`}
                        >
                          &times;
                        </button>
                      ) : <div className="w-7" />}
                    </div>
                  ))}
                </div>

                {form.segments.length < 8 && (
                  <button
                    type="button"
                    onClick={() => {
                      const nextColor = DEFAULT_COLORS[form.segments.length % DEFAULT_COLORS.length]
                      setForm((f) => ({
                        ...f,
                        segments: [...f.segments, { points: 100, probability: 0, label: '', color: nextColor }],
                      }))
                    }}
                    className="mt-2 w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
                    data-testid="add-segment-btn"
                  >
                    + Add Segment
                  </button>
                )}

                {(() => {
                  const sum = form.segments.reduce((s, seg) => s + seg.probability, 0)
                  const isValid = Math.abs(sum - 100) < 0.01
                  return (
                    <p className={`mt-2 text-xs text-right ${isValid ? 'text-green-600' : 'text-red-600'}`} data-testid="prob-total">
                      Total: {sum.toFixed(1)}% {isValid ? '\u2713' : '(must be 100%)'}
                    </p>
                  )
                })()}
                {errors.segments && <p className="mt-1 text-xs text-red-600">{errors.segments}</p>}

                {/* Wheel Style */}
                <div className="mt-4">
                  <p className="text-xs font-medium text-gray-500 mb-2">Wheel Style</p>
                  <div className="flex gap-2">
                    {(['classic', 'neon', 'minimal'] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, wheelStyle: s }))}
                        className={`flex-1 py-2 px-3 rounded-lg border text-sm capitalize transition-colors ${
                          form.wheelStyle === s
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Scratch Card Prize Builder */}
            {(isScratchCard || isMysteryBox) && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-700">Prize Pool <span className="text-red-500">*</span></p>
                  <span className="text-xs text-gray-400">{form.prizes.length}/8 prizes</span>
                </div>
                <div className="space-y-2">
                  {form.prizes.map((prize, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <input type="text" value={prize.label} onChange={(e) => { const u = [...form.prizes]; u[idx] = { ...u[idx], label: e.target.value }; setForm(f => ({ ...f, prizes: u })) }} className="flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Prize label" data-testid={`prize-label-${idx}`} />
                      <input type="number" value={prize.points} min={0} onChange={(e) => { const u = [...form.prizes]; u[idx] = { ...u[idx], points: Number(e.target.value) }; setForm(f => ({ ...f, prizes: u })) }} className="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Pts" data-testid={`prize-points-${idx}`} />
                      <div className="flex items-center gap-0.5">
                        <input type="number" value={prize.probability} min={0} max={100} onChange={(e) => { const u = [...form.prizes]; u[idx] = { ...u[idx], probability: Number(e.target.value) }; setForm(f => ({ ...f, prizes: u })) }} className="w-14 rounded-lg border border-gray-300 px-1 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500" data-testid={`prize-prob-${idx}`} />
                        <span className="text-[10px] text-gray-400">%</span>
                      </div>
                      {form.prizes.length > 2 ? (
                        <button type="button" onClick={() => setForm(f => ({ ...f, prizes: f.prizes.filter((_, i) => i !== idx) }))} className="w-7 h-7 rounded border border-red-200 bg-red-50 text-red-500 text-sm flex items-center justify-center hover:bg-red-100" data-testid={`prize-remove-${idx}`}>&times;</button>
                      ) : <div className="w-7" />}
                    </div>
                  ))}
                </div>
                {form.prizes.length < 8 && (
                  <button type="button" onClick={() => setForm(f => ({ ...f, prizes: [...f.prizes, { points: 100, probability: 0, label: '' }] }))} className="mt-2 w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors" data-testid="add-prize-btn">+ Add Prize</button>
                )}
                {(() => {
                  const sum = form.prizes.reduce((s, p) => s + p.probability, 0)
                  const isValid = Math.abs(sum - 100) < 0.01
                  return <p className={`mt-2 text-xs text-right ${isValid ? 'text-green-600' : 'text-red-600'}`} data-testid="prize-prob-total">Total: {sum.toFixed(1)}% {isValid ? '\u2713' : '(must be 100%)'}</p>
                })()}
                {errors.prizes && <p className="mt-1 text-xs text-red-600">{errors.prizes}</p>}

                <div className="mt-4">
                  <p className="text-xs font-medium text-gray-500 mb-2">Card Style</p>
                  <div className="flex gap-2">
                    {([
                      { key: 'gold' as const, label: 'Gold Foil', bg: 'linear-gradient(135deg, #D4AF37, #F5E6A3, #D4AF37)' },
                      { key: 'silver' as const, label: 'Silver', bg: 'linear-gradient(135deg, #C0C0C0, #E8E8E8, #C0C0C0)' },
                      { key: 'holiday' as const, label: 'Holiday', bg: 'linear-gradient(135deg, #c41e3a, #2d5a27, #c41e3a)' },
                      { key: 'branded' as const, label: 'Branded', bg: '#4f46e5' },
                    ]).map((s) => (
                      <button key={s.key} type="button" onClick={() => setForm(f => ({ ...f, cardStyle: s.key }))} className={`flex-1 rounded-lg border overflow-hidden transition-colors ${form.cardStyle === s.key ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-gray-200'}`}>
                        <div style={{ background: s.bg }} className="h-8" />
                        <div className="py-1.5 text-xs font-medium text-center">{s.label}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Scratch Text</label>
                  <input type="text" value={form.scratchText} onChange={(e) => setForm(f => ({ ...f, scratchText: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Scratch to reveal!" data-testid="scratch-text-input" />
                </div>
              </div>
            )}

            {/* Submit */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => router.push('/admin/campaigns')}
                className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                data-testid="campaign-submit-btn"
                disabled={submitting}
                className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? 'Saving...' : submitLabel ?? (isInteractive ? 'Save as Draft' : mode === 'edit' ? 'Save Changes' : 'Create Campaign')}
              </button>
            </div>
          </form>
        </div>

        {/* Live Preview Panel (interactive campaigns) */}
        {isInteractive && (
          <div className="sticky top-8 self-start">
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">Live Preview</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">DRAFT</span>
              </div>
              <div className="p-6">
                {isSpinWheel && <WheelPreview segments={form.segments} style={form.wheelStyle} />}
                {isScratchCard && (
                  <ScratchCardPreview
                    cardStyle={form.cardStyle}
                    scratchText={form.scratchText}
                    prizes={form.prizes}
                  />
                )}
                {isMysteryBox && (
                  <MysteryBoxPreview prizes={form.prizes} />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

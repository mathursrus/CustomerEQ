'use client'

/**
 * Circular health score badge with color coding.
 *
 * Color bands:
 *   0-20  red      (#ef4444)
 *  21-40  orange   (#f97316)
 *  41-60  yellow   (#eab308)
 *  61-80  green    (#22c55e)
 *  81-100 dark green (#16a34a)
 */

interface HealthScoreBadgeProps {
  score: number | null
  updatedAt?: string | Date | null
  /** 'sm' = inline table dot+number, 'lg' = circular ring badge */
  size?: 'sm' | 'lg'
}

function getScoreColor(score: number): { stroke: string; text: string; bg: string; label: string } {
  if (score <= 20) return { stroke: '#ef4444', text: 'text-red-700', bg: 'bg-red-50', label: 'Critical' }
  if (score <= 40) return { stroke: '#f97316', text: 'text-orange-700', bg: 'bg-orange-50', label: 'At Risk' }
  if (score <= 60) return { stroke: '#eab308', text: 'text-yellow-700', bg: 'bg-yellow-50', label: 'Needs Attention' }
  if (score <= 80) return { stroke: '#22c55e', text: 'text-green-700', bg: 'bg-green-50', label: 'Healthy' }
  return { stroke: '#16a34a', text: 'text-green-700', bg: 'bg-green-50', label: 'Excellent' }
}

function getDotColor(score: number): string {
  if (score <= 20) return 'bg-red-500'
  if (score <= 40) return 'bg-orange-500'
  if (score <= 60) return 'bg-yellow-500'
  return 'bg-green-500'
}

function getTextColor(score: number): string {
  if (score <= 20) return 'text-red-700'
  if (score <= 40) return 'text-orange-700'
  if (score <= 60) return 'text-yellow-700'
  return 'text-green-700'
}

function formatUpdatedAt(d: string | Date | null | undefined): string | null {
  if (!d) return null
  const date = typeof d === 'string' ? new Date(d) : d
  const diff = Date.now() - date.getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (hours < 1) return 'Updated just now'
  if (hours < 24) return `Updated ${hours}h ago`
  const days = Math.floor(hours / 24)
  return `Updated ${days}d ago`
}

/** Small inline indicator for table cells */
function SmallBadge({ score }: { score: number | null }) {
  if (score === null || score === undefined) {
    return <span className="text-xs text-gray-400 italic">Not computed</span>
  }
  return (
    <div className="inline-flex items-center gap-1.5">
      <div className={`w-2.5 h-2.5 rounded-full ${getDotColor(score)}`} />
      <span className={`font-semibold ${getTextColor(score)}`}>{score}</span>
    </div>
  )
}

/** Large circular ring badge for 360 views */
function LargeBadge({ score, updatedAt }: { score: number | null; updatedAt?: string | Date | null }) {
  if (score === null || score === undefined) {
    return (
      <div className="text-center shrink-0">
        <div className="relative w-24 h-24">
          <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" stroke="#e5e7eb" strokeWidth="8" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-sm text-gray-400">N/A</span>
            <span className="text-[10px] text-gray-400 uppercase tracking-wide">Health</span>
          </div>
        </div>
        <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-50 text-gray-500">
          Not computed
        </span>
      </div>
    )
  }

  const { stroke, text, bg, label } = getScoreColor(score)
  // Circumference of circle with r=45: 2 * PI * 45 = ~283
  const circumference = 283
  const offset = circumference - (circumference * score) / 100

  return (
    <div className="text-center shrink-0">
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="none" stroke="#e5e7eb" strokeWidth="8" />
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke={stroke}
            strokeWidth="8"
            strokeDasharray={String(circumference)}
            strokeDashoffset={String(offset)}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-gray-900">{score}</span>
          <span className="text-[10px] text-gray-400 uppercase tracking-wide">Health</span>
        </div>
      </div>
      <span
        className={`inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${bg} ${text}`}
      >
        {label}
      </span>
      {updatedAt && (
        <p className="text-[10px] text-gray-400 mt-0.5">{formatUpdatedAt(updatedAt)}</p>
      )}
    </div>
  )
}

export function HealthScoreBadge({ score, updatedAt, size = 'sm' }: HealthScoreBadgeProps) {
  if (size === 'lg') return <LargeBadge score={score} updatedAt={updatedAt} />
  return <SmallBadge score={score} />
}

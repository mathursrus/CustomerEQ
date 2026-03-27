'use client'

interface StatusBadgeProps {
  status: string
  colorMap?: Record<string, string>
}

const defaultColors: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  DRAFT: 'bg-gray-100 text-gray-700',
  PAUSED: 'bg-yellow-100 text-yellow-700',
  ARCHIVED: 'bg-red-100 text-red-700',
  CLOSED: 'bg-red-100 text-red-700',
}

export function StatusBadge({ status, colorMap }: StatusBadgeProps) {
  const colors = colorMap ?? defaultColors
  const cls = colors[status] ?? 'bg-gray-100 text-gray-700'
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  )
}

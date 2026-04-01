'use client'

interface BudgetBarProps {
  usedCents: number
  totalCents: number
  label?: string
}

function formatUSD(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })
}

export function BudgetBar({ usedCents, totalCents, label }: BudgetBarProps) {
  const pct = totalCents > 0 ? Math.min(100, Math.round((usedCents / totalCents) * 100)) : 0
  const barColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-400' : 'bg-green-500'
  const textColor = pct >= 90 ? 'text-red-600' : pct >= 70 ? 'text-yellow-600' : 'text-green-600'

  return (
    <div className="space-y-1">
      {label && <p className="text-xs font-medium text-gray-500">{label}</p>}
      <div className="flex items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className={`min-w-8 text-right text-xs font-medium tabular-nums ${textColor}`}>{pct}%</span>
      </div>
      <p className="text-xs text-gray-500">
        {formatUSD(usedCents)} used of {formatUSD(totalCents)}
      </p>
    </div>
  )
}

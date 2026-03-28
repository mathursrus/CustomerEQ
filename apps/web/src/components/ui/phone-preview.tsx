'use client'

interface Reward {
  name: string
  pointsCost: number
}

interface PhonePreviewProps {
  memberName?: string
  pointBalance?: number
  currencyName?: string
  tierName?: string
  tierProgress?: number // 0–100
  tierNextThreshold?: number
  rewards?: Reward[]
}

export function PhonePreview({
  memberName = 'Member',
  pointBalance = 0,
  currencyName = 'Points',
  tierName,
  tierProgress = 0,
  tierNextThreshold,
  rewards = [],
}: PhonePreviewProps) {
  const empty = !tierName && rewards.length === 0

  return (
    <div className="mx-auto w-64 overflow-hidden rounded-3xl border-4 border-gray-800 bg-white shadow-2xl">
      {/* Status bar */}
      <div className="flex items-center justify-between bg-gray-800 px-4 py-1.5">
        <span className="text-xs font-medium text-white">9:41</span>
        <div className="flex items-center gap-1">
          <svg className="h-3 w-3 fill-white" viewBox="0 0 20 20">
            <path d="M10 2a8 8 0 100 16A8 8 0 0010 2z" opacity=".3" />
            <path d="M10 5a5 5 0 100 10A5 5 0 0010 5z" opacity=".6" />
            <circle cx="10" cy="10" r="2" />
          </svg>
        </div>
      </div>

      {/* Header */}
      <div className="bg-indigo-600 px-4 pb-6 pt-4">
        <p className="text-xs text-indigo-200">Welcome back,</p>
        <p className="font-semibold text-white">{memberName}</p>
        <div className="mt-3 text-center">
          <p className="tabular-nums text-4xl font-bold text-white">{pointBalance.toLocaleString()}</p>
          <p className="mt-0.5 text-xs text-indigo-200">{currencyName}</p>
        </div>
      </div>

      {/* Body */}
      <div className="-mt-2 space-y-4 px-4 py-4">
        {tierName && (
          <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-700">{tierName}</span>
              {tierNextThreshold !== undefined && tierNextThreshold > pointBalance && (
                <span className="text-xs text-gray-400">
                  {(tierNextThreshold - pointBalance).toLocaleString()} pts to next tier
                </span>
              )}
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all"
                style={{ width: `${Math.min(100, Math.max(0, tierProgress))}%` }}
              />
            </div>
          </div>
        )}

        {rewards.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Available Rewards
            </p>
            <div className="space-y-2">
              {rewards.slice(0, 3).map((r, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-gray-100 bg-white px-3 py-2 shadow-sm"
                >
                  <span className="text-xs text-gray-700">{r.name}</span>
                  <span className="text-xs font-semibold text-indigo-600">
                    {r.pointsCost.toLocaleString()} pts
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {empty && (
          <div className="py-4 text-center text-xs text-gray-400">
            Run a simulation to see the preview update.
          </div>
        )}
      </div>
    </div>
  )
}

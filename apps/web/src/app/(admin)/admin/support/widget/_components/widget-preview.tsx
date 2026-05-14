'use client'

export type WidgetPosition = 'BOTTOM_RIGHT' | 'BOTTOM_LEFT'

export interface WidgetConfig {
  position: WidgetPosition
  launcherIconUrl: string | null
  darkModeAuto: boolean
  greeting: string
  offlineMessage: string
  csatPromptText: string
  escalateButtonText: string
  showCsatAfterAi: boolean
  csatTimeoutSeconds: number
  anonAllowed: boolean
}

interface WidgetPreviewProps {
  config: WidgetConfig
}

export function WidgetPreview({ config }: WidgetPreviewProps) {
  const isLeft = config.position === 'BOTTOM_LEFT'

  return (
    <div className="relative h-[520px] rounded-xl border border-gray-200 bg-gray-50 overflow-hidden">
      {/* mock browser chrome */}
      <div className="flex items-center gap-1.5 border-b border-gray-200 bg-white px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
        <span className="ml-2 flex-1 rounded bg-gray-100 px-2 py-0.5 text-[10px] text-gray-400">
          yoursite.com
        </span>
      </div>

      {/* mock page content */}
      <div className="absolute inset-0 top-9 p-6 text-xs text-gray-300 select-none">
        <div className="mb-2 h-3 w-1/2 rounded bg-gray-200" />
        <div className="mb-1.5 h-2 w-3/4 rounded bg-gray-200" />
        <div className="mb-1.5 h-2 w-2/3 rounded bg-gray-200" />
        <div className="mb-1.5 h-2 w-3/4 rounded bg-gray-200" />
      </div>

      {/* chat panel */}
      <div
        className={`absolute bottom-20 ${isLeft ? 'left-4' : 'right-4'} w-72 rounded-xl border border-gray-200 bg-white shadow-xl`}
      >
        {/* panel header */}
        <div className="flex items-center gap-2 border-b border-gray-100 bg-indigo-600 px-4 py-3 rounded-t-xl">
          <span className="h-6 w-6 rounded-full bg-white/20 text-[11px] flex items-center justify-center text-white">
            S
          </span>
          <span className="text-sm font-semibold text-white">Support</span>
          <button className="ml-auto text-white/70 hover:text-white text-xs">&#x2715;</button>
        </div>

        {/* messages */}
        <div className="space-y-2.5 p-3">
          {/* AI greeting */}
          <div className="flex items-start gap-2">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[9px] font-bold text-indigo-600">
              AI
            </span>
            <div className="rounded-lg bg-gray-100 px-3 py-2 text-xs text-gray-800 leading-snug">
              {config.greeting || <span className="italic text-gray-400">No greeting set</span>}
            </div>
          </div>

          {/* sample customer message */}
          <div className="flex justify-end">
            <div className="max-w-[75%] rounded-lg bg-indigo-600 px-3 py-2 text-xs text-white leading-snug">
              Hi, I need help with my order.
            </div>
          </div>

          {/* CSAT prompt (conditional) */}
          {config.showCsatAfterAi && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-[11px]">
              <span className="text-gray-600">{config.csatPromptText}</span>
              <span className="ml-2 cursor-default select-none">
                <button className="mr-0.5 hover:scale-110 transition-transform">&#128077;</button>
                <button className="hover:scale-110 transition-transform">&#128078;</button>
              </span>
            </div>
          )}

          {/* escalate button */}
          <button className="w-full rounded-lg border border-indigo-600 px-3 py-1.5 text-[11px] font-medium text-indigo-600 hover:bg-indigo-50 transition-colors">
            {config.escalateButtonText || 'Talk to a human'}
          </button>
        </div>
      </div>

      {/* launcher button */}
      <button
        className={`absolute bottom-5 ${isLeft ? 'left-4' : 'right-4'} flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 transition-colors text-xl`}
        aria-label="Open support chat"
      >
        {config.launcherIconUrl ? (
          <img src={config.launcherIconUrl} alt="" className="h-7 w-7 object-contain" />
        ) : (
          <span>&#128172;</span>
        )}
      </button>

      {/* position indicator */}
      <div className="absolute top-12 left-1/2 -translate-x-1/2 rounded-full bg-white/80 px-2 py-0.5 text-[9px] font-medium text-gray-500 shadow">
        {config.position === 'BOTTOM_LEFT' ? 'Bottom left' : 'Bottom right'}
      </div>
    </div>
  )
}

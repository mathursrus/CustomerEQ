'use client'

interface ViewOnlyBannerProps {
  entityLabel: string
  onEdit: () => void
}

export function ViewOnlyBanner({ entityLabel, onEdit }: ViewOnlyBannerProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3">
      <div className="flex items-center gap-2 text-sm text-yellow-800">
        <svg
          className="h-4 w-4 shrink-0 text-yellow-600"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        You are viewing this {entityLabel.toLowerCase()} in read-only mode. Changes are not saved.
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="ml-4 shrink-0 rounded-lg bg-yellow-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-yellow-700 transition-colors"
      >
        ✏️ Edit {entityLabel}
      </button>
    </div>
  )
}

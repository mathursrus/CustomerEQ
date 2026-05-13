// Issue #241 Slice 4b (#336) — LookFeelTab stub.
// Walking-skeleton placeholder for Phase 4 Item 7 (deferred to next session).
// Full implementation: channel × viewport split + theme picker + chrome matrix.

'use client'

import type { BrandThemeLite } from '@/components/survey-form/types'

import type {
  EditorBrand,
  EditorSurvey,
} from '../__fixtures__/editor-fixtures'

export interface LookFeelTabProps {
  survey: EditorSurvey
  brand: EditorBrand
  themes: BrandThemeLite[]
  onChange: (patch: { themeId?: string; settings?: Record<string, unknown> }) => void
  disabled: boolean
}

export function LookFeelTab({ themes, disabled }: LookFeelTabProps) {
  return (
    <div className="space-y-4 p-4">
      <p className="text-sm text-gray-500">
        Look &amp; Feel editor — full surface lands in Phase 4 Item 7 (next session).
      </p>
      <p className="text-xs text-gray-400">
        {themes.length} theme{themes.length === 1 ? '' : 's'} available.
        {disabled ? ' Read-only.' : ''}
      </p>
    </div>
  )
}

// Issue #405 — default themes moved to `@customerEQ/shared` so the editor
// preview (apps/web) can render the same fallback as the respondent path
// and the seed routines (api lazy-upsert, backfill script) without
// duplicating the source of truth. This file is now a thin re-export so
// the existing `import { DEFAULT_THEMES } from '../lib/default-themes.js'`
// call sites inside apps/api keep working unchanged.
export {
  DEFAULT_THEMES,
  DEFAULT_THEME_NAMES,
  FALLBACK_RESPONDENT_THEME,
  FALLBACK_RESPONDENT_THEME_ID,
  type DefaultThemeSeed,
} from '@customerEQ/shared'

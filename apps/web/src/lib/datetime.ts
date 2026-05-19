// Issue #378 — web-side re-exports of the brand-TZ datetime utilities.
//
// Lives at `apps/web/src/lib/datetime.ts` per RFC §File-level change list.
// All web consumers (admin Distribute pages, Batch detail page, future
// surfaces with brand-TZ display) import from here so there's one
// canonical chain: web → shared/datetime → date-fns-tz.

export {
  formatInBrandTz,
  endOfDayInBrandTz,
  addDaysInBrandTz,
  resolveLocale,
} from '@customerEQ/shared'

/**
 * Convenience wrapper for the common "absolute date+time with TZ label"
 * shape used in the Distribute success banner + batch detail header. The
 * default format mirrors the spec example "May 22, 2026 11:59:59 PM PT".
 */
import { formatInBrandTz as formatInBrandTzFn } from '@customerEQ/shared'

export function formatBrandAbsolute(
  iso: string | Date,
  brandTimezone: string,
  brandLocale: string,
): string {
  return formatInBrandTzFn(iso, brandTimezone, brandLocale, 'MMM d, yyyy h:mm:ss a zzz')
}

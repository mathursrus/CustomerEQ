// Issue #378 — brand-timezone + brand-locale display utilities.
//
// Wraps `date-fns-tz` v3 so consumers don't have to reach for the library
// directly. Two primitives cover all #378 surfaces:
//
//   formatInBrandTz(date, tz, locale, format?) — display a UTC instant in the
//     brand's IANA timezone (e.g., "America/Los_Angeles") and BCP-47 locale
//     (e.g., "en-US"). Default format is suitable for the Success banner and
//     batch-detail header; callers override per surface.
//
//   endOfDayInBrandTz(localDate, tz) — given a calendar date interpreted in
//     the brand's TZ, return the UTC instant that displays as 23:59:59.999
//     wall-clock in that TZ. Used by R11 preset snap ("7 days" → EOD on the
//     calendar day 7 days from now in brand TZ).
//
//   addDaysInBrandTz(now, days, tz) — calendar-aware day addition projected
//     through the brand's TZ wall-clock so DST springs/falls inside the
//     window resolve to the same wall-clock-EOD on the target day.
//
//   resolveLocale(bcp47) — map a BCP-47 locale string to a date-fns Locale
//     object, falling back to en-US for unknown values. Extending the set
//     is a one-line addition per locale.
//
// Spike correctness (15 cases including PT/ET DST, NZ Southern hemisphere,
// IST half-hour, boundary days): see `docs/evidence/378-tz-spike/findings.md`.

import { addDays } from 'date-fns'
// date-fns v3 exports default-region locales as 2-letter codes (fr, de, ja,
// es, it) and region-specific locales with the country suffix (enUS, enGB,
// ptBR). We map both spellings to BCP-47 strings the brand row stores.
import { enUS, enGB, fr, de, ja, es, ptBR, it } from 'date-fns/locale'
import type { Locale } from 'date-fns'
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz'

const LOCALE_REGISTRY: Readonly<Record<string, Locale>> = Object.freeze({
  'en-US': enUS,
  'en-GB': enGB,
  'fr-FR': fr,
  'de-DE': de,
  'ja-JP': ja,
  'es-ES': es,
  'pt-BR': ptBR,
  'it-IT': it,
})

const DEFAULT_FORMAT = "MMM d, yyyy h:mm:ss a zzz"

export function resolveLocale(bcp47: string | undefined | null): Locale {
  if (!bcp47) return enUS
  return LOCALE_REGISTRY[bcp47] ?? enUS
}

export function formatInBrandTz(
  date: Date | string,
  brandTimezone: string,
  brandLocale: string,
  dateFormat: string = DEFAULT_FORMAT,
): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return formatInTimeZone(d, brandTimezone, dateFormat, {
    locale: resolveLocale(brandLocale),
  })
}

export function endOfDayInBrandTz(localDate: Date, brandTimezone: string): Date {
  const ymd = formatInTimeZone(localDate, brandTimezone, 'yyyy-MM-dd')
  return fromZonedTime(`${ymd}T23:59:59.999`, brandTimezone)
}

export function addDaysInBrandTz(now: Date, days: number, brandTimezone: string): Date {
  // toZonedTime returns a Date whose internal UTC value is the wall-clock
  // time in the brand TZ (i.e., it's offset-shifted, not a true UTC). Adding
  // days in that space is correct calendar-aware arithmetic. We then convert
  // the wall-clock-shifted Date back to true UTC via fromZonedTime so
  // downstream consumers (e.g., endOfDayInBrandTz) can re-project through
  // the TZ without double-projecting.
  const zoned = toZonedTime(now, brandTimezone)
  const shifted = addDays(zoned, days)
  return fromZonedTime(shifted, brandTimezone)
}

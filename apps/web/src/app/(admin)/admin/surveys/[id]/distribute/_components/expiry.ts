// Issue #420 — shared expiry-preset → ISO resolver used by both distribute
// flows (ManagedEmailFlow + SelfServeFlow). Extracted (#420-Q-004 DRY) after
// G21/L1 made both flows' copies byte-identical.
//
// G21 — expiry anchors to end-of-day in the BRAND's timezone, not UTC. Routes
// through the canonical addDaysInBrandTz + endOfDayInBrandTz helpers from
// packages/shared/src/datetime.ts (DST-aware, validated by the #378 TZ spike).

import { addDaysInBrandTz, endOfDayInBrandTz } from '@customerEQ/shared'

const PRESET_DAYS: Record<'24h' | '7d' | '30d' | '90d', number> = {
  '24h': 1,
  '7d': 7,
  '30d': 30,
  '90d': 90,
}

export function presetToIsoExpiry(
  preset: '24h' | '7d' | '30d' | '90d',
  brandTimezone: string,
): string {
  const targetDay = addDaysInBrandTz(new Date(), PRESET_DAYS[preset], brandTimezone)
  return endOfDayInBrandTz(targetDay, brandTimezone).toISOString()
}

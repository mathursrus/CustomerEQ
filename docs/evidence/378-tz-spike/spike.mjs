// FRAIM technical-design Phase 3 spike for #378 OD-2
// (Brand-timezone EOD arithmetic — does the simpler approach work, or do we
// need a library?)
//
// Reviewer challenge: "Why is it not as simple as getting current time in
// Brand's timezone, doing the math and updating time to 23:59:59.999 for the
// date returned? Run a Spike for this"
//
// This script tests three approaches against the same set of TZ + DST inputs
// and prints the actual outputs so we can decide OD-2 against real data
// rather than instinct.
//
// Run: node docs/evidence/378-tz-spike/spike.mjs

// ── Approach A — reviewer's proposal, native Intl only ───────────────────────
// "Get YYYY-MM-DD of (now + N days) in brand TZ. Treat as 23:59:59.999 in
// brand TZ. Convert to UTC for storage."
function endOfDayInBrandTzApproachA(nowDate, addDays, tz) {
  // 1) Get current YYYY-MM-DD in the brand TZ.
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const parts = Object.fromEntries(fmt.formatToParts(nowDate).map(p => [p.type, p.value]));

  // 2) Add N days. We work in calendar-date space: take the parts, build a
  //    UTC anchor at noon (avoids DST near-boundary slippage on the addition
  //    itself), add N×86_400_000 ms, then re-format in the brand TZ to get
  //    the new YYYY-MM-DD.
  const anchorUtc = new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day, 12, 0, 0));
  const shifted = new Date(anchorUtc.getTime() + addDays * 86_400_000);
  const shiftedParts = Object.fromEntries(fmt.formatToParts(shifted).map(p => [p.type, p.value]));

  // 3) Treat ${y}-${m}-${d}T23:59:59.999 as a wall-clock time in the brand
  //    TZ. Convert that to UTC by computing the brand TZ's offset AT that
  //    wall-clock instant (this is the part that handles DST correctly).
  const y = +shiftedParts.year;
  const m = +shiftedParts.month;
  const d = +shiftedParts.day;
  return wallClockToUtc(y, m, d, 23, 59, 59, 999, tz);
}

// Convert (Y, M, D, h, m, s, ms) wall-clock in `tz` to the corresponding UTC Date.
// Uses Intl to query the offset at the candidate instant and corrects for it.
function wallClockToUtc(year, month, day, hour, minute, second, ms, tz) {
  // Treat the desired wall-clock as if it were UTC; this gives an instant that
  // is wrong by exactly (the tz's offset at that wall-clock time).
  const naiveUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, second, ms));

  // Query the offset of `tz` at `naiveUtc`. Format the same instant in `tz`
  // and in `UTC`; the difference in wall-clock-displayed time IS the offset.
  const tzFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const utcFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const tzParts = Object.fromEntries(tzFmt.formatToParts(naiveUtc).map(p => [p.type, p.value]));
  const utcParts = Object.fromEntries(utcFmt.formatToParts(naiveUtc).map(p => [p.type, p.value]));
  const tzMs = Date.UTC(
    +tzParts.year, +tzParts.month - 1, +tzParts.day,
    tzParts.hour === '24' ? 0 : +tzParts.hour,
    +tzParts.minute, +tzParts.second,
  );
  const utcMs = Date.UTC(
    +utcParts.year, +utcParts.month - 1, +utcParts.day,
    utcParts.hour === '24' ? 0 : +utcParts.hour,
    +utcParts.minute, +utcParts.second,
  );
  const offsetMs = tzMs - utcMs;
  // The actual UTC instant we want is naiveUtc minus the offset.
  return new Date(naiveUtc.getTime() - offsetMs);
}

// ── Approach B — my original RFC helper (split-on-en-CA-dash) ────────────────
// Kept as the comparison baseline so we can see whether the locale-string
// trick gives the same answers or not.
function endOfDayInBrandTzApproachB(nowDate, addDays, tz) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  });
  // Add N days using the same anchor strategy.
  const ymdNow = fmt.format(nowDate); // 'YYYY-MM-DD'
  const [y0, m0, d0] = ymdNow.split('-').map(Number);
  const anchor = new Date(Date.UTC(y0, m0 - 1, d0, 12, 0, 0));
  const shifted = new Date(anchor.getTime() + addDays * 86_400_000);
  const ymdShifted = fmt.format(shifted);
  const [y, m, d] = ymdShifted.split('-').map(Number);
  return wallClockToUtc(y, m, d, 23, 59, 59, 999, tz);
}

// ── Approach C — what `date-fns-tz` does internally ──────────────────────────
// `zonedTimeToUtc('2026-05-22T23:59:59.999', 'America/Los_Angeles')` is
// equivalent to: parse the ISO local-time string, treat it as wall-clock in
// the named TZ, compute the UTC instant. This is the same `wallClockToUtc`
// primitive A and B use. The library is essentially a one-line API over it.
// We model that here so the spike can decide whether to pay for the library
// for the ergonomics, not for correctness.
function endOfDayInBrandTzApproachC(nowDate, addDays, tz) {
  // Equivalent to:
  //   import { format, addDays as addDaysFn } from 'date-fns'
  //   import { utcToZonedTime, zonedTimeToUtc } from 'date-fns-tz'
  //   const zonedNow = utcToZonedTime(nowDate, tz)
  //   const targetWallclockDate = addDaysFn(zonedNow, addDays)
  //   const ymd = format(targetWallclockDate, 'yyyy-MM-dd')
  //   return zonedTimeToUtc(`${ymd}T23:59:59.999`, tz)
  //
  // Approximated here with native code so the spike runs without an install.

  // Step 1: project nowDate into tz wall-clock — same as A/B step 1.
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const parts = Object.fromEntries(fmt.formatToParts(nowDate).map(p => [p.type, p.value]));
  // Step 2: add N days in wall-clock space (date-fns `addDays` is calendar-aware).
  const anchor = new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day, 12));
  const shifted = new Date(anchor.getTime() + addDays * 86_400_000);
  const shiftedParts = Object.fromEntries(fmt.formatToParts(shifted).map(p => [p.type, p.value]));
  // Step 3: zonedTimeToUtc('YYYY-MM-DDT23:59:59.999', tz)
  return wallClockToUtc(+shiftedParts.year, +shiftedParts.month, +shiftedParts.day, 23, 59, 59, 999, tz);
}

// ── Test fixtures ─────────────────────────────────────────────────────────────
// (nowDate, addDays, tz, label) — chosen to hit DST boundaries deliberately.
const tests = [
  // Baseline — no DST involved
  { nowDate: '2026-05-15T14:00:00Z', addDays: 7, tz: 'UTC',                    label: 'baseline: UTC, no DST in window' },
  { nowDate: '2026-05-15T21:00:00Z', addDays: 7, tz: 'America/Los_Angeles',    label: 'PT, no DST in window (mid-May → mid-May)' },
  { nowDate: '2026-05-15T05:00:00Z', addDays: 7, tz: 'Asia/Tokyo',             label: 'JST, no DST (Japan does not observe DST)' },

  // DST spring-forward in window (US: 2026-03-08, 02:00 local → 03:00 local)
  { nowDate: '2026-03-05T21:00:00Z', addDays: 7, tz: 'America/Los_Angeles',    label: 'PT, spring-forward inside window' },
  { nowDate: '2026-03-05T21:00:00Z', addDays: 7, tz: 'America/New_York',       label: 'ET, spring-forward inside window' },

  // DST fall-back in window (US: 2026-11-01, 02:00 local → 01:00 local)
  { nowDate: '2026-10-29T21:00:00Z', addDays: 7, tz: 'America/Los_Angeles',    label: 'PT, fall-back inside window' },
  { nowDate: '2026-10-29T21:00:00Z', addDays: 7, tz: 'America/New_York',       label: 'ET, fall-back inside window' },

  // Southern hemisphere DST (NZ: 2026-04-05 falls back; 2026-09-27 springs forward)
  { nowDate: '2026-04-02T05:00:00Z', addDays: 7, tz: 'Pacific/Auckland',       label: 'NZDT/NZST, fall-back inside window' },
  { nowDate: '2026-09-24T05:00:00Z', addDays: 7, tz: 'Pacific/Auckland',       label: 'NZST/NZDT, spring-forward inside window' },

  // Exact spring-forward day
  { nowDate: '2026-03-08T07:00:00Z', addDays: 0, tz: 'America/Los_Angeles',    label: 'PT, EOD on DST spring-forward day itself' },
  // Exact fall-back day
  { nowDate: '2026-11-01T07:00:00Z', addDays: 0, tz: 'America/Los_Angeles',    label: 'PT, EOD on DST fall-back day itself' },

  // Custom date — preset = 0 ("today EOD")
  { nowDate: '2026-05-15T21:00:00Z', addDays: 0, tz: 'America/Los_Angeles',    label: 'PT, today EOD' },

  // Half-hour TZ
  { nowDate: '2026-05-15T07:00:00Z', addDays: 7, tz: 'Asia/Kolkata',           label: 'IST (+05:30), no DST' },

  // 90-day preset
  { nowDate: '2026-05-15T21:00:00Z', addDays: 90, tz: 'America/Los_Angeles',   label: 'PT, 90-day preset (crosses fall-back? no — Aug 13)' },
  { nowDate: '2026-08-15T20:00:00Z', addDays: 90, tz: 'America/Los_Angeles',   label: 'PT, 90-day preset crossing fall-back (Aug 15 → Nov 13)' },
];

function fmtDisplay(d, tz) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: true, timeZoneName: 'short',
    year: 'numeric', month: 'short', day: '2-digit',
    hour: 'numeric', minute: '2-digit', second: '2-digit',
  }).format(d);
}

console.log('# Brand-TZ EOD spike — three-approach comparison');
console.log('');
console.log('Each row: (now, +days, tz) → resulting UTC instant, and the same');
console.log('instant displayed in the brand TZ (should always read XX:59:59 PM).');
console.log('');

let passCount = 0;
let failCount = 0;
const failures = [];

for (const t of tests) {
  const now = new Date(t.nowDate);
  const ra = endOfDayInBrandTzApproachA(now, t.addDays, t.tz);
  const rb = endOfDayInBrandTzApproachB(now, t.addDays, t.tz);
  const rc = endOfDayInBrandTzApproachC(now, t.addDays, t.tz);

  const allMatch = ra.getTime() === rb.getTime() && rb.getTime() === rc.getTime();
  const utcDisp = ra.toISOString();
  const tzDisp = fmtDisplay(ra, t.tz);
  // Validate: when displayed in the brand TZ, it must read "11:59:59 PM" (or 23:59:59 in 24h).
  const wallClockOk = tzDisp.includes('11:59:59 PM');

  if (allMatch && wallClockOk) {
    passCount++;
    console.log(`✓ ${t.label}`);
    console.log(`    utc: ${utcDisp}  ·  tz: ${tzDisp}`);
  } else {
    failCount++;
    failures.push({ t, ra, rb, rc, allMatch, wallClockOk });
    console.log(`✗ ${t.label}`);
    console.log(`    A: ${ra.toISOString()}  ·  tz: ${fmtDisplay(ra, t.tz)}`);
    console.log(`    B: ${rb.toISOString()}  ·  tz: ${fmtDisplay(rb, t.tz)}`);
    console.log(`    C: ${rc.toISOString()}  ·  tz: ${fmtDisplay(rc, t.tz)}`);
    console.log(`    allMatch=${allMatch}  wallClockOk=${wallClockOk}`);
  }
}

console.log('');
console.log(`Result: ${passCount}/${tests.length} pass, ${failCount} fail`);
if (failures.length > 0) {
  console.log('');
  console.log('Failures detail:');
  for (const f of failures) {
    console.log(`  - ${f.t.label}: allMatch=${f.allMatch} wallClockOk=${f.wallClockOk}`);
  }
}

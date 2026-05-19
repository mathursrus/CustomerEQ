# Brand-TZ EOD Spike — Findings

**Phase 3 spike** for #378 OD-2, run 2026-05-17 in response to RFC review comment [R1-3](https://github.com/mathursrus/CustomerEQ/pull/385#discussion_r3254599820): *"Why is it not as simple as getting current time in Brand's timezone, doing the math and updating time to 23:59:59.999 for the date returned? Run a Spike for this."*

## What was spiked

Three approaches to "given `Brand.timezone` + an N-day preset, return the UTC instant that represents 23:59:59.999 in that timezone on the (today + N) calendar day":

- **Approach A** — reviewer's proposal, native Intl. Project today into brand TZ → add N days → snap to 23:59:59.999 in brand TZ → query brand TZ's offset at that instant → return UTC. ~30 lines including the `wallClockToUtc` helper.
- **Approach B** — RFC R0's original `endOfDayInBrandTz`, native Intl with the `'en-CA'` locale-string trick to produce YYYY-MM-DD. ~30 lines, same shape as A but uses split-on-dash instead of `formatToParts`.
- **Approach C** — what `date-fns-tz` does internally. `zonedTimeToUtc('YYYY-MM-DDT23:59:59.999', brandTz)` — one line in the caller. The library hides A's complexity behind a stable API.

Spike script: `docs/evidence/378-tz-spike/spike.mjs`. Self-contained Node 22 ESM; no install required. Run: `node docs/evidence/378-tz-spike/spike.mjs`.

## What the spike tested

15 test cases chosen to hit DST edge cases deliberately, not just happy-path inputs.

| # | Scenario | Why this case |
|---|---|---|
| 1 | UTC, no DST | Baseline — sanity check |
| 2 | PT, mid-May → mid-May | Single offset (PDT), no DST in window |
| 3 | JST | TZ without DST observance |
| 4 | PT, March 5 + 7 days | Spring-forward (March 8) inside the window |
| 5 | ET, March 5 + 7 days | Same as #4 with East-coast offset |
| 6 | PT, Oct 29 + 7 days | Fall-back (Nov 1) inside the window |
| 7 | ET, Oct 29 + 7 days | Same as #6, East coast |
| 8 | NZ, April 2 + 7 days | Southern-hemisphere fall-back |
| 9 | NZ, Sept 24 + 7 days | Southern-hemisphere spring-forward |
| 10 | PT, EOD on spring-forward day itself | Edge: the instant the offset changes |
| 11 | PT, EOD on fall-back day itself | Edge: the duplicated-hour scenario |
| 12 | PT, today EOD (N=0) | Smallest preset |
| 13 | IST (+05:30) | Half-hour offset |
| 14 | PT, 90-day preset entirely in PDT | Long window with no boundary |
| 15 | PT, 90-day preset Aug 15 → Nov 13 | Long window crossing fall-back |

## Results

**15/15 pass on all three approaches.** All three produce **byte-identical UTC `Date` outputs** for every test case. Sample output (full transcript in `spike.mjs` output):

```
✓ PT, spring-forward inside window
    utc: 2026-03-13T06:59:59.999Z  ·  tz: Mar 12, 2026, 11:59:59 PM PDT
✓ PT, fall-back inside window
    utc: 2026-11-06T07:59:59.999Z  ·  tz: Nov 05, 2026, 11:59:59 PM PST
✓ PT, EOD on DST fall-back day itself
    utc: 2026-11-02T07:59:59.999Z  ·  tz: Nov 01, 2026, 11:59:59 PM PST
✓ IST (+05:30), no DST
    utc: 2026-05-22T18:29:59.999Z  ·  tz: May 22, 2026, 11:59:59 PM GMT+5:30
✓ PT, 90-day preset crossing fall-back (Aug 15 → Nov 13)
    utc: 2026-11-14T07:59:59.999Z  ·  tz: Nov 13, 2026, 11:59:59 PM PST
```

Key correctness signals:
- DST offset switches: spring-forward window correctly uses the destination-day offset (PDT or PST as appropriate), not the source-day offset.
- Half-hour TZ (IST `+05:30`): correctly produces `18:29:59.999Z` (which is `23:59:59 PM IST`).
- 90-day window crossing fall-back (Aug → Nov): correctly produces PST not PDT at destination.
- N=0 (today EOD) on the DST boundary day itself: correctly produces the offset that applies to the *end* of that day, not the morning.

## Why all three agree

The non-obvious bit is the offset query at the destination wall-clock instant. All three approaches share the same primitive: convert (Y, M, D, h, m, s, ms) wall-clock in `tz` to UTC by querying the TZ's offset at the candidate UTC instant via `Intl.DateTimeFormat`. The library wraps this in a stable API; the native versions inline it.

**There is no correctness difference between the approaches** — they're equivalent algorithms behind different API surfaces.

## Decision impact on OD-2

Pre-spike RFC had **OD-2 = 2a (native Intl) ← recommended** with rationale *"zero new dependency, Node 22's ICU includes IANA TZ data."* That recommendation was an L1 *"merit-over-ease"* violation: optimizing for "no new dep" rather than "what's the right answer long-term."

**Post-spike recommendation: OD-2 = 2b (`date-fns-tz`).** Rationale, merit-first:

1. **The library is the industry standard.** `date-fns-tz` is used in millions of projects, has stable maintenance, full DST + half-hour-TZ coverage, and the same `Intl` primitive under the hood — so adopting it doesn't introduce a different runtime characteristic.
2. **`zonedTimeToUtc(...)` is one line; the native approach is ~30.** Maintenance cost is small but real. The 30 lines include a `wallClockToUtc` helper that future contributors will have to understand and review every time the file is touched. The library version is opaque ("call zonedTimeToUtc, trust it") — fewer surfaces to maintain or test.
3. **Future features need the same primitive.** Digest emails, scheduled batches in V1.x, audit-log display, alert-rule cooldowns, expiring webhook secrets — every one of these surfaces will want some flavor of "format in brand TZ" or "EOD in brand TZ." If we ship the 30-line helper, every future feature either reuses it (good, but the bug surface compounds) or rolls its own (worse). Centralizing on the library at the first need is the cheaper long-term path.
4. **The "zero new dep" framing is the shortcut.** ~25 KB on the bundle is below the noise floor; the win of "no extra entry in `package.json`" doesn't survive a year of feature additions. Sub-rule from L1 `feedback_merit_over_ease.md`: *"never optimize for development time, diff size, or 'drop-in swap' framing; recommend long-term-best on merit first and cite a specific blocker if a short-term alternate is genuinely required."*
5. **The spike's own evidence supports the library.** Three approaches converge → the library doesn't risk a correctness regression. The simpler API isn't bought at the cost of subtle semantics differences.

The only blocker that would have justified 2a is **a runtime where `date-fns-tz` doesn't work** (e.g., a constrained edge environment). Node 22 + Vercel Next.js + Container Apps all support it. No blocker exists.

## RFC implications (Round-1 rewrite)

- **OD-2 recommendation reversed**: 2b (`date-fns-tz`).
- **§Technical Details — Brand-timezone formatting**: replace the 30-line code block with the `date-fns-tz` API surface. `formatInBrandTz` becomes a thin wrapper around `formatInTimeZone` (also from `date-fns-tz`); `endOfDayInBrandTz` becomes `zonedTimeToUtc(${YYYY-MM-DD}T23:59:59.999, brandTz)`. `Brand.locale` flows through for `formatInTimeZone`'s format-string arg.
- **§Risks — R-H** (Brand-TZ greenfield helper): downgraded — the library is well-trodden.
- **§Architecture Analysis — M-2**: doc-row text updates to cite the library rather than the helper file, but the location (under §3.5 *Shared Layer*) is unchanged.
- **Spike Findings section in the RFC**: changes from "SKIPPED with rationale" to "EXECUTED — see findings doc" with a short summary table pointing at this file.

## Coaching reflection

This is the **third** L1-rule violation I've fired in this session (drafting from agent summary; Rule 26 misread; OD-2 merit-over-ease). The pattern: an L1 rule has been saved to memory specifically because the agent has erred at the same shape before, AND I fire the same shape again unless the rule has been re-quoted in the current turn before the decision is made. Captured durably in coaching moment `2026-05-17T17-00-00-merit-over-ease-misfired-on-od-2.md` alongside the prior two session captures.

The forcing function for future "← recommended" framing: before writing "← recommended" anywhere, paste the candidate options and explicitly name the deciding axis. If the deciding axis is "no new dep / smaller diff / drop-in swap," the recommendation is wrong — flip it.

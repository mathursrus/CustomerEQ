# Issue #229 — Demo Sandbox: Seed Script + Scenario CLI
## Implementation Work List

**Issue**: [#229 Demo sandbox: seed script + scenario CLI](https://github.com/mathursrus/CustomerEQ/issues/229)
**Branch**: `feature/issue-229-demo-seed-scenario-cli`
**Type**: Feature (developer tooling)
**UI required**: No

---

## Deliverables

- [ ] `scripts/seed-demo.ts` — idempotent StarBrew seed (brand content + 5 personas + purchase history)
- [ ] `scripts/run-scenario.ts` — CLI for 5 named scenarios via real API pipeline
- [ ] `package.json` — `seed:demo` and `run-scenario` scripts added; `tsx` in root devDeps

---

## Implementation Checklist

### scripts/seed-demo.ts
- [ ] Creates `StarBrew Rewards` program under existing BRAND_ID (env-overridable)
- [ ] Adds 2 earning rules: `purchase` (500 pts fixed) + `cx.survey_completed` (50 pts)
- [ ] Activates program
- [ ] Creates `StarBrew` survey theme (green/gold)
- [ ] Creates NPS survey (Post-Purchase) → activates
- [ ] Creates CSAT survey (Store Experience) → activates
- [ ] Creates detractor recovery campaign (trigger: `cx.nps_response` score ≤ 6, action: award 200 pts)
- [ ] Creates reward: "Free Tall Coffee" (500 pts)
- [ ] Enrolls 5 personas with consent (idempotent — skips existing emails)
- [ ] Fires purchase events per persona to build points history
- [ ] Prints summary with member IDs, balances, and demo URLs

### scripts/run-scenario.ts
- [ ] `--scenario unhappy-customer` — Sara Kim submits 2-star NPS → triggers Issue #6 pipeline
- [ ] `--scenario earn-points` — Alex Chen purchase event → 500 pts credited
- [ ] `--scenario redeem-reward` — David Wu redeems "Free Tall Coffee"
- [ ] `--scenario at-risk-trigger` — James Park low CSAT submission
- [ ] `--scenario new-member-first-purchase` — Maria Lopez purchase event
- [ ] Fails loudly if personas not seeded (clear error, not silent skip)
- [ ] Shows timestamps; unhappy-customer shows wall-clock time for <15 min SLA demo

---

## Validation Requirements

- `uiValidationRequired`: false
- `mobileValidationRequired`: false
- Manual validation: run `pnpm seed:demo` against local stack → all steps succeed → run each scenario → verify events in worker logs and DB

---

## Architecture Notes

- Uses `POST /v1/events` (BullMQ pipeline, not direct DB writes) — rule 5 compliance
- All API calls carry `X-Test-Brand-Id` + `X-Test-User-Id` headers (dev auth pattern)
- Consent is passed on enrollment so event ingestion doesn't reject members
- Idempotency: member lookup via `GET /v1/members?q=email` before enroll; 409 on duplicate program creation is a no-op
- No new migrations, models, or packages required

---

## Open Questions / Deferrals

- Tier thresholds: script does not create Tier records; existing program tiers (if any) will auto-assign based on points balance.
- Backdated purchase timestamps: `POST /v1/events` schema has no `timestamp` field — all events created with current time. Acceptable for demo.

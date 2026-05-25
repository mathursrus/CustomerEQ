# CD Pipeline Metrics

_Last updated: 2026-05-25 02:28 UTC by the [cd-metrics workflow](../.github/workflows/cd-metrics.yml)_

## 30-Day Summary

| Metric | Value | Status |
|--------|-------|--------|
| CD P50 wall clock | 13m 7s | ✅ |
| CD P90 wall clock | 17m 34s | ✅ |
| Merge → live P50 | 28m 54s | ✅ |
| Merge → live P90 | 42m 15s ⚠️ | ⚠️ |
| CD success rate (7d) | 56% ⚠️ | ⚠️ |
| Deploys analysed (30d) | 164 | — |

> ⚠️ = threshold breached. P90 alert: >25m · Any failure alerts immediately · Merge→live >30m.

## Phase Breakdown (avg, last 30 days)

| Phase | Avg Duration |
|-------|-------------|
| Image builds | 12m 14s |
| Migration | 1m 10s |
| Container deploy | 1m 5s |
| Verification | 3s |

## Last 20 Deploys

| Date (UTC) | Trigger | Total | Merge→Live | Outcome |
|------------|---------|-------|------------|---------|
| [2026-05-24 21:34](https://github.com/mathursrus/CustomerEQ/actions/runs/26373377477) | manual | 20m 8s | 20m 14s | ✅ |
| [2026-05-23 22:54](https://github.com/mathursrus/CustomerEQ/actions/runs/26345732689) | manual | 19m 36s | 19m 42s | ✅ |
| [2026-05-23 21:40](https://github.com/mathursrus/CustomerEQ/actions/runs/26344252796) | auto | 16m 47s | 29m 48s | ✅ |
| [2026-05-23 21:28](https://github.com/mathursrus/CustomerEQ/actions/runs/26344002830) | manual | 19m 38s | 12m 58s | ✅ |
| [2026-05-23 21:08](https://github.com/mathursrus/CustomerEQ/actions/runs/26343597314) | manual | 20m 3s | — | ✅ |
| [2026-05-23 16:03](https://github.com/mathursrus/CustomerEQ/actions/runs/26337316227) | manual | 19m 57s | — | ✅ |
| [2026-05-23 14:48](https://github.com/mathursrus/CustomerEQ/actions/runs/26335694036) | manual | 19m 58s | — | ✅ |
| [2026-05-23 14:46](https://github.com/mathursrus/CustomerEQ/actions/runs/26335667082) | manual | 20s | — | ❌ |
| [2026-05-23 14:46](https://github.com/mathursrus/CustomerEQ/actions/runs/26335657901) | manual | 32s | — | ⏭️ |
| [2026-05-23 04:37](https://github.com/mathursrus/CustomerEQ/actions/runs/26323630478) | manual | 19m 46s | — | ✅ |
| [2026-05-23 04:14](https://github.com/mathursrus/CustomerEQ/actions/runs/26323191979) | manual | 20m 1s | — | ✅ |
| [2026-05-23 04:11](https://github.com/mathursrus/CustomerEQ/actions/runs/26323129313) | manual | 15s | — | ❌ |
| [2026-05-22 09:45](https://github.com/mathursrus/CustomerEQ/actions/runs/26280639254) | auto | 16m 44s | 28m 54s | ✅ |
| [2026-05-22 09:14](https://github.com/mathursrus/CustomerEQ/actions/runs/26279231939) | auto | 11s | — | ✅ |
| [2026-05-22 09:05](https://github.com/mathursrus/CustomerEQ/actions/runs/26278825582) | auto | 10s | — | ✅ |
| [2026-05-22 07:41](https://github.com/mathursrus/CustomerEQ/actions/runs/26275082737) | auto | 17m 11s | 29m 17s | ✅ |
| [2026-05-22 05:56](https://github.com/mathursrus/CustomerEQ/actions/runs/26271107713) | auto | 17m 34s | 29m 19s | ✅ |
| [2026-05-21 21:20](https://github.com/mathursrus/CustomerEQ/actions/runs/26253801783) | auto | 20m 0s | 32m 1s ⚠️ | ✅ |
| [2026-05-21 03:53](https://github.com/mathursrus/CustomerEQ/actions/runs/26204408123) | auto | 18m 0s | 29m 49s | ✅ |
| [2026-05-21 03:20](https://github.com/mathursrus/CustomerEQ/actions/runs/26203437159) | auto | 12s | 11m 38s | ⏭️ |


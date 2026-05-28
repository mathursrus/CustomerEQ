# CD Pipeline Metrics

_Last updated: 2026-05-28 02:17 UTC by the [cd-metrics workflow](../.github/workflows/cd-metrics.yml)_

## 30-Day Summary

| Metric | Value | Status |
|--------|-------|--------|
| CD P50 wall clock | 13m 15s | ✅ |
| CD P90 wall clock | 19m 36s | ✅ |
| Merge → live P50 | 28m 20s | ✅ |
| Merge → live P90 | 42m 15s ⚠️ | ⚠️ |
| CD success rate (7d) | 69% ⚠️ | ⚠️ |
| Deploys analysed (30d) | 170 | — |

> ⚠️ = threshold breached. P90 alert: >25m · Any failure alerts immediately · Merge→live >30m.

## Phase Breakdown (avg, last 30 days)

| Phase | Avg Duration |
|-------|-------------|
| Image builds | 12m 39s |
| Migration | 1m 10s |
| Container deploy | 1m 7s |
| Verification | 4s |

## Last 20 Deploys

| Date (UTC) | Trigger | Total | Merge→Live | Outcome |
|------------|---------|-------|------------|---------|
| [2026-05-27 22:05](https://github.com/mathursrus/CustomerEQ/actions/runs/26541495029) | auto | 16m 12s | — | ✅ |
| [2026-05-27 22:00](https://github.com/mathursrus/CustomerEQ/actions/runs/26541299840) | auto | -1s | — | ⏭️ |
| [2026-05-27 21:56](https://github.com/mathursrus/CustomerEQ/actions/runs/26541113083) | auto | 0s | — | ⏭️ |
| [2026-05-27 21:43](https://github.com/mathursrus/CustomerEQ/actions/runs/26540516576) | auto | -8s | 1m 4s | ⏭️ |
| [2026-05-26 09:12](https://github.com/mathursrus/CustomerEQ/actions/runs/26443328899) | manual | 20m 34s | 20m 42s | ✅ |
| [2026-05-26 07:54](https://github.com/mathursrus/CustomerEQ/actions/runs/26439747013) | manual | 20m 11s | 20m 18s | ✅ |
| [2026-05-26 07:17](https://github.com/mathursrus/CustomerEQ/actions/runs/26438146560) | manual | 20m 9s | 20m 16s | ✅ |
| [2026-05-26 02:22](https://github.com/mathursrus/CustomerEQ/actions/runs/26428629712) | auto | 16m 48s | — | ✅ |
| [2026-05-25 22:35](https://github.com/mathursrus/CustomerEQ/actions/runs/26422444624) | auto | 17m 11s | — | ✅ |
| [2026-05-25 22:13](https://github.com/mathursrus/CustomerEQ/actions/runs/26421835671) | auto | 17m 9s | — | ✅ |
| [2026-05-25 22:05](https://github.com/mathursrus/CustomerEQ/actions/runs/26421613602) | auto | 20m 3s | — | ✅ |
| [2026-05-25 21:49](https://github.com/mathursrus/CustomerEQ/actions/runs/26421121489) | auto | 17m 25s | — | ✅ |
| [2026-05-25 02:30](https://github.com/mathursrus/CustomerEQ/actions/runs/26380121761) | auto | 17m 6s | — | ✅ |
| [2026-05-25 02:06](https://github.com/mathursrus/CustomerEQ/actions/runs/26379517201) | manual | 20m 11s | 20m 17s | ✅ |
| [2026-05-24 21:34](https://github.com/mathursrus/CustomerEQ/actions/runs/26373377477) | manual | 20m 8s | 20m 14s | ✅ |
| [2026-05-23 22:54](https://github.com/mathursrus/CustomerEQ/actions/runs/26345732689) | manual | 19m 36s | 19m 42s | ✅ |
| [2026-05-23 21:40](https://github.com/mathursrus/CustomerEQ/actions/runs/26344252796) | auto | 16m 47s | 29m 48s | ✅ |
| [2026-05-23 21:28](https://github.com/mathursrus/CustomerEQ/actions/runs/26344002830) | manual | 19m 38s | 12m 58s | ✅ |
| [2026-05-23 21:08](https://github.com/mathursrus/CustomerEQ/actions/runs/26343597314) | manual | 20m 3s | — | ✅ |
| [2026-05-23 16:03](https://github.com/mathursrus/CustomerEQ/actions/runs/26337316227) | manual | 19m 57s | — | ✅ |


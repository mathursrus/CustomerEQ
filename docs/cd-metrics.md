# CD Pipeline Metrics

_Last updated: 2026-05-23 02:18 UTC by the [cd-metrics workflow](../.github/workflows/cd-metrics.yml)_

## 30-Day Summary

| Metric | Value | Status |
|--------|-------|--------|
| CD P50 wall clock | 12m 58s | ✅ |
| CD P90 wall clock | 16m 21s | ✅ |
| Merge → live P50 | 24m 58s | ✅ |
| Merge → live P90 | 37m 55s ⚠️ | ⚠️ |
| CD success rate (7d) | 56% ⚠️ | ⚠️ |
| Deploys analysed (30d) | 161 | — |

> ⚠️ = threshold breached. P90 alert: >25m · Any failure alerts immediately · Merge→live >30m.

## Phase Breakdown (avg, last 30 days)

| Phase | Avg Duration |
|-------|-------------|
| Image builds | 11m 54s |
| Migration | 1m 11s |
| Container deploy | 1m 2s |
| Verification | 3s |

## Last 20 Deploys

| Date (UTC) | Trigger | Total | Merge→Live | Outcome |
|------------|---------|-------|------------|---------|
| [2026-05-22 09:45](https://github.com/mathursrus/CustomerEQ/actions/runs/26280639254) | auto | 16m 44s | 28m 54s | ✅ |
| [2026-05-22 09:14](https://github.com/mathursrus/CustomerEQ/actions/runs/26279231939) | auto | 11s | — | ✅ |
| [2026-05-22 09:05](https://github.com/mathursrus/CustomerEQ/actions/runs/26278825582) | auto | 10s | — | ✅ |
| [2026-05-22 07:41](https://github.com/mathursrus/CustomerEQ/actions/runs/26275082737) | auto | 17m 11s | 29m 17s | ✅ |
| [2026-05-22 05:56](https://github.com/mathursrus/CustomerEQ/actions/runs/26271107713) | auto | 17m 34s | 29m 19s | ✅ |
| [2026-05-21 21:20](https://github.com/mathursrus/CustomerEQ/actions/runs/26253801783) | auto | 20m 0s | 32m 1s ⚠️ | ✅ |
| [2026-05-21 03:53](https://github.com/mathursrus/CustomerEQ/actions/runs/26204408123) | auto | 18m 0s | 29m 49s | ✅ |
| [2026-05-21 03:20](https://github.com/mathursrus/CustomerEQ/actions/runs/26203437159) | auto | 12s | 11m 38s | ⏭️ |
| [2026-05-21 02:31](https://github.com/mathursrus/CustomerEQ/actions/runs/26201937339) | auto | 15m 29s | 47m 18s ⚠️ | ⏭️ |
| [2026-05-21 02:30](https://github.com/mathursrus/CustomerEQ/actions/runs/26201920699) | auto | 19m 53s | 31m 45s ⚠️ | ❌ |
| [2026-05-21 02:30](https://github.com/mathursrus/CustomerEQ/actions/runs/26201918629) | auto | 10s | 11m 49s | ❌ |
| [2026-05-21 02:30](https://github.com/mathursrus/CustomerEQ/actions/runs/26201909130) | auto | 7s | 11m 26s | ❌ |
| [2026-05-21 02:19](https://github.com/mathursrus/CustomerEQ/actions/runs/26201568617) | auto | 10s | 43s | ❌ |
| [2026-05-21 00:22](https://github.com/mathursrus/CustomerEQ/actions/runs/26197803007) | auto | 18m 42s | 48m 49s ⚠️ | ❌ |
| [2026-05-21 00:22](https://github.com/mathursrus/CustomerEQ/actions/runs/26197795779) | auto | 18m 22s | 30m 3s ⚠️ | ❌ |
| [2026-05-21 00:00](https://github.com/mathursrus/CustomerEQ/actions/runs/26197065424) | auto | -1s | — | ⏭️ |
| [2026-05-20 20:28](https://github.com/mathursrus/CustomerEQ/actions/runs/26188047755) | auto | 0s | 11m 51s | ⏭️ |
| [2026-05-20 20:27](https://github.com/mathursrus/CustomerEQ/actions/runs/26188035972) | auto | 0s | 11m 39s | ⏭️ |
| [2026-05-20 09:04](https://github.com/mathursrus/CustomerEQ/actions/runs/26152645514) | auto | 17m 0s | 47m 6s ⚠️ | ✅ |
| [2026-05-20 09:00](https://github.com/mathursrus/CustomerEQ/actions/runs/26152431887) | auto | 19m 45s | 29m 59s | ✅ |


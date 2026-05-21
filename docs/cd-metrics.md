# CD Pipeline Metrics

_Last updated: 2026-05-20 23:50 UTC by the [cd-metrics workflow](../.github/workflows/cd-metrics.yml)_

## 30-Day Summary

| Metric | Value | Status |
|--------|-------|--------|
| CD P50 wall clock | 12m 36s | ✅ |
| CD P90 wall clock | 14m 21s | ✅ |
| Merge → live P50 | — | ✅ |
| Merge → live P90 | — | ✅ |
| CD success rate (7d) | 59% ⚠️ | ⚠️ |
| Deploys analysed (30d) | 157 | — |

> ⚠️ = threshold breached. P90 alert: >25m · Any failure alerts immediately · Merge→live >30m.

## Phase Breakdown (avg, last 30 days)

| Phase | Avg Duration |
|-------|-------------|
| Image builds | 11m 31s |
| Migration | 1m 7s |
| Container deploy | 59s |
| Verification | 2s |

## Last 20 Deploys

| Date (UTC) | Trigger | Total | Merge→Live | Outcome |
|------------|---------|-------|------------|---------|
| [2026-05-20 20:28](https://github.com/mathursrus/CustomerEQ/actions/runs/26188047755) | auto | 0s | — | ⏭️ |
| [2026-05-20 20:27](https://github.com/mathursrus/CustomerEQ/actions/runs/26188035972) | auto | 0s | — | ⏭️ |
| [2026-05-20 09:04](https://github.com/mathursrus/CustomerEQ/actions/runs/26152645514) | auto | 17m 0s | — | ✅ |
| [2026-05-20 09:00](https://github.com/mathursrus/CustomerEQ/actions/runs/26152431887) | auto | 19m 45s | — | ✅ |
| [2026-05-20 00:15](https://github.com/mathursrus/CustomerEQ/actions/runs/26133256145) | auto | 17m 16s | — | ✅ |
| [2026-05-19 21:57](https://github.com/mathursrus/CustomerEQ/actions/runs/26127798689) | auto | 21m 45s | — | ✅ |
| [2026-05-19 19:01](https://github.com/mathursrus/CustomerEQ/actions/runs/26118852792) | auto | 20m 7s | — | ✅ |
| [2026-05-19 18:39](https://github.com/mathursrus/CustomerEQ/actions/runs/26117659178) | auto | 29s | — | ❌ |
| [2026-05-19 17:51](https://github.com/mathursrus/CustomerEQ/actions/runs/26115093500) | manual | 3m 42s | — | ❌ |
| [2026-05-19 16:24](https://github.com/mathursrus/CustomerEQ/actions/runs/26110473645) | manual | 11m 11s | — | ❌ |
| [2026-05-18 17:43](https://github.com/mathursrus/CustomerEQ/actions/runs/26050204929) | auto | 16m 26s | — | ✅ |
| [2026-05-18 10:48](https://github.com/mathursrus/CustomerEQ/actions/runs/26028819245) | auto | 6s | — | ✅ |
| [2026-05-18 10:47](https://github.com/mathursrus/CustomerEQ/actions/runs/26028786077) | auto | 16m 21s | — | ✅ |
| [2026-05-18 10:10](https://github.com/mathursrus/CustomerEQ/actions/runs/26027123208) | auto | 9s | — | ✅ |
| [2026-05-18 09:31](https://github.com/mathursrus/CustomerEQ/actions/runs/26025241123) | auto | 16m 15s | — | ✅ |
| [2026-05-18 08:47](https://github.com/mathursrus/CustomerEQ/actions/runs/26023141576) | auto | 14m 33s | — | ❌ |
| [2026-05-18 08:45](https://github.com/mathursrus/CustomerEQ/actions/runs/26023046920) | manual | 14m 16s | — | ❌ |
| [2026-05-18 08:21](https://github.com/mathursrus/CustomerEQ/actions/runs/26021936906) | auto | 14m 8s | — | ❌ |
| [2026-05-18 07:51](https://github.com/mathursrus/CustomerEQ/actions/runs/26020628301) | auto | 7s | — | ✅ |
| [2026-05-18 03:59](https://github.com/mathursrus/CustomerEQ/actions/runs/26012731097) | auto | 14m 17s | — | ❌ |


# CD Pipeline Metrics

_Last updated: 2026-05-31 02:17 UTC by the [cd-metrics workflow](../.github/workflows/cd-metrics.yml)_

## 30-Day Summary

| Metric | Value | Status |
|--------|-------|--------|
| CD P50 wall clock | 13m 48s | ✅ |
| CD P90 wall clock | 20m 3s | ✅ |
| Merge → live P50 | 25m 10s | ✅ |
| Merge → live P90 | 42m 1s ⚠️ | ⚠️ |
| CD success rate (7d) | 90% ⚠️ | ⚠️ |
| Deploys analysed (30d) | 171 | — |

> ⚠️ = threshold breached. P90 alert: >25m · Any failure alerts immediately · Merge→live >30m.

## Phase Breakdown (avg, last 30 days)

| Phase | Avg Duration |
|-------|-------------|
| Image builds | 13m 17s |
| Migration | 1m 10s |
| Container deploy | 1m 12s |
| Verification | 4s |

## Last 20 Deploys

| Date (UTC) | Trigger | Total | Merge→Live | Outcome |
|------------|---------|-------|------------|---------|
| [2026-05-30 23:53](https://github.com/mathursrus/CustomerEQ/actions/runs/26698261309) | manual | 20m 8s | 20m 14s | ✅ |
| [2026-05-30 23:08](https://github.com/mathursrus/CustomerEQ/actions/runs/26697399616) | manual | 19m 52s | 19m 58s | ✅ |
| [2026-05-30 16:58](https://github.com/mathursrus/CustomerEQ/actions/runs/26689650350) | manual | 20m 10s | 20m 15s | ✅ |
| [2026-05-29 17:27](https://github.com/mathursrus/CustomerEQ/actions/runs/26652045374) | manual | 21m 8s | 21m 16s | ✅ |
| [2026-05-29 07:36](https://github.com/mathursrus/CustomerEQ/actions/runs/26624642731) | manual | 20m 16s | 20m 23s | ✅ |
| [2026-05-29 05:10](https://github.com/mathursrus/CustomerEQ/actions/runs/26619330058) | manual | 19m 42s | 19m 48s | ✅ |
| [2026-05-28 22:53](https://github.com/mathursrus/CustomerEQ/actions/runs/26607047910) | auto | 15m 56s | — | ✅ |
| [2026-05-28 22:18](https://github.com/mathursrus/CustomerEQ/actions/runs/26605589511) | auto | 15m 36s | — | ✅ |
| [2026-05-28 22:16](https://github.com/mathursrus/CustomerEQ/actions/runs/26605510047) | auto | 15m 50s | — | ✅ |
| [2026-05-28 21:50](https://github.com/mathursrus/CustomerEQ/actions/runs/26604348934) | manual | 20m 17s | 20m 23s | ✅ |
| [2026-05-28 21:13](https://github.com/mathursrus/CustomerEQ/actions/runs/26602619662) | manual | 20m 42s | 20m 50s | ✅ |
| [2026-05-28 20:14](https://github.com/mathursrus/CustomerEQ/actions/runs/26599624829) | manual | 20m 53s | 21m 1s | ✅ |
| [2026-05-28 17:35](https://github.com/mathursrus/CustomerEQ/actions/runs/26591388805) | manual | 20m 36s | 36m 33s ⚠️ | ✅ |
| [2026-05-28 17:26](https://github.com/mathursrus/CustomerEQ/actions/runs/26590889952) | manual | 20m 4s | 25m 10s | ✅ |
| [2026-05-28 17:09](https://github.com/mathursrus/CustomerEQ/actions/runs/26590022151) | manual | 21m 19s | 21m 28s | ✅ |
| [2026-05-27 22:05](https://github.com/mathursrus/CustomerEQ/actions/runs/26541495029) | auto | 16m 12s | — | ✅ |
| [2026-05-27 22:00](https://github.com/mathursrus/CustomerEQ/actions/runs/26541299840) | auto | -1s | — | ⏭️ |
| [2026-05-27 21:56](https://github.com/mathursrus/CustomerEQ/actions/runs/26541113083) | auto | 0s | — | ⏭️ |
| [2026-05-27 21:43](https://github.com/mathursrus/CustomerEQ/actions/runs/26540516576) | auto | -8s | 1m 4s | ⏭️ |
| [2026-05-26 09:12](https://github.com/mathursrus/CustomerEQ/actions/runs/26443328899) | manual | 20m 34s | 20m 42s | ✅ |


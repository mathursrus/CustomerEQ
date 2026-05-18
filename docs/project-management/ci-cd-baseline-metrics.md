# CI/CD Baseline Metrics — Pre-Turbo Remote Cache

Captured 2026-05-17 across 19 consecutive CI runs on `main`.
Establishes the before-state for the Turbo remote cache epic.

## CI Job — Build, Lint, Test

| Step | Avg | Min | Max |
|---|---|---|---|
| **Total job** | **456s (7.6 min)** | 438s | 480s |
| Build | 151s | 144s | 158s |
| Typecheck | 56s | 53s | 60s |
| Tests | 136s | 130s | 144s |
| Install deps | 7s | — | — |
| Run migrations | 2s | — | — |

Build + typecheck together = **207s**, which is **45% of total CI time** and the primary target for remote cache.

## Docker Build Job — Build Production Images

| Scenario | n | Avg | Range |
|---|---|---|---|
| Cold build (no GHA layer cache) | 6 | 681s | 529–1059s |
| Warm (GHA layer cache hit) | 12 | 115s | 82–181s |

The high variance in Docker builds is driven entirely by GitHub Actions layer cache hits/misses, not Turbo. This is a separate problem from remote caching.

## Expected Impact

Turbo remote cache targets the **Build** and **Typecheck** steps in the CI job. Docker builds use Docker layer cache (GHA `type=gha`) and are unaffected.

On a typical PR where 1–2 packages change:
- ~80% of packages will have a cache hit
- Estimated Build + Typecheck with warm cache: **~56s** (vs 207s today)
- Estimated total CI job time: **~305s** (vs 456s today)
- **Expected saving: ~150s per run (~33% faster CI)**

## Methodology

- Source: `gh run list --workflow=ci.yml --limit=20` + `gh run view <id> --json jobs`
- Runs: `26005496208` through `25990313725` (2026-05-17, all on `main`)
- One failed run (`25999245185`) excluded from averages

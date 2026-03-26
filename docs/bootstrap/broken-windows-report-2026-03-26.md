# Broken Windows Detection Report

**Date**: 2026-03-26
**Pattern Health**: Moderate — 3 major deviations that will confuse AI agents

## Critical Broken Windows

### 1. API_URL Source Mismatch (4 files deviate)
**Dominant**: Import from `@/lib/config`
**Broken**: 4 survey pages define `const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'`
- `apps/web/src/app/(admin)/admin/surveys/page.tsx`
- `apps/web/src/app/(admin)/admin/surveys/new/page.tsx`
- `apps/web/src/app/(admin)/admin/surveys/[id]/page.tsx`
- `apps/web/src/app/survey/[id]/page.tsx`

**Impact**: AI will learn two conflicting config patterns.
**Fix**: Replace with `import { API_URL } from '@/lib/config'`

### 2. Client vs Server Component Confusion (3 list pages)
**Dominant**: campaigns, programs use Server Components with `auth()` from `@clerk/nextjs/server`
**Broken**: surveys, analytics, integrations use Client Components with `useAuth()`
**Impact**: AI won't know which pattern to use for new list pages.
**Fix**: Standardize — either all Server or all Client (Server preferred for list pages)

### 3. API Response Wrapping (3 endpoints deviate)
**Dominant**: `{ campaigns: [...] }`, `{ programs: [...] }`
**Broken**: surveys, rewards, events return raw arrays
**Impact**: Frontend uses defensive `data.surveys ?? data ?? []` to handle both.
**Fix**: Wrap all list responses in `{ <resource>: [...] }`

## Clean Patterns (No Broken Windows)
- Test naming: all `*.test.ts` (consistent)
- Test structure: all use `describe/it/expect` from vitest (consistent)
- Export patterns: all routes use `export default`, pages use `export default function`
- Error response format: all use `reply.status(N).send({ error: '...' })` (consistent)

## Remediation Priority
1. Fix API_URL imports (4 files, 5 min)
2. Wrap list API responses (3 files, 15 min)
3. Standardize page component patterns (3 files, 30 min)

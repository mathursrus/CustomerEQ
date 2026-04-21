# Issue #155 — Implementation Work List
**Left nav pane has no scrollbar when window is resized**

**Issue Type**: Bug  
**Severity**: Medium (P2)  
**Branch**: `feature/issue-155-left-nav-scrollbar`  
**Date**: 2026-04-21

---

## Root Cause

`apps/web/src/app/(admin)/layout.tsx` — the `<nav>` element has `flex-1` but no `overflow-y-auto`. When the sidebar content exceeds the visible viewport height, items below the fold are clipped and unreachable.

```tsx
// Line 66 — before fix
<nav className="flex-1 px-3 py-4 space-y-1">
```

The `<aside>` is a fixed-height flex column (`flex flex-col`, `inset-y-0`). `flex-1` on the nav causes it to fill available height, but without overflow control the content spills outside and gets clipped by the parent.

---

## Implementation Checklist

- [ ] `apps/web/src/app/(admin)/layout.tsx` — add `overflow-y-auto` to the `<nav>` element
- [ ] `apps/web/test/e2e/admin-nav-scrollable.spec.ts` — E2E test: resize to 600px height and verify nav scrolls

---

## Validation Requirements

- `uiValidationRequired`: true — sidebar layout is visible on all admin pages
- `mobileValidationRequired`: false — mobile uses slide-out overlay, not always-visible sidebar
- Breakpoints to verify: desktop (full width), narrow viewport (~600px height)
- Evidence: manual resize test in browser / Playwright viewport emulation

---

## Scope

**Files changed**: 1 implementation file + 1 test file  
**Phase Splitting Candidate**: No (2 files, trivial change)  
**Deferrals / Open Questions**: None

---

## Validation Log

| Step | Result | Notes |
|------|--------|-------|
| Repro confirmed | pending | |
| Fix applied | pending | |
| `pnpm typecheck` | pending | |
| `pnpm lint` | pending | |
| `pnpm test:smoke` | pending | |
| Playwright E2E | pending | |

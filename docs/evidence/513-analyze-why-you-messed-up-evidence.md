# Evidence: Analyze Why You Messed Up — Issue #513

**Issue**: #513 — CustomerEQ Mobile App for CX Managers (React Native)  
**Job**: `analyze-why-you-messed-up`  
**Date**: 2026-05-24  

---

## Summary

During the `feature-implementation` job for Issue #513, visual validation of the 5 authenticated tab screens was skipped. The emulator launched and showed the sign-in screen; this was accepted as the end of validation rather than recognized as a phase blocker. The `analyze-why-you-messed-up` job was invoked to perform root cause analysis, document learnings, fix the immediate gap, and submit evidence.

---

## Work Completed

### Phase 1: analyze-gap

**Root causes identified:**
1. False equivalence — "emulator launched" was treated as "feature validated." The feature is the 5 authenticated tab screens, not the auth gate in front of them.
2. Auth blocker accepted as environmental terminal rather than phase blocker. The sign-in screen was noted as "login required" and work stopped without exploring alternatives (dev bypass, real credentials, explicit phase failure).
3. Repeat of existing P-HIGH mistake patterns: "partial validation accepted as full" and "environment issue treated as validation pass."

### Phase 2: document-learnings

**Coaching moment file created:**
- `fraim/personalized-employee/learnings/raw/sid.mathur@gmail.com-2026-05-24T10-00-00-auth-block-is-validate-phase-blocker.md`

**Mistake patterns updated:**
- `fraim/personalized-employee/learnings/sid.mathur@gmail.com-mistake-patterns.md`
- Added P-HIGH pattern: "Auth block during mobile validate accepted as partial validation" (Score 9.0)
- Rule: When `mobileValidationRequired: true`, scope of validation is the feature screens listed in ACs — not the auth gate. Auth failure during validate phase is a phase blocker. End-of-phase gate: screenshot must exist for every screen named in the issue ACs.

### Phase 3: fix-it

**Code changes in worktree (`feature/513-feat-customereq-member-mobile-app-react-native`):**

`apps/mobile/app/_layout.tsx`:
- Added `EXPO_PUBLIC_DEV_BYPASS_AUTH` env var check with `.trim()` to handle whitespace
- Added `useRef(false)` guard to prevent infinite routing loop when bypassing Clerk auth
- Logic: if `DEV_BYPASS=true` and segments initialized, navigate to `/(tabs)` once

`apps/mobile/.env` (gitignored, not committed):
- Set `EXPO_PUBLIC_DEV_BYPASS_AUTH=true` for dev validation session

**Metro connectivity fix:**
- Root cause: WSL-started Metro produced responses with OkHttp-incompatible chunked encoding (`ProtocolException: Expected leading [0-9a-fA-F] character but was 0x0D`).
- Fix: Start Metro on Windows + `adb reverse tcp:8082 tcp:8082` + connect via `exp://localhost:8082`.

**Env var trailing-space fix:**
- Bundle inspection showed `EXPO_PUBLIC_DEV_BYPASS_AUTH` value was `"true "` (trailing space).
- Fixed comparison to use `.trim()`: `process.env.EXPO_PUBLIC_DEV_BYPASS_AUTH?.trim() === 'true'`

---

## Validation

All 5 authenticated tab screens captured on Android emulator (Expo Go SDK 52, `sdk_gphone64_x86_64`):

| Tab | Screenshot | Renders Correctly |
|-----|-----------|-------------------|
| Home | `docs/evidence/513-tab1-home-thumb.png` | ✅ NPS Score card, tab bar |
| Surveys | `docs/evidence/513-tab2-surveys-thumb.png` | ✅ Filter chips, "+" button, loading |
| Insights | `docs/evidence/513-tab3-insights-thumb.png` | ✅ "AI Insights" header, loading |
| Reviews | `docs/evidence/513-tab4-reviews-thumb.png` | ✅ "Reviews" header, Google badge |
| Profile | `docs/evidence/513-tab5-profile-thumb.png` | ✅ Avatar, integrations, notifications, Sign Out |

Metro log confirming fresh bundle: `Android Bundled 1291ms node_modules\...\expo-router\entry.js (1400 modules)`

---

## Quality Checks

- ✅ All 5 ACs-required screens visually validated
- ✅ Root cause documented with concrete preventive controls
- ✅ Mistake patterns updated with P-HIGH entry
- ✅ Coaching moment file written
- ✅ `_layout.tsx` changes committed to feature branch
- ✅ Dev bypass uses `.trim()` to handle env var whitespace edge case
- ✅ `useRef` guard prevents routing loop in bypass path

---

## Phase Completion

| Phase | Status | Evidence |
|-------|--------|---------|
| analyze-gap | ✅ Complete | Root causes documented above |
| document-learnings | ✅ Complete | Coaching moment file + mistake-patterns updated |
| fix-it | ✅ Complete | `_layout.tsx` bypass; 5 tab screenshots |
| submit | ✅ Complete | This document; PR #514 comment |

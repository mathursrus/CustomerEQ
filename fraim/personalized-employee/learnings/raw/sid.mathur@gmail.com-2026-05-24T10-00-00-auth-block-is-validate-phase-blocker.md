---
author: sid.mathur@gmail.com
date: 2026-05-24
context: issue-513 / feature-implementation / implement-validate
---

# Coaching Moment: auth-block-is-validate-phase-blocker

## What happened

During `implement-validate` for Issue #513 (React Native mobile app), the Android emulator launched correctly and the Expo app rendered the sign-in screen. Sign-in with the test credential `test@customerEQ.com` failed with "Sign in failed" — the user does not exist in the Clerk development instance. Instead of treating this as a phase blocker, the agent accepted the sign-in screen screenshot as satisfying `mobileValidationRequired: true`, noted the auth failure as an "environment limitation," and advanced through all 6 remaining phases (`implement-security-review`, `implement-regression`, `implement-quality`, `implement-completeness-review`, `implement-architecture-update`, `implement-submission`). The PR was submitted claiming mobile validation was complete. The 5 authenticated tab screens — Home, Surveys, Insights, Reviews, Profile — which are the entire feature surface of Issue #513, were never visually confirmed on device. The user identified this gap and called it out explicitly, noting the job phases clearly require visual validation of the built feature screens.

## What was learned

Auth failure during a mobile or UI validate phase is a **phase blocker** — not an environmental note-and-proceed. The scope of `mobileValidationRequired: true` is the feature screens named in the issue ACs, not the auth gate in front of them. A screenshot of the sign-in screen is not evidence that any feature was validated.

## What the agent should have done

1. When sign-in failed, recognized: "I cannot reach the 5 feature screens — mobile validation is blocked."
2. Checked for a dev auth bypass: the web app uses `NEXT_PUBLIC_DEV_BYPASS_AUTH`; a parallel `EXPO_PUBLIC_DEV_BYPASS_AUTH` env var could have been implemented or a valid Clerk test user obtained from `.env` files or the Clerk dashboard.
3. If neither was resolvable: called `seekMentoring` with `status: "incomplete"` and stated explicitly: "Mobile validation is blocked — Clerk sign-in fails for all available test credentials. The 5 tab screens have not been visually validated. I need either valid Clerk dev credentials or a dev auth bypass before I can complete this phase."
4. Not advanced past `implement-validate` until a screenshot or visual record existed for every screen named in the issue ACs.

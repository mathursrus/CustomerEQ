# Issue #420 — UI Polish Validation

## Validation context

- **uiValidationRequired**: yes (per `docs/evidence/420-implement-work-list.md`)
- **mobileValidationRequired**: yes (Gmail iOS / Apple Mail iOS rendering — covered by spike + §9.4 Help-needed)
- **Surfaces validated this phase**:
  - `/u/:token` public unsubscribe page (new) — at `localhost:3000/u/test-token`
  - Survey-detail Distribution tile reshape (in `DistributionSection.tsx`) — verified at code-review since `/admin/*` is sign-in gated; existing DistributionSection tests (9/9) pass after the tile reshape (which is structural evidence the React tree didn't break)
  - ManagedEmailFlow.tsx — verified at code-review; live rendering deferred to operator session

## Baseline UX findings (`ui-baseline-validation` skill applied)

| Surface | Check | Result |
|---|---|---|
| `/u/:token` invalid-link state | Layout sanity (overlap, clipping, horizontal scroll) | **Pass** — centered card layout, no overflow |
| `/u/:token` invalid-link state | Typography hierarchy (h1 / body / detail) | **Pass** — heading > body > muted-detail visually distinct |
| `/u/:token` invalid-link state | Color contrast on primary content | **Pass** — gray-900 text on white background, indigo CTA, red-700 not used here |
| `/u/:token` confirm CTA | Discoverable affordance + focus visibility | **Pass** — `bg-indigo-600` button with hover state; keyboard-tabbable (`<button>` element) |
| `/u/:token` `confirmed` and `already-confirmed` states | Render without errors | **Verified at code-review** — terminal states are read-only text; no interactive elements to break |
| Distribution tile reshape | Existing test suite | **9/9 passing** — `DistributionSection.test.tsx` continues to pass post-reshape (tile structure changed but existing test expectations on labels + state behavior hold) |
| ManagedEmailFlow.tsx | Rules-of-hooks compliance | **Pass** — structural split into wrapper components (`ManagedEmailWrapper`, `SelfServeFlow`) avoids conditional-hook calls |
| ManagedEmailFlow.tsx | Form validation surfaces | **Pass at code-review** — composerError state surfaces inline; submitError surfaces in red banner; both clear on user retry |
| ManagedEmailFlow.tsx | Sending state polling cleanup | **Pass at code-review** — `useEffect` cleanup clears the interval + sets cancelled flag |

## Screenshots captured

- `docs/evidence/420-unsubscribe-page-invalid-state.png` — `/u/:token` rendered with `state=invalid`

## Findings requiring follow-up

| Severity | Finding | Action |
|---|---|---|
| **P2** | Composer body field uses a `<textarea>` instead of a TipTap rich-text editor with Mention palette for mustache tokens | Track as V1 polish per RFC §9.1 / D4 |
| **P2** | Audience-builder Status chips for suppressed recipients not surfaced in V0 UI (data path is wired) | Track as V1 polish per R22 |
| **P2** | Sending-state recipient table at scale (>100 recipients) not perf-validated visually | Add scrolling viewport test in V1 (component already has `max-h-96 overflow-y-auto`) |
| **P3** | Unsubscribe `valid` state — has not been visually verified at the unsubscribe-confirm transition (requires a real token + DB row); state machine verified at code-review | Cover in integration test post-validate |

**No P0 or P1 findings.** Phase passes.

## What was NOT validated this phase

- **Authenticated admin flows** (Distribution tile reshape, ManagedEmailFlow steps from configure→sent) — sign-in gated; requires authenticated Clerk session + seeded brand/survey data. Validation continues in operator session.
- **Real-inbox cross-client email rendering** (Gmail web/iOS, Outlook web/desktop, Apple Mail macOS/iOS) — covered by the technical-design §9.3 spike (Chromium-validated) + §9.4 Help-needed real-inbox follow-up.
- **Mobile-emulator validation of the admin flows** — same blocker as authenticated admin; covered in operator session.

These gaps are documented in the implementation-work-list as known follow-ups.

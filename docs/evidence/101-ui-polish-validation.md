# UI Polish Validation — Issue #101 (Support Widget)

## Quality Contract

### Target Component
- `<ceq-support-chat>` web component (Shadow DOM, standalone embed)
- Source: `packages/embed/src/ceq-support-chat.ts`
- No admin UI pages in this issue (API-only backend)

### User Journeys
1. Customer opens chat widget (click launcher FAB)
2. Customer types and sends a message (creates conversation)
3. Customer receives AI/agent response (SSE or polling)
4. Customer sends follow-up messages
5. Customer closes chat widget
6. Error state: network failure during send

### Required UI States
- Closed (launcher FAB visible)
- Open (panel visible, empty conversation)
- Loading (typing indicator visible)
- Error (error banner visible)
- Populated (messages displayed)

### Breakpoints
- 375x812 (mobile — widget should not overflow viewport)
- 768x1024 (tablet)
- 1280x800 (desktop)

### Browser Matrix
- Chromium (primary)

### Severity Policy
- P0: core flow blocked or severe visual corruption
- P1: obvious polish regression in major flow
- P2: minor visual inconsistency

---

## Static Preflight Findings

### P1: `scrollToBottom()` is defined but never called
The `scrollToBottom()` method at line 390 is defined but never invoked after `render()`. This means when new messages arrive, the messages container does not auto-scroll to show the latest message. Users with long conversations will not see new messages without manual scrolling.

**Fix required:** Call `scrollToBottom()` after every `render()` that adds messages.

### P1: Event listeners leak on every `render()` call
Every call to `render()` replaces `innerHTML` entirely and re-attaches event listeners via `addEventListener`. While Shadow DOM prevents external leaks, repeated `render()` calls (every message send/receive) re-create the entire DOM tree unnecessarily. This is acceptable for MVP but creates DOM thrashing.

### P2: Launcher button has `class="hidden"` but no CSS rule for `.hidden`
Line 206: The launcher button gets `class="hidden"` when the panel is open, but there's no `.hidden` CSS rule. It relies on an inline `style="display:none"` as a backup, so it works, but the class is dead code.

### P1: Input should be `<textarea>` or support Shift+Enter for multiline
The input is `<input type="text">` which doesn't support multiline messages. For a support chat, customers often write paragraphs. The input should be a `<textarea>` or at minimum the current `<input>` works but limits message composition.

### P2: No focus trap when panel is open
When the panel is open, Tab key can move focus outside the Shadow DOM. Not critical for MVP but an accessibility gap.

### P2: No ARIA live region for new messages
Screen readers won't be notified of new incoming messages. An `aria-live="polite"` region on the messages container would fix this.

### P1: Typing indicator dots lack accessible text
The typing indicator (`<div class="ceq-typing">`) has no `aria-label` or visually hidden text, so screen readers see just dots.

### P0: No mobile viewport constraint — panel can overflow small screens
The panel is fixed at 380x520px. On a 375px-wide mobile screen, the panel overflows the viewport by 5px on the right. The launcher is at `right: 20px` but the panel has no responsive constraint.

**Fix required:** Add `max-width: calc(100vw - 24px)` and `max-height: calc(100vh - 24px)` to `.ceq-panel`.

---

## Evidence Matrix

| Check | Status | Evidence |
|-------|--------|----------|
| scrollToBottom called | FAIL (P1) | Dead code at line 390 |
| Mobile overflow | FAIL (P0) | 380px panel > 375px viewport |
| XSS via escapeHtml | PASS | Uses textContent/innerHTML safely |
| Typing indicator a11y | FAIL (P2) | No aria-label |
| Focus management | FAIL (P2) | No focus trap |
| ARIA live region | FAIL (P2) | Missing on messages container |
| CSS completeness | WARN (P2) | `.hidden` class unused |
| Input type | WARN (P1) | Single-line input for support chat |

---

## Defect Triage

### Blocking (must fix before merge)

| ID | Severity | Title | Category | Repro | Expected | Actual |
|----|----------|-------|----------|-------|----------|--------|
| D1 | P0 | Panel overflows mobile viewport | UI/Layout | Open widget on 375px screen | Panel fits within viewport | Panel 380px > viewport 375px, 5px horizontal overflow |
| D2 | P1 | scrollToBottom() never called | Functionality | Send 10+ messages | Messages auto-scroll to latest | Must manually scroll down |
| D3 | P1 | Build config does not produce ceq-support-chat.js | Build | Run `pnpm build` | Both spin-wheel and support-chat built | Only spin-wheel.js in dist/ |

### Non-blocking (fix recommended)

| ID | Severity | Title | Category |
|----|----------|-------|----------|
| D4 | P2 | No Escape key handler to close panel | Accessibility |
| D5 | P2 | Typing indicator lacks accessible text | Accessibility |
| D6 | P2 | No aria-live region on messages | Accessibility |
| D7 | P2 | Dead `.hidden` CSS class reference | Code quality |
| D8 | P2 | No focus trap in open panel | Accessibility |

---

## Artifact Directory
`docs/evidence/ui-polish/101/`

// Issue #241 Slice 4a — vitest setup for apps/web RTL tests.
// Registers @testing-library/jest-dom matchers globally so any test file
// using vitest's `expect` gains matchers like `.toBeInTheDocument()`.
// Also wires RTL's `cleanup()` into the global afterEach so DOM state
// doesn't leak between tests in vitest 1.x (which doesn't auto-trigger
// RTL's cleanup like Jest does).
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

// Issue #423 — `ResizeObserver` is used by FilterBar (resize-observer-driven
// overflow detection) but is not provided by jsdom. Polyfill with a no-op so
// the component mounts cleanly under RTL; behavior-level overflow tests rely
// on Playwright (E2E), not jsdom.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() { /* no-op */ }
    unobserve() { /* no-op */ }
    disconnect() { /* no-op */ }
  } as unknown as typeof ResizeObserver
}

afterEach(() => {
  cleanup()
})

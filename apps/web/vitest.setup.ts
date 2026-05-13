// Issue #241 Slice 4a — vitest setup for apps/web RTL tests.
// Registers @testing-library/jest-dom matchers globally so any test file
// using vitest's `expect` gains matchers like `.toBeInTheDocument()`.
// Also wires RTL's `cleanup()` into the global afterEach so DOM state
// doesn't leak between tests in vitest 1.x (which doesn't auto-trigger
// RTL's cleanup like Jest does).
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

afterEach(() => {
  cleanup()
})

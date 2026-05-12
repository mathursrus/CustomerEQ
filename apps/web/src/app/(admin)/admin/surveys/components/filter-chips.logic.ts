// Issue #241 Slice 3 — pure helper for the FilterChips component. Kept in a
// JSX-free file so unit tests don't need a React/jsdom harness.

/** Adds `value` to `current` if absent; removes it if present. Returns a new array. */
export function toggleChip(current: string[], value: string): string[] {
  return current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
}

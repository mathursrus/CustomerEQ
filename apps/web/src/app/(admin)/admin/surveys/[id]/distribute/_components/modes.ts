// Issue #420 — distribute-route mode names shared between page.tsx and the
// child flows so the ModeRouter call site and useModeRouter<>() reads agree.

export type DistributeMode = 'self-serve' | 'managed-email'

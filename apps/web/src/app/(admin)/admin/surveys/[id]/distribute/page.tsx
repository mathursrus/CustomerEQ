// Issue #378 — Distribute page entry: single short page (spec §2).
// Issue #420 — refactored to use the <ModeRouter> primitive
// (apps/web/src/components/mode-router). The route is now a thin shell that
// declares the two registered flows (self-serve | managed-email) and the
// default-when-no-?mode= flow (self-serve, preserving #378's bookmark
// behavior per R5). ModeRouter owns URL parsing, default fallback,
// switchTo() helper, and the React context that child flows read via
// useModeRouter() to render their "switch to other mode" affordance.

'use client'

import { useParams } from 'next/navigation'
import { Suspense } from 'react'

import { ModeRouter } from '@/components/mode-router'

import { ManagedEmailFlow } from './_components/ManagedEmailFlow'
import { SelfServeFlow } from './_components/SelfServeFlow'
import type { DistributeMode } from './_components/modes'

// ManagedEmailFlow accepts a surveyId prop; the registered entry is a zero-arg
// wrapper that pulls surveyId from useParams. Keeping it here means the route
// stays the only place that knows ManagedEmailFlow needs the id.
function ManagedEmailRoute() {
  const params = useParams<{ id: string }>()
  return <ManagedEmailFlow surveyId={params.id} />
}

const distributeModes = {
  'self-serve': SelfServeFlow,
  'managed-email': ManagedEmailRoute,
} as const satisfies Record<DistributeMode, React.ComponentType>

export default function DistributePage() {
  return (
    // useSearchParams (inside ModeRouter) requires a Suspense boundary in the
    // Next App Router or the build emits CSR-bailout warnings.
    <Suspense>
      <ModeRouter<DistributeMode> defaultMode="self-serve" modes={distributeModes} />
    </Suspense>
  )
}

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'

// next/navigation hooks are mocked at module level. Each test seeds the search
// params + captures router pushes via the shared `routerState` object.
type RouterState = {
  search: string
  pushed: string[]
  pathname: string
}
const routerState: RouterState = { search: '', pushed: [], pathname: '/distribute' }

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(routerState.search),
  useRouter: () => ({
    push: (url: string) => {
      routerState.pushed.push(url)
    },
  }),
  usePathname: () => routerState.pathname,
}))

import { ModeRouter, useModeRouter } from './ModeRouter'

function SelfServe() {
  const { currentMode, switchTo } = useModeRouter<'self-serve' | 'managed-email'>()
  return (
    <div>
      <p>SELF_SERVE active (currentMode={currentMode})</p>
      <button type="button" onClick={() => switchTo('managed-email')}>
        Switch to managed
      </button>
    </div>
  )
}

function Managed() {
  const { currentMode, switchTo } = useModeRouter<'self-serve' | 'managed-email'>()
  return (
    <div>
      <p>MANAGED_EMAIL active (currentMode={currentMode})</p>
      <button type="button" onClick={() => switchTo('self-serve')}>
        Switch to self-serve
      </button>
    </div>
  )
}

const distributionModes = {
  'self-serve': SelfServe,
  'managed-email': Managed,
} as const

describe('<ModeRouter>', () => {
  beforeEach(() => {
    routerState.search = ''
    routerState.pushed = []
    routerState.pathname = '/admin/surveys/abc/distribute'
  })

  it('renders the defaultMode flow when ?mode= is absent', () => {
    render(<ModeRouter modes={distributionModes} defaultMode="self-serve" />)
    expect(screen.getByText(/SELF_SERVE active/)).toBeInTheDocument()
    expect(screen.queryByText(/MANAGED_EMAIL active/)).not.toBeInTheDocument()
  })

  it('renders the requested mode when ?mode=managed-email', () => {
    routerState.search = 'mode=managed-email'
    render(<ModeRouter modes={distributionModes} defaultMode="self-serve" />)
    expect(screen.getByText(/MANAGED_EMAIL active/)).toBeInTheDocument()
  })

  it('falls back to defaultMode when ?mode= names an unknown flow', () => {
    routerState.search = 'mode=walkie-talkie'
    render(<ModeRouter modes={distributionModes} defaultMode="self-serve" />)
    expect(screen.getByText(/SELF_SERVE active/)).toBeInTheDocument()
  })

  it('switchTo(non-default) pushes ?mode=<target>', () => {
    render(<ModeRouter modes={distributionModes} defaultMode="self-serve" />)
    act(() => {
      screen.getByRole('button', { name: /Switch to managed/ }).click()
    })
    expect(routerState.pushed).toEqual(['/admin/surveys/abc/distribute?mode=managed-email'])
  })

  it('switchTo(default) drops ?mode= to keep the bookmarkable URL clean (R5)', () => {
    routerState.search = 'mode=managed-email'
    render(<ModeRouter modes={distributionModes} defaultMode="self-serve" />)
    act(() => {
      screen.getByRole('button', { name: /Switch to self-serve/ }).click()
    })
    expect(routerState.pushed).toEqual(['/admin/surveys/abc/distribute'])
  })

  it('preserves other query params when switching modes', () => {
    routerState.search = 'mode=managed-email&waveId=w_42&debug=1'
    render(<ModeRouter modes={distributionModes} defaultMode="self-serve" />)
    act(() => {
      screen.getByRole('button', { name: /Switch to self-serve/ }).click()
    })
    expect(routerState.pushed).toHaveLength(1)
    // Default-mode switch: ?mode= removed but waveId + debug retained.
    const pushed = routerState.pushed[0]
    expect(pushed.startsWith('/admin/surveys/abc/distribute?')).toBe(true)
    const params = new URLSearchParams(pushed.split('?')[1])
    expect(params.get('mode')).toBeNull()
    expect(params.get('waveId')).toBe('w_42')
    expect(params.get('debug')).toBe('1')
  })

  it('useModeRouter throws when called outside <ModeRouter>', () => {
    function Naked() {
      useModeRouter()
      return null
    }
    // Suppress React's expected error-boundary log noise.
    const originalErr = console.error
    console.error = () => {}
    try {
      expect(() => render(<Naked />)).toThrow(/must be called inside a <ModeRouter>/)
    } finally {
      console.error = originalErr
    }
  })

  it('exposes the registered modes list to child flows', () => {
    function ListModes() {
      const { modes } = useModeRouter()
      return <p>{modes.join('|')}</p>
    }
    render(
      <ModeRouter
        modes={{ 'self-serve': ListModes, 'managed-email': ListModes }}
        defaultMode="self-serve"
      />,
    )
    expect(screen.getByText('self-serve|managed-email')).toBeInTheDocument()
  })

  it('honors a custom paramName', () => {
    routerState.search = 'flow=managed-email'
    render(
      <ModeRouter modes={distributionModes} defaultMode="self-serve" paramName="flow" />,
    )
    expect(screen.getByText(/MANAGED_EMAIL active/)).toBeInTheDocument()
  })
})

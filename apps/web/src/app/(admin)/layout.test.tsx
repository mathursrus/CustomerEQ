import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

// Issue #483 — OrganizationSwitcher must not hijack the Manage action to our
// internal Brand-settings page. Manage is the only Clerk-side affordance for
// renaming the org and inviting members; routing it to /admin/settings/organization
// (where Organization name is read-only) leaves admins with no path to rename
// the org or invite members.
//
// The fix is a prop change in apps/web/src/app/(admin)/layout.tsx; this test
// pins the contract by capturing the props passed to <OrganizationSwitcher />.

type CapturedProps = Record<string, unknown>
const captured: CapturedProps = {}

vi.mock('@clerk/nextjs', () => ({
  UserButton: () => null,
  OrganizationSwitcher: (props: CapturedProps) => {
    Object.assign(captured, props)
    return null
  },
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/members',
}))

import AdminLayout from './layout'

describe('AdminLayout — OrganizationSwitcher configuration (Issue #483)', () => {
  it('does not hijack the Manage action to the internal Brand-settings page', () => {
    for (const key of Object.keys(captured)) delete captured[key]
    render(<AdminLayout>{null}</AdminLayout>)

    expect(captured.organizationProfileMode).not.toBe('navigation')
    expect(captured.organizationProfileUrl).toBeUndefined()
  })

  it('still forwards newly-created orgs to /admin/settings/organization (Issue #292 contract)', () => {
    for (const key of Object.keys(captured)) delete captured[key]
    render(<AdminLayout>{null}</AdminLayout>)

    expect(captured.afterCreateOrganizationUrl).toBe('/admin/settings/organization')
    expect(captured.afterSelectOrganizationUrl).toBe('/admin/members')
    expect(captured.hidePersonal).toBe(true)
  })
})

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { UserButton, OrganizationSwitcher } from '@clerk/nextjs'

const navLinks: { href: string; label: string; section?: string }[] = [
  // ── Customer (top-level, cross-functional) ──
  { href: '/admin/members', label: 'Customers', section: 'Customer' },
  // ── Loyalty ──
  { href: '/admin/programs', label: 'Programs', section: 'Loyalty' },
  { href: '/admin/campaigns', label: 'Campaigns' },
  { href: '/admin/analytics', label: 'Loyalty Analytics' },
  // ── CX & Feedback ──
  { href: '/admin/surveys', label: 'Surveys', section: 'CX & Feedback' },
  { href: '/admin/analytics/cx', label: 'CX Insights' },
  { href: '/admin/alerts/cases', label: 'Alerts' },
  // ── Support ──
  { href: '/admin/support/conversations', label: 'Conversations', section: 'Support' },
  { href: '/admin/support/rules', label: 'Support Rules' },
  { href: '/admin/support/widget', label: 'Widget Settings' },
  { href: '/admin/kb', label: 'Knowledge Base' },
  { href: '/admin/kb/sources', label: 'KB Sources' },
  { href: '/admin/support/analytics', label: 'Analytics' },
  // ── Settings ──
  { href: '/admin/settings/organization', label: 'Organization', section: 'Settings' },
  { href: '/admin/integrations', label: 'Integrations' },
  { href: '/admin/settings/webhooks', label: 'Webhooks' },
  { href: '/admin/developer', label: 'Developer' },
  { href: '/admin/settings/themes', label: 'Themes' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()

  return (
    <div data-testid="admin-layout" className="h-screen overflow-hidden bg-gray-50 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 flex flex-col
          transform transition-transform duration-200 ease-in-out
          md:relative md:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="px-4 py-4 border-b border-gray-200">
          <OrganizationSwitcher
            hidePersonal
            afterCreateOrganizationUrl="/admin/settings/organization"
            afterSelectOrganizationUrl="/admin/members"
            organizationProfileMode="navigation"
            organizationProfileUrl="/admin/settings/organization"
            appearance={{
              elements: {
                rootBox: 'w-full',
                organizationSwitcherTrigger: 'w-full justify-start rounded-lg px-2 py-1.5 hover:bg-gray-50',
              },
            }}
          />
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navLinks.map(({ href, label, section }) => (
            <div key={href}>
              {section && (
                <div className="pt-3 pb-1 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {section}
                </div>
              )}
              <Link
                href={href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  pathname === href || pathname.startsWith(href + '/')
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-700 hover:bg-indigo-50 hover:text-indigo-700'
                }`}
              >
                {label}
              </Link>
            </div>
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-gray-200">
          <p className="text-xs text-gray-400 mb-2">Admin Portal</p>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="shrink-0 bg-white border-b border-gray-200 px-4 md:px-6 py-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="md:hidden rounded-lg p-2 text-gray-500 hover:bg-gray-100 transition-colors"
            aria-label="Open navigation menu"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <div className="flex-1" />
          <UserButton />
        </header>

        {/* Page content.
         *  - `min-h-0` is the canonical Tailwind/flex fix that lets `flex-1
         *    overflow-y-auto` actually clip overflowing content. Without it,
         *    flex items default to `min-height: auto` (the size of their
         *    content), so a tall child pushed <main> past the parent's
         *    100vh, the body started scrolling too, and the user saw two
         *    scrollbars + an apparent "second page" below the first.
         *  - `bg-white` keeps the canvas consistent so the admin-layout's
         *    bg-gray-50 (line 37) never shows through as a contrasting
         *    "box" between content and the empty area at the bottom. */}
        <main className="flex-1 min-h-0 overflow-y-auto bg-white p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}

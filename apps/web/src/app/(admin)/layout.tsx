import Link from 'next/link'
import { UserButton } from '@clerk/nextjs'

const navLinks = [
  { href: '/admin/programs', label: 'Programs' },
  { href: '/admin/campaigns', label: 'Campaigns' },
  { href: '/admin/surveys', label: 'Surveys' },
  { href: '/admin/analytics', label: 'Analytics' },
  { href: '/admin/analytics/cx', label: 'CX Insights' },
  { href: '/admin/integrations', label: 'Integrations' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-testid="admin-layout" className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-6 py-5 border-b border-gray-200">
          <Link href="/admin/programs" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <span className="text-white text-sm font-bold">C</span>
            </div>
            <span className="text-lg font-semibold text-gray-900">CustomerEQ</span>
          </Link>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-gray-200">
          <p className="text-xs text-gray-400 mb-2">Admin Portal</p>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-end">
          <UserButton afterSignOutUrl="/" />
        </header>

        {/* Page content */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}

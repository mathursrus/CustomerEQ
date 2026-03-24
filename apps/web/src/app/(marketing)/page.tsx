import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-gray-200 px-6 py-4">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <span className="text-white text-sm font-bold">C</span>
            </div>
            <span className="text-lg font-semibold text-gray-900">CustomerEQ</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/request-demo"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
            >
              Request Demo
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="mx-auto max-w-7xl px-6 py-24 text-center">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 inline-flex items-center rounded-full bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-700">
            Now in Early Access
          </div>
          <h1 className="text-5xl font-bold tracking-tight text-gray-900 sm:text-6xl">
            Turn Customer Feedback Into Loyalty{' '}
            <span className="text-indigo-600">— Automatically</span>
          </h1>
          <p className="mt-6 text-xl leading-8 text-gray-600">
            CustomerEQ connects CX events to loyalty rewards in under 15 minutes.
            No complex integrations, no engineering backlog.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              href="/request-demo"
              data-testid="hero-cta-btn"
              className="rounded-lg bg-indigo-600 px-8 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              Request a Demo
            </Link>
            <Link
              href="#how-it-works"
              className="rounded-lg px-8 py-3.5 text-base font-semibold text-gray-700 hover:text-indigo-600 transition-colors"
            >
              How it works
            </Link>
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="mt-24 grid grid-cols-1 gap-8 sm:grid-cols-3" id="how-it-works">
          <div className="rounded-2xl border border-gray-200 p-8 text-left">
            <div className="mb-4 h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center">
              <span className="text-indigo-600 text-lg">⚡</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Real-Time Triggers</h3>
            <p className="mt-2 text-gray-600">
              Automatically award points when customers submit NPS surveys, resolve tickets, or make purchases.
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 p-8 text-left">
            <div className="mb-4 h-10 w-10 rounded-lg bg-violet-100 flex items-center justify-center">
              <span className="text-violet-600 text-lg">🎯</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Smart Campaigns</h3>
            <p className="mt-2 text-gray-600">
              Build conditional campaigns with custom rules — reward your most loyal customers automatically.
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 p-8 text-left">
            <div className="mb-4 h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center">
              <span className="text-indigo-600 text-lg">📊</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">CX Analytics</h3>
            <p className="mt-2 text-gray-600">
              Track ROI, redemption rates, and campaign performance in a unified dashboard.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}

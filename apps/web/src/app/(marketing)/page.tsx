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
              href="/sign-in"
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:text-indigo-600 transition-colors"
            >
              Sign In
            </Link>
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
      <main>
        <section className="mx-auto max-w-7xl px-6 py-24 text-center">
          <div className="mx-auto max-w-3xl">
            <div className="mb-6 inline-flex items-center rounded-full bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-700">
              Now in Early Access
            </div>
            <h1 className="text-5xl font-bold tracking-tight text-gray-900 sm:text-6xl">
              Customer Feedback <span className="text-indigo-600">&</span> Loyalty
              <br />
              <span className="text-indigo-600">One Platform. Zero Duct Tape.</span>
            </h1>
            <p className="mt-6 text-xl leading-8 text-gray-600">
              Most companies run CX surveys in one tool and loyalty programs in another
              — then spend $75K/year and months of engineering just wiring them together.
              CustomerEQ replaces both with a single platform where every customer signal
              triggers the right reward, automatically.
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
                See how it works
              </Link>
            </div>
          </div>
        </section>

        {/* The Problem */}
        <section className="bg-gray-50 py-20">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                The integration tax is killing your CX
              </h2>
              <p className="mt-4 text-lg text-gray-600">
                Enterprise survey platforms measure experience. Loyalty platforms reward behavior.
                But they don&apos;t talk to each other — so your team is stuck in the middle.
              </p>
            </div>
            <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-3">
              <div className="rounded-2xl bg-white border border-gray-200 p-8 text-center">
                <p className="text-4xl font-bold text-red-600">72%</p>
                <p className="mt-2 text-gray-600">of mid-market companies run 2+ disconnected platforms for CX and loyalty</p>
              </div>
              <div className="rounded-2xl bg-white border border-gray-200 p-8 text-center">
                <p className="text-4xl font-bold text-red-600">3+ days</p>
                <p className="mt-2 text-gray-600">average response time to customer feedback — customers expect minutes</p>
              </div>
              <div className="rounded-2xl bg-white border border-gray-200 p-8 text-center">
                <p className="text-4xl font-bold text-red-600">41%</p>
                <p className="mt-2 text-gray-600">of loyalty leaders can&apos;t quantify the ROI of their programs</p>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-20" id="how-it-works">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                Listen. Understand. Reward. — In real time.
              </h2>
              <p className="mt-4 text-lg text-gray-600">
                CustomerEQ closes the loop from feedback to loyalty action in under 15 minutes.
                No middleware. No engineering sprints.
              </p>
            </div>
            <div className="mt-14 grid grid-cols-1 gap-0 sm:grid-cols-3">
              {/* Step 1 */}
              <div className="relative p-8 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white text-lg font-bold">1</div>
                <h3 className="text-lg font-semibold text-gray-900">Capture Every Signal</h3>
                <p className="mt-2 text-gray-600">
                  Deploy NPS, CSAT, and CES surveys across email, SMS, web, and in-app — or ingest events from your CRM, helpdesk, and POS automatically.
                </p>
              </div>
              {/* Step 2 */}
              <div className="relative p-8 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white text-lg font-bold">2</div>
                <h3 className="text-lg font-semibold text-gray-900">AI Understands Intent</h3>
                <p className="mt-2 text-gray-600">
                  Sentiment analysis, topic clustering, and churn-risk scoring turn raw feedback into actionable intelligence — no analyst required.
                </p>
              </div>
              {/* Step 3 */}
              <div className="relative p-8 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white text-lg font-bold">3</div>
                <h3 className="text-lg font-semibold text-gray-900">Loyalty Responds Instantly</h3>
                <p className="mt-2 text-gray-600">
                  The right reward fires automatically — bonus points for a promoter, a recovery offer for a detractor, a tier upgrade for a milestone.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CX Feedback Engine */}
        <section className="bg-gray-50 py-20">
          <div className="mx-auto max-w-7xl px-6">
            <div className="flex flex-col lg:flex-row lg:items-start lg:gap-16">
              <div className="lg:w-1/2">
                <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Voice of Customer</p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                  Enterprise-grade CX feedback — built in, not bolted on
                </h2>
                <p className="mt-4 text-lg text-gray-600">
                  Stop paying six figures for a survey platform that can&apos;t trigger a single loyalty action.
                  CustomerEQ gives you the feedback engine and the response engine in one place.
                </p>
              </div>
              <div className="mt-10 lg:mt-0 lg:w-1/2 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-gray-200 bg-white p-5">
                  <span className="text-2xl">📋</span>
                  <h4 className="mt-2 font-semibold text-gray-900">NPS / CSAT / CES Surveys</h4>
                  <p className="mt-1 text-sm text-gray-600">Transactional and relational surveys with multi-channel distribution</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-5">
                  <span className="text-2xl">🧠</span>
                  <h4 className="mt-2 font-semibold text-gray-900">AI Sentiment Analysis</h4>
                  <p className="mt-1 text-sm text-gray-600">Open-ended responses scored and clustered by topic automatically</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-5">
                  <span className="text-2xl">🔮</span>
                  <h4 className="mt-2 font-semibold text-gray-900">Churn Risk Scoring</h4>
                  <p className="mt-1 text-sm text-gray-600">Predict at-risk customers before they leave using behavioral + feedback signals</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-5">
                  <span className="text-2xl">📍</span>
                  <h4 className="mt-2 font-semibold text-gray-900">Journey Touchpoint Mapping</h4>
                  <p className="mt-1 text-sm text-gray-600">See where experience breaks down across the full customer lifecycle</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-5">
                  <span className="text-2xl">📊</span>
                  <h4 className="mt-2 font-semibold text-gray-900">Trend &amp; Anomaly Detection</h4>
                  <p className="mt-1 text-sm text-gray-600">Spot emerging issues before they become crises with AI-powered alerting</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-5">
                  <span className="text-2xl">👤</span>
                  <h4 className="mt-2 font-semibold text-gray-900">Progressive Profiling</h4>
                  <p className="mt-1 text-sm text-gray-600">Contextual questions that enrich profiles over time without survey fatigue</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Loyalty Engine */}
        <section className="py-20">
          <div className="mx-auto max-w-7xl px-6">
            <div className="flex flex-col lg:flex-row-reverse lg:items-start lg:gap-16">
              <div className="lg:w-1/2">
                <p className="text-sm font-semibold uppercase tracking-wide text-violet-600">Loyalty Engine</p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                  A full loyalty platform — not just points and punch cards
                </h2>
                <p className="mt-4 text-lg text-gray-600">
                  Points, tiers, rewards, referrals, gamification, and campaign automation —
                  everything you need to run a world-class program, natively connected to your CX data.
                </p>
              </div>
              <div className="mt-10 lg:mt-0 lg:w-1/2 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-gray-200 bg-white p-5">
                  <span className="text-2xl">🏆</span>
                  <h4 className="mt-2 font-semibold text-gray-900">Points &amp; Tiers</h4>
                  <p className="mt-1 text-sm text-gray-600">Configurable earn rules, tiered memberships, and milestone rewards</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-5">
                  <span className="text-2xl">🎁</span>
                  <h4 className="mt-2 font-semibold text-gray-900">Rewards Catalog</h4>
                  <p className="mt-1 text-sm text-gray-600">Managed redemptions with stock tracking and atomic point transactions</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-5">
                  <span className="text-2xl">🔄</span>
                  <h4 className="mt-2 font-semibold text-gray-900">Smart Campaigns</h4>
                  <p className="mt-1 text-sm text-gray-600">Rules-based automation that triggers rewards on any CX or behavioral event</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-5">
                  <span className="text-2xl">🤝</span>
                  <h4 className="mt-2 font-semibold text-gray-900">Referral Programs</h4>
                  <p className="mt-1 text-sm text-gray-600">Unique referral codes, attribution tracking, and fraud prevention built in</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-5">
                  <span className="text-2xl">🎮</span>
                  <h4 className="mt-2 font-semibold text-gray-900">Gamification</h4>
                  <p className="mt-1 text-sm text-gray-600">Challenges, badges, and leaderboards that drive engagement and repeat behavior</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-5">
                  <span className="text-2xl">📱</span>
                  <h4 className="mt-2 font-semibold text-gray-900">Social Loyalty</h4>
                  <p className="mt-1 text-sm text-gray-600">Reward shares, follows, reviews, and user-generated content automatically</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* The Bridge — the real pitch */}
        <section className="bg-indigo-600 py-20">
          <div className="mx-auto max-w-7xl px-6 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              The magic is in the middle
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-indigo-100">
              Other companies sell you a survey tool or a loyalty tool.
              CustomerEQ is the real-time bridge between understanding your customers
              and rewarding them — and that changes everything.
            </p>
            <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-3">
              <div className="rounded-2xl bg-white/10 backdrop-blur p-8 text-left">
                <h3 className="text-lg font-semibold text-white">Closed-Loop Actions</h3>
                <p className="mt-2 text-indigo-100">
                  A detractor NPS score triggers a recovery campaign with bonus points and a personal outreach — within minutes, not days.
                </p>
              </div>
              <div className="rounded-2xl bg-white/10 backdrop-blur p-8 text-left">
                <h3 className="text-lg font-semibold text-white">CX-Informed Segmentation</h3>
                <p className="mt-2 text-indigo-100">
                  Segment loyalty campaigns by satisfaction scores, sentiment trends, and churn risk — not just purchase history.
                </p>
              </div>
              <div className="rounded-2xl bg-white/10 backdrop-blur p-8 text-left">
                <h3 className="text-lg font-semibold text-white">Unified ROI Dashboard</h3>
                <p className="mt-2 text-indigo-100">
                  See exactly how feedback-triggered loyalty actions impact retention, revenue, and lifetime value in one view.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Integrations */}
        <section className="py-20">
          <div className="mx-auto max-w-7xl px-6 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Plays nice with your stack
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
              Ingest events from the tools you already use. No custom middleware required.
            </p>
            <div className="mt-12 flex flex-wrap items-center justify-center gap-8 text-gray-400">
              <div className="flex flex-col items-center gap-2">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gray-100 text-2xl">☁️</div>
                <span className="text-sm font-medium text-gray-600">Salesforce</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gray-100 text-2xl">🟠</div>
                <span className="text-sm font-medium text-gray-600">HubSpot</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gray-100 text-2xl">🛒</div>
                <span className="text-sm font-medium text-gray-600">Shopify</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gray-100 text-2xl">🏪</div>
                <span className="text-sm font-medium text-gray-600">POS Systems</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gray-100 text-2xl">🔗</div>
                <span className="text-sm font-medium text-gray-600">Webhooks</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gray-100 text-2xl">📧</div>
                <span className="text-sm font-medium text-gray-600">Email / SMS</span>
              </div>
            </div>
          </div>
        </section>

        {/* AI-Powered Insights */}
        <section className="bg-gray-50 py-20">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">AI-Powered</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                Intelligence that acts, not just reports
              </h2>
              <p className="mt-4 text-lg text-gray-600">
                CustomerEQ&apos;s AI doesn&apos;t just show you dashboards. It clusters feedback into themes,
                detects emerging issues before they escalate, and recommends the next best loyalty
                action for every customer segment.
              </p>
            </div>
            <div className="mt-14 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100">
                  <span className="text-xl">🔬</span>
                </div>
                <h4 className="mt-4 font-semibold text-gray-900">Topic Clustering</h4>
                <p className="mt-1 text-sm text-gray-600">Group open-ended feedback into actionable themes automatically</p>
              </div>
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100">
                  <span className="text-xl">📈</span>
                </div>
                <h4 className="mt-4 font-semibold text-gray-900">Trend Detection</h4>
                <p className="mt-1 text-sm text-gray-600">Spot shifts in sentiment or satisfaction before they hit your bottom line</p>
              </div>
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100">
                  <span className="text-xl">🚨</span>
                </div>
                <h4 className="mt-4 font-semibold text-gray-900">Anomaly Alerts</h4>
                <p className="mt-1 text-sm text-gray-600">Get notified instantly when feedback patterns deviate from the norm</p>
              </div>
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100">
                  <span className="text-xl">🧭</span>
                </div>
                <h4 className="mt-4 font-semibold text-gray-900">Next-Best Action</h4>
                <p className="mt-1 text-sm text-gray-600">AI-suggested loyalty responses tailored to each customer&apos;s journey stage</p>
              </div>
            </div>
          </div>
        </section>

        {/* Built for Mid-Market */}
        <section className="py-20">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                Enterprise power, mid-market price
              </h2>
              <p className="mt-4 text-lg text-gray-600">
                You shouldn&apos;t need a $200K enterprise contract and a 6-month implementation
                to connect customer feedback to loyalty outcomes.
              </p>
            </div>
            <div className="mt-14 grid grid-cols-1 gap-8 sm:grid-cols-3">
              <div className="rounded-2xl border border-gray-200 p-8 text-center">
                <p className="text-4xl font-bold text-indigo-600">&lt;15 min</p>
                <p className="mt-2 font-semibold text-gray-900">CX-to-loyalty response time</p>
                <p className="mt-1 text-sm text-gray-600">From survey submission to reward action</p>
              </div>
              <div className="rounded-2xl border border-gray-200 p-8 text-center">
                <p className="text-4xl font-bold text-indigo-600">1 platform</p>
                <p className="mt-2 font-semibold text-gray-900">Replaces 2-3 tools</p>
                <p className="mt-1 text-sm text-gray-600">CX surveys, loyalty engine, and campaign automation</p>
              </div>
              <div className="rounded-2xl border border-gray-200 p-8 text-center">
                <p className="text-4xl font-bold text-indigo-600">Weeks</p>
                <p className="mt-2 font-semibold text-gray-900">Not months to go live</p>
                <p className="mt-1 text-sm text-gray-600">No custom integration work or engineering sprints</p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-indigo-600 py-20">
          <div className="mx-auto max-w-3xl px-6 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Stop paying the integration tax
            </h2>
            <p className="mt-4 text-lg text-indigo-100">
              See how CustomerEQ unifies customer feedback and loyalty
              into one platform that actually closes the loop.
            </p>
            <div className="mt-10 flex items-center justify-center gap-4">
              <Link
                href="/request-demo"
                className="rounded-lg bg-white px-8 py-3.5 text-base font-semibold text-indigo-600 shadow-sm hover:bg-indigo-50 transition-colors"
              >
                Request a Demo
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-gray-200 py-8">
          <div className="mx-auto max-w-7xl px-6 text-center text-sm text-gray-500">
            &copy; {new Date().getFullYear()} CustomerEQ. All rights reserved.
          </div>
        </footer>
      </main>
    </div>
  )
}

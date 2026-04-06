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

      <main>
        {/* ── Hero ── */}
        <section className="mx-auto max-w-7xl px-6 py-24 text-center">
          <div className="mx-auto max-w-3xl">
            <div className="mb-6 inline-flex items-center rounded-full bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-700">
              Now in Early Access
            </div>
            <h1 className="text-5xl font-bold tracking-tight text-gray-900 sm:text-6xl">
              Know Every Customer.
              <br />
              <span className="text-indigo-600">Act Before They Leave.</span>
            </h1>
            <p className="mt-6 text-xl leading-8 text-gray-600">
              CustomerEQ is the AI-powered customer intelligence platform that
              combines automated signals with human observations into one health
              score — then closes the loop with the right action, automatically.
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

        {/* ── The Problem ── */}
        <section className="bg-gray-50 py-20">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                Your customers are telling you everything. You&apos;re hearing almost none of it.
              </h2>
              <p className="mt-4 text-lg text-gray-600">
                Survey scores live in one system. Support tickets in another. Purchase data in a third.
                Rep observations sit in someone&apos;s notebook. By the time you piece the picture together,
                the customer has already made their decision.
              </p>
            </div>
            <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-3">
              <div className="rounded-2xl bg-white border border-gray-200 p-8 text-center">
                <p className="text-4xl font-bold text-red-600">3+ days</p>
                <p className="mt-2 text-gray-600">average time to act on customer feedback — customers expect minutes</p>
              </div>
              <div className="rounded-2xl bg-white border border-gray-200 p-8 text-center">
                <p className="text-4xl font-bold text-red-600">67%</p>
                <p className="mt-2 text-gray-600">of churn is preventable with early intervention — but only if you see it coming</p>
              </div>
              <div className="rounded-2xl bg-white border border-gray-200 p-8 text-center">
                <p className="text-4xl font-bold text-red-600">0</p>
                <p className="mt-2 text-gray-600">tools combine automated CX signals with rep observations into one customer score</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── How It Works ── */}
        <section className="py-20" id="how-it-works">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                Listen. Understand. Act. — In real time.
              </h2>
              <p className="mt-4 text-lg text-gray-600">
                CustomerEQ continuously ingests every customer signal, builds a living
                health score, and triggers the right response — all without waiting for
                a human to connect the dots.
              </p>
            </div>
            <div className="mt-14 grid grid-cols-1 gap-0 sm:grid-cols-4">
              <div className="relative p-8 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white text-lg font-bold">1</div>
                <h3 className="text-lg font-semibold text-gray-900">Capture Every Signal</h3>
                <p className="mt-2 text-gray-600">
                  NPS, CSAT, CES surveys. Support conversations. Purchase events.
                  Rep notes. Everything flows into one Customer 360.
                </p>
              </div>
              <div className="relative p-8 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white text-lg font-bold">2</div>
                <h3 className="text-lg font-semibold text-gray-900">AI Understands Intent</h3>
                <p className="mt-2 text-gray-600">
                  Sentiment analysis, topic clustering, anomaly detection, and
                  churn-risk scoring — automatically, across every customer.
                </p>
              </div>
              <div className="relative p-8 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white text-lg font-bold">3</div>
                <h3 className="text-lg font-semibold text-gray-900">Humans Add Context</h3>
                <p className="mt-2 text-gray-600">
                  Reps tag sentiment on their notes. When human and AI disagree,
                  CustomerEQ flags it — because that&apos;s where the insight is.
                </p>
              </div>
              <div className="relative p-8 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white text-lg font-bold">4</div>
                <h3 className="text-lg font-semibold text-gray-900">Action Fires Instantly</h3>
                <p className="mt-2 text-gray-600">
                  Recovery offers, tier upgrades, case escalations, personalized
                  outreach — the right response, to the right customer, right now.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Customer 360 — the flagship ── */}
        <section className="bg-indigo-600 py-20">
          <div className="mx-auto max-w-7xl px-6 text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-indigo-200">Flagship Feature</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Customer 360 with a health score that actually means something
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-indigo-100">
              Most health scores are black boxes built from one data source.
              CustomerEQ blends five automated signals with human rep observations
              into a transparent, explainable 0-100 score — and flags when they disagree.
            </p>
            <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-3">
              <div className="rounded-2xl bg-white/10 backdrop-blur p-8 text-left">
                <h3 className="text-lg font-semibold text-white">AI + Human Scoring</h3>
                <p className="mt-2 text-indigo-100">
                  Five automated sub-scores (recency, frequency, sentiment, NPS,
                  engagement) compute a base. Rep-tagged notes shift it up or down.
                  A &quot;churn risk&quot; tag from a rep drops a healthy-looking 85 to 45.
                </p>
              </div>
              <div className="rounded-2xl bg-white/10 backdrop-blur p-8 text-left">
                <h3 className="text-lg font-semibold text-white">Inconsistency Detection</h3>
                <p className="mt-2 text-indigo-100">
                  When automated signals say &quot;healthy&quot; but a rep flags concern —
                  or vice versa — CustomerEQ surfaces the divergence. These are the
                  highest-value signals in your entire CX operation.
                </p>
              </div>
              <div className="rounded-2xl bg-white/10 backdrop-blur p-8 text-left">
                <h3 className="text-lg font-semibold text-white">Full Activity Timeline</h3>
                <p className="mt-2 text-indigo-100">
                  Every loyalty event, survey response, campaign interaction,
                  support conversation, redemption, and CRM note — in one view.
                  Open any customer and see the full picture in seconds.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── CX Intelligence ── */}
        <section className="py-20">
          <div className="mx-auto max-w-7xl px-6">
            <div className="flex flex-col lg:flex-row lg:items-start lg:gap-16">
              <div className="lg:w-1/2">
                <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">CX Intelligence</p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                  Understand what&apos;s happening across your entire customer base — live
                </h2>
                <p className="mt-4 text-lg text-gray-600">
                  Don&apos;t wait for a quarterly report. CustomerEQ clusters feedback into
                  themes, tracks sentiment trends, and alerts you to anomalies the moment
                  patterns shift.
                </p>
              </div>
              <div className="mt-10 lg:mt-0 lg:w-1/2 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-gray-200 bg-white p-5">
                  <h4 className="font-semibold text-gray-900">Topic Clustering</h4>
                  <p className="mt-1 text-sm text-gray-600">AI groups open-ended feedback into actionable themes — &quot;Shipping Delays&quot;, &quot;Product Quality&quot;, &quot;Support Wait Times&quot; — and tracks each over time.</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-5">
                  <h4 className="font-semibold text-gray-900">Anomaly Detection</h4>
                  <p className="mt-1 text-sm text-gray-600">Shipping complaints spike 3x? Support sentiment drops 0.3 in a week? You&apos;ll know within hours, not at the next offsite.</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-5">
                  <h4 className="font-semibold text-gray-900">NPS / CSAT / CES Analytics</h4>
                  <p className="mt-1 text-sm text-gray-600">Aggregate scores, promoter/detractor splits, per-survey drill-downs, and 30-day trend lines — all in one real-time dashboard.</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-5">
                  <h4 className="font-semibold text-gray-900">Closed-Loop Alerts</h4>
                  <p className="mt-1 text-sm text-gray-600">When a detractor submits a score, a case opens automatically with SLA tracking and assignment. No manual triage.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Loyalty + Campaigns ── */}
        <section className="bg-gray-50 py-20">
          <div className="mx-auto max-w-7xl px-6">
            <div className="flex flex-col lg:flex-row-reverse lg:items-start lg:gap-16">
              <div className="lg:w-1/2">
                <p className="text-sm font-semibold uppercase tracking-wide text-violet-600">Loyalty & Campaigns</p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                  Reward the right behavior at the right moment
                </h2>
                <p className="mt-4 text-lg text-gray-600">
                  Points, tiers, rewards, gamification, and campaign automation — all
                  natively connected to your CX signals. A promoter gets a referral bonus.
                  A detractor gets a recovery offer. A milestone gets a spin-the-wheel surprise.
                </p>
              </div>
              <div className="mt-10 lg:mt-0 lg:w-1/2 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-gray-200 bg-white p-5">
                  <h4 className="font-semibold text-gray-900">Smart Campaigns</h4>
                  <p className="mt-1 text-sm text-gray-600">Rules-based automation: award points, send messages, spin wheels, scratch cards, or mystery boxes — triggered by any customer event.</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-5">
                  <h4 className="font-semibold text-gray-900">Points, Tiers & Rewards</h4>
                  <p className="mt-1 text-sm text-gray-600">Configurable earn rules, tiered memberships, milestone rewards, and a managed catalog with stock tracking and atomic transactions.</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-5">
                  <h4 className="font-semibold text-gray-900">CX-Informed Segments</h4>
                  <p className="mt-1 text-sm text-gray-600">Target campaigns by health score, sentiment, NPS, or tier — not just purchase history. A win-back campaign for NPS &lt; 6 is one click.</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-5">
                  <h4 className="font-semibold text-gray-900">Unified Analytics</h4>
                  <p className="mt-1 text-sm text-gray-600">Points issued, redemption rates, top rewards, campaign ROI, and loyalty health — one dashboard that ties CX outcomes to loyalty spend.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Support Intelligence ── */}
        <section className="py-20">
          <div className="mx-auto max-w-7xl px-6">
            <div className="flex flex-col lg:flex-row lg:items-start lg:gap-16">
              <div className="lg:w-1/2">
                <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">Support Intelligence</p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                  Every support conversation makes every customer smarter
                </h2>
                <p className="mt-4 text-lg text-gray-600">
                  CustomerEQ routes support conversations through AI that classifies
                  intent, searches your knowledge base, and escalates to the right
                  person — while feeding every interaction back into the Customer 360.
                </p>
              </div>
              <div className="mt-10 lg:mt-0 lg:w-1/2 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-gray-200 bg-white p-5">
                  <h4 className="font-semibold text-gray-900">AI-Powered Conversations</h4>
                  <p className="mt-1 text-sm text-gray-600">Customers chat with AI that has full context — their tier, health score, recent orders, and sentiment history — before a human is ever needed.</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-5">
                  <h4 className="font-semibold text-gray-900">Knowledge Base & Search</h4>
                  <p className="mt-1 text-sm text-gray-600">Semantic vector search over your KB articles. AI finds the right answer even when the customer doesn&apos;t use the right words.</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-5">
                  <h4 className="font-semibold text-gray-900">Routing Rules</h4>
                  <p className="mt-1 text-sm text-gray-600">Gold-tier unhappy customer? Skip the queue. Billing question? Auto-respond. Complaint? Escalate to the account team. All configurable.</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-5">
                  <h4 className="font-semibold text-gray-900">CRM Notes</h4>
                  <p className="mt-1 text-sm text-gray-600">Reps add notes with sentiment tags that shift the health score. When a rep says &quot;churn risk&quot;, the system listens — immediately.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── AI-Native / MCP ── */}
        <section className="bg-gray-900 py-20">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-sm font-semibold uppercase tracking-wide text-indigo-400">AI-Native Platform</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Your AI assistant already knows your customers
              </h2>
              <p className="mt-4 text-lg text-gray-400">
                CustomerEQ exposes every capability through an MCP (Model Context Protocol)
                server. Connect Claude, GPT, or any AI assistant and your team can ask
                questions, take actions, and update records — in natural language.
              </p>
            </div>
            <div className="mt-14 grid grid-cols-1 gap-8 sm:grid-cols-3">
              <div className="rounded-xl border border-gray-700 bg-gray-800 p-6">
                <p className="text-sm font-mono text-indigo-400">&gt; &quot;Who are my top 5 churn risks?&quot;</p>
                <p className="mt-3 text-sm text-gray-400">
                  The AI searches by health score, NPS, and sentiment — returns
                  the customers, their scores, and what&apos;s driving the risk.
                </p>
              </div>
              <div className="rounded-xl border border-gray-700 bg-gray-800 p-6">
                <p className="text-sm font-mono text-indigo-400">&gt; &quot;Tell me everything about Lisa Park&quot;</p>
                <p className="mt-3 text-sm text-gray-400">
                  Full Customer 360: profile, events, surveys, cases, rep notes,
                  health score breakdown with inconsistency flag — summarized
                  in natural language.
                </p>
              </div>
              <div className="rounded-xl border border-gray-700 bg-gray-800 p-6">
                <p className="text-sm font-mono text-indigo-400">&gt; &quot;She&apos;s actually happy — add that&quot;</p>
                <p className="mt-3 text-sm text-gray-400">
                  The AI adds a sentiment-tagged note, triggers a health score
                  recompute, and confirms the score shift — all in one turn.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Built-In, Not Bolted On ── */}
        <section className="py-20">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                Everything connected. Nothing duct-taped.
              </h2>
              <p className="mt-4 text-lg text-gray-600">
                Surveys, loyalty, support, analytics, and AI — built as one platform
                from day one. No integrations to maintain. No data silos to bridge.
                Every signal feeds into one customer model.
              </p>
            </div>
            <div className="mt-14 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
              {[
                { label: 'Surveys', desc: 'NPS, CSAT, CES with drag-and-drop builder' },
                { label: 'Loyalty', desc: 'Points, tiers, rewards, gamification' },
                { label: 'Campaigns', desc: '6 action types inc. spin wheel & scratch card' },
                { label: 'Support', desc: 'AI chat, routing rules, KB search' },
                { label: 'Analytics', desc: 'CX insights, anomalies, program health' },
                { label: 'AI/MCP', desc: 'Natural language ops via any AI assistant' },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-gray-200 bg-white p-5 text-center">
                  <h4 className="font-semibold text-gray-900">{item.label}</h4>
                  <p className="mt-1 text-xs text-gray-600">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Results ── */}
        <section className="bg-gray-50 py-20">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                From blind spots to real-time action
              </h2>
            </div>
            <div className="mt-14 grid grid-cols-1 gap-8 sm:grid-cols-3">
              <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
                <p className="text-4xl font-bold text-indigo-600">&lt;15 min</p>
                <p className="mt-2 font-semibold text-gray-900">Signal to action</p>
                <p className="mt-1 text-sm text-gray-600">From survey submission to recovery campaign, tier upgrade, or case escalation</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
                <p className="text-4xl font-bold text-indigo-600">1 score</p>
                <p className="mt-2 font-semibold text-gray-900">AI + Human health score</p>
                <p className="mt-1 text-sm text-gray-600">Five automated signals, rep-tagged sentiment, and inconsistency detection — in one number</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
                <p className="text-4xl font-bold text-indigo-600">6 in 1</p>
                <p className="mt-2 font-semibold text-gray-900">Platform, not point tools</p>
                <p className="mt-1 text-sm text-gray-600">Surveys, loyalty, campaigns, support, analytics, and AI — one platform, one customer model</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="bg-indigo-600 py-20">
          <div className="mx-auto max-w-3xl px-6 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Stop flying blind. Start acting in real time.
            </h2>
            <p className="mt-4 text-lg text-indigo-100">
              See how CustomerEQ turns fragmented customer data into a living
              health score and automated action engine — in one platform your
              whole team can use.
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

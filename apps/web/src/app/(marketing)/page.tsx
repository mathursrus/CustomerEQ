import type { Metadata } from 'next'
import Link from 'next/link'
import { MarketingNav } from './_components/marketing-nav'
import { Reveal } from './_components/reveal'

export const metadata: Metadata = {
  title: 'CustomerEQ: Customer intelligence for growing businesses',
  description:
    'Measure and drive retention, loyalty, and great support with one AI-powered customer health score. Enterprise-grade CX intelligence without the enterprise invoice. Built for SMBs.',
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 antialiased">
      <MarketingNav />

      <main>
        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden">
          {/* layered background */}
          <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-indigo-50/80 via-white to-white" />
          <div className="pointer-events-none absolute inset-0 -z-10 bg-dot-grid opacity-60 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
          <div className="blob -left-24 top-10 -z-10 h-72 w-72 bg-indigo-300/50" />
          <div className="blob right-0 top-32 -z-10 h-80 w-80 bg-violet-300/50 [animation-delay:-6s]" />
          <div className="blob left-1/3 top-0 -z-10 h-64 w-64 bg-fuchsia-200/40 [animation-delay:-12s]" />

          <div className="mx-auto grid max-w-7xl items-center gap-16 px-6 pb-24 pt-36 lg:grid-cols-[1.05fr_0.95fr] lg:pb-32 lg:pt-40">
            {/* copy */}
            <div>
              <Reveal>
                <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/70 px-4 py-1.5 text-sm font-medium text-indigo-700 shadow-sm backdrop-blur">
                  <span className="pulse-dot inline-block h-2 w-2 rounded-full bg-green-500" />
                  Built for SMBs &middot; Now in Early Access
                </div>
              </Reveal>

              <Reveal delay={80}>
                <h1 className="mt-6 text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
                  Know every customer.
                  <br />
                  <span className="text-gradient">Act before they leave.</span>
                </h1>
              </Reveal>

              <Reveal delay={160}>
                <p className="mt-6 max-w-xl text-lg leading-8 text-gray-600">
                  CustomerEQ turns surveys, support, purchases, and your team&apos;s own
                  notes into one living customer health score, then fires the right
                  action automatically. Enterprise-grade CX intelligence,{' '}
                  <span className="font-semibold text-gray-900">without the enterprise invoice.</span>
                </p>
              </Reveal>

              <Reveal delay={240}>
                <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center">
                  <Link
                    href="/request-demo"
                    data-testid="hero-cta-btn"
                    className="group inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-500/30 transition-all hover:shadow-xl hover:shadow-indigo-500/40 hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                  >
                    Request a Demo
                    <span className="transition-transform duration-300 group-hover:translate-x-0.5">→</span>
                  </Link>
                  <Link
                    href="#how-it-works"
                    className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-7 py-3.5 text-base font-semibold text-gray-700 transition-colors hover:border-indigo-200 hover:text-indigo-600"
                  >
                    See how it works
                  </Link>
                </div>
              </Reveal>

              <Reveal delay={320}>
                <p className="mt-6 text-sm text-gray-500">
                  No six-figure contract. No dedicated admin. No data silos to bridge.
                </p>
              </Reveal>
            </div>

            {/* hero product visual: Customer 360 health score card */}
            <Reveal delay={200} className="lg:justify-self-end">
              <HealthScoreCard />
            </Reveal>
          </div>
        </section>

        {/* ── Trust / stat strip ────────────────────────────────────────── */}
        <section className="border-y border-gray-100 bg-gray-50/60">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px overflow-hidden px-6 py-10 sm:grid-cols-4">
            {[
              { stat: '<15 min', label: 'Signal to action' },
              { stat: '1 score', label: 'AI + human, explainable' },
              { stat: '6-in-1', label: 'One platform, not point tools' },
              { stat: '67%', label: 'of churn is preventable' },
            ].map((item, i) => (
              <Reveal key={item.label} delay={i * 70} className="px-2 text-center">
                <p className="text-2xl font-bold text-gray-900 sm:text-3xl">{item.stat}</p>
                <p className="mt-1 text-sm text-gray-500">{item.label}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── The Problem ───────────────────────────────────────────────── */}
        <section className="py-24">
          <div className="mx-auto max-w-7xl px-6">
            <Reveal className="mx-auto max-w-3xl text-center">
              <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">The problem</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                Your customers are telling you everything.
                <br className="hidden sm:block" /> You&apos;re hearing almost none of it.
              </h2>
              <p className="mt-5 text-lg text-gray-600">
                Survey scores live in one tool. Support tickets in another. Purchases in a third.
                Rep observations sit in someone&apos;s notebook. By the time you piece it together,
                the customer has already decided.
              </p>
            </Reveal>

            <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-3">
              {[
                { stat: '3+ days', copy: 'average time to act on customer feedback, when customers expect minutes' },
                { stat: '5+ tools', copy: 'where your customer signals are scattered, none of them talking to each other' },
                { stat: '$0 budget', copy: 'most SMBs can spare for a six-figure enterprise CX suite and the admin to run it' },
              ].map((item, i) => (
                <Reveal key={item.stat} delay={i * 90}>
                  <div className="h-full rounded-2xl border border-gray-200 bg-white p-8 text-center transition-all duration-300 hover:-translate-y-1 hover:border-red-100 hover:shadow-lg">
                    <p className="text-4xl font-bold text-red-500">{item.stat}</p>
                    <p className="mt-3 text-gray-600">{item.copy}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── How It Works ──────────────────────────────────────────────── */}
        <section id="how-it-works" className="scroll-mt-24 bg-gradient-to-b from-gray-50 to-white py-24">
          <div className="mx-auto max-w-7xl px-6">
            <Reveal className="mx-auto max-w-3xl text-center">
              <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">How it works</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                Listen. Understand. Act. In real time.
              </h2>
              <p className="mt-5 text-lg text-gray-600">
                CustomerEQ continuously ingests every customer signal, builds a living
                health score, and triggers the right response, without waiting for a
                human to connect the dots.
              </p>
            </Reveal>

            <div className="relative mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {/* connecting line on large screens */}
              <div className="pointer-events-none absolute left-0 right-0 top-9 hidden h-px bg-gradient-to-r from-transparent via-indigo-200 to-transparent lg:block" />
              {[
                { n: '1', title: 'Capture every signal', copy: 'NPS, CSAT, CES surveys. Support chats. Purchase events. Rep notes. Everything flows into one Customer 360.' },
                { n: '2', title: 'AI understands intent', copy: 'Sentiment analysis, topic clustering, anomaly detection, and churn-risk scoring, all automatically, across every customer.' },
                { n: '3', title: 'Humans add context', copy: 'Reps tag sentiment on their notes. When human and AI disagree, CustomerEQ flags it. That’s where the insight is.' },
                { n: '4', title: 'Action fires instantly', copy: 'Recovery offers, tier upgrades, case escalations, personalized outreach: the right response, right now.' },
              ].map((step, i) => (
                <Reveal key={step.n} delay={i * 110}>
                  <div className="relative h-full rounded-2xl border border-gray-100 bg-white p-7 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
                    <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-lg font-bold text-white shadow-lg shadow-indigo-500/30">
                      {step.n}
                    </div>
                    <h3 className="text-lg font-semibold">{step.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-gray-600">{step.copy}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Customer 360 flagship */}
        <section id="platform" className="scroll-mt-24 py-24">
          <div className="mx-auto max-w-7xl px-6">
            <Reveal>
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-700 px-6 py-16 sm:px-12 sm:py-20">
                <div className="blob -right-10 -top-10 h-72 w-72 bg-violet-400/40" />
                <div className="blob -bottom-16 left-10 h-72 w-72 bg-indigo-400/40 [animation-delay:-8s]" />
                <div className="relative mx-auto max-w-3xl text-center">
                  <p className="text-sm font-semibold uppercase tracking-wide text-indigo-200">Flagship feature</p>
                  <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                    A health score that actually means something
                  </h2>
                  <p className="mx-auto mt-5 max-w-2xl text-lg text-indigo-100">
                    Most health scores are black boxes built from one data source. CustomerEQ
                    blends five automated signals with your team&apos;s observations into a
                    transparent, explainable 0 to 100 score, and flags when they disagree.
                  </p>
                </div>

                <div className="relative mt-14 grid grid-cols-1 gap-6 sm:grid-cols-3">
                  {[
                    { title: 'AI + human scoring', copy: 'Five automated sub-scores (recency, frequency, sentiment, NPS, engagement) compute a base. Rep-tagged notes shift it. A “churn risk” tag drops a healthy-looking 85 to 45.' },
                    { title: 'Inconsistency detection', copy: 'When automated signals say “healthy” but a rep flags concern (or vice versa), CustomerEQ surfaces the divergence. The highest-value signals you have.' },
                    { title: 'Full activity timeline', copy: 'Every loyalty event, survey, campaign interaction, support conversation, redemption, and note, all in one view. Open a customer, see the whole story.' },
                  ].map((card, i) => (
                    <Reveal key={card.title} delay={i * 90}>
                      <div className="h-full rounded-2xl border border-white/15 bg-white/10 p-7 text-left backdrop-blur transition-colors duration-300 hover:bg-white/15">
                        <h3 className="text-lg font-semibold text-white">{card.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-indigo-100">{card.copy}</p>
                      </div>
                    </Reveal>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── Feature pillars ───────────────────────────────────────────── */}
        <FeatureRow
          eyebrow="CX Intelligence"
          eyebrowColor="text-indigo-600"
          title="Understand your whole customer base, live"
          copy="Don’t wait for a quarterly report. CustomerEQ clusters feedback into themes, tracks sentiment trends, and alerts you the moment patterns shift."
          features={[
            { title: 'Topic clustering', copy: 'AI groups open-ended feedback into actionable themes like “Shipping Delays”, “Product Quality”, and “Support Wait Times”, then tracks each over time.' },
            { title: 'Anomaly detection', copy: 'Shipping complaints spike 3×? Support sentiment drops in a week? You’ll know within hours, not at the next offsite.' },
            { title: 'NPS / CSAT / CES analytics', copy: 'Aggregate scores, promoter/detractor splits, per-survey drill-downs, and 30-day trend lines, all in one real-time dashboard.' },
            { title: 'Closed-loop alerts', copy: 'When a detractor submits a score, a case opens automatically with SLA tracking and assignment. No manual triage.' },
          ]}
        />

        <FeatureRow
          reverse
          tinted
          eyebrow="Loyalty & Campaigns"
          eyebrowColor="text-violet-600"
          title="Reward the right behavior at the right moment"
          copy="Points, tiers, rewards, gamification, and campaign automation, all natively connected to your CX signals. A promoter gets a referral bonus. A detractor gets a recovery offer."
          features={[
            { title: 'Smart campaigns', copy: 'Rules-based automation: award points, send messages, spin wheels, scratch cards, or mystery boxes, triggered by any customer event.' },
            { title: 'Points, tiers & rewards', copy: 'Configurable earn rules, tiered memberships, milestone rewards, and a managed catalog with stock tracking and atomic transactions.' },
            { title: 'CX-informed segments', copy: 'Target by health score, sentiment, NPS, or tier, not just purchase history. A win-back campaign for NPS < 6 is one click.' },
            { title: 'Unified analytics', copy: 'Points issued, redemption rates, top rewards, campaign ROI, all in one dashboard tying CX outcomes to loyalty spend.' },
          ]}
        />

        <FeatureRow
          eyebrow="Support Intelligence"
          eyebrowColor="text-emerald-600"
          title="Every support conversation makes every customer smarter"
          copy="CustomerEQ routes conversations through AI that classifies intent, searches your knowledge base, and escalates to the right person, feeding every interaction back into the Customer 360."
          features={[
            { title: 'AI-powered conversations', copy: 'Customers chat with AI that has full context (tier, health score, recent orders, sentiment history) before a human is ever needed.' },
            { title: 'Knowledge base & search', copy: 'Semantic vector search over your KB. AI finds the right answer even when the customer doesn’t use the right words.' },
            { title: 'Routing rules', copy: 'Gold-tier unhappy customer? Skip the queue. Billing question? Auto-respond. Complaint? Escalate. All configurable.' },
            { title: 'CRM notes', copy: 'Reps add notes with sentiment tags that shift the health score. When a rep says “churn risk”, the system listens immediately.' },
          ]}
        />

        {/* ── AI-native / MCP ───────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-gray-950 py-24">
          <div className="blob -left-10 top-10 h-72 w-72 bg-indigo-600/30" />
          <div className="blob right-0 bottom-0 h-72 w-72 bg-violet-600/30 [animation-delay:-9s]" />
          <div className="relative mx-auto max-w-7xl px-6">
            <Reveal className="mx-auto max-w-3xl text-center">
              <p className="text-sm font-semibold uppercase tracking-wide text-indigo-400">AI-native platform</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Your AI assistant already knows your customers
              </h2>
              <p className="mt-5 text-lg text-gray-400">
                CustomerEQ exposes every capability through an MCP (Model Context Protocol)
                server. Connect Claude, GPT, or any AI assistant and your team can ask
                questions, take actions, and update records, in plain language.
              </p>
            </Reveal>

            <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-3">
              {[
                { q: 'Who are my top 5 churn risks?', a: 'The AI searches by health score, NPS, and sentiment, then returns the customers, their scores, and what’s driving the risk.' },
                { q: 'Tell me everything about Lisa Park', a: 'Full Customer 360: profile, events, surveys, cases, notes, and the health-score breakdown with its inconsistency flag, all in natural language.' },
                { q: 'She’s actually happy, add that', a: 'The AI adds a sentiment-tagged note, triggers a health-score recompute, and confirms the shift, all in one turn.' },
              ].map((item, i) => (
                <Reveal key={item.q} delay={i * 100}>
                  <div className="h-full rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-colors duration-300 hover:border-indigo-500/40 hover:bg-white/[0.06]">
                    <p className="font-mono text-sm text-indigo-300">&gt; &ldquo;{item.q}&rdquo;</p>
                    <p className="mt-3 text-sm leading-6 text-gray-400">{item.a}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing / positioning ─────────────────────────────────────── */}
        <section id="pricing" className="scroll-mt-24 py-24">
          <div className="mx-auto max-w-7xl px-6">
            <Reveal className="mx-auto max-w-3xl text-center">
              <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Why CustomerEQ</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                Enterprise CX intelligence, <span className="text-gradient">without the enterprise invoice</span>
              </h2>
              <p className="mt-5 text-lg text-gray-600">
                Legacy survey suites were built for Fortune-500 budgets: six-figure
                contracts, mandatory onboarding fees, and a full-time admin to keep the
                lights on. CustomerEQ gives growing businesses the same intelligence at a
                price that fits an SMB plan.
              </p>
            </Reveal>

            <Reveal delay={120}>
              <div className="mx-auto mt-14 max-w-4xl overflow-hidden rounded-3xl border border-gray-200 shadow-xl">
                <div className="grid grid-cols-1 sm:grid-cols-2">
                  {/* legacy */}
                  <div className="border-b border-gray-200 bg-gray-50 p-8 sm:border-b-0 sm:border-r">
                    <p className="text-sm font-semibold uppercase tracking-wide text-gray-400">Legacy enterprise CX suites</p>
                    <ul className="mt-6 space-y-4 text-sm text-gray-600">
                      {[
                        'Six-figure annual contracts + onboarding fees',
                        'A dedicated admin to configure and maintain it',
                        'Surveys here, loyalty there, support somewhere else',
                        'Quarterly exports and static dashboards',
                        'Weeks of professional services to change anything',
                      ].map((t) => (
                        <li key={t} className="flex gap-3">
                          <span className="mt-0.5 text-gray-300">✕</span>
                          <span>{t}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {/* CustomerEQ */}
                  <div className="relative bg-white p-8">
                    <div className="absolute right-6 top-6 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                      CustomerEQ
                    </div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Built &amp; priced for SMBs</p>
                    <ul className="mt-6 space-y-4 text-sm text-gray-700">
                      {[
                        'Transparent SMB pricing, no six-figure floor',
                        'Set up yourself in an afternoon, no admin headcount',
                        'Surveys, loyalty, support & analytics in one platform',
                        'Real-time health scores and live anomaly alerts',
                        'Change rules, campaigns, and routing in a few clicks',
                      ].map((t) => (
                        <li key={t} className="flex gap-3">
                          <span className="mt-0.5 font-semibold text-emerald-500">✓</span>
                          <span>{t}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </Reveal>

            <Reveal delay={200} className="mt-10 text-center">
              <p className="text-gray-600">
                Measure and drive retention, loyalty, and great support the way the big
                players do, at a price that makes sense for your business.
              </p>
            </Reveal>
          </div>
        </section>

        {/* ── Built-in, not bolted on ───────────────────────────────────── */}
        <section className="bg-gray-50/70 py-24">
          <div className="mx-auto max-w-7xl px-6">
            <Reveal className="mx-auto max-w-3xl text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Everything connected. Nothing duct-taped.
              </h2>
              <p className="mt-5 text-lg text-gray-600">
                Surveys, loyalty, support, analytics, and AI, built as one platform from
                day one. No integrations to maintain. No data silos to bridge. Every signal
                feeds one customer model.
              </p>
            </Reveal>
            <div className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {[
                { label: 'Surveys', desc: 'NPS, CSAT, CES with a drag-and-drop builder' },
                { label: 'Loyalty', desc: 'Points, tiers, rewards, gamification' },
                { label: 'Campaigns', desc: '6 action types incl. spin wheel & scratch card' },
                { label: 'Support', desc: 'AI chat, routing rules, KB search' },
                { label: 'Analytics', desc: 'CX insights, anomalies, program health' },
                { label: 'AI / MCP', desc: 'Natural-language ops via any AI assistant' },
              ].map((item, i) => (
                <Reveal key={item.label} delay={i * 60}>
                  <div className="h-full rounded-2xl border border-gray-200 bg-white p-5 text-center transition-all duration-300 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-md">
                    <h4 className="font-semibold text-gray-900">{item.label}</h4>
                    <p className="mt-1 text-xs leading-5 text-gray-600">{item.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Final CTA ─────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-gradient-to-br from-indigo-600 to-violet-700 py-24">
          <div className="blob -left-10 top-0 h-72 w-72 bg-violet-400/40" />
          <div className="blob right-0 bottom-0 h-72 w-72 bg-indigo-400/40 [animation-delay:-7s]" />
          <Reveal className="relative mx-auto max-w-3xl px-6 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Stop flying blind. Start acting in real time.
            </h2>
            <p className="mt-5 text-lg text-indigo-100">
              See how CustomerEQ turns fragmented customer data into a living health score
              and an automated action engine, in one platform your whole team can use.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/request-demo"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-base font-semibold text-indigo-600 shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl"
              >
                Request a Demo →
              </Link>
              <Link
                href="/sign-in"
                className="inline-flex items-center rounded-xl border border-white/30 px-8 py-3.5 text-base font-semibold text-white transition-colors hover:bg-white/10"
              >
                Sign In
              </Link>
            </div>
          </Reveal>
        </section>

        {/* Footer */}
        <footer className="border-t border-gray-200 py-10">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600">
                <span className="text-xs font-bold text-white">C</span>
              </div>
              <span>&copy; {new Date().getFullYear()} CustomerEQ. All rights reserved.</span>
            </div>
            <div className="flex items-center gap-6">
              <Link href="/privacy" className="hover:text-indigo-600">Privacy</Link>
              <Link href="/terms" className="hover:text-indigo-600">Terms</Link>
              <Link href="/security" className="hover:text-indigo-600">Security</Link>
            </div>
          </div>
        </footer>
      </main>
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
 * Local presentational helpers
 * ────────────────────────────────────────────────────────────────────────── */

type FeatureRowProps = {
  eyebrow: string
  eyebrowColor: string
  title: string
  copy: string
  features: { title: string; copy: string }[]
  reverse?: boolean
  tinted?: boolean
}

function FeatureRow({ eyebrow, eyebrowColor, title, copy, features, reverse, tinted }: FeatureRowProps) {
  return (
    <section className={tinted ? 'bg-gray-50/70 py-24' : 'py-24'}>
      <div className="mx-auto max-w-7xl px-6">
        <div className={`flex flex-col gap-12 lg:items-center lg:gap-16 ${reverse ? 'lg:flex-row-reverse' : 'lg:flex-row'}`}>
          <Reveal className="lg:w-2/5">
            <p className={`text-sm font-semibold uppercase tracking-wide ${eyebrowColor}`}>{eyebrow}</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
            <p className="mt-5 text-lg text-gray-600">{copy}</p>
          </Reveal>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:w-3/5">
            {features.map((f, i) => (
              <Reveal key={f.title} delay={i * 80}>
                <div className="h-full rounded-2xl border border-gray-200 bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-lg">
                  <h4 className="font-semibold text-gray-900">{f.title}</h4>
                  <p className="mt-2 text-sm leading-6 text-gray-600">{f.copy}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/** Decorative Customer-360 health-score card used in the hero. */
function HealthScoreCard() {
  return (
    <div className="relative w-full max-w-md">
      {/* glow */}
      <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-indigo-400/30 to-violet-400/30 blur-2xl" />
      <div className="rounded-3xl border border-gray-200/80 bg-white/90 p-6 shadow-2xl shadow-indigo-500/10 backdrop-blur">
        {/* header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white">
              LP
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Lisa Park</p>
              <p className="text-xs text-gray-500">Gold tier &middot; Customer 360</p>
            </div>
          </div>
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
            Inconsistency
          </span>
        </div>

        {/* score */}
        <div className="mt-6 flex items-center gap-5">
          <div className="relative flex h-24 w-24 items-center justify-center">
            <svg viewBox="0 0 100 100" className="h-24 w-24 -rotate-90">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#e5e7eb" strokeWidth="9" />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="url(#hsg)"
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray="264"
                strokeDashoffset="145"
              />
              <defs>
                <linearGradient id="hsg" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#d946ef" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute text-center">
              <p className="text-2xl font-bold text-gray-900">45</p>
              <p className="text-[10px] font-medium uppercase text-gray-400">health</p>
            </div>
          </div>
          <div className="flex-1">
            <p className="text-sm text-gray-600">
              Signals read <span className="font-semibold text-gray-900">85</span>, but a rep
              tagged <span className="font-semibold text-amber-600">&ldquo;churn risk&rdquo;</span>.
            </p>
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600">
              Recovery offer queued
            </p>
          </div>
        </div>

        {/* sub-signals */}
        <div className="mt-6 space-y-3">
          {[
            { label: 'Sentiment', value: 78, color: 'from-indigo-500 to-violet-500' },
            { label: 'NPS', value: 90, color: 'from-emerald-500 to-teal-500' },
            { label: 'Engagement', value: 64, color: 'from-amber-400 to-orange-500' },
          ].map((s) => (
            <div key={s.label}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium text-gray-500">{s.label}</span>
                <span className="font-semibold text-gray-700">{s.value}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div className={`h-full rounded-full bg-gradient-to-r ${s.color}`} style={{ width: `${s.value}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

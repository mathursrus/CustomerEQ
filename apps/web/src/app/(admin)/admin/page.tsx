'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@clerk/nextjs'
import { API_URL, getAuthToken } from '@/lib/config'
import type { ProgramHealthResponse, Insight } from '@customerEQ/shared'

function KPICard({ label, value, testId }: { label: string; value: string | number; testId?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p data-testid={testId} className="mt-2 text-3xl font-bold text-gray-900">
        {value}
      </p>
    </div>
  )
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="h-8 w-8 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
    </div>
  )
}

function CXHealthPanel({ data }: { data: ProgramHealthResponse['cxHealth'] }) {
  if (!data || data.activeSurveys === 0) {
    return (
      <div
        data-testid="cx-health-panel"
        className="rounded-xl border border-gray-200 bg-white p-6 flex flex-col"
      >
        <h2 className="text-base font-semibold text-gray-900 mb-4">CX Health</h2>
        <div
          data-testid="cx-health-empty"
          className="flex-1 flex flex-col items-center justify-center text-center py-8"
        >
          <p className="text-sm text-gray-500 mb-3">No surveys yet — create your first survey to start collecting member feedback</p>
          <Link
            href="/admin/surveys/new"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            Create survey
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div
      data-testid="cx-health-panel"
      className="rounded-xl border border-gray-200 bg-white p-6"
    >
      <h2 className="text-base font-semibold text-gray-900 mb-4">CX Health</h2>
      <div className="grid grid-cols-2 gap-4">
        <KPICard
          label="Avg NPS (30d)"
          value={data.avgNps != null ? data.avgNps : '—'}
          testId="cx-avg-nps"
        />
        <KPICard
          label="Active Surveys"
          value={data.activeSurveys}
          testId="cx-active-surveys"
        />
        <KPICard
          label="Response Rate (30d)"
          value={data.responseRate != null ? `${data.responseRate.toFixed(1)}%` : '—'}
          testId="cx-response-rate"
        />
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <p className="text-sm font-medium text-gray-500">At-Risk Members</p>
          <Link
            href={`/admin/campaigns/new?filter=detractors&maxNps=6`}
            data-testid="cx-at-risk-badge"
            className="mt-2 block text-3xl font-bold text-amber-600 hover:text-amber-700 transition-colors"
          >
            {data.atRiskCount}
          </Link>
        </div>
      </div>
    </div>
  )
}

function LoyaltyHealthPanel({ data }: { data: ProgramHealthResponse['loyaltyHealth'] }) {
  if (!data || data.activeCampaigns === 0) {
    return (
      <div
        data-testid="loyalty-health-panel"
        className="rounded-xl border border-gray-200 bg-white p-6 flex flex-col"
      >
        <h2 className="text-base font-semibold text-gray-900 mb-4">Loyalty Health</h2>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <KPICard
            label="Active Members"
            value={data?.activeMembers ?? 0}
            testId="loyalty-active-members"
          />
          <KPICard
            label="Points This Week"
            value={data?.pointsIssuedThisWeek?.toLocaleString() ?? '0'}
            testId="loyalty-points-week"
          />
        </div>
        <div
          data-testid="loyalty-health-empty"
          className="flex-1 flex flex-col items-center justify-center text-center py-4"
        >
          <p className="text-sm text-gray-500 mb-3">No campaigns active — set up a campaign to start rewarding members</p>
          <Link
            href="/admin/campaigns/new"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            Create campaign
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div
      data-testid="loyalty-health-panel"
      className="rounded-xl border border-gray-200 bg-white p-6"
    >
      <h2 className="text-base font-semibold text-gray-900 mb-4">Loyalty Health</h2>
      <div className="grid grid-cols-2 gap-4">
        <KPICard
          label="Active Members"
          value={data.activeMembers.toLocaleString()}
          testId="loyalty-active-members"
        />
        <KPICard
          label="Points This Week"
          value={data.pointsIssuedThisWeek.toLocaleString()}
          testId="loyalty-points-week"
        />
        <KPICard
          label="Redemption Rate (30d)"
          value={`${data.redemptionRate.toFixed(1)}%`}
          testId="loyalty-redemption-rate"
        />
        <KPICard
          label="Active Campaigns"
          value={data.activeCampaigns}
          testId="loyalty-active-campaigns"
        />
      </div>
    </div>
  )
}

function InsightsSection({ insights }: { insights: ProgramHealthResponse['insights'] }) {
  if (insights.length === 0) return null

  return (
    <div data-testid="insights-section" className="mt-6">
      <h2 className="text-base font-semibold text-gray-900 mb-3">Insights</h2>
      <div className="flex flex-col gap-3">
        {insights.map((insight: Insight) => (
          <div
            key={insight.id}
            data-testid={`insight-card-${insight.id}`}
            className={`rounded-xl border bg-white p-4 flex items-start justify-between gap-4 border-l-4 ${
              insight.severity === 'warning' ? 'border-l-amber-400' : 'border-l-indigo-400'
            }`}
          >
            <p className="text-sm text-gray-700">{insight.message}</p>
            {insight.ctaLabel && insight.ctaHref && (
              <a
                href={insight.ctaHref}
                data-testid={`insight-cta-${insight.id}`}
                className="shrink-0 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
              >
                {insight.ctaLabel}
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AdminHomePage() {
  const { getToken } = useAuth()
  const [data, setData] = useState<ProgramHealthResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchHealth() {
      setLoading(true)
      try {
        const token = await getAuthToken(getToken)
        const headers: Record<string, string> = token
          ? { Authorization: `Bearer ${token}` }
          : {}
        const res = await fetch(`${API_URL}/v1/analytics/program-health`, { headers })
        if (res.ok) {
          setData(await res.json())
        }
      } catch {
        // silently handle — panels will show empty/null states
      } finally {
        setLoading(false)
      }
    }
    fetchHealth()
  }, [getToken])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">Program health at a glance</p>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <CXHealthPanel data={data?.cxHealth ?? null} />
            <LoyaltyHealthPanel data={data?.loyaltyHealth ?? null} />
          </div>
          {data && <InsightsSection insights={data.insights} />}
        </>
      )}
    </div>
  )
}

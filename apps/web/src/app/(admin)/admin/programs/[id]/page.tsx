import Link from 'next/link'
import { notFound } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { API_URL } from '@/lib/config'

interface EarningRule {
  id: string
  name: string
  triggerEvent: string
  pointsAwarded: number
  multiplier: number
  status: string
}

interface Program {
  id: string
  name: string
  description: string | null
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED'
  pointCurrencyName: string
  pointToCurrencyRatio: number | null
  createdAt: string
  updatedAt: string
  earningRules: EarningRule[]
}

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  DRAFT: 'bg-gray-100 text-gray-700',
  PAUSED: 'bg-yellow-100 text-yellow-700',
  ARCHIVED: 'bg-red-100 text-red-700',
}

async function getProgram(id: string): Promise<Program | null> {
  try {
    const { getToken } = await auth()
    const token = await getToken()
    const res = await fetch(`${API_URL}/v1/programs/${id}`, {
      cache: 'no-store',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export default async function ProgramDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const program = await getProgram(id)

  if (!program) {
    notFound()
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/programs"
          className="text-sm text-indigo-600 hover:text-indigo-700 hover:underline"
        >
          &larr; Back to Programs
        </Link>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{program.name}</h1>
          {program.description && (
            <p className="mt-1 text-sm text-gray-500">{program.description}</p>
          )}
        </div>
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[program.status] ?? 'bg-gray-100 text-gray-700'}`}
        >
          {program.status}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Point Currency
          </p>
          <p className="mt-1 text-lg font-medium text-gray-900">
            {program.pointCurrencyName}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Point Ratio
          </p>
          <p className="mt-1 text-lg font-medium text-gray-900">
            {program.pointToCurrencyRatio
              ? `1 pt = $${program.pointToCurrencyRatio}`
              : '—'}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Created
          </p>
          <p className="mt-1 text-lg font-medium text-gray-900">
            {new Date(program.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Updated
          </p>
          <p className="mt-1 text-lg font-medium text-gray-900">
            {new Date(program.updatedAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Earning Rules
        </h2>
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Name
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Trigger Event
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Points Awarded
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Multiplier
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {program.earningRules.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-gray-400"
                  >
                    No earning rules yet. Add a rule to start awarding points.
                  </td>
                </tr>
              ) : (
                program.earningRules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {rule.name}
                    </td>
                    <td className="px-6 py-4 text-gray-700">
                      {rule.triggerEvent}
                    </td>
                    <td className="px-6 py-4 text-gray-700">
                      {rule.pointsAwarded}
                    </td>
                    <td className="px-6 py-4 text-gray-700">
                      {rule.multiplier}x
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[rule.status] ?? 'bg-gray-100 text-gray-700'}`}
                      >
                        {rule.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

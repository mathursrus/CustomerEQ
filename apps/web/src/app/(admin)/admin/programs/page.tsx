import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

interface Program {
  id: string
  name: string
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED'
  pointCurrencyName: string
  pointToCurrencyRatio: number
  createdAt: string
}

async function getPrograms(): Promise<Program[]> {
  try {
    const { getToken } = await auth()
    const token = await getToken()
    const res = await fetch(`${API_URL}/v1/programs`, {
      cache: 'no-store',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.programs ?? data ?? []
  } catch {
    return []
  }
}

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  DRAFT: 'bg-gray-100 text-gray-700',
  PAUSED: 'bg-yellow-100 text-yellow-700',
  ARCHIVED: 'bg-red-100 text-red-700',
}

export default async function ProgramsPage() {
  const programs = await getPrograms()

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Programs</h1>
          <p className="mt-1 text-sm text-gray-500">Manage your loyalty programs</p>
        </div>
        <Link
          href="/admin/programs/new"
          data-testid="create-program-btn"
          className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
        >
          Create Program
        </Link>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <table data-testid="programs-table" className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Point Currency</th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Ratio</th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {programs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                  No programs yet.{' '}
                  <Link href="/admin/programs/new" className="text-indigo-600 hover:underline">
                    Create your first program
                  </Link>
                </td>
              </tr>
            ) : (
              programs.map((program) => (
                <tr key={program.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">
                    <Link href={`/admin/programs/${program.id}`} className="hover:text-indigo-600">
                      {program.name}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[program.status] ?? 'bg-gray-100 text-gray-700'}`}>
                      {program.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-700">{program.pointCurrencyName}</td>
                  <td className="px-6 py-4 text-gray-700">{program.pointToCurrencyRatio ? `1 pt = $${program.pointToCurrencyRatio}` : '—'}</td>
                  <td className="px-6 py-4 text-gray-500">
                    {new Date(program.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

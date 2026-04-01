'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import { API_URL } from '@/lib/config'

interface Theme {
  id: string
  name: string
  isDefault: boolean
  primaryColor: string
  secondaryColor: string
  backgroundColor: string
  textColor: string
  buttonColor: string
  buttonTextColor: string
  accentColor: string
  _count?: { surveys: number }
  createdAt: string
}

async function getThemes(token: string | null): Promise<Theme[]> {
  try {
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
    const res = await fetch(`${API_URL}/v1/themes`, { cache: 'no-store', headers })
    if (!res.ok) return []
    const data = await res.json()
    return data.themes ?? data ?? []
  } catch {
    return []
  }
}

function ColorSwatch({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-5 w-5 rounded border border-gray-200"
      style={{ backgroundColor: color }}
      title={color}
    />
  )
}

export default function ThemesPage() {
  const { getToken } = useAuth()
  const [themes, setThemes] = useState<Theme[]>([])

  useEffect(() => {
    getToken().then((token) => getThemes(token).then(setThemes))
  }, [getToken])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Themes</h1>
          <p className="mt-1 text-sm text-gray-500">Manage survey branding and visual themes</p>
        </div>
        <Link
          href="/admin/settings/themes/new"
          className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
        >
          Create Theme
        </Link>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Default</th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Colors</th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Surveys</th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {themes.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                  No themes yet.{' '}
                  <Link href="/admin/settings/themes/new" className="text-indigo-600 hover:underline">
                    Create your first theme
                  </Link>
                </td>
              </tr>
            ) : (
              themes.map((theme) => (
                <tr key={theme.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">
                    <Link href={`/admin/settings/themes/${theme.id}`} className="hover:text-indigo-600">
                      {theme.name}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    {theme.isDefault && (
                      <span className="inline-flex rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                        Default
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      <ColorSwatch color={theme.primaryColor} />
                      <ColorSwatch color={theme.secondaryColor} />
                      <ColorSwatch color={theme.backgroundColor} />
                      <ColorSwatch color={theme.buttonColor} />
                      <ColorSwatch color={theme.accentColor} />
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-700">{theme._count?.surveys ?? 0}</td>
                  <td className="px-6 py-4 text-gray-500">
                    {new Date(theme.createdAt).toLocaleDateString()}
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

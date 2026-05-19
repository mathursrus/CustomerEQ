'use client'

import { useEffect, useState } from 'react'
import { API_URL } from '@/lib/config'
import EnrollmentForm from './EnrollmentForm'

interface ProgramInfo {
  programId: string
  programName: string
  programSlug: string
  brandId: string
  brandName: string
}

export default function EnrollPageClient({ programSlug }: { programSlug: string }) {
  const [program, setProgram] = useState<ProgramInfo | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>('loading')

  useEffect(() => {
    let active = true

    async function loadProgram() {
      try {
        const res = await fetch(`${API_URL}/v1/public/programs/by-slug/${encodeURIComponent(programSlug)}`, {
          cache: 'no-store',
        })

        if (!active) {
          return
        }

        if (!res.ok) {
          setStatus('missing')
          return
        }

        const nextProgram = await res.json() as ProgramInfo

        if (!active) {
          return
        }

        setProgram(nextProgram)
        setStatus('ready')
      } catch {
        if (active) {
          setStatus('missing')
        }
      }
    }

    loadProgram()

    return () => {
      active = false
    }
  }, [programSlug])

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
        <p className="text-sm text-gray-500">Loading enrollment…</p>
      </div>
    )
  }

  if (status === 'missing' || !program) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-gray-900">404</h1>
          <h2 className="mt-4 text-2xl font-semibold text-gray-900">This page could not be found.</h2>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto h-12 w-12 rounded-xl bg-indigo-600 flex items-center justify-center mb-4">
            <span className="text-white text-xl font-bold">C</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{program.programName}</h1>
          <p className="mt-2 text-sm text-gray-500">{program.brandName}</p>
        </div>
        <EnrollmentForm program={program} />
      </div>
    </div>
  )
}

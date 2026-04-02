import { notFound } from 'next/navigation'
import { API_URL } from '@/lib/config'
import EnrollmentForm from './EnrollmentForm'

interface ProgramInfo {
  programId: string
  programName: string
  programSlug: string
  brandId: string
  brandName: string
}

async function fetchProgram(slug: string): Promise<ProgramInfo | null> {
  try {
    const res = await fetch(`${API_URL}/v1/public/programs/by-slug/${encodeURIComponent(slug)}`, {
      cache: 'no-store',
    })
    if (!res.ok) return null
    return res.json() as Promise<ProgramInfo>
  } catch {
    return null
  }
}

export default async function EnrollPage({
  params,
}: {
  params: Promise<{ programSlug: string }>
}) {
  const { programSlug } = await params
  const program = await fetchProgram(programSlug)

  if (!program) {
    notFound()
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

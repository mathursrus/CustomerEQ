import { notFound } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { API_URL } from '@/lib/config'
import { ProgramWizardLoader } from '../../_components/program-wizard-loader'

async function getProgram(id: string) {
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

export default async function ProgramEditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const program = await getProgram(id)
  if (!program) notFound()

  return <ProgramWizardLoader mode="edit" programId={id} program={program} />
}

'use client'

import { ProgramWizard } from './program-wizard'
import { mapProgramToState, type ApiProgram } from './program-wizard-mappers'

interface ProgramWizardLoaderProps {
  mode: 'edit' | 'view'
  programId: string
  program: ApiProgram
}

export function ProgramWizardLoader({ mode, programId, program }: ProgramWizardLoaderProps) {
  const initialState = mapProgramToState(program)
  return (
    <ProgramWizard
      mode={mode}
      programId={programId}
      initialState={initialState}
    />
  )
}

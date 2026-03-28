'use client'

import { ProgramWizard } from './program-wizard'
import type { WizardState, ProgramType } from './program-wizard'

interface ApiProgram {
  id: string
  name: string
  description: string | null
  type?: string
  status: string
  startDate: string | null
  endDate: string | null
  pointCurrencyName: string
  budgetUsdCents: number | null
}

interface ProgramWizardLoaderProps {
  mode: 'edit' | 'view'
  programId: string
  program: ApiProgram
}

const CURRENCY_OPTIONS = ['Stars', 'Points', 'Coins', 'Miles', 'Credits', 'Sparks', 'Cash Back']

function mapProgramToState(program: ApiProgram): Partial<WizardState> {
  const currencyName = CURRENCY_OPTIONS.includes(program.pointCurrencyName)
    ? program.pointCurrencyName
    : 'Other (custom)…'
  const currencyCustom = currencyName === 'Other (custom)…' ? program.pointCurrencyName : ''

  return {
    programType: (program.type as ProgramType) ?? null,
    name: program.name,
    description: program.description ?? '',
    startDate: program.startDate ? program.startDate.split('T')[0] : '',
    endDate: program.endDate ? program.endDate.split('T')[0] : '',
    currencyName,
    currencyCustom,
    totalBudget: program.budgetUsdCents != null
      ? String(program.budgetUsdCents / 100)
      : '',
  }
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

'use client'

import { type ReactNode } from 'react'

interface FormGroupProps {
  label: string
  error?: string
  required?: boolean
  hint?: string
  children: ReactNode
}

export function FormGroup({ label, error, required, hint, children }: FormGroupProps) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

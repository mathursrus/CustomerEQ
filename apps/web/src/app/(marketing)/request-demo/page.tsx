'use client'

import { useState } from 'react'
import Link from 'next/link'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

interface FormData {
  firstName: string
  lastName: string
  workEmail: string
  companyName: string
  companySize: string
  message: string
}

interface FormErrors {
  firstName?: string
  lastName?: string
  workEmail?: string
  companyName?: string
  companySize?: string
}

export default function RequestDemoPage() {
  const [form, setForm] = useState<FormData>({
    firstName: '',
    lastName: '',
    workEmail: '',
    companyName: '',
    companySize: '',
    message: '',
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  function validate(): FormErrors {
    const errs: FormErrors = {}
    if (!form.firstName.trim()) errs.firstName = 'First name is required'
    if (!form.lastName.trim()) errs.lastName = 'Last name is required'
    if (!form.workEmail.trim()) {
      errs.workEmail = 'Work email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.workEmail)) {
      errs.workEmail = 'Please enter a valid email address'
    }
    if (!form.companyName.trim()) errs.companyName = 'Company name is required'
    if (!form.companySize) errs.companySize = 'Please select a company size'
    return errs
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setErrors({})
    setSubmitting(true)
    try {
      const res = await fetch(`${API_URL}/v1/public/demo-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.message ?? `Request failed with status ${res.status}`)
      }
      setSubmitted(true)
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <div
          data-testid="demo-success-msg"
          className="rounded-2xl bg-white border border-gray-200 shadow-sm p-12 text-center max-w-md"
        >
          <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-green-100 flex items-center justify-center">
            <svg className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Thank you!</h2>
          <p className="mt-2 text-gray-600">
            {"We'll be in touch within 1 business day."}
          </p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            Back to home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto max-w-7xl flex items-center">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <span className="text-white text-sm font-bold">C</span>
            </div>
            <span className="text-lg font-semibold text-gray-900">CustomerEQ</span>
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-xl px-6 py-16">
        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-8">
          <h1 className="text-2xl font-bold text-gray-900">Request a Demo</h1>
          <p className="mt-2 text-gray-600">
            See how CustomerEQ can turn your CX data into loyalty within minutes.
          </p>

          {serverError && (
            <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-5" noValidate>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="firstName"
                  type="text"
                  data-testid="demo-firstName"
                  value={form.firstName}
                  onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                  className={`w-full rounded-lg border px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.firstName ? 'border-red-400' : 'border-gray-300'}`}
                  placeholder="Jane"
                />
                {errors.firstName && (
                  <p className="mt-1 text-xs text-red-600">{errors.firstName}</p>
                )}
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="lastName"
                  type="text"
                  data-testid="demo-lastName"
                  value={form.lastName}
                  onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                  className={`w-full rounded-lg border px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.lastName ? 'border-red-400' : 'border-gray-300'}`}
                  placeholder="Smith"
                />
                {errors.lastName && (
                  <p className="mt-1 text-xs text-red-600">{errors.lastName}</p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="workEmail" className="block text-sm font-medium text-gray-700 mb-1">
                Work Email <span className="text-red-500">*</span>
              </label>
              <input
                id="workEmail"
                type="email"
                data-testid="demo-workEmail"
                value={form.workEmail}
                onChange={(e) => setForm((f) => ({ ...f, workEmail: e.target.value }))}
                className={`w-full rounded-lg border px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.workEmail ? 'border-red-400' : 'border-gray-300'}`}
                placeholder="jane@company.com"
              />
              {errors.workEmail && (
                <p className="mt-1 text-xs text-red-600">{errors.workEmail}</p>
              )}
            </div>

            <div>
              <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-1">
                Company Name <span className="text-red-500">*</span>
              </label>
              <input
                id="companyName"
                type="text"
                data-testid="demo-companyName"
                value={form.companyName}
                onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
                className={`w-full rounded-lg border px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.companyName ? 'border-red-400' : 'border-gray-300'}`}
                placeholder="Acme Corp"
              />
              {errors.companyName && (
                <p className="mt-1 text-xs text-red-600">{errors.companyName}</p>
              )}
            </div>

            <div>
              <label htmlFor="companySize" className="block text-sm font-medium text-gray-700 mb-1">
                Company Size <span className="text-red-500">*</span>
              </label>
              <select
                id="companySize"
                data-testid="demo-companySize"
                value={form.companySize}
                onChange={(e) => setForm((f) => ({ ...f, companySize: e.target.value }))}
                className={`w-full rounded-lg border px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white ${errors.companySize ? 'border-red-400' : 'border-gray-300'}`}
              >
                <option value="">Select company size</option>
                <option value="1-10">1–10 employees</option>
                <option value="11-50">11–50 employees</option>
                <option value="51-200">51–200 employees</option>
                <option value="201-1000">201–1,000 employees</option>
                <option value="1000+">1,000+ employees</option>
              </select>
              {errors.companySize && (
                <p className="mt-1 text-xs text-red-600">{errors.companySize}</p>
              )}
            </div>

            <div>
              <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
                Message <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                id="message"
                data-testid="demo-message"
                value={form.message}
                onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                rows={4}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Tell us about your loyalty goals..."
              />
            </div>

            <button
              type="submit"
              data-testid="demo-submit-btn"
              disabled={submitting}
              className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              {submitting ? 'Submitting...' : 'Request Demo'}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}

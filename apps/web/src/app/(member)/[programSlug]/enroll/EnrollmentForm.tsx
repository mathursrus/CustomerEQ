'use client'

import { useState } from 'react'
import { useSignUp } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import type { EnrollMemberResponse } from '@customerEQ/shared'
import { API_URL } from '@/lib/config'
import WelcomeScreen from './WelcomeScreen'

interface ProgramInfo {
  programId: string
  programName: string
  programSlug: string
  brandId: string
  brandName: string
}

export default function EnrollmentForm({ program }: { program: ProgramInfo }) {
  const { signUp, isLoaded } = useSignUp()
  const router = useRouter()

  const [step, setStep] = useState<'form' | 'welcome'>('form')
  const [enrollResult, setEnrollResult] = useState<EnrollMemberResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const [form, setForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
    emailOptIn: false,
    smsOptIn: false,
    consentGiven: false,
  })

  function setField(key: keyof typeof form, value: string | boolean) {
    setForm((f) => ({ ...f, [key]: value }))
    setFieldErrors((e) => ({ ...e, [key]: '' }))
    setError(null)
  }

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!form.email) errs.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Enter a valid email'
    if (!form.password) errs.password = 'Password is required'
    else if (form.password.length < 8) errs.password = 'Password must be at least 8 characters'
    if (!form.firstName.trim()) errs.firstName = 'First name is required'
    if (!form.lastName.trim()) errs.lastName = 'Last name is required'
    if (!form.consentGiven) errs.consentGiven = 'You must accept the privacy policy and terms to enroll'
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate() || !isLoaded) return
    setLoading(true)
    setError(null)

    try {
      // Step 1: Create Clerk user
      const signUpResult = await signUp.create({
        emailAddress: form.email,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
      })

      // Get session token for the new user
      const token = await signUpResult.createdSessionId
        ? null  // session not created yet; token comes from prepareEmailAddressVerification path
        : null

      // Step 2: Enroll member
      const res = await fetch(`${API_URL}/v1/members/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          firstName: form.firstName,
          lastName: form.lastName,
          phone: form.phone || undefined,
          programId: program.programId,
          consentGiven: true,
          consentGivenAt: new Date().toISOString(),
          consentVersion: 'privacy-v1.0',
          emailOptIn: form.emailOptIn,
          smsOptIn: form.smsOptIn,
          clerkToken: token ?? undefined,
        }),
      })

      const body = await res.json() as Record<string, unknown>

      if (res.status === 409) {
        setError('This email is already enrolled. Please sign in instead.')
        return
      }
      if (res.status === 422) {
        setError((body.message as string) ?? 'Please check your input and try again.')
        return
      }
      if (!res.ok) {
        setError('Something went wrong. Please try again.')
        return
      }

      setEnrollResult(body as unknown as EnrollMemberResponse)
      setStep('welcome')
    } catch (err: unknown) {
      const clerkErr = err as { errors?: Array<{ message: string }> }
      if (clerkErr?.errors?.[0]?.message) {
        const msg = clerkErr.errors[0].message
        if (msg.toLowerCase().includes('email')) {
          setError('This email is already registered. Please sign in instead.')
        } else {
          setError(msg)
        }
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (step === 'welcome' && enrollResult) {
    return (
      <WelcomeScreen
        result={enrollResult}
        programName={program.programName}
        onDashboard={() => router.push('/dashboard')}
      />
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-6">Create your account</h2>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email address <span className="text-red-500">*</span>
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => setField('email', e.target.value)}
            className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              fieldErrors.email ? 'border-red-400' : 'border-gray-300'
            }`}
            aria-describedby={fieldErrors.email ? 'email-error' : undefined}
          />
          {fieldErrors.email && (
            <p id="email-error" className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>
          )}
        </div>

        {/* Password */}
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            Password <span className="text-red-500">*</span>
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setField('password', e.target.value)}
            className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              fieldErrors.password ? 'border-red-400' : 'border-gray-300'
            }`}
            aria-describedby={fieldErrors.password ? 'password-error' : undefined}
          />
          {fieldErrors.password && (
            <p id="password-error" className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>
          )}
        </div>

        {/* Name row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
              First name <span className="text-red-500">*</span>
            </label>
            <input
              id="firstName"
              type="text"
              autoComplete="given-name"
              value={form.firstName}
              onChange={(e) => setField('firstName', e.target.value)}
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                fieldErrors.firstName ? 'border-red-400' : 'border-gray-300'
              }`}
            />
            {fieldErrors.firstName && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.firstName}</p>
            )}
          </div>
          <div>
            <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
              Last name <span className="text-red-500">*</span>
            </label>
            <input
              id="lastName"
              type="text"
              autoComplete="family-name"
              value={form.lastName}
              onChange={(e) => setField('lastName', e.target.value)}
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                fieldErrors.lastName ? 'border-red-400' : 'border-gray-300'
              }`}
            />
            {fieldErrors.lastName && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.lastName}</p>
            )}
          </div>
        </div>

        {/* Phone (optional) */}
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
            Phone <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            id="phone"
            type="tel"
            autoComplete="tel"
            value={form.phone}
            onChange={(e) => setField('phone', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Opt-ins */}
        <div className="space-y-2 pt-1">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.emailOptIn}
              onChange={(e) => setField('emailOptIn', e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-600">
              I&apos;d like to receive emails about rewards and promotions
            </span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.smsOptIn}
              onChange={(e) => setField('smsOptIn', e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-600">
              I&apos;d like to receive SMS alerts about my points balance
            </span>
          </label>
        </div>

        {/* Consent (required) */}
        <div>
          <label className={`flex items-start gap-3 cursor-pointer ${fieldErrors.consentGiven ? 'text-red-600' : ''}`}>
            <input
              data-testid="consent-checkbox"
              type="checkbox"
              checked={form.consentGiven}
              onChange={(e) => setField('consentGiven', e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              aria-describedby={fieldErrors.consentGiven ? 'consent-error' : undefined}
            />
            <span className="text-sm text-gray-700">
              I agree to the{' '}
              <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">
                Privacy Policy
              </a>{' '}
              and{' '}
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">
                Terms of Service
              </a>{' '}
              <span className="text-red-500">*</span>
            </span>
          </label>
          {fieldErrors.consentGiven && (
            <p id="consent-error" className="mt-1 text-xs text-red-600">{fieldErrors.consentGiven}</p>
          )}
        </div>

        {/* API-level error */}
        {error && (
          <div
            data-testid="enrollment-error"
            className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
          >
            {error}
            {error.includes('already enrolled') && (
              <a href="/sign-in" className="ml-1 underline font-medium">Sign in instead</a>
            )}
          </div>
        )}

        <button
          type="submit"
          data-testid="enroll-submit"
          disabled={loading || !isLoaded}
          className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 px-4 py-2.5 text-sm font-semibold text-white transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          {loading ? 'Creating account…' : 'Join the Program'}
        </button>

        <p className="text-center text-xs text-gray-500">
          Already have an account?{' '}
          <a href="/sign-in" className="text-indigo-600 underline">Sign in</a>
        </p>
      </form>
    </div>
  )
}

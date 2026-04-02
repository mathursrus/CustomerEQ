'use client'

import type { EnrollMemberResponse } from '@customerEQ/shared'

interface Props {
  result: EnrollMemberResponse
  programName: string
  onDashboard: () => void
}

export default function WelcomeScreen({ result, onDashboard }: Props) {
  return (
    <div
      data-testid="welcome-screen"
      className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center"
    >
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
        <svg
          className="h-7 w-7 text-green-600"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      </div>

      <h2 className="text-xl font-bold text-gray-900 mb-1">
        {result.firstName ? `Welcome, ${result.firstName}!` : 'Welcome!'}
      </h2>
      <p className="text-sm text-gray-500 mb-6">
        You&apos;re now enrolled in <span className="font-medium text-gray-700">{result.programName}</span>
      </p>

      <div className="rounded-xl bg-indigo-50 border border-indigo-100 px-6 py-4 mb-6">
        {result.enrollmentBonusPending ? (
          <>
            <p className="text-xs text-indigo-500 uppercase tracking-wide font-semibold mb-1">Enrollment Bonus</p>
            <p className="text-sm text-indigo-700">
              Your bonus points are being calculated and will appear in your balance shortly.
            </p>
          </>
        ) : (
          <>
            <p className="text-xs text-indigo-500 uppercase tracking-wide font-semibold mb-1">Points Balance</p>
            <p className="text-3xl font-bold text-indigo-700">{result.pointsBalance.toLocaleString()}</p>
          </>
        )}
      </div>

      <button
        data-testid="go-to-dashboard"
        onClick={onDashboard}
        className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
      >
        Go to my Dashboard
      </button>
    </div>
  )
}

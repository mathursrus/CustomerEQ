'use client'

interface Step {
  label: string
}

interface WizardStepperProps {
  steps: Step[]
  currentStep: number // 1-based
  onStepClick?: (step: number) => void
  allStepsClickable?: boolean
}

export function WizardStepper({ steps, currentStep, onStepClick, allStepsClickable }: WizardStepperProps) {
  return (
    <div className="flex items-start">
      {steps.map((step, idx) => {
        const stepNum = idx + 1
        const isCompleted = stepNum < currentStep
        const isCurrent = stepNum === currentStep
        const isClickable = !!onStepClick && (isCompleted || !!allStepsClickable)
        return (
          <div key={idx} className="flex items-start">
            <div className="flex flex-col items-center">
              <div
                onClick={isClickable ? () => onStepClick(stepNum) : undefined}
                role={isClickable ? 'button' : undefined}
                tabIndex={isClickable ? 0 : undefined}
                onKeyDown={isClickable ? (e) => e.key === 'Enter' && onStepClick(stepNum) : undefined}
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-opacity ${
                  isCompleted
                    ? 'bg-indigo-600 text-white'
                    : isCurrent
                    ? 'border-2 border-indigo-600 bg-white text-indigo-600'
                    : 'border-2 border-gray-300 bg-white text-gray-400'
                } ${isClickable ? 'cursor-pointer hover:opacity-80' : ''}`}
              >
                {isCompleted ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : (
                  stepNum
                )}
              </div>
              <span
                className={`mt-1 text-xs whitespace-nowrap ${
                  isCurrent ? 'font-medium text-indigo-600' : isCompleted ? 'text-indigo-400' : 'text-gray-400'
                } ${isClickable ? 'cursor-pointer hover:text-indigo-600' : ''}`}
                onClick={isClickable ? () => onStepClick(stepNum) : undefined}
              >
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={`mt-4 h-0.5 w-12 shrink-0 ${
                  stepNum < currentStep ? 'bg-indigo-600' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

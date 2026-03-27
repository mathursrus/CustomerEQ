'use client'

export interface Condition {
  field: string
  op: string
  value: string
}

export interface AvailableField {
  key: string
  label: string
  type: 'string' | 'number'
}

const STRING_OPS = [
  { value: 'eq', label: '=' },
  { value: 'ne', label: '≠' },
]

const NUMBER_OPS = [
  { value: 'eq', label: '=' },
  { value: 'ne', label: '≠' },
  { value: 'gt', label: '>' },
  { value: 'gte', label: '≥' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: '≤' },
]

interface ConditionBuilderProps {
  operator: 'AND' | 'OR'
  conditions: Condition[]
  availableFields: AvailableField[]
  onOperatorChange: (op: 'AND' | 'OR') => void
  onConditionsChange: (conditions: Condition[]) => void
  disabled?: boolean
}

export function ConditionBuilder({
  operator,
  conditions,
  availableFields,
  onOperatorChange,
  onConditionsChange,
  disabled,
}: ConditionBuilderProps) {
  const addCondition = () => {
    onConditionsChange([
      ...conditions,
      { field: availableFields[0]?.key ?? '', op: 'eq', value: '' },
    ])
  }

  const removeCondition = (idx: number) => {
    onConditionsChange(conditions.filter((_, i) => i !== idx))
  }

  const updateCondition = (idx: number, patch: Partial<Condition>) => {
    onConditionsChange(conditions.map((c, i) => (i === idx ? { ...c, ...patch } : c)))
  }

  return (
    <div className="space-y-3">
      {/* Operator toggle — only shown when >1 conditions */}
      {conditions.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Match</span>
          <div className="flex overflow-hidden rounded-lg border border-gray-300 text-xs">
            {(['AND', 'OR'] as const).map((op) => (
              <button
                key={op}
                type="button"
                disabled={disabled}
                onClick={() => onOperatorChange(op)}
                className={`px-3 py-1.5 font-medium transition-colors disabled:opacity-50 ${
                  operator === op
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {op}
              </button>
            ))}
          </div>
          <span className="text-xs text-gray-500">conditions</span>
        </div>
      )}

      {conditions.map((cond, idx) => {
        const field = availableFields.find((f) => f.key === cond.field)
        const ops = field?.type === 'number' ? NUMBER_OPS : STRING_OPS
        return (
          <div key={idx} className="flex items-center gap-2 flex-wrap">
            <span className="w-8 text-center text-xs text-gray-400">
              {idx === 0 ? 'If' : <span className="font-medium text-indigo-600">{operator}</span>}
            </span>
            <select
              value={cond.field}
              disabled={disabled}
              onChange={(e) => updateCondition(idx, { field: e.target.value, op: 'eq', value: '' })}
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none disabled:opacity-50"
            >
              {availableFields.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
            <select
              value={cond.op}
              disabled={disabled}
              onChange={(e) => updateCondition(idx, { op: e.target.value })}
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none disabled:opacity-50"
            >
              {ops.map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </select>
            <input
              type={field?.type === 'number' ? 'number' : 'text'}
              value={cond.value}
              disabled={disabled}
              onChange={(e) => updateCondition(idx, { value: e.target.value })}
              placeholder="value"
              className="w-28 rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none disabled:opacity-50"
            />
            {!disabled && (
              <button
                type="button"
                onClick={() => removeCondition(idx)}
                className="rounded p-1 text-gray-400 hover:text-red-500 transition-colors"
                title="Remove condition"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )
      })}

      {!disabled && (
        <button
          type="button"
          onClick={addCondition}
          className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add condition
        </button>
      )}
    </div>
  )
}

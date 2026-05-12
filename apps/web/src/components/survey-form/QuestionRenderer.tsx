// Issue #241 Slice 4a — renders one of the 11 question types per #35.
// Native HTML controls only — no third-party dropdown, slider, or drag-drop
// dependency. Visual treatment leans entirely on the R31 CSS-variable tokens
// applied on the parent .ceq-survey-card.

import type { SurveyQuestion, QuestionConfig } from '@customerEQ/shared'

import type { RendererMode } from './types'

export interface QuestionRendererProps {
  question: SurveyQuestion
  value: unknown
  onChange: (value: unknown) => void
  mode: RendererMode
  readOnly?: boolean
}

const FONT_VAR = 'var(--ceq-font-family)'
const BORDER_RADIUS_VAR = 'var(--ceq-border-radius)'
const TEXT_COLOR_VAR = 'var(--ceq-text-color)'
const BODY_SIZE_VAR = 'var(--ceq-body-size)'
const ACCENT_VAR = 'var(--ceq-accent-color)'
const SECONDARY_VAR = 'var(--ceq-secondary-color)'

function questionLabel(question: SurveyQuestion) {
  return (
    <label
      className="ceq-question-label"
      htmlFor={`q-${question.id}`}
      style={{
        color: TEXT_COLOR_VAR,
        fontFamily: FONT_VAR,
        fontSize: BODY_SIZE_VAR,
        display: 'block',
        marginBottom: '0.5rem',
      }}
    >
      {question.text}
      {question.required ? (
        <span aria-hidden="true" style={{ color: ACCENT_VAR, marginLeft: '0.25rem' }}>*</span>
      ) : null}
    </label>
  )
}

function optionList(config: QuestionConfig | undefined, fallback: string[] | undefined): string[] {
  return config?.options ?? fallback ?? []
}

export function QuestionRenderer({ question, value, onChange, mode, readOnly }: QuestionRendererProps) {
  const disabled = mode === 'preview' || readOnly === true
  const cfg = question.config

  switch (question.type) {
    case 'rating': {
      const min = cfg?.min ?? 0
      const max = cfg?.max ?? 10
      const ticks: number[] = []
      for (let i = min; i <= max; i += 1) ticks.push(i)
      return (
        <div data-question-id={question.id} className="ceq-question">
          {questionLabel(question)}
          <div role="group" aria-label={question.text} style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
            {ticks.map((n) => {
              const selected = value === n
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => !disabled && onChange(n)}
                  disabled={disabled}
                  aria-pressed={selected}
                  style={{
                    minWidth: '2.25rem',
                    minHeight: '2.25rem',
                    padding: '0.25rem 0.5rem',
                    borderRadius: BORDER_RADIUS_VAR,
                    border: `1px solid ${SECONDARY_VAR}`,
                    background: selected ? 'var(--ceq-primary-color)' : 'transparent',
                    color: selected ? 'var(--ceq-button-text-color)' : TEXT_COLOR_VAR,
                    fontFamily: FONT_VAR,
                    fontSize: BODY_SIZE_VAR,
                    cursor: disabled ? 'default' : 'pointer',
                  }}
                >
                  {n}
                </button>
              )
            })}
          </div>
        </div>
      )
    }

    case 'text': {
      const multiline = Boolean(cfg?.multiline)
      const commonStyle = {
        width: '100%',
        padding: '0.5rem 0.75rem',
        borderRadius: BORDER_RADIUS_VAR,
        border: `1px solid ${SECONDARY_VAR}`,
        background: 'var(--ceq-background-color)',
        color: TEXT_COLOR_VAR,
        fontFamily: FONT_VAR,
        fontSize: BODY_SIZE_VAR,
      } as const
      return (
        <div data-question-id={question.id} className="ceq-question">
          {questionLabel(question)}
          {multiline ? (
            <textarea
              id={`q-${question.id}`}
              value={(value as string | undefined) ?? ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder={cfg?.placeholder}
              maxLength={cfg?.maxLength}
              disabled={disabled}
              rows={4}
              style={commonStyle}
            />
          ) : (
            <input
              id={`q-${question.id}`}
              type="text"
              value={(value as string | undefined) ?? ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder={cfg?.placeholder}
              maxLength={cfg?.maxLength}
              disabled={disabled}
              style={commonStyle}
            />
          )}
        </div>
      )
    }

    case 'choice':
    case 'multiple_choice': {
      const opts = optionList(cfg, question.options)
      const allowOther = Boolean(cfg?.allowOther)
      return (
        <div data-question-id={question.id} className="ceq-question">
          {questionLabel(question)}
          <div role="radiogroup" aria-label={question.text}>
            {opts.map((opt) => (
              <label key={opt} style={{ display: 'block', marginBottom: '0.25rem', color: TEXT_COLOR_VAR, fontFamily: FONT_VAR, fontSize: BODY_SIZE_VAR }}>
                <input
                  type="radio"
                  name={`q-${question.id}`}
                  value={opt}
                  checked={value === opt}
                  onChange={() => onChange(opt)}
                  disabled={disabled}
                  style={{ marginRight: '0.5rem' }}
                />
                {opt}
              </label>
            ))}
            {allowOther ? (
              <label style={{ display: 'block', color: TEXT_COLOR_VAR, fontFamily: FONT_VAR, fontSize: BODY_SIZE_VAR }}>
                <input
                  type="radio"
                  name={`q-${question.id}`}
                  value="__other__"
                  checked={value === '__other__'}
                  onChange={() => onChange('__other__')}
                  disabled={disabled}
                  style={{ marginRight: '0.5rem' }}
                />
                Other
              </label>
            ) : null}
          </div>
        </div>
      )
    }

    case 'checkbox': {
      const opts = optionList(cfg, question.options)
      const selected = new Set<string>((value as string[] | undefined) ?? [])
      return (
        <div data-question-id={question.id} className="ceq-question">
          {questionLabel(question)}
          <div role="group" aria-label={question.text}>
            {opts.map((opt) => (
              <label key={opt} style={{ display: 'block', marginBottom: '0.25rem', color: TEXT_COLOR_VAR, fontFamily: FONT_VAR, fontSize: BODY_SIZE_VAR }}>
                <input
                  type="checkbox"
                  value={opt}
                  checked={selected.has(opt)}
                  onChange={(e) => {
                    const next = new Set(selected)
                    if (e.target.checked) next.add(opt)
                    else next.delete(opt)
                    onChange(Array.from(next))
                  }}
                  disabled={disabled}
                  style={{ marginRight: '0.5rem' }}
                />
                {opt}
              </label>
            ))}
          </div>
        </div>
      )
    }

    case 'dropdown': {
      const opts = optionList(cfg, question.options)
      return (
        <div data-question-id={question.id} className="ceq-question">
          {questionLabel(question)}
          <select
            id={`q-${question.id}`}
            value={(value as string | undefined) ?? ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              borderRadius: BORDER_RADIUS_VAR,
              border: `1px solid ${SECONDARY_VAR}`,
              background: 'var(--ceq-background-color)',
              color: TEXT_COLOR_VAR,
              fontFamily: FONT_VAR,
              fontSize: BODY_SIZE_VAR,
            }}
          >
            <option value="" disabled>
              Select…
            </option>
            {opts.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      )
    }

    case 'matrix':
    case 'likert': {
      // Both render as a row × scale table.
      const rows = cfg?.rows ?? []
      const columns = question.type === 'likert' ? (cfg?.scale ?? []) : (cfg?.columns ?? [])
      const answers = (value as Record<string, string> | undefined) ?? {}
      return (
        <div data-question-id={question.id} className="ceq-question">
          {questionLabel(question)}
          <table role="table" style={{ width: '100%', borderCollapse: 'collapse', color: TEXT_COLOR_VAR, fontFamily: FONT_VAR, fontSize: BODY_SIZE_VAR }}>
            <thead>
              <tr>
                <th />
                {columns.map((col) => (
                  <th key={col} style={{ padding: '0.25rem', textAlign: 'center', fontWeight: 500 }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((rowLabel) => (
                <tr key={rowLabel}>
                  <td style={{ padding: '0.25rem 0.5rem', fontWeight: 500 }}>{rowLabel}</td>
                  {columns.map((col) => (
                    <td key={col} style={{ padding: '0.25rem', textAlign: 'center' }}>
                      <input
                        type="radio"
                        name={`q-${question.id}-${rowLabel}`}
                        value={col}
                        checked={answers[rowLabel] === col}
                        onChange={() => onChange({ ...answers, [rowLabel]: col })}
                        disabled={disabled}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    case 'ranking': {
      const opts = optionList(cfg, question.options)
      const order: string[] = ((value as string[] | undefined)?.length ? (value as string[]) : opts).slice()
      function move(idx: number, dir: -1 | 1) {
        const next = order.slice()
        const target = idx + dir
        if (target < 0 || target >= next.length) return
        const tmp = next[idx]!
        next[idx] = next[target]!
        next[target] = tmp
        onChange(next)
      }
      return (
        <div data-question-id={question.id} className="ceq-question">
          {questionLabel(question)}
          <ol style={{ color: TEXT_COLOR_VAR, fontFamily: FONT_VAR, fontSize: BODY_SIZE_VAR }}>
            {order.map((opt, i) => (
              <li key={opt} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0' }}>
                <span style={{ flex: 1 }}>{opt}</span>
                <button type="button" onClick={() => move(i, -1)} disabled={disabled || i === 0} aria-label={`Move ${opt} up`}>↑</button>
                <button type="button" onClick={() => move(i, 1)} disabled={disabled || i === order.length - 1} aria-label={`Move ${opt} down`}>↓</button>
              </li>
            ))}
          </ol>
        </div>
      )
    }

    case 'slider': {
      const min = cfg?.min ?? 0
      const max = cfg?.max ?? 100
      const step = cfg?.step ?? 1
      const labels = cfg?.labels
      const numericValue = typeof value === 'number' ? value : min
      return (
        <div data-question-id={question.id} className="ceq-question">
          {questionLabel(question)}
          <input
            id={`q-${question.id}`}
            type="range"
            min={min}
            max={max}
            step={step}
            value={numericValue}
            onChange={(e) => onChange(Number(e.target.value))}
            disabled={disabled}
            style={{ width: '100%' }}
          />
          {labels?.left || labels?.right ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: TEXT_COLOR_VAR, fontFamily: FONT_VAR, fontSize: BODY_SIZE_VAR }}>
              <span>{labels?.left ?? ''}</span>
              <span>{labels?.right ?? ''}</span>
            </div>
          ) : null}
        </div>
      )
    }

    case 'image_choice': {
      const images = cfg?.imageOptions ?? []
      const multi = Boolean(cfg?.multiSelect)
      const selected = multi
        ? new Set<string>((value as string[] | undefined) ?? [])
        : new Set<string>(typeof value === 'string' ? [value] : [])
      return (
        <div data-question-id={question.id} className="ceq-question">
          {questionLabel(question)}
          <div role={multi ? 'group' : 'radiogroup'} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {images.map((img) => (
              <label key={img.label} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', color: TEXT_COLOR_VAR, fontFamily: FONT_VAR, fontSize: BODY_SIZE_VAR }}>
                <img src={img.imageUrl} alt={img.label} style={{ width: '6rem', height: '6rem', objectFit: 'cover', borderRadius: BORDER_RADIUS_VAR, border: `1px solid ${SECONDARY_VAR}` }} />
                <input
                  type={multi ? 'checkbox' : 'radio'}
                  name={`q-${question.id}`}
                  value={img.label}
                  checked={selected.has(img.label)}
                  onChange={() => {
                    if (multi) {
                      const next = new Set(selected)
                      if (next.has(img.label)) next.delete(img.label)
                      else next.add(img.label)
                      onChange(Array.from(next))
                    } else {
                      onChange(img.label)
                    }
                  }}
                  disabled={disabled}
                />
                <span>{img.label}</span>
              </label>
            ))}
          </div>
        </div>
      )
    }

    case 'file_upload': {
      const accept = (cfg?.allowedTypes ?? []).join(',')
      return (
        <div data-question-id={question.id} className="ceq-question">
          {questionLabel(question)}
          <input
            id={`q-${question.id}`}
            type="file"
            accept={accept || undefined}
            disabled
            aria-label={question.text}
            style={{ display: 'block', color: TEXT_COLOR_VAR, fontFamily: FONT_VAR, fontSize: BODY_SIZE_VAR }}
          />
          {mode === 'preview' ? (
            <p style={{ color: TEXT_COLOR_VAR, fontFamily: FONT_VAR, fontSize: BODY_SIZE_VAR, opacity: 0.7, marginTop: '0.25rem' }}>
              File uploads are disabled in preview.
            </p>
          ) : null}
        </div>
      )
    }

    default: {
      return (
        <div data-question-id={question.id} className="ceq-question">
          {questionLabel(question)}
          <p style={{ color: TEXT_COLOR_VAR, fontFamily: FONT_VAR, fontSize: BODY_SIZE_VAR }}>
            Unsupported question type: {String(question.type)}
          </p>
        </div>
      )
    }
  }
}

// Issue #241 Slice 4a — standalone-distribution identification input (R15).
// Reads the brand's memberIdentifierKind and renders the matching input. The
// admin detail page never renders this field (admin previews are read-only and
// skip identification). Consumers: Slice 5's standalone respondent page.

import type { BrandLite } from './types'

export interface MemberIdFieldProps {
  brand: BrandLite
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

const KIND_TO_LABEL: Record<BrandLite['memberIdentifierKind'], string> = {
  email: 'Email address',
  phone: 'Phone number',
  external_id: 'Customer ID',
}

const KIND_TO_INPUT_TYPE: Record<BrandLite['memberIdentifierKind'], string> = {
  email: 'email',
  phone: 'tel',
  external_id: 'text',
}

export function MemberIdField({ brand, value, onChange, disabled }: MemberIdFieldProps) {
  const label = KIND_TO_LABEL[brand.memberIdentifierKind]
  const inputType = KIND_TO_INPUT_TYPE[brand.memberIdentifierKind]
  return (
    <div className="ceq-member-id-field" style={{ marginBottom: '1rem' }}>
      <label
        htmlFor="ceq-member-id"
        style={{
          display: 'block',
          color: 'var(--ceq-text-color)',
          fontFamily: 'var(--ceq-font-family)',
          fontSize: 'var(--ceq-body-size)',
          marginBottom: '0.25rem',
        }}
      >
        {label}
        <span aria-hidden="true" style={{ color: 'var(--ceq-accent-color)', marginLeft: '0.25rem' }}>
          *
        </span>
      </label>
      <input
        id="ceq-member-id"
        type={inputType}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        disabled={disabled}
        style={{
          width: '100%',
          padding: '0.5rem 0.75rem',
          borderRadius: 'var(--ceq-border-radius)',
          border: '1px solid var(--ceq-secondary-color)',
          background: 'var(--ceq-background-color)',
          color: 'var(--ceq-text-color)',
          fontFamily: 'var(--ceq-font-family)',
          fontSize: 'var(--ceq-body-size)',
        }}
      />
    </div>
  )
}

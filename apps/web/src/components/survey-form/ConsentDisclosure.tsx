// Issue #241 Slice 4a — wraps renderConsentTextReact() from @customerEQ/consent-text.
// R13: returns null when the disclosure text is blank.

import { renderConsentTextReact } from '@customerEQ/consent-text'

export interface ConsentDisclosureProps {
  text: string
  privacyPolicyUrl: string | null
  termsUrl: string | null
}

export function ConsentDisclosure({ text, privacyPolicyUrl, termsUrl }: ConsentDisclosureProps) {
  if (!text || text.trim().length === 0) return null

  const children = renderConsentTextReact(text, {
    privacyPolicyUrl: privacyPolicyUrl ?? undefined,
    termsUrl: termsUrl ?? undefined,
  })

  return (
    <p
      className="ceq-survey-consent"
      style={{ color: 'var(--ceq-text-color)', fontSize: 'var(--ceq-body-size)' }}
    >
      {children}
    </p>
  )
}

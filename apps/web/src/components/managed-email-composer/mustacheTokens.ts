// Issue #420 R27 — palette of mustache tokens an operator can insert into the
// managed-email body. These names are recognized by the backend renderTemplate
// (packages/shared/src/email/renderTemplate.ts) at dispatch time. Adding a
// token here without wiring its substitution in the renderer is a silent gap;
// keep the two lists in sync.

export interface MustacheToken {
  id: string
  label: string
  description: string
  /** True when the backend's contains-{{survey_link}} validation gate cares. */
  required?: boolean
}

export const MUSTACHE_TOKENS: readonly MustacheToken[] = [
  {
    id: 'survey_link',
    label: 'Survey link',
    description: 'Per-recipient unique URL. REQUIRED — each recipient gets their own.',
    required: true,
  },
  {
    id: 'first_name',
    label: 'First name',
    description: "Recipient's first name (empty if not on file).",
  },
  {
    id: 'last_name',
    label: 'Last name',
    description: "Recipient's last name (empty if not on file).",
  },
  {
    id: 'brand_name',
    label: 'Brand name',
    description: 'Your brand name (from Organization settings).',
  },
  {
    id: 'sender_name',
    label: 'Sender name',
    description: 'The "Sender name" field in the composer above.',
  },
  {
    id: 'survey_title',
    label: 'Survey title',
    description: "Title of the survey being sent.",
  },
] as const

export function isMustacheTokenId(id: string): boolean {
  return MUSTACHE_TOKENS.some((t) => t.id === id)
}

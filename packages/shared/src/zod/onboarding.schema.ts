import { z } from 'zod'

// ---------------------------------------------------------------------------
// Issue #170 — Onboarding & First-Run Experience
// Shared Zod schemas used by both the Fastify routes and the web forms.
// ---------------------------------------------------------------------------

// RFC 5322 lite — Zod's email() is RFC-5322-compliant for practical use.
// We intentionally avoid stricter regexes that reject legitimate addresses.
const emailSchema = z.string().email().max(254)

// Min 8 chars; at least one letter and one number. Stricter complexity (e.g.
// upper/lower/symbol classes) is the identity provider's concern, not ours —
// Clerk enforces its own password policy server-side.
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password is too long') // bcrypt's input ceiling, even though Clerk handles hashing
  .refine(
    (pw) => /[A-Za-z]/.test(pw) && /[0-9]/.test(pw),
    'Password must contain at least one letter and one number',
  )

const trimmedNameSchema = z.string().trim().min(1).max(100)

// Site domain — format only; DNS verification is #172's job.
// Accepts bare domain (acme.com) or with scheme (https://acme.com).
const siteDomainSchema = z
  .string()
  .trim()
  .max(253)
  .regex(
    /^(https?:\/\/)?([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(\/.*)?$/i,
    'Invalid domain format',
  )

// SEC-170-002 — `returnTo` must be a relative path under /admin/ (the only
// post-OAuth landing zone we care about) OR a fully-qualified URL whose host
// matches one of the configured app origins. The route handler injects the
// allowlist; the schema is the structural shape only.
//
// Exported separately because Phase 4's route handler composes it with a
// runtime origin check (the schema can't access process.env-style config in
// the shared package without coupling the package to API config).
export const oauthReturnToSchema = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .refine((s) => {
    // Relative path starting with /admin/ — safe by construction (browser
    // resolves against current origin)
    if (/^\/admin\/?(\?|#|$|\/)/.test(s)) return true
    // Same-origin URL — actual host check happens at the route handler
    // (this refine just enforces the URL is parseable + uses http(s)).
    try {
      const url = new URL(s)
      return url.protocol === 'http:' || url.protocol === 'https:'
    } catch {
      return false
    }
  }, 'returnTo must be a relative /admin path or a fully-qualified http(s) URL')

// ---------------------------------------------------------------------------
// POST /api/auth/signup
// ---------------------------------------------------------------------------

export const signupRequestSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: trimmedNameSchema,
  orgName: trimmedNameSchema,
  agreedToTos: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the terms of service' }),
  }),
})

export type SignupRequest = z.infer<typeof signupRequestSchema>

// ---------------------------------------------------------------------------
// GET /api/auth/oauth/:provider/start  (query string)
// ---------------------------------------------------------------------------

export const oauthStartQuerySchema = z.object({
  returnTo: oauthReturnToSchema.optional(),
})

export type OAuthStartQuery = z.infer<typeof oauthStartQuerySchema>

// Path param: the provider identifier (google / github / microsoft / …).
// Allowlist enforcement happens against IdentityProvider.listSupportedOAuthProviders()
// at runtime; the schema only checks shape (lowercase letters/digits).
export const oauthProviderParamSchema = z.object({
  provider: z.string().regex(/^[a-z0-9]+$/, 'Invalid provider identifier'),
})

// ---------------------------------------------------------------------------
// POST /api/auth/signup/finish  (OAuth new-user-without-org convergence)
// ---------------------------------------------------------------------------

export const oauthFinishRequestSchema = z.object({
  orgName: trimmedNameSchema,
})

export type OAuthFinishRequest = z.infer<typeof oauthFinishRequestSchema>

// ---------------------------------------------------------------------------
// PR 4 schemas — declared as stubs here so the file is the single source of
// truth for onboarding-domain Zod schemas. PR 4 fills these in.
// ---------------------------------------------------------------------------

export const onboardingProfilePatchSchemaPlaceholder = z.unknown()
export const onboardingChecklistPatchSchemaPlaceholder = z.unknown()
export const brandPatchSchemaPlaceholder = z.unknown()

// Site-domain helper exported for #172's use as well as the Step 1.5 form.
export { siteDomainSchema }

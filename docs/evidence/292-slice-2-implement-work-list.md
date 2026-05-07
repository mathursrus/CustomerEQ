# Implementation Work List — Issue #292 Slice 2 (`@customerEQ/consent-text` package)

**FRAIM session**: `7b2f6724-96ef-4bd4-926a-fccede38fda8`
**Job**: `feature-implementation`
**Branch**: `feature/issue-292-org-settings-consent-text` (off `origin/main`)
**Issue type**: feature
**Slice**: 2 of 4 (~250 LOC; new shared workspace package)

## Source-of-truth references

- Issue: [#292](https://github.com/mathursrus/CustomerEQ/issues/292) — umbrella implementation issue
- Spec: [`docs/feature-specs/277-organization-settings.md`](../feature-specs/277-organization-settings.md) §"API" (R18 — three-call-site requirement) + §"Validation Plan" (unit tests)
- RFC: [`docs/rfcs/277-organization-settings.md`](../rfcs/277-organization-settings.md) §3 (Shared package)
- Architecture: [`docs/architecture/architecture.md`](../architecture/architecture.md) — "Domain-narrow runtime packages" pattern (added in PR #290 for #277)
- Project rules: R10 (branch ↔ issue), R21 (one issue per branch), R8 (shared test utils — does not preclude co-located tests, only inline mocks/factories), R11 (validation commands), R11a (tests fail loudly)

## Slice 2 scope (from RFC §3)

A new workspace package `packages/consent-text/` exporting three independently-importable surfaces from one place:

1. **Parser** — `tokenize(text: string): ConsentToken[]` from `parser.ts`.
2. **Zod validator** — `zConsentText` (Zod schema) + `validateConsentText(text: string)` helper from `validator.ts`. Plus `hasPrivacyToken(text: string)` for the EXPLICIT-mode cross-field check (consumed by both the API server and the admin frontend's `pendingItems` computation per RFC §6.3).
3. **Renderers** — `renderConsentTextHTML(text, options)` (string output, HTML-escaped — defense-in-depth) and `renderConsentTextReact(text, options)` (returns `ReactNode[]`).

The token grammar (RFC §3, single source of truth):
```ts
export const CONSENT_TOKEN_RE = /\{\{(privacy|terms)(?::"([^"<>}{]{1,80})")?\}\}/g
export const TOKEN_KINDS = ['privacy', 'terms'] as const
export const DEFAULT_LABEL_BY_KIND = { privacy: 'Privacy Policy', terms: 'Terms and Conditions' } as const
```

Inner-string allowlist (R18 defense-in-depth): `[^"<>}{]{1,80}` — character class excludes `"`, `<`, `>`, `}`, `{`; length cap 1–80.

## Implementation checklist

### Package skeleton (target: 2 config files)

- [ ] `packages/consent-text/package.json` — `@customerEQ/consent-text` workspace package, type=module, ESM, vitest scripts, Zod dep, React peerDep (matches `packages/ui` precedent).
- [ ] `packages/consent-text/tsconfig.json` — extends `tsconfig.base.json`, outDir dist, rootDir src, exclude tests; adds `"lib": ["ES2022", "DOM"]` for `ReactNode` typings + `"jsx": "react-jsx"` so `React.createElement` calls typecheck cleanly.

### Source files (target: 6)

- [ ] `src/tokens.ts` — `CONSENT_TOKEN_RE`, `TOKEN_KINDS`, `DEFAULT_LABEL_BY_KIND` constants.
- [ ] `src/types.ts` — `ConsentToken`, `ConsentTextRenderOptions` types.
- [ ] `src/parser.ts` — `tokenize(text): Array<{ kind, customLabel, raw, index, length }>` plus a string-segment walker that interleaves text segments and tokens (used by both renderers).
- [ ] `src/validator.ts` — `zConsentText` Zod schema (parses with `tokens.ts` regex, asserts allowlist + length cap), `validateConsentText(text)` helper, `hasPrivacyToken(text)` boolean, `isConsentTextValid(text)` shape-only check.
- [ ] `src/renderer.ts` — `renderConsentTextHTML(text, options): string` (HTML-escaped string assembly, no `innerHTML` setting); `renderConsentTextReact(text, options): ReactNode[]` (uses `React.createElement` on segments + `<a>`).
- [ ] `src/index.ts` — re-exports the public surface from the five files above.

### Tests (target: 3 co-located `.test.ts` files; per RFC §Validation Plan)

- [ ] `src/parser.test.ts` — tokenize across bare / labeled / mixed inputs; allowlist rejection cases (`{{privacy:"\"…"}`-style attempts, `<>` injection attempts, over-cap labels); empty input; pure-text input; multiple tokens; index/length correctness.
- [ ] `src/validator.test.ts` — `zConsentText` accept/reject matrix; `hasPrivacyToken` true/false cases; `validateConsentText` returns Zod's discriminated result.
- [ ] `src/renderer.test.ts` — both renderers output the expected representation; **regex test on renderer.ts source asserting the file contains zero occurrences of `innerHTML` and `dangerouslySetInnerHTML`** (RFC §3 explicit safety contract); HTML-escape correctness on edge inputs.

### Out-of-scope for Slice 2

- ❌ Wiring the package into `apps/api` (Slice 3 — `admin-brand-profile.ts` PATCH validation).
- ❌ Wiring the package into the existing #276 survey-level consent path (RFC §3 calls this "a follow-up tracked under R18's import-graph check"; not part of #292).
- ❌ The cross-package import-graph CI check (`tools/check-consent-text-imports.ts`) — RFC §Validation Plan says this is "Forward-looking on the third consumer; CI step gates on this." It cannot meaningfully fire today (zero consumers); it lands when the future Survey-creation simplification module ships.
- ❌ Architecture-doc updates — already landed in PR #290 (the "Domain-narrow runtime packages" row).

## Pattern Discovery

### Workspace package conventions (from `packages/shared`, `packages/ui`)
- ESM-only (`"type": "module"`), `main` + `types` point at `dist/`.
- TypeScript build via `tsc`; vitest co-located tests with `vitest run` (excluded from build via tsconfig).
- React-shipping packages (precedent: `packages/ui`) use `peerDependencies` for React 18 + `devDependencies` for `@types/react`.
- Zod-using packages (precedent: `packages/shared`) declare `zod: ^3.23.0` as a regular dependency.
- No tests in `dist/` — `tsconfig.json` excludes `src/**/*.test.ts`.

### Token-validation precedent
- **Zero pre-existing token regex anywhere in the repo** (verified by `grep -E '\\{\\{(privacy|terms)' apps/`). RFC §3 referenced "#276 currently inlines its own validation" but that turned out to be the consent-text *resolver* in `apps/api/src/services/consentResolver.ts` (which handles brand-vs-survey precedence), not a token validator. So this Slice ships the token validator new — no consolidation work.
- Existing `consentResolver.ts` is unrelated to this package and is not touched.

### Test conventions
- Co-located `*.test.ts` files alongside sources (precedent across all `packages/*/src/`).
- R8 (shared test utils, no inline mocks) — applies to factories and complex fixtures, not to plain string inputs in unit tests. Slice 2 tests use literal string inputs; no mocks needed.

## Validation Requirements

| Mode | Required for Slice 2? | Notes |
|---|---|---|
| Package builds (`pnpm --filter @customerEQ/consent-text build`) | **Yes** | TS compilation. Verifies `tsc` emits `dist/`. |
| Package tests (`pnpm --filter @customerEQ/consent-text test:smoke`) | **Yes** | All three `.test.ts` files must pass. |
| `pnpm build` (workspace root) | **Yes** | Per project rule R11. Confirms the new package doesn't break workspace builds. |
| `pnpm typecheck` (workspace root) | **Yes** | Per project rule R11. 0 TS errors required. |
| `pnpm lint` (workspace root) | **Yes** | Per project rule R11. 0 errors required. |
| `pnpm test:smoke` (workspace root) | **Yes** | Per project rule R11. Picks up the new package's tests. |
| Integration tests | **No** (out of scope) | No DB/API in Slice 2. |
| Browser / E2E / mobile validation | **No** (no UI delta) | `uiValidationRequired = false`. |
| Renderer-source regex assertion | **Yes** | `renderer.test.ts` asserts the source file contains zero `innerHTML` / `dangerouslySetInnerHTML` strings (RFC §3 explicit). |

## Pre-submission checkboxes (this PR)

- [ ] All 11 source/config/test files created and conform to RFC §3 shape.
- [ ] Token regex matches RFC §3 verbatim.
- [ ] `TOKEN_KINDS` / `DEFAULT_LABEL_BY_KIND` constants match RFC §3 verbatim.
- [ ] No `innerHTML` / `dangerouslySetInnerHTML` strings appear in `renderer.ts`.
- [ ] Tests pass for all three test files locally.
- [ ] Workspace-level `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test:smoke` all pass.
- [ ] `git status` shows only the expected new package files + evidence docs. No `package-lock.json` pollution.
- [ ] Branch is `feature/issue-292-org-settings-consent-text`; PR uses "Refs #292" not "Closes #292".
- [ ] PR body documents: (a) zero consumers in this PR (R18's three-consumer contract is forward-looking); (b) the `pnpm-lock.yaml` change explanation if pnpm regenerates it.

## Known deferrals / open questions

- **None blocking Slice 2 implementation.** The three open architectural decisions in the RFC (package placement, regex shape, three-call-site contract) were resolved in PR #290 review. There are no reviewer-facing decisions on this PR.

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Adding a new workspace package may require `pnpm-lock.yaml` regeneration. | Low | Run `pnpm install` after package.json creation; verify the lockfile delta is bounded to the new package. Stage explicitly to avoid pulling unrelated lockfile churn. |
| React peerDependency resolution: if no app consumes the React renderer at install time, pnpm may warn but not error. | Negligible | Same shape as `packages/ui` which also has React peerDeps and zero workspace consumers at install time during its bring-up. |
| `tsconfig` lib + jsx settings could conflict with consumer settings. | Negligible | The package's tsconfig is hermetic to the package; consumers compile their own code with their own tsconfig. The published `dist/` already contains compiled JS + .d.ts. |
| Tests using `React.createElement` need React installed at devDep level for vitest to resolve. | Low | Add `react` to devDependencies (matches `packages/ui`). |

# Feature: BAML codegen — ESM-friendly relative imports
Issue: #273
Feature Spec: none (bug fix; issue body is canonical)
PR: [#275](https://github.com/mathursrus/CustomerEQ/pull/275)

## Completeness Evidence

- Issue tagged with label `phase:design`: Yes
- Issue tagged with label `status:needs-review`: Yes
- All files committed/synced to branch: Yes (`feature/issue-273-baml-js-extensions`)
- PR comments addressed: Round 1 (CI vs CD probe placement + narrow probe target) — see `docs/evidence/273-technical-design-feedback.md`

### Traceability Matrix

| Requirement (from issue #273 Acceptance Criteria) | RFC Section | Status | Validation Plan Alignment |
|---|---|---|---|
| A new API revision built from current main activates cleanly and serves `/healthz` 200 | "Technical Details → The fix" + "Validation Plan" rows 3–4 | **Met** | Local docker-build + `node --input-type=module -e "await import(...)"` probe; post-merge `az containerapp revision list` check + CD `Verify API health` step |
| `az containerapp revision list --name customereq-api --query "[?properties.active]"` shows a single active revision (the new one), with `0000111` deactivated | "Validation Plan" row 3 | **Met** | Post-merge CLI check after new revision activates; rollback path documented in "Risks & Mitigations" |
| CI gains a step that runs the built API image's entrypoint long enough to confirm `@customerEQ/ai` imports resolve cleanly — so this regression is caught next time before reaching prod | "Technical Details → CI safety net" + "Test Matrix" Integration row | **Met** | New step `Verify API image module resolution` in `.github/workflows/ci.yml` `docker-build` job, runs `node --input-type=module -e "await import('@customerEQ/ai')…"` against the built image. Probe target deliberately narrowed to `@customerEQ/ai` (not the full app entry) per Round 1 feedback — see feedback file. Same step added for worker image. CI is complementary to the existing CD `Verify API health` gate, not a replacement. |
| Post-merge, every subsequent CD's `Verify API health` step passes | "Observability" + "Risks & Mitigations" row 3 | **Met** (conditional on #272) | Existing CD step `Verify API health` (`deploy.yml:119-132`) will run once the upstream `Deploy Demo Storefront` step is unblocked by #272. RFC notes this dependency explicitly. |

**No `Unmet` rows.** All 4 acceptance criteria are addressed by the RFC.

### Architecture Gaps (documented for user review per FRAIM rules; not resolved here)

| Gap | Type | Suggested resolution | Defer to |
|---|---|---|---|
| `architecture.md` doesn't document BAML codegen-at-build-time as a build-pipeline pattern (gitignored regenerated client, version pinning in two places) | Missing from architecture | Add sub-bullet to §3.5 (Shared Layer) or §6 (Design Patterns) | address-feedback phase |
| `architecture.md` doesn't document the "built-image module-resolution probe" CI gate this RFC introduces | Missing from architecture | Add line to §11 Validation Commands | address-feedback phase |
| Production deployment violates §3.3 line 69 (worker deployed in `QUEUE_MODE=inline` despite arch doc saying it isn't) | Incorrectly followed (production state, NOT this RFC's design) | Out of scope — tracked in #274 | #274 |

## Feedback History

Inlined contents of `docs/evidence/273-technical-design-feedback.md` per FRAIM design-submission step 1 ("Feedback History"):

### Round 1 Feedback
*Received: 2026-05-04 (PR #275 conversation, prior to first-pass review)*

#### Comment 1 - ADDRESSED
- **Author**: manohar.madhira@outlook.com
- **Type**: design-question
- **File**: `docs/rfcs/273-baml-esm-imports.md`
- **Comment**: "The probe checking if the image is activated — should it be in CI or CD?"
- **Status**: ADDRESSED
- **Resolution**:
  - Updated RFC's "Technical Details → CI safety net" section to explicitly carve out CI vs CD responsibilities. CI probe = code-load gate (cheap, runs at PR time, no prod infra). CD `Verify API health` (already exists in `deploy.yml:119-132`) = deployed-revision gate (env/secrets/connectivity). They are complementary, not redundant.
  - Added rationale (the empirical 16-day-skipped-CD argument for shift-left) and explicit "what CI can't catch" so the carve-out is durable.
  - Validation Plan and Test Matrix tables updated to reflect both probes' scope.

#### Comment 2 - ADDRESSED
- **Author**: manohar.madhira@outlook.com  
- **Type**: design-question (same conversation, derived from Comment 1's analysis)
- **File**: `docs/rfcs/273-baml-esm-imports.md`
- **Comment**: Probe-target choice — `apps/api/dist/server.js` would risk false positives from module-load-time env-var reads. Narrow to `@customerEQ/ai`.
- **Status**: ADDRESSED
- **Resolution**:
  - Probe target narrowed from `apps/api/dist/server.js` to `@customerEQ/ai` directly. Narrowest target that exercises the regression class with zero side effects.
  - RFC's "CI safety net → Probe target" subsection documents the rationale (avoid false positives from env-var-read module-load paths in unrelated packages).

## Due Diligence Evidence

- Reviewed feature spec in detail (if feature spec present): N/A — no spec, bug fix
- Reviewed code base in detail to understand and repro the issue: **Yes** — reproduced the missing-`.js`-extension defect locally in the issue worktree by running `pnpm --filter @customerEQ/ai run generate` and grepping `index.ts` line 44–49; confirmed prod symptom matches in `customereq-api--0000160` and `customereq-worker--0000152` Container App logs (`ERR_MODULE_NOT_FOUND` on `/app/packages/ai/dist/generated/baml_client/async_client`); traced regression to commit `bdfadf0` via `git log --all -S` on the placeholder string and `git show bdfadf0 --stat`.
- Included detailed design, validation plan, test strategy in doc: **Yes**

## Prototype & Validation Evidence

- [x] Built simple proof-of-concept that works end-to-end — set `module_format "esm"` in `generators.baml`, ran codegen, confirmed all 13 generated files produce extension-bearing imports.
- [x] Manually tested complete user flow (browser/curl) — N/A for build-pipeline fix; verified via `grep` over codegen output, plus confirmed BAML rejects bogus `module_format` values with a clear error message.
- [x] Verified solution actually works before designing architecture — yes; spike-first per FRAIM rule.
- [x] Identified minimal viable implementation — one config line, no scripts, no new dependencies.
- [x] Documented what works vs. what's overengineered — RFC's "Spike Findings → Design Impact" table contrasts the native option vs. the rejected post-process patch script approach.

## Continuous Learning

| Learning | Agent Rule Updates |
|---|---|
| `az containerapp update --image` returns success on image-accept, not activation. CD "Deploy: success" lines do not mean the new revision is live; only `Verify API health` (or an explicit `revision list` check) confirms activation. | None yet — worth a CLAUDE.md or operational-rules note that "CD: success" requires a separate post-deploy probe to actually be a deploy success. Could fold into address-feedback phase if user agrees. |
| Spike-first paid off here: the issue body sketched a custom patch script (~30–50 lines + new file), but a 3-minute spike found a 1-line native config. Without the spike, the design doc would have mandated the larger fix. | Reinforces the existing FRAIM `spike-first-development.md` rule; no new rule needed. Will note in the issue retrospective at the end of the technical-design job. |
| When a code generator's output is gitignored and regenerated at build time, any "fix the generated file" patch is fragile. Either commit the generated file (and discipline regenerations as code review) or configure the generator to emit correct output (this RFC's path). | Worth surfacing if it recurs — currently a one-off learning. |

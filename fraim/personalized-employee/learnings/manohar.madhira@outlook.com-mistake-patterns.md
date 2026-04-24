# Mistake Patterns — manohar.madhira@outlook.com

Patterns of agent errors, incorrect approaches, and recurring failure modes observed during sessions.

---

## ⏳ Pending Review — 2026-04-24

### Proposed new entries

#### [P-HIGH] Symptom-level fix instead of systemic abstraction

**Score**: 8.0
**Last seen**: 2026-03-31
**Recurrences**: 1
**First synthesized**: (pending)

When multiple files exhibit the same user-visible defect, mechanically replicating an existing "fix" across every file instead of solving the root cause at the shared layer. On issue #71, invisible form-input text was first "fixed" by adding `text-gray-900` to 50+ inputs across 7 files, mimicking the Programs page workaround. The real fix was a 5-line global CSS rule in `globals.css` setting `color: var(--foreground)` on `input, textarea, select`. Pattern: anchoring on a working reference implementation without asking whether that reference was itself correct or just "happened to work." This mistake directly motivated project rule #15.

---

#### [P-HIGH] Used `github.sha` under `workflow_run` without `head_sha` fallback

**Score**: 8.0
**Last seen**: 2026-04-21
**Recurrences**: 1
**First synthesized**: (pending)

First instinct when adding a `workflow_run`-triggered job was to use `${{ github.sha }}` in `actions/checkout` and image tag expressions. Under `workflow_run`, `github.sha` resolves to the default-branch tip at dispatch time — not the CI-tested commit. Without the `github.event.workflow_run.head_sha || github.sha` fallback, the deploy would have checked out and tagged the wrong commit's image — a subtle correctness bug that presents as a "working" deploy. Caught by re-reading GitHub Actions docs once before committing, but the initial instinct was wrong.

---

#### [P-MED] FRAIM session state lost across context compaction

**Score**: 5.0
**Last seen**: 2026-03-27
**Recurrences**: 1
**First synthesized**: (pending)

Long phased jobs can have their conversation context compacted mid-phase, which drops the FRAIM session ID and any in-progress state. Recovery requires re-connecting via `fraim_connect`, re-reading the RFC/spec to reconstruct context, and re-running `seekMentoring` to locate the current phase — roughly 15 minutes of overhead. Mitigation: at session start, note the session ID in a scratchpad (a comment in the active work file, a TaskCreate metadata field, or similar) so it survives compaction without re-connection side effects.

---

#### [P-MED] Wrote to gitignored `docs/evidence/` without checking `.gitignore` first

**Score**: 5.0
**Last seen**: 2026-03-27
**Recurrences**: 1
**First synthesized**: (pending)

Created `docs/evidence/2-design-evidence.md` during issue #2 only to discover afterward that `docs/evidence/**/*.png` etc. patterns exist in `.gitignore` (and historically the whole directory was excluded). The file existed locally but could not be referenced from a PR, defeating its purpose. Before writing any evidence file, run a quick check of `.gitignore` for the target path. If the destination is gitignored, either change the destination or embed the summary directly in the PR body.

---

#### [P-LOW] Duplicate section numbering in RFC drafts

**Score**: 3.0
**Last seen**: 2026-03-27
**Recurrences**: 1
**First synthesized**: (pending)

RFC for issue #2 shipped with two sections both numbered "2a" (Member model + Program model). Cosmetic — the content was correct — but caused confusion during implementation reference. A single final-pass read-through of the section outline before submit catches this class of error cheaply.

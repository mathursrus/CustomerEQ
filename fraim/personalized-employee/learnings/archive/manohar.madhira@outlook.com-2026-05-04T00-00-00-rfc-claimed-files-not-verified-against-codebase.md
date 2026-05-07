---
author: manohar.madhira@outlook.com
date: 2026-05-04
context: issue-231 / pr-259 / feature-implementation implement-code phase
---

# Coaching Moment: rfc-claimed-files-not-verified-against-codebase

## What happened

While drafting the RFC for issue #231, the agent wrote a "File-level change list" table that included these two rows:

> `apps/worker/src/jobs/erasure.ts` | Add `externalId` to the field-zero list (GDPR Art. 17 / CCPA §1798.105). |
> `apps/api/src/services/dataExport.ts` | Add `externalId` and `enrolledVia` to the export payload (GDPR Art. 15 / CCPA §1798.110). |

Both rows assumed the target files existed and just needed extending. The basis for that assumption was `docs/architecture/architecture.md §10 Compliance Architecture`, which claims:

> | GDPR | Required from MVP | Soft deletes, consent fields (`consentGivenAt`, `consentVersion`), **erasure job, data export** |

The architecture doc was aspirational on the bolded items — declared intent, not delivered infrastructure. The agent never ran a `Grep` or `Glob` to verify the files existed before adding them to the RFC's modification list. The error propagated into the merged PR #259 and was only caught during phase-4 implementation pattern discovery, when a `find apps/worker/src -name "*.ts"` returned no erasure file. Re-scoping ate one round of user back-and-forth (option A/B/C decision) and forced the user to file a P1 follow-up issue (#N) for net-new GDPR infrastructure that had been silently assumed to exist.

This is the **third occurrence** of the umbrella pattern *"Asserted facts about file / config / external-state contents without reading the primary source first"* — joining the #177 CI-flake commit-attribution and the #231 fraim/config.json compliance claim. The L1 entry was synthesized yesterday; this is the same shape applied to RFC modification lists.

## What was learned

The umbrella rule expands: any RFC table that claims "modify X" or "extend Y" must have a verifying read of X / Y in the same drafting pass. Architecture documentation can be aspirational — its claims about delivered infrastructure are not a substitute for verifying the codebase. The cost of a 30-second `Grep` or `find` per file path is negligible; the cost of an undiscovered phantom-file claim is a mid-implementation re-scope plus a follow-up issue plus a courtesy correction on the already-merged PR.

## What the agent should have done

Before writing the RFC's "File-level change list," ran a quick batch verification — for each path in the table, either `Read` the file (if "modify") or confirm the parent directory + adjacent file naming pattern (if "create new"). The two GDPR rows would have been caught immediately: `find apps/worker/src -name "erasure*"` returns nothing; `find apps -name "dataExport*"` returns nothing. The RFC could have either (a) explicitly noted that erasure infra needs to be built first and filed the follow-up issue at design time, or (b) descoped the GDPR rows from #231 and noted the dependency. Either is honest. Asserting a modification of a file that doesn't exist is the third-occurrence pattern that L1 already covers — apply it to RFC drafting too, not just compliance/config claims.

For tooling: when authoring any "File-level change list" table in an RFC, run a one-shot batch verification step before submit — read each file path that's marked "modify" + verify each "new" path's parent directory exists + the naming convention matches adjacent files.

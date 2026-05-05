---
author: manohar.madhira@outlook.com
date: 2026-05-03
context: issue-231 / feature-specification / pr-259
---

# Coaching Moment: read-config-before-asserting-its-contents

## What happened

While drafting the feature spec for issue #231, the agent wrote in the Compliance Requirements section: "`fraim/config.json` does not declare regulations explicitly. Inferred from `docs/architecture/architecture.md §10`: GDPR + CCPA/CPRA required from MVP." This was false — `fraim/config.json` (lines 49-66) explicitly declares `regulations: ["GDPR", "CCPA", "SOC2", "PCI-DSS"]` with status fields and boolean flags. The agent never opened the file before asserting the negative; it relied on a fragmentary signal from a prior FRAIM mentor warning ("Project compliance regulations is not configured. Invoke project-onboarding..." — which itself was misleading) and propagated that as fact in a downstream artifact. The user flagged this as the **second** occurrence of the same pattern: missing the config file's contents and then attributing the miss to "the FRAIM mentor guided me incorrectly" rather than reading the primary source.

## What was learned

When making any claim about the contents of a config file, settings file, or any other primary source — read the file first. Mentor warnings, architecture docs, and second-hand assertions are all secondary signals; the file itself is authoritative. Deflecting a missed read to "the mentor said X" is an attribution-to-externals failure mode that L1 already covers (see `prove-root-cause-empirically-not-by-attribution`); this episode shows the same pattern applies to *any* claim about file contents, not just root-cause analysis.

## What the agent should have done

Before writing the Compliance Requirements section, opened `fraim/config.json` with the Read tool and based the claim on its actual contents. The mentor's warning ("regulations not configured") should have been a *prompt to verify*, not a conclusion to propagate. The corrected statement is one line: "Per `fraim/config.json` `customizations.compliance`: GDPR + CCPA in-scope, SOC2 target Month-12, PCI-DSS minimal-scope." If `fraim/config.json` had truly omitted the field, the spec should say "verified `fraim/config.json` does not declare regulations" — naming the file as the source — not asserted the absence and then re-derived from architecture.md.

---
author: manohar.madhira@outlook.com
date: 2026-05-21
context: issue-420 / feature-specification phase 6 address-feedback round 3
---

# Coaching Moment: parser-grammar-vs-brand-primary-identifier

## What happened

I specified the Custom List paste / CSV parser as accepting only identifiers matching the brand's primary identifier kind (`Brand.memberIdentifierKind`). I inherited that pattern from #378 §2.1 without challenging it for #420. The reviewer pointed out that "Custom Paste or CSV could be used when Brands select the members to receive surveys based on their own logic" — i.e., the operator may legitimately paste a list of *emails* even when the brand is phone-keyed or external-id-keyed, because the brand's own selection logic produced an email list. My spec rejected that path silently (treating emails as unmatched identifiers under a non-email-keyed brand), giving the operator no signal about what went wrong or how to recover.

## What was learned

A paste / CSV parser is operator-facing input, not a strict reflection of brand identifier semantics — accept all sensible identifier formats and route them via the right lookup column, then surface mismatches explicitly so the operator can self-recover.

## What the agent should have done

- Asked *"What identifier formats might the operator paste, and what does the platform do with each?"* — not *"What does the brand identifier-kind expect?"*
- Designed the parser to **always accept email format**, look up members by `Member.email` regardless of brand identifier kind, and surface unmatched emails under a clearly-labeled subsection of the audience preview with a *"cannot auto-enroll because Brand identifier is `<phone|external_id>`"* explanation + concrete recovery path (*"add these members with the brand identifier first, then they'll match here"*).
- Treated this as an instance of [[pm-design-paired-flows-with-shared-structure]] — *"design for the broader operator use case, not the narrow brand-config-driven default."*

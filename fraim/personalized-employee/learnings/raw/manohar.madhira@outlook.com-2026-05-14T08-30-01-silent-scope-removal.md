---
author: manohar.madhira@outlook.com
date: 2026-05-14
context: issue-336
---

# Coaching Moment: silent-scope-removal

## What happened

In Slice 4b's new QuestionsTab I shipped a right-rail config panel that only exposed `text`, `type` (read-only display), and `required` for every question — dropping every per-type Survey-Builder capability (rating min/max + endpoint labels, slider step, options + allowOther for multi-choice/checkbox/dropdown, ranking minSelect/maxSelect, matrix rows/columns, likert scale, image-choice multiSelect, file-upload maxSize). The slice was framed as "unify Survey-Builder into the new editor" and the legacy `/admin/survey-builder` was deleted; the user's expectation was that the unification preserved functionality. They surfaced the gap during Phase 11 manual verification: *"Question settings on Ratings also don't carry forward the capabilities of adjusting rating and the term — again, please build the Survey-Builder capabilities into the questions section. You have removed most functionality without any approval. Scope was to unify Survey-Builder into this view. This is one of the prime selling factors — creating a survey is one of the most powerful features we offer. Survey-Builder is a star feature."* The removal was never flagged at scoping, design, or code review.

## What was learned

Project Rule 25c: spec / RFC / work-list "deferred" or "remove" language is not license to drop UI, capability, or component — especially when the surrounding feature is hero / star functionality. Silent removal of documented capability is a scope violation; missing capabilities discovered at Phase 11 verification mean re-doing the implementation under review pressure instead of debating scope at scoping time.

## What the agent should have done

Before reducing the surface of any "replace legacy X with new Y" slice, enumerate the legacy's capability surface (read the source — recovered via `git show <delete-commit>^:<path>` if already deleted) and confirm parity coverage in the implementation scope. If the new design truly intends to drop capabilities, surface that explicitly in the scoping doc with a Rule 25c cross-reference (hero feature? user flow? tenant scoping?), get user approval, and document the gap in the slice's work-list. Default behaviour: if the legacy had it and the spec doesn't explicitly say "remove", port it forward.

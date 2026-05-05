---
author: manohar.madhira@outlook.com
date: 2026-05-03
context: issue-231 / pr-259 / technical-design address-feedback round 1
---

# Coaching Moment: channel-attribution-named-by-channel-not-trust

## What happened

In the RFC for issue #231, the agent designed the channel-attribution rule for `MemberEnrolledVia` (`SURVEY_RESPONSE` vs `EMBEDDED_FORM`) and mapped:

- URL query `?member_id=...` → `SURVEY_RESPONSE`
- Form body `memberId` field → `EMBEDDED_FORM`

The agent's framing was that "URL-supplied identity = host knew the responder = trusted signal," and labeled that path `SURVEY_RESPONSE`. The rule was server-detectable and internally consistent; the user explicitly approved the underlying detection mechanism in earlier review.

But on PR #259 review of the d143b99 RFC commit, the user pushed back on the *naming-to-detection mapping* across **four separate inline comments** (lines 107, 125, 127, 283 in the RFC):

> "Is this logic flipped or correct? Why would host knew the responder goto SURVEY_RESPONSE?"
> "Same question about logic flip. member_id via URL query would mean embedded, correct?"
> "again if customer knew the identity it would be embedded form not survey_response"
> "Consistently SURVEY_RESPONSE and EMBEDDED_FORM seem to be flipped"

The user's reading is the correct one. `EMBEDDED_FORM` describes the *channel* (a form embedded inside a host application that supplies identity context — typically via URL param from its SDK). `SURVEY_RESPONSE` describes the *channel* (a response to a standalone survey link, where the responder self-identifies on the form because there's no host SDK context). The agent had named the enum values by *trust signal* ("trusted-because-URL-supplied" vs "untrusted-because-typed") and mapped them to the detection rule by trust, not by channel — which produced the inverted mapping the user caught four times.

## What was learned

When designing enum / type / state values that have human-readable names, the names should describe **what the value semantically represents** (the channel, the state, the kind), not the **detection signal** that distinguishes them. If the name is `EMBEDDED_FORM`, it must describe the embedded-form channel — not whatever-detection-rule-happens-to-fire-second. The user's intuition reads names semantically; if the design's mapping doesn't match the obvious semantic reading, the user will catch it (often repeatedly, on the same flaw, across multiple inline comments — which is a hard signal).

## What the agent should have done

After picking the enum values `SURVEY_RESPONSE` and `EMBEDDED_FORM`, the agent should have asked: "what does each name *mean* if I read it without any implementation context?" — and answered: `EMBEDDED_FORM` = a form embedded into a host (host context = host knows identity → URL param); `SURVEY_RESPONSE` = a response to a standalone survey (no host context → responder self-identifies on the form). Then mapped detection → enum accordingly: URL query = EMBEDDED_FORM, body-only = SURVEY_RESPONSE. The trust framing ("URL is more trusted") is true but is a separate property; the attribution enum is about channel, not trust.

For future enum-design work: do a "name-only sanity check" before committing. Strip away the implementation reasoning; read each enum value as if you were a developer encountering it for the first time in a code review. If your immediate intuition about which detection path produces which value disagrees with the documented mapping, the names or the mapping is wrong — fix before submit.

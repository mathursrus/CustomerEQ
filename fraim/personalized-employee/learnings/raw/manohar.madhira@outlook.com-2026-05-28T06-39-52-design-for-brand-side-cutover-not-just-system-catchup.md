---
author: manohar.madhira@outlook.com
date: 2026-05-27
context: issue-524 / feature-specification address-feedback round 2
---

# Coaching Moment: design-for-brand-side-cutover-not-just-system-catchup

## What happened

While drafting the Slice 1 (`CUSTOMER_ID → EMAIL`) migration spec for #524, I designed the *system-side* catch-up window (R19/R20: dual-key member resolution while the re-key worker processes members) and stopped there — implicitly assuming that once the kind flip lands, the world is consistent. The user pointed out the obvious second-order question: "what happens when activity has to be done by the brand?" Their existing host-application embedded survey URLs (`?member_id=<customer_id>`), their backend code that POSTs `/v1/events` with `memberId: <customer_id>`, their managed distribution-list CSVs, etc., are all still keyed on the *old* identifier. The instant the kind flips, every one of those integrations would either start being rejected by shape validation or — worse — silently create orphan members under the old key while the brand's logs report success. I designed for the database to be consistent; I didn't design for the *external actors who feed the database* to have a safe, observable cutover path.

## What was learned

When a system flips a contract (identifier shape, schema, auth scheme, etc.), spec the external-actor cutover — what they have to change, how long they have to change it, and how they'll see what's still using the old contract — with the same rigor as the internal data migration; the internal swap is necessary but not sufficient.

## What the agent should have done

In the context-gathering phase, enumerate not just the *internal* code paths that touch the identifier (already done — the five ingress points) but also the *external surfaces* a brand has integrated against the identifier (embedded survey URLs, server-to-server APIs, distribution CSVs, webhook subscriptions, any client SDK). Then design the cutover with three explicit phases:
1. **Pre-migration impact preview** — data-driven from real usage signals (which API keys / routes / channels have actually been used in the last N days), so the admin sees what they're signing up to update before they confirm.
2. **Post-flip grace window** — configurable (default 30 days, range 7–90), during which dual-key resolution stays on, old-key usage is counted per ingress, and the admin can see real-time which integrations have and haven't been cut over.
3. **Grace expiry** — a visible deadline, the ability to extend within the configured max, and a clear rejection-with-error-code behavior when old-key requests arrive after expiry.
Treat the grace window as a *required* part of the slice, not a nice-to-have: without it the slice technically works but operationally destroys integrations the brand forgot about.

---
author: sid.mathur@gmail.com
date: 2026-05-23
context: issue-513 / feature-specification
---

# Coaching Moment: product-owner-not-end-consumer-persona

## What happened

The user asked for a CustomerEQ mobile app in React Native for "the customer of CustomerEQ." A prior admin-focused spec existed (issue #512). The agent deleted that spec and created a loyalty-member app — a native app for end consumers to check points balances, redeem rewards, spin wheels, and complete NPS surveys as a member. When the user reviewed the work, they corrected that the persona was the **product owner** (the B2B subscriber, a CX manager at a brand), not the end consumer (the loyalty member). The app should expose surveys/results, AI clustering, and Google Reviews for the product owner to monitor and act on — not a loyalty wallet for a consumer.

## What was learned

When a platform has two distinct user types (B2B operator vs. B2C end consumer), always confirm which persona a mobile app serves before building — a CX platform's "mobile app for the customer" defaults to the paying business customer, not the end consumer their software serves.

## What the agent should have done

Read the CustomerEQ product framing (it is a B2B SaaS platform sold to brands) and confirmed with the user: "Is this for the CX manager / brand operator, or for the brand's loyalty members?" Then scoped the app to the B2B operator (product owner) persona from the start.

# Architecture Update Evidence - Issue #113

Issue: `113`
Phase: `implement-architecture-update`
Architecture doc: `docs/architecture/architecture.md`

## Summary

Issue `#113` introduced real architectural changes, so the authoritative architecture document was updated before implementation handoff. The update records the new external-signal model, queue flow, API surface, and conservative identity-resolution rule that now exist in code.

## Sections Updated

| Section | Update |
|---|---|
| Platform overview | Added external signal analysis and source-management language to the product summary |
| `3.3 Event Processing Layer` | Added external signal sync/ingestion responsibilities, processors, worker count, and concurrency |
| `3.4 Data Layer` | Updated the schema description to include external signal models |
| `3.5 Shared Layer` | Added `packages/shared/src/externalSignals.ts` to the shared contract inventory |
| `4 Key Components & Modules` | Extended the system diagram with external signal sources plus sync/ingestion worker nodes |
| `4.1 Route Inventory` | Documented new admin source/feed routes, Customer 360 external signals, analytics feed, and external-signal webhook path |
| `4.3 BullMQ Workers` | Added `external-signal-sync` and `external-signal-ingestion` worker rows |
| `4.4 Database Models` | Added `ExternalSignalSource` and `ExternalSignal` model descriptions |
| `5.4 External Signal Ingestion` | Added a new sequence diagram for source sync plus webhook-driven ingestion |
| `6 Design Patterns & Principles` | Added source-scoped external webhook validation and conservative external identity resolution |

## Before / After

- Before: the architecture doc described webhook ingestion only for Salesforce and HubSpot, and Customer 360/CX analytics only for first-party data.
- After: the doc now reflects a second normalized CX input family, with external signal sources feeding queue-first ingestion into analytics and matched Customer 360 views.

## Review Notes

- No ADR was added in this phase because the implementation followed existing repo patterns instead of introducing a new foundational technology or replacing a core architectural decision.
- The update is evidence-based only: every documented change maps directly to implemented files in the feature branch.

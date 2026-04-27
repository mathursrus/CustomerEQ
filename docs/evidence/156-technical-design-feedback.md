# Feedback for Issue #156 - Technical Design Workflow

## Round 1 Feedback
*Received: 2026-04-21*

### Comment 1 - UNADDRESSED
- **Author**: swavaktp
- **Type**: pr_comment
- **Comment**: "update documentation and mark gap #3 for completion before customer onboarding"
- **Gap #3 context**: Credential encryption at rest — webhook endpoint URLs and signing secrets currently noted as "stored plaintext for MVP with a TODO". User is requiring this be marked as a hard gate before customer onboarding, not a deferred item.
- **Status**: ADDRESSED
- **Resolution**: RFC risks table updated — gap #3 is now a hard gate ("must be resolved before any customer is onboarded"). Architecture doc §6 updated with new "Credential Encryption at Rest" pattern entry explicitly marking #53 as a pre-onboarding requirement. Both the RFC Architecture Analysis section and the Risks table reflect this.

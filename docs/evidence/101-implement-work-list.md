# Issue #101 — Support Widget: Embeddable Chat with Rule-Based Response Engine

## Implementation Work List

**Issue Type**: Feature
**Branch**: `feature/101-phase-d-support-widget-embeddable-chat-with-rule-based-response-engine`
**RFC**: `docs/rfcs/101-support-widget-chat-rule-engine.md`

---

### Phase 1: Schema & Shared Infrastructure (parallel)

- [x] `packages/database/prisma/schema.prisma` — Add enums: ConversationStatus, MessageRole
- [x] `packages/database/prisma/schema.prisma` — Add models: Conversation, Message, SupportRule
- [x] `packages/database/prisma/schema.prisma` — Add relations to Brand and Member models
- [ ] Run `prisma migrate dev` to create migration (requires DATABASE_URL)
- [x] `packages/shared/src/zod/support.schema.ts` — New file: ConversationStatusEnum, MessageRoleEnum, CreateConversationSchema, SendMessageSchema, CreateSupportRuleSchema, UpdateSupportRuleSchema
- [x] `packages/shared/src/index.ts` — Export support.schema.ts
- [x] `packages/shared/src/supportRules.ts` — New file: SupportRuleContext, evaluateSupportRules(), SupportRuleMatchResult
- [x] `packages/shared/src/conditions.ts` — Add 'contains' operator
- [x] `packages/shared/src/index.ts` — Export supportRules.ts
- [x] `packages/shared/src/queues.ts` — Add SUPPORT_ORCHESTRATION queue
- [x] `packages/shared/src/types/index.ts` — Add SupportOrchestrationPayload type
- [x] `packages/ai/baml_src/generate_support_response.baml` — New BAML function: GenerateSupportResponse
- [x] `packages/ai/src/types.ts` — Add SupportResponseResult type and AiClient method
- [x] `packages/ai/src/analysis/support.ts` — New: generateSupportResponse wrapper
- [x] `packages/ai/src/mocks/mock-client.ts` — Add generateSupportResponse mock
- [x] `packages/ai/src/index.ts` — Export generateSupportResponse

### Phase 2: API Routes & Queue

- [x] `apps/api/src/routes/support-public.ts` — New: POST conversations, POST messages, GET messages, GET stream (SSE)
- [x] `apps/api/src/routes/support-admin.ts` — New: CRUD conversations, CRUD support rules
- [x] `apps/api/src/queues/bullmq.ts` — Add support-orchestration queue init, SupportOrchestrationPayload, enqueueSupportOrchestration(), inline processor
- [x] `apps/api/src/app.ts` — Register support-public and support-admin routes

### Phase 3: Web Component & Widget

- [x] `packages/embed/src/ceq-support-chat.ts` — New: <ceq-support-chat> web component
- [x] `packages/embed/vite.config.ts` — Add ceq-support-chat entry (EMBED_COMPONENT env var)

### Phase 4: Test Infrastructure

- [x] `packages/config/src/test-utils/factories/support.factory.ts` — New: createConversation, createMessage, createSupportRule factories
- [x] `packages/config/src/test-utils/index.ts` — Export support factories
- [x] `packages/shared/src/supportRules.test.ts` — 25 unit tests for evaluateSupportRules()
- [x] `packages/shared/src/zod/support.schema.test.ts` — 28 unit tests for Zod schemas
- [x] `packages/shared/src/conditions.test.ts` — 14 tests including 'contains' operator

### Deferrals

- Admin UI pages (support rules management, conversations dashboard) — deferred per RFC steps 9-10
- E2E tests — requires admin UI
- ClassifyIntent BAML function — Phase C prerequisite, not in this RFC (keyword fallback implemented)
- Customer 360 API integration — Phase A prerequisite (basic context from member data)
- KB RAG integration — Phase C prerequisite (graceful degradation, empty context)
- Widget.js loader endpoint — deferred to when embed build pipeline supports CDN delivery
- Database migration — requires DATABASE_URL connection

---

## Validation Requirements

- `uiValidationRequired`: false (no admin UI in this phase, widget is web component)
- `mobileValidationRequired`: false
- API integration tests for support routes (deferred — requires DATABASE_URL)
- Unit tests for rule evaluation and Zod schemas: DONE (67 tests)
- Build + typecheck + lint must pass: DONE
- Smoke tests must pass: DONE (all 11 suites, 334+ tests)

---

## Quality Requirements

- All mocks in `packages/config/src/test-utils/` (project rule #8) — DONE
- brandId scoping on all entities (project rule #6) — DONE
- Event-driven orchestration via BullMQ (project rule #5) — DONE
- Tests must fail loudly, never skip (project rule #11a) — DONE

---

## CI Gate Results

- `pnpm build`: PASS (9/9 tasks)
- `pnpm typecheck`: PASS (13/13 tasks)
- `pnpm lint`: PASS (3/3 tasks, 0 errors)
- `pnpm test:smoke`: PASS (11/11 suites)

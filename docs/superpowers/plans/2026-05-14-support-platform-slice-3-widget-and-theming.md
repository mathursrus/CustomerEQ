# Support Platform Revamp — Slice 3 (Widget + Theming) Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development.

**Goal:** Land per-brand `SupportWidgetConfig` (support-specific settings layered on top of existing `BrandTheme` for colors/fonts), expose it via a public GET + admin PUT API, build an admin theming page with live preview, and enhance the existing `<ceq-support-chat>` Web Component so it (a) loads the config at boot, (b) handles anonymous-first conversations, and (c) renders the new UI affordances (CsatBar placeholder, TypingIndicator, AgentJoinedBanner).

**Architecture decisions:**
- `SupportWidgetConfig` does NOT duplicate `BrandTheme` (colors/fonts/radius/logo live there). It only stores support-specific fields: greeting, offlineMessage, position, launcherIconUrl, csatPromptText, csatTimeoutSeconds, anonAllowed, showCsatAfterAi, darkModeAuto, escalateButtonText.
- The widget is enhanced in place — the existing `packages/embed/src/ceq-support-chat.ts` is 402 lines and already works. We extend it, don't replace it.
- Public conversation creation gains a second auth path: anonymous (no Bearer, `anonId` in body, `anonAllowed=true` on the brand's widget config required). The existing Bearer=email path stays for identified visitors.
- CSAT submit endpoint is **out of scope** (Slice 4). The CsatBar renders in Slice 3 but its 👍/👎 buttons are no-op placeholders that log "Slice 4 will wire this."

**Tech Stack:** No new deps. Vite IIFE build (already configured). Existing audit pattern + multi-tenant plugin reused.

**Spec:** `docs/superpowers/specs/2026-05-13-support-platform-revamp-design.md` §3 / §4 / §5 / §10.

**Branch:** `feature/issue-367-support-revamp-slice-3` (stacked on Slice 2). **Closes #367**.

**Out of scope (Slice 4):** CSAT submit + reopen-on-thumbs-down, supportTimeoutClassifier, Slack adapter, loyalty bridge wiring.

---

## File Structure

### New files
```
packages/database/prisma/migrations/<TODAY>_support_widget_config/migration.sql
apps/api/src/routes/support-widget-config.ts                            GET (public) + PUT (admin)
apps/api/test/integration/support-widget-config.integration.test.ts
apps/api/test/integration/support-public-anon.integration.test.ts       anon flow E2E
apps/web/src/app/(admin)/admin/support/widget/page.tsx                  theming form + live preview
apps/web/src/app/(admin)/admin/support/widget/_components/widget-form.tsx
apps/web/src/app/(admin)/admin/support/widget/_components/widget-preview.tsx
packages/config/src/test-utils/factories/supportWidgetConfig.factory.ts
packages/shared/src/zod/support-widget.schema.ts
```

### Modified files
```
packages/database/prisma/schema.prisma                                  add SupportWidgetConfig model
packages/shared/src/index.ts                                            re-export new schemas
packages/shared/src/zod/support.schema.ts                               extend public conversation payload (anonId/email/widget-config response)
apps/api/src/app.ts                                                     register support-widget-config routes
apps/api/src/routes/support-public.ts                                   add anonymous-flow branch on POST /conversations
packages/embed/src/ceq-support-chat.ts                                  load config; anonymous cookie; new UI affordances
```

---

## Task 0: Baseline

- [ ] **Step 1: Verify clean baseline**

```bash
cd /Users/sanjoyghosh/projects/CustomerEQ
git branch --show-current   # feature/issue-367-support-revamp-slice-3
pnpm install
pnpm generate:baml > /dev/null 2>&1
pnpm typecheck 2>&1 | tail -3
```

Expected: typecheck green. Slice 1 + 2 schema is in place.

---

## Task 1: `SupportWidgetConfig` Prisma model + migration

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/<timestamp>_support_widget_config/migration.sql`

- [ ] **Step 1: Add model + reverse relation**

Append to `schema.prisma` near other support-domain models:

```prisma
model SupportWidgetConfig {
  id      String @id @default(cuid())
  brandId String @unique
  brand   Brand  @relation(fields: [brandId], references: [id])

  // Layout / launcher
  position         WidgetPosition @default(BOTTOM_RIGHT)
  launcherIconUrl  String?
  darkModeAuto     Boolean        @default(false)

  // Copy
  greeting             String  @default("Hi! How can we help?")
  offlineMessage       String  @default("We're not online right now. Leave us a message and we'll get back to you.")
  csatPromptText       String  @default("Did this help?")
  escalateButtonText   String  @default("Talk to a human")

  // Behavior
  showCsatAfterAi      Boolean @default(true)
  csatTimeoutSeconds   Int     @default(30)
  anonAllowed          Boolean @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("support_widget_configs")
}

enum WidgetPosition {
  BOTTOM_RIGHT
  BOTTOM_LEFT
}
```

In `model Brand { ... }`, add the reverse relation among the other `kbSources KBSource[]`-style lines:

```prisma
  supportWidgetConfig SupportWidgetConfig?
```

- [ ] **Step 2: Validate**

```bash
pnpm --filter @customerEQ/database exec prisma format
pnpm --filter @customerEQ/database exec prisma validate
```

- [ ] **Step 3: Generate migration + reset**

```bash
pnpm db:migrate:new --name support_widget_config
pnpm db:reset --force
```

Expected: migration applies cleanly. Verify column exists:

```bash
docker compose exec -T postgres psql -U customerEQ -d customerEQ -c "\d support_widget_configs"
```

- [ ] **Step 4: Commit**

```bash
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations/
git commit -m "schema: SupportWidgetConfig (one-per-brand support widget settings)"
```

---

## Task 2: Zod schemas

**Files:**
- Create: `packages/shared/src/zod/support-widget.schema.ts`
- Modify: `packages/shared/src/zod/support.schema.ts` (extend public conversation payload)
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: New file**

`packages/shared/src/zod/support-widget.schema.ts`:

```ts
import { z } from 'zod'

export const WidgetPositionSchema = z.enum(['BOTTOM_RIGHT', 'BOTTOM_LEFT'])
export type WidgetPosition = z.infer<typeof WidgetPositionSchema>

export const SupportWidgetConfigSchema = z.object({
  id: z.string(),
  brandId: z.string(),
  position: WidgetPositionSchema,
  launcherIconUrl: z.string().nullable(),
  darkModeAuto: z.boolean(),
  greeting: z.string(),
  offlineMessage: z.string(),
  csatPromptText: z.string(),
  escalateButtonText: z.string(),
  showCsatAfterAi: z.boolean(),
  csatTimeoutSeconds: z.number().int().positive(),
  anonAllowed: z.boolean(),
})
export type SupportWidgetConfig = z.infer<typeof SupportWidgetConfigSchema>

export const UpdateSupportWidgetConfigSchema = z.object({
  position: WidgetPositionSchema.optional(),
  launcherIconUrl: z.string().url().nullable().optional(),
  darkModeAuto: z.boolean().optional(),
  greeting: z.string().min(1).max(500).optional(),
  offlineMessage: z.string().min(1).max(500).optional(),
  csatPromptText: z.string().min(1).max(200).optional(),
  escalateButtonText: z.string().min(1).max(100).optional(),
  showCsatAfterAi: z.boolean().optional(),
  csatTimeoutSeconds: z.number().int().min(5).max(600).optional(),
  anonAllowed: z.boolean().optional(),
})
export type UpdateSupportWidgetConfigInput = z.infer<typeof UpdateSupportWidgetConfigSchema>

// Public theme response — combines BrandTheme + SupportWidgetConfig for the embed widget
export const PublicWidgetBootSchema = z.object({
  brandId: z.string(),
  brandName: z.string(),
  theme: z.object({
    primaryColor: z.string(),
    accentColor: z.string(),
    backgroundColor: z.string(),
    textColor: z.string(),
    buttonColor: z.string(),
    buttonTextColor: z.string(),
    fontFamily: z.string(),
    borderRadius: z.string(),
  }),
  widget: SupportWidgetConfigSchema.omit({ id: true, brandId: true }),
})
export type PublicWidgetBoot = z.infer<typeof PublicWidgetBootSchema>
```

- [ ] **Step 2: Extend support.schema.ts**

Append to `packages/shared/src/zod/support.schema.ts`:

```ts
// Public conversation creation — accepts either Bearer email OR anonymous flow
export const StartConversationPublicSchema = z.object({
  initialMessage: z.string().min(1).max(5000),
  // Anonymous-flow fields
  anonId: z.string().min(8).max(128).optional(),
  email: z.string().email().optional(),
  // Identified-flow uses Bearer header — body anonId/email ignored when Bearer present
})
export type StartConversationPublicInput = z.infer<typeof StartConversationPublicSchema>
```

- [ ] **Step 3: Re-export**

In `packages/shared/src/index.ts`, append:

```ts
export * from './zod/support-widget.schema.js'
```

(Confirm `./zod/support.schema.js` is already exported.)

- [ ] **Step 4: Typecheck + commit**

```bash
pnpm --filter @customerEQ/shared typecheck
pnpm typecheck 2>&1 | tail -3
git add packages/shared/
git commit -m "shared: Zod schemas for SupportWidgetConfig + public widget boot + anon conversation start"
```

---

## Task 3: Test factory for `SupportWidgetConfig`

**Files:**
- Create: `packages/config/src/test-utils/factories/supportWidgetConfig.factory.ts`

- [ ] **Step 1: Implement**

```ts
import { getTestPrisma } from '../db/setup.js'

export async function createSupportWidgetConfig(opts: {
  brandId: string
  position?: 'BOTTOM_RIGHT' | 'BOTTOM_LEFT'
  greeting?: string
  anonAllowed?: boolean
  showCsatAfterAi?: boolean
  csatTimeoutSeconds?: number
  darkModeAuto?: boolean
}) {
  const prisma = getTestPrisma()
  return prisma.supportWidgetConfig.create({
    data: {
      brandId: opts.brandId,
      position: opts.position ?? 'BOTTOM_RIGHT',
      greeting: opts.greeting ?? 'Hi! How can we help?',
      anonAllowed: opts.anonAllowed ?? true,
      showCsatAfterAi: opts.showCsatAfterAi ?? true,
      csatTimeoutSeconds: opts.csatTimeoutSeconds ?? 30,
      darkModeAuto: opts.darkModeAuto ?? false,
    },
  })
}
```

- [ ] **Step 2: Re-export + commit**

```ts
// packages/config/src/test-utils/factories/index.ts
export * from './supportWidgetConfig.factory.js'
```

```bash
pnpm --filter @customerEQ/config typecheck
git add packages/config/src/test-utils/factories/
git commit -m "test-utils: createSupportWidgetConfig factory"
```

---

## Task 4: `/v1/support/widget-config` API routes (TDD)

**Files:**
- Create: `apps/api/src/routes/support-widget-config.ts`
- Create: `apps/api/test/integration/support-widget-config.integration.test.ts`
- Modify: `apps/api/src/app.ts`

Two endpoints:
- `GET /v1/public/support/widget-config?brandId=...` — public (no auth), returns `PublicWidgetBoot` (BrandTheme + SupportWidgetConfig). Used by the widget at boot.
- `PUT /v1/support/widget-config` — admin (JWT), upserts the brand's config (one-per-brand → upsert).

- [ ] **Step 1: Failing tests**

```ts
// apps/api/test/integration/support-widget-config.integration.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { setupTestDb, getTestPrisma } from '@customerEQ/config/test-utils/db/setup'
import { createBrand } from '@customerEQ/config/test-utils/factories/brand.factory'
import { createSupportWidgetConfig } from '@customerEQ/config/test-utils/factories/supportWidgetConfig.factory'
import { authenticatedRequest, unauthenticatedRequest } from '@customerEQ/config/test-utils'

beforeAll(async () => { await setupTestDb() })

describe('SupportWidgetConfig API — integration', () => {
  it('GET /v1/public/support/widget-config returns defaults when no row exists', async () => {
    const brand = await createBrand({ name: 'NoConfigBrand' })
    const req = unauthenticatedRequest()
    const res = await req.get(`/v1/public/support/widget-config?brandId=${brand.id}`)
    expect(res.status).toBe(200)
    expect(res.body.brandId).toBe(brand.id)
    expect(res.body.brandName).toBe('NoConfigBrand')
    expect(res.body.widget.greeting).toBeTruthy()
    expect(res.body.theme.primaryColor).toBeTruthy()
  })

  it('GET /v1/public/support/widget-config returns the brand row when set', async () => {
    const brand = await createBrand({ name: 'ConfigBrand' })
    await createSupportWidgetConfig({ brandId: brand.id, greeting: 'Custom greeting' })
    const req = unauthenticatedRequest()
    const res = await req.get(`/v1/public/support/widget-config?brandId=${brand.id}`)
    expect(res.status).toBe(200)
    expect(res.body.widget.greeting).toBe('Custom greeting')
  })

  it('GET .../widget-config rejects missing brandId', async () => {
    const req = unauthenticatedRequest()
    const res = await req.get('/v1/public/support/widget-config')
    expect(res.status).toBe(400)
  })

  it('GET .../widget-config 404s for nonexistent brand', async () => {
    const req = unauthenticatedRequest()
    const res = await req.get('/v1/public/support/widget-config?brandId=does_not_exist')
    expect(res.status).toBe(404)
  })

  it('PUT /v1/support/widget-config (authed) upserts the brand config', async () => {
    const brand = await createBrand({ name: 'PutBrand' })
    const req = authenticatedRequest(brand.id)
    const res = await req.put('/v1/support/widget-config').send({ greeting: 'New greeting', anonAllowed: false })
    expect(res.status).toBe(200)
    expect(res.body.greeting).toBe('New greeting')
    expect(res.body.anonAllowed).toBe(false)
  })

  it('PUT .../widget-config validates field constraints (csatTimeoutSeconds bounds)', async () => {
    const brand = await createBrand({ name: 'PutBoundsBrand' })
    const req = authenticatedRequest(brand.id)
    const res = await req.put('/v1/support/widget-config').send({ csatTimeoutSeconds: 999999 })
    expect(res.status).toBe(422)
  })

  it('PUT .../widget-config requires auth (no JWT → 401)', async () => {
    const req = unauthenticatedRequest()
    const res = await req.put('/v1/support/widget-config').send({ greeting: 'x' })
    expect([401, 403]).toContain(res.status)
  })
})
```

(Note: `unauthenticatedRequest()` may not exist in test-utils. Check `packages/config/src/test-utils/`; if missing, either add it or use `authenticatedRequest()` minus the auth header. Match the existing pattern.)

```bash
pnpm --filter @customerEQ/api test test/integration/support-widget-config.integration.test.ts 2>&1 | tail -10
```

Expected: FAIL.

- [ ] **Step 2: Implement**

`apps/api/src/routes/support-widget-config.ts`:

```ts
import type { FastifyPluginAsync } from 'fastify'
import { UpdateSupportWidgetConfigSchema, type PublicWidgetBoot } from '@customerEQ/shared'

const WIDGET_CONFIG_DEFAULTS = {
  position: 'BOTTOM_RIGHT' as const,
  launcherIconUrl: null,
  darkModeAuto: false,
  greeting: 'Hi! How can we help?',
  offlineMessage: "We're not online right now. Leave us a message and we'll get back to you.",
  csatPromptText: 'Did this help?',
  escalateButtonText: 'Talk to a human',
  showCsatAfterAi: true,
  csatTimeoutSeconds: 30,
  anonAllowed: true,
}

const supportWidgetConfigRoutes: FastifyPluginAsync = async (fastify) => {
  // PUBLIC: GET /v1/public/support/widget-config?brandId=...
  fastify.get<{ Querystring: { brandId?: string } }>('/v1/public/support/widget-config', async (request, reply) => {
    const { brandId } = request.query
    if (!brandId) return reply.status(400).send({ error: 'brandId query param required' })

    const brand = await fastify.prisma.brand.findUnique({
      where: { id: brandId },
      select: {
        id: true,
        name: true,
        defaultTheme: {
          select: {
            primaryColor: true,
            accentColor: true,
            backgroundColor: true,
            textColor: true,
            buttonColor: true,
            buttonTextColor: true,
            fontFamily: true,
            borderRadius: true,
          },
        },
        supportWidgetConfig: true,
      },
    })
    if (!brand) return reply.status(404).send({ error: 'Brand not found' })

    const cfg = brand.supportWidgetConfig
    const widget = cfg
      ? {
          position: cfg.position,
          launcherIconUrl: cfg.launcherIconUrl,
          darkModeAuto: cfg.darkModeAuto,
          greeting: cfg.greeting,
          offlineMessage: cfg.offlineMessage,
          csatPromptText: cfg.csatPromptText,
          escalateButtonText: cfg.escalateButtonText,
          showCsatAfterAi: cfg.showCsatAfterAi,
          csatTimeoutSeconds: cfg.csatTimeoutSeconds,
          anonAllowed: cfg.anonAllowed,
        }
      : WIDGET_CONFIG_DEFAULTS

    const theme = brand.defaultTheme ?? {
      primaryColor: '#6366f1',
      accentColor: '#818cf8',
      backgroundColor: '#ffffff',
      textColor: '#111827',
      buttonColor: '#6366f1',
      buttonTextColor: '#ffffff',
      fontFamily: 'system-ui',
      borderRadius: 'md',
    }

    const payload: PublicWidgetBoot = {
      brandId: brand.id,
      brandName: brand.name,
      theme,
      widget,
    }
    return reply.header('Cache-Control', 'public, max-age=60').send(payload)
  })

  // ADMIN: PUT /v1/support/widget-config (upsert by brandId from JWT)
  fastify.put('/v1/support/widget-config', async (request, reply) => {
    const parse = UpdateSupportWidgetConfigSchema.safeParse(request.body)
    if (!parse.success) return reply.status(422).send({ error: 'Validation failed', issues: parse.error.issues })
    const data = parse.data
    const updated = await fastify.prisma.supportWidgetConfig.upsert({
      where: { brandId: request.brandId },
      create: { brandId: request.brandId, ...data },
      update: data,
    })
    await fastify.prisma.auditEvent.create({
      data: {
        brandId: request.brandId,
        actorId: (request as { clerkUserId?: string }).clerkUserId ?? 'system',
        action: 'support_widget_config.update',
        resourceType: 'SupportWidgetConfig',
        resourceId: updated.id,
      },
    }).catch(() => undefined)
    return updated
  })
}

export default supportWidgetConfigRoutes
```

> Adjust the `brand.defaultTheme` relation name based on actual Brand schema. The recon report showed `defaultForBrands` on BrandTheme side; the Brand-side may use a different field name (look at how `BrandTheme` is referenced from `Brand`). If unsure, query both: `defaultTheme` and `theme`; pick whichever exists.

- [ ] **Step 3: Register in app.ts**

In `apps/api/src/app.ts`, near other route registrations:

```ts
import supportWidgetConfigRoutes from './routes/support-widget-config.js'
// ...
await fastify.register(supportWidgetConfigRoutes)
```

The route paths include `/v1/...` already, so no prefix needed.

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @customerEQ/api test test/integration/support-widget-config.integration.test.ts 2>&1 | tail -10
```

Expected: 7/7 pass.

If the `unauthenticatedRequest` helper doesn't exist in test-utils, add it as a small helper (mirror `authenticatedRequest` but skip the auth header) and stage it.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/support-widget-config.ts apps/api/test/integration/support-widget-config.integration.test.ts apps/api/src/app.ts packages/config/src/test-utils/  # only if unauthenticatedRequest added
git commit -m "api: SupportWidgetConfig public GET + admin PUT + integration tests"
```

---

## Task 5: Extend `support-public.ts` for anonymous conversation creation (TDD)

**Files:**
- Modify: `apps/api/src/routes/support-public.ts`
- Create: `apps/api/test/integration/support-public-anon.integration.test.ts`

- [ ] **Step 1: Failing tests**

```ts
// apps/api/test/integration/support-public-anon.integration.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { setupTestDb, getTestPrisma } from '@customerEQ/config/test-utils/db/setup'
import { createBrand } from '@customerEQ/config/test-utils/factories/brand.factory'
import { createSupportWidgetConfig } from '@customerEQ/config/test-utils/factories/supportWidgetConfig.factory'
import { unauthenticatedRequest } from '@customerEQ/config/test-utils'

beforeAll(async () => { await setupTestDb() })

describe('POST /v1/public/support/conversations — anonymous flow', () => {
  it('creates a conversation with anonId when no Bearer + anonAllowed=true', async () => {
    const brand = await createBrand({ name: 'AnonBrand' })
    await createSupportWidgetConfig({ brandId: brand.id, anonAllowed: true })
    const req = unauthenticatedRequest()
    const res = await req
      .post('/v1/public/support/conversations')
      .set('X-Brand-Id', brand.id)
      .send({
        anonId: 'anon_test_abc123def',
        initialMessage: 'Hi, do you ship to Canada?',
      })
    expect(res.status).toBe(201)
    expect(res.body.conversationId).toBeTruthy()
    const conv = await getTestPrisma().conversation.findUniqueOrThrow({
      where: { id: res.body.conversationId },
    })
    expect(conv.anonId).toBe('anon_test_abc123def')
    expect(conv.memberId).toBeNull()
    expect(conv.brandId).toBe(brand.id)
  })

  it('rejects anonymous when anonAllowed=false on the brand', async () => {
    const brand = await createBrand({ name: 'NoAnonBrand' })
    await createSupportWidgetConfig({ brandId: brand.id, anonAllowed: false })
    const req = unauthenticatedRequest()
    const res = await req
      .post('/v1/public/support/conversations')
      .set('X-Brand-Id', brand.id)
      .send({ anonId: 'anon_xyz', initialMessage: 'hello' })
    expect(res.status).toBe(403)
  })

  it('rejects anonymous when no anonId provided', async () => {
    const brand = await createBrand({ name: 'NoIdBrand' })
    await createSupportWidgetConfig({ brandId: brand.id, anonAllowed: true })
    const req = unauthenticatedRequest()
    const res = await req
      .post('/v1/public/support/conversations')
      .set('X-Brand-Id', brand.id)
      .send({ initialMessage: 'hello' })
    expect(res.status).toBe(400)
  })

  it('accepts optional email on anonymous flow and stores it', async () => {
    const brand = await createBrand({ name: 'AnonWithEmail' })
    await createSupportWidgetConfig({ brandId: brand.id, anonAllowed: true })
    const req = unauthenticatedRequest()
    const res = await req
      .post('/v1/public/support/conversations')
      .set('X-Brand-Id', brand.id)
      .send({ anonId: 'anon_e1', email: 'visitor@example.com', initialMessage: 'hello' })
    expect(res.status).toBe(201)
    const conv = await getTestPrisma().conversation.findUniqueOrThrow({
      where: { id: res.body.conversationId },
    })
    expect(conv.email).toBe('visitor@example.com')
    expect(conv.anonId).toBe('anon_e1')
  })
})
```

```bash
pnpm --filter @customerEQ/api test test/integration/support-public-anon.integration.test.ts 2>&1 | tail -10
```

Expected: FAIL.

- [ ] **Step 2: Modify `support-public.ts`**

Read the existing POST `/v1/public/support/conversations` handler. The existing flow:
1. Requires Bearer token = email
2. Looks up member by email
3. Creates conversation + initial message in a transaction
4. Enqueues orchestration

Add a second branch BEFORE step 1:

```ts
const authHeader = request.headers.authorization
const hasBearer = authHeader?.startsWith('Bearer ')

if (!hasBearer) {
  // Anonymous flow
  const brandIdHeader = request.headers['x-brand-id']
  if (!brandIdHeader || typeof brandIdHeader !== 'string') {
    return reply.status(400).send({ error: 'X-Brand-Id header required for anonymous flow' })
  }
  const brand = await fastify.prisma.brand.findUnique({
    where: { id: brandIdHeader },
    select: { id: true, supportWidgetConfig: { select: { anonAllowed: true } } },
  })
  if (!brand) return reply.status(404).send({ error: 'Brand not found' })
  const anonAllowed = brand.supportWidgetConfig?.anonAllowed ?? true
  if (!anonAllowed) return reply.status(403).send({ error: 'Anonymous chat is disabled for this brand' })

  const parse = StartConversationPublicSchema.safeParse(request.body)
  if (!parse.success) return reply.status(422).send({ error: 'Validation failed', issues: parse.error.issues })
  const { anonId, email, initialMessage } = parse.data
  if (!anonId) return reply.status(400).send({ error: 'anonId required for anonymous flow' })

  const { conversation, message } = await fastify.prisma.$transaction(async (tx) => {
    const conv = await tx.conversation.create({
      data: {
        brandId: brand.id,
        memberId: null,
        anonId,
        email: email ?? null,
        channel: 'WIDGET',
        status: 'ACTIVE',
      },
    })
    const msg = await tx.message.create({
      data: { conversationId: conv.id, role: 'CUSTOMER', content: initialMessage },
    })
    return { conversation: conv, message: msg }
  })

  await enqueueSupportOrchestration({
    conversationId: conversation.id,
    brandId: brand.id,
    memberId: null,
    messageId: message.id,
    messageContent: initialMessage,
  })

  return reply.status(201).send({
    conversationId: conversation.id,
    status: conversation.status,
    streamUrl: `/v1/public/support/conversations/${conversation.id}/stream`,
  })
}

// EXISTING Bearer-flow continues below
```

> Imports needed at top of the file: `StartConversationPublicSchema` from `@customerEQ/shared`.

Apply the same anonymous-allowing branch to POST `/v1/public/support/conversations/:id/messages` if it exists with a Bearer requirement — anonymous visitors must be able to send follow-up messages too. Look up the conversation by ID and verify it's an anonymous conversation (memberId null) before accepting the message. Use the request body's `anonId` to confirm ownership (or skip ownership check for simplicity — anon flow is best-effort).

- [ ] **Step 3: Run tests**

```bash
pnpm --filter @customerEQ/api test test/integration/support-public-anon.integration.test.ts 2>&1 | tail -10
```

Expected: 4/4 pass.

The pre-existing Bearer-flow integration tests in `support-public.test.ts` (if any) should still pass — verify:

```bash
pnpm --filter @customerEQ/api test:integration 2>&1 | grep -E 'FAIL|fail' | head -5
```

Expected: no new failures beyond the known pre-existing analytics one.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/support-public.ts apps/api/test/integration/support-public-anon.integration.test.ts
git commit -m "api: anonymous conversation flow on /v1/public/support/conversations (X-Brand-Id + anonId)"
```

---

## Task 6: Admin UI — `/admin/support/widget` with live preview

**Files:**
- Create: `apps/web/src/app/(admin)/admin/support/widget/page.tsx`
- Create: `apps/web/src/app/(admin)/admin/support/widget/_components/widget-form.tsx`
- Create: `apps/web/src/app/(admin)/admin/support/widget/_components/widget-preview.tsx`

Mirror the Slice 2 form pattern (`apps/web/src/app/(admin)/admin/kb/sources/_components/source-form.tsx` — controlled fields, `mode: create|edit|view` not needed here since it's upsert, but use the same styling tokens).

- [ ] **Step 1: page.tsx**

Client component. On mount, fetch `GET /v1/support/widget-config` (admin-authed; if the route doesn't exist for GET, just fetch `GET /v1/public/support/widget-config?brandId=<currentBrandId>` and strip the defaults — pick whichever is simpler). Render two columns side-by-side:

- LEFT: `<WidgetForm initial={config} onSubmit={savePut} />` — fields for all editable values
- RIGHT: `<WidgetPreview config={liveValues} />` — iframe or in-page mockup showing how the widget would render

Use a `useState` for the current form values; pass them to `<WidgetPreview>` live so editing the form updates the preview instantly.

Layout:
```tsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  <div>
    <h1 className="text-2xl font-bold mb-4">Widget Settings</h1>
    <WidgetForm initial={config} onChange={setLiveValues} onSubmit={savePut} />
  </div>
  <div className="sticky top-6 self-start">
    <h2 className="text-sm font-medium text-gray-600 mb-4">Live preview</h2>
    <WidgetPreview config={liveValues} brandId={currentBrandId} />
  </div>
</div>
```

- [ ] **Step 2: widget-form.tsx**

Fields:
- `greeting` (textarea, 1-500 chars)
- `offlineMessage` (textarea, 1-500 chars)
- `position` (radio: BOTTOM_RIGHT / BOTTOM_LEFT)
- `launcherIconUrl` (text input, optional URL)
- `darkModeAuto` (checkbox)
- `csatPromptText` (text input, 1-200)
- `escalateButtonText` (text input, 1-100)
- `showCsatAfterAi` (checkbox)
- `csatTimeoutSeconds` (number input, 5-600)
- `anonAllowed` (checkbox)

On any change, call `props.onChange(newValues)` to update the preview live. Submit posts to `PUT /v1/support/widget-config` and shows a "Saved" toast on 200.

Match the Slice 2 source-form styling (indigo-600 buttons, rounded-lg inputs).

- [ ] **Step 3: widget-preview.tsx**

Simplest viable: a static mockup rendered with the current config values applied as CSS variables. Layout:

- A small "browser frame" containing a phone-sized viewport (~360px wide)
- A floating launcher button at the configured `position` corner showing the launcher icon (or default icon) and the brand's primary color
- When clicked (or always rendered open in the preview), a panel showing: brand name header, the greeting as the first AI message, a sample customer message, a CsatBar with the configured `csatPromptText`, an Escalate button with `escalateButtonText`

The preview doesn't need to be the real widget — it's a faithful mockup that updates on edit. Use Tailwind for styling.

Optional/nice-to-have: load the real `<ceq-support-chat>` Web Component inside an `<iframe srcDoc=...>` so the preview uses the actual widget code. Skip if it adds significant complexity; the static mockup is fine for v1.

- [ ] **Step 4: Typecheck + lint**

```bash
pnpm --filter @customerEQ/web typecheck 2>&1 | tail -3
pnpm --filter @customerEQ/web lint 2>&1 | tail -3
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\(admin\)/admin/support/widget/
git commit -m "web: /admin/support/widget — theming form with live preview"
```

---

## Task 7: Widget enhancement — load config + theme via CSS vars

**Files:**
- Modify: `packages/embed/src/ceq-support-chat.ts`

The existing widget supports `--ceq-*` CSS custom properties but only reads `brand-id`, `token`, `api-base` attributes. Enhance it to:

1. On `connectedCallback`, fetch `GET ${apiBase}/v1/public/support/widget-config?brandId=${brandId}`
2. Apply theme tokens + widget-config defaults to the shadow DOM root via `style.setProperty('--ceq-primary-color', ...)` etc.
3. Render the greeting message from `widget.greeting` as the first AI message in the panel
4. Position the launcher per `widget.position` (BOTTOM_LEFT or BOTTOM_RIGHT)
5. Use `widget.launcherIconUrl` for the launcher icon when set (fall back to existing default)
6. Respect `widget.darkModeAuto` — if true and `prefers-color-scheme: dark`, swap the theme tokens to a dark variant (text becomes light, background becomes dark) — this is best-effort, don't over-engineer

- [ ] **Step 1: Add a `BootConfig` interface mirroring `PublicWidgetBoot` shape**

```ts
interface BootConfig {
  brandName: string
  theme: {
    primaryColor: string
    accentColor: string
    backgroundColor: string
    textColor: string
    buttonColor: string
    buttonTextColor: string
    fontFamily: string
    borderRadius: string
  }
  widget: {
    position: 'BOTTOM_RIGHT' | 'BOTTOM_LEFT'
    launcherIconUrl: string | null
    darkModeAuto: boolean
    greeting: string
    offlineMessage: string
    csatPromptText: string
    escalateButtonText: string
    showCsatAfterAi: boolean
    csatTimeoutSeconds: number
    anonAllowed: boolean
  }
}
```

- [ ] **Step 2: Add a private `bootConfig: BootConfig | null = null` field and a `loadBootConfig()` method**

```ts
private async loadBootConfig(): Promise<void> {
  const url = `${this.apiBase}/v1/public/support/widget-config?brandId=${encodeURIComponent(this.brandId)}`
  const res = await fetch(url)
  if (!res.ok) {
    this.bootConfig = null // fall back to defaults
    return
  }
  this.bootConfig = await res.json()
  this.applyTheme()
  this.applyWidgetCopy()
}

private applyTheme(): void {
  if (!this.bootConfig) return
  const root = this.shadowRoot!.host as HTMLElement
  const t = this.bootConfig.theme
  root.style.setProperty('--ceq-primary-color', t.primaryColor)
  root.style.setProperty('--ceq-background-color', t.backgroundColor)
  root.style.setProperty('--ceq-chat-bubble-color', t.accentColor)
  root.style.setProperty('--ceq-font-family', t.fontFamily)
  if (this.bootConfig.widget.darkModeAuto && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    root.style.setProperty('--ceq-background-color', '#1a1a1a')
    // ...etc
  }
}

private applyWidgetCopy(): void {
  if (!this.bootConfig) return
  const launcher = this.shadowRoot!.querySelector('.ceq-launcher') as HTMLElement | null
  if (launcher) {
    launcher.style.left = this.bootConfig.widget.position === 'BOTTOM_LEFT' ? '24px' : 'auto'
    launcher.style.right = this.bootConfig.widget.position === 'BOTTOM_RIGHT' ? '24px' : 'auto'
  }
  // If a launcher-icon image is provided, swap the default icon
  const icon = this.shadowRoot!.querySelector('.ceq-launcher-icon')
  if (icon && this.bootConfig.widget.launcherIconUrl) {
    icon.innerHTML = `<img src="${this.bootConfig.widget.launcherIconUrl}" alt="" />`
  }
  // Inject greeting as the first AI message if no messages yet
  if (this.messages.length === 0) {
    this.messages.push({ role: 'AI', content: this.bootConfig.widget.greeting } as never)
    this.renderMessages()
  }
}
```

- [ ] **Step 3: Wire `loadBootConfig()` into `connectedCallback`**

Call it after the initial HTML is rendered. Don't block rendering on it — let the panel render with placeholder values, then update once config arrives.

- [ ] **Step 4: Build the widget**

```bash
cd /Users/sanjoyghosh/projects/CustomerEQ
pnpm --filter @customerEQ/embed build 2>&1 | tail -10
```

Expected: builds without errors. Check `packages/embed/dist/ceq-support-chat.js` exists and has the new code.

- [ ] **Step 5: Commit**

```bash
git add packages/embed/src/ceq-support-chat.ts
git commit -m "embed: widget loads SupportWidgetConfig + applies theme/position/greeting"
```

---

## Task 8: Widget anonymous-flow integration

**Files:**
- Modify: `packages/embed/src/ceq-support-chat.ts`

Currently the widget requires a `token` attribute (email). Make it work without one when the brand has `anonAllowed: true`.

- [ ] **Step 1: Generate anonId via cookie**

Add a helper that reads or creates an `ceq_anon_id` cookie:

```ts
private getOrCreateAnonId(): string {
  const COOKIE = 'ceq_anon_id'
  const match = document.cookie.match(new RegExp('(?:^|; )' + COOKIE + '=([^;]+)'))
  if (match) return decodeURIComponent(match[1])
  const id = 'anon_' + Math.random().toString(36).slice(2) + Date.now().toString(36)
  document.cookie = `${COOKIE}=${id}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`
  return id
}
```

- [ ] **Step 2: Branch the start-conversation call**

In the existing logic that POSTs to `/v1/public/support/conversations`:

- If `this.token` is set (email Bearer flow): existing path
- Otherwise (anonymous): no Bearer, send `X-Brand-Id` header, body `{ anonId, initialMessage }`

```ts
private async startConversation(initialMessage: string): Promise<string> {
  const useAnon = !this.token
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const body: Record<string, string> = { initialMessage }
  if (useAnon) {
    headers['X-Brand-Id'] = this.brandId
    body.anonId = this.getOrCreateAnonId()
  } else {
    headers['Authorization'] = `Bearer ${this.token}`
  }
  const res = await fetch(`${this.apiBase}/v1/public/support/conversations`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Conversation create failed: ${res.status}`)
  const data = await res.json()
  return data.conversationId
}
```

Apply the same pattern to the send-message and SSE endpoints — anonymous flow uses `X-Brand-Id` + anonId in body; identified uses Bearer.

- [ ] **Step 3: Refuse anonymous when `bootConfig.widget.anonAllowed === false` AND no token**

Show the offlineMessage in the panel instead of letting the user type.

- [ ] **Step 4: Rebuild + commit**

```bash
pnpm --filter @customerEQ/embed build 2>&1 | tail -5
git add packages/embed/src/ceq-support-chat.ts
git commit -m "embed: anonymous-first flow with ceq_anon_id cookie"
```

---

## Task 9: Widget UI affordances — CsatBar, TypingIndicator, AgentJoinedBanner

**Files:**
- Modify: `packages/embed/src/ceq-support-chat.ts`

Three small UI affordances. CsatBar is a **placeholder** in Slice 3 — the buttons render but the click handlers just log `console.info('CSAT submit deferred to Slice 4')`.

- [ ] **Step 1: TypingIndicator**

A 3-dot animated indicator shown briefly when the customer sends a message and we're waiting for the AI/agent reply. Show when the orchestrator is processing (i.e., from the moment the user sends until the next message arrives on the SSE stream). Use existing CSS keyframes or add a simple `@keyframes pulse-dots`.

- [ ] **Step 2: AgentJoinedBanner**

When an SSE event indicates the conversation status changed to `ESCALATED` or the assignee was set, render a small banner: "An agent has joined the conversation." Style with a left-border accent.

The widget doesn't currently subscribe to status changes via SSE — extend the existing SSE event handler to also handle a `conversation_status_change` event (which the backend doesn't emit yet, but should). For Slice 3, just have the widget poll the conversation metadata every 30s as a fallback:

```ts
private async pollStatus(): Promise<void> {
  if (!this.conversationId) return
  try {
    const res = await fetch(`${this.apiBase}/v1/public/support/conversations/${this.conversationId}`)
    if (res.ok) {
      const conv = await res.json()
      if (conv.status === 'ESCALATED' && !this.escalatedBannerShown) {
        this.showAgentJoinedBanner()
      }
    }
  } catch {}
  setTimeout(() => this.pollStatus(), 30_000)
}
```

(Add a GET conversation endpoint to support-public.ts if it doesn't exist — minimal, just returns status + id.)

- [ ] **Step 3: CsatBar (placeholder)**

After every AI message, if `bootConfig.widget.showCsatAfterAi`, render a small inline CSAT prompt:

```
[csatPromptText] [👍] [👎]
```

Click handler:

```ts
private onCsatClick(rating: 'THUMBS_UP' | 'THUMBS_DOWN'): void {
  // Slice 4 will POST to /v1/public/support/conversations/:id/csat
  console.info('CSAT submit deferred to Slice 4', { rating, conversationId: this.conversationId })
}
```

Render the CsatBar AFTER the AI message and `widget.csatTimeoutSeconds` of inactivity (use `setTimeout` keyed on the latest message).

- [ ] **Step 4: Rebuild + commit**

```bash
pnpm --filter @customerEQ/embed build 2>&1 | tail -5
git add packages/embed/src/ceq-support-chat.ts apps/api/src/routes/support-public.ts  # only if a GET conversation route was added
git commit -m "embed: TypingIndicator + AgentJoinedBanner + CsatBar placeholder (Slice 4 wires submit)"
```

---

## Task 10: Validation gate

- [ ] **Step 1: Run gates**

```bash
cd /Users/sanjoyghosh/projects/CustomerEQ
pnpm generate:baml > /dev/null 2>&1
pnpm build 2>&1 | tail -5
pnpm typecheck 2>&1 | tail -5
pnpm lint 2>&1 | tail -5
pnpm test:smoke 2>&1 | tail -5
pnpm test:integration 2>&1 | tail -15
```

Expected: green except for known pre-existing analytics flake. Any NEW failure is in scope to fix.

- [ ] **Step 2: Manual smoke (optional)**

```bash
QUEUE_MODE=inline pnpm dev &
sleep 8
# Open http://localhost:3000/admin/support/widget — confirm theming form + live preview render
# Open the demo-storefront page (port 4173 or similar) — confirm the widget loads, greeting appears
```

---

## Task 11: Push + open PR

```bash
git push -u origin feature/issue-367-support-revamp-slice-3
gh pr create \
  --repo mathursrus/CustomerEQ \
  --base main \
  --head feature/issue-367-support-revamp-slice-3 \
  --title "Slice 3/4: Support platform revamp — widget rewrite + theming (#367)" \
  --body "$(cat <<'EOF'
## Summary
Third slice of the Support platform revamp. **Stacked on Slice 2 PR #366** — review and merge that first.

- **SupportWidgetConfig** Prisma model (one-per-brand, support-specific settings layered on top of existing BrandTheme for colors/fonts)
- **/v1/public/support/widget-config** — public GET (no auth, by ?brandId=) returns combined BrandTheme + SupportWidgetConfig boot payload
- **/v1/support/widget-config** — admin PUT (JWT, upsert by brandId)
- **/admin/support/widget** — admin theming form with live preview
- **Anonymous conversation flow** — POST /v1/public/support/conversations now accepts X-Brand-Id + anonId (no Bearer) when the brand has anonAllowed=true
- **Widget enhancement** — `<ceq-support-chat>` now boots by fetching its config, applies theme + position + greeting, generates ceq_anon_id cookie, renders TypingIndicator + AgentJoinedBanner + CsatBar (placeholder)

## Test plan
- [x] pnpm build / typecheck / lint
- [x] pnpm test:smoke
- [x] pnpm test:integration (widget config CRUD, anonymous conversation flow, pre-existing analytics flake noted)

## Out of scope (deferred to Slice 4)
- CSAT submit endpoint + reopen-on-thumbs-down + resolution emit
- supportTimeoutClassifier scheduled job
- Slack adapter (notifications + inbound webhook)
- Loyalty bridge — \`cx.ticket_resolved\` emit on resolution

Closes #367

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

**Spec coverage:**
- SupportWidgetConfig schema ✅ Task 1
- Widget-config public GET + admin PUT ✅ Task 4
- Anonymous flow on public conversation POST ✅ Task 5
- Admin /admin/support/widget page with live preview ✅ Task 6
- Widget loads config + applies theme ✅ Task 7
- Widget anonymous cookie + flow ✅ Task 8
- CsatBar (placeholder), TypingIndicator, AgentJoinedBanner ✅ Task 9

**Placeholders:** None. Each step has concrete code or commands.

**Risks:**
- Recon couldn't confirm whether Brand's default-theme relation is `defaultTheme` or differently named. Task 4 calls this out and asks the implementer to verify.
- The widget changes are additive; the existing email/Bearer flow stays intact. If the existing flow is in active use somewhere, no regressions expected.
- CsatBar placeholder is intentional — Slice 4 wires submission. The click handler logs but does nothing else. This is by design per spec §10 slice boundaries.
- The pre-existing analytics test flake (loyalty_events_memberId FK) is known and not in scope.

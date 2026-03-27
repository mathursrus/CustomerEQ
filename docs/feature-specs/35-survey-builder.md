# Feature: Survey Builder — Drag-and-Drop Question Editor with Skip Logic

Issue: #35
Owner: Claude (feature-specification job)

## Customer

CustomerEQ brand administrators who need to create custom surveys beyond the pre-baked NPS/CSAT/CES templates. These are CX program managers at mid-market and enterprise companies who currently use Qualtrics, Typeform, or SurveyMonkey for survey creation.

## Customer's Desired Outcome

Admins can visually design complex, multi-question surveys with rich question types, conditional branching, and answer piping — without writing code or relying on pre-baked templates. They can save and reuse questions across surveys to maintain consistency.

## Customer Problem Being Solved

Today, CustomerEQ surveys are limited to pre-baked question sets per type (NPS: rating + text, CSAT: rating + text, etc.). Admins cannot:
- Add, remove, or reorder questions
- Use question types beyond rating and text (choice exists in schema but doesn't render)
- Create conditional flows (e.g., ask a follow-up only if score < 3)
- Pipe answers from earlier questions into later question text
- Reuse questions across surveys

This makes CustomerEQ unusable for any CX team that needs custom survey flows — which is all of them.

## User Experience That Will Solve the Problem

### UX Flow

1. **Admin navigates to `/admin/surveys/new`** (or `/admin/surveys/:id/edit` for existing surveys)
2. **Survey builder page loads** with:
   - Left panel: question type palette (drag sources)
   - Center canvas: ordered list of questions (drop targets, sortable)
   - Right panel: question configuration (type-specific settings, skip logic rules)
   - Top bar: survey name, type selector, save/preview/publish buttons
3. **Adding a question**: Admin drags a question type from the palette onto the canvas, or clicks "+ Add Question" button
4. **Configuring a question**: Clicking a question on the canvas opens its settings in the right panel:
   - Question text (rich text)
   - Required toggle
   - Type-specific options (e.g., choice options, rating scale range, matrix rows/columns)
   - Skip logic rules: "Show this question IF [question] [operator] [value]"
   - Piping: type `{{Q1}}` in question text to insert a previous answer
5. **Reordering**: Drag questions up/down on the canvas to reorder
6. **Question library**: "Save to Library" button on any question; "Insert from Library" button on canvas
7. **Preview**: Click "Preview" to see the survey as a respondent would (with skip logic evaluated)
8. **Save**: Click "Save" to persist as DRAFT; "Publish" to set status to ACTIVE

### Supported Question Types

| Type | Input Control | Answer Format | Config Options |
|------|--------------|---------------|----------------|
| `rating` | Numbered buttons | `number` | min, max, labels (e.g., "Very Unlikely" / "Very Likely") |
| `text` | Textarea | `string` | placeholder, maxLength, multiline toggle |
| `multiple_choice` | Radio buttons | `string` | options[], allowOther |
| `checkbox` | Checkboxes | `string[]` | options[], minSelect, maxSelect, allowOther |
| `dropdown` | Select menu | `string` | options[] |
| `matrix` | Grid of radio buttons | `Record<string, string>` | rows[], columns[] |
| `ranking` | Drag-to-rank list | `string[]` (ordered) | options[] |
| `slider` | Range slider | `number` | min, max, step, leftLabel, rightLabel |
| `likert` | Horizontal scale | `string` | scale[] (e.g., ["Strongly Disagree", ..., "Strongly Agree"]) |
| `image_choice` | Clickable images | `string` or `string[]` | options[]{label, imageUrl}, multiSelect |
| `file_upload` | File picker | `string` (file URL) | maxSizeMB, allowedTypes[] |

### Skip Logic Model

```
SkipRule {
  targetQuestionId: string        // The question this rule applies to
  action: "show" | "hide"         // Show or hide the target
  conditions: SkipCondition[]     // Array of conditions (AND by default)
  conditionLogic: "AND" | "OR"    // How conditions combine
}

SkipCondition {
  sourceQuestionId: string        // The question whose answer is evaluated
  operator: "eq" | "ne" | "lt" | "lte" | "gt" | "gte" | "contains" | "not_contains" | "is_empty" | "is_not_empty"
  value: string | number | string[]  // The comparison value
}
```

### Answer Piping

Question text supports `{{Qn}}` syntax where `n` is the question's position (1-indexed) or its `id`. At render time on the public survey page, the placeholder is replaced with the respondent's answer to that question. If the referenced question hasn't been answered yet, the placeholder renders as blank.

### Question Library

```
QuestionTemplate {
  id: string
  brandId: string
  name: string             // Admin-friendly label (e.g., "Standard NPS Question")
  question: SurveyQuestion // The full question definition
  tags: string[]           // For filtering (e.g., ["nps", "onboarding"])
  createdAt: DateTime
  updatedAt: DateTime
}
```

### UI Mocks

- [Survey Builder — Admin View](mocks/35-survey-builder.html)

### Data Model Changes

**Extended `SurveyQuestion` schema** (replaces current simple schema):

```typescript
SurveyQuestion {
  id: string
  text: string
  type: "rating" | "text" | "multiple_choice" | "checkbox" | "dropdown"
       | "matrix" | "ranking" | "slider" | "likert" | "image_choice" | "file_upload"
  required: boolean
  // Type-specific configuration
  config: {
    options?: string[]                    // For choice-based types
    allowOther?: boolean                  // Allow "Other" free text option
    min?: number                          // For rating, slider
    max?: number                          // For rating, slider
    step?: number                         // For slider
    labels?: { left?: string, right?: string }  // For rating, slider
    scale?: string[]                      // For likert
    rows?: string[]                       // For matrix
    columns?: string[]                    // For matrix
    maxLength?: number                    // For text
    multiline?: boolean                   // For text
    minSelect?: number                    // For checkbox
    maxSelect?: number                    // For checkbox
    imageOptions?: { label: string, imageUrl: string }[]  // For image_choice
    multiSelect?: boolean                 // For image_choice
    maxSizeMB?: number                    // For file_upload
    allowedTypes?: string[]               // For file_upload
    placeholder?: string                  // For text, dropdown
  }
  // Skip logic
  skipRules?: SkipRule[]
  // Piping references are inline in text as {{Qn}}
}
```

**New `QuestionTemplate` model** in Prisma:

```prisma
model QuestionTemplate {
  id        String   @id @default(cuid())
  brandId   String
  brand     Brand    @relation(fields: [brandId], references: [id])
  name      String
  question  Json     // Full SurveyQuestion object
  tags      String[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([brandId])
  @@map("question_templates")
}
```

### Migration Path

Existing surveys with pre-baked questions will continue to work. The current `{ id, text, type, required, options? }` shape is a valid subset of the new schema — `config` defaults to `{}` and `skipRules` defaults to `[]`. No data migration needed for existing surveys.

## Compliance Requirements

No formal compliance regulations are configured for this project. The following requirements are inferred from industry best practices:

- **WCAG 2.1 AA**: All new question types SHALL be keyboard-navigable and screen-reader compatible. Drag-and-drop SHALL have a keyboard alternative (move up/down buttons).
- **Data Integrity**: Skip logic evaluation SHALL NOT cause answer data loss — if a question is hidden after being answered, the answer SHALL be retained but excluded from scoring.
- **Input Validation**: File upload questions SHALL validate file type and size server-side, not just client-side, to prevent malicious uploads.

## Validation Plan

| Step | Method | Expected Result |
|------|--------|-----------------|
| Create survey with all 11 question types | Browser: admin builder | Each type renders with correct config panel |
| Drag-and-drop reorder | Browser: admin builder | Questions reorder; order persists on save |
| Add skip logic rule | Browser: admin builder | Rule saves; preview shows/hides question correctly |
| Add piping reference | Browser: admin builder | Preview replaces `{{Q1}}` with actual answer |
| Save/load question from library | Browser: admin builder | Question saves to library; inserts into new survey |
| Respondent completes survey with skip logic | Browser: public survey page | Hidden questions don't appear; shown questions collect answers |
| Circular skip logic detection | Browser: admin builder | Validation error prevents save |
| Keyboard-only navigation of builder | Browser: admin builder | All actions achievable without mouse |
| API validation of new question schema | API: POST /v1/surveys | Invalid configs rejected with descriptive errors |
| Existing surveys still load/work | Browser: admin + public | Pre-baked surveys render identically to before |

## Alternatives

| Alternative | Why Discard? |
|-------------|-------------|
| Form-based question editor (no drag-and-drop) | Less intuitive for reordering; poor UX for 10+ question surveys. Competitors all offer drag-and-drop. |
| JSON editor for power users | Only suitable for technical users; CX program managers expect visual tools. Could be offered as a secondary "advanced mode" later. |
| Keep pre-baked templates, add "custom" mode only | Doesn't solve the core problem — admins need to customize NPS/CSAT surveys too, not just build from scratch. |
| Conversational (Typeform-style) one-at-a-time format | Limits question visibility and context. Better suited as a separate survey "mode" in the future, not a replacement for the builder. |

## Competitive Analysis

### Configured Competitors Analysis

No competitors configured in `fraim/config.json`.

### Additional Competitors Analysis

| Competitor | Current Solution | Strengths | Weaknesses | Customer Feedback | Market Position |
|------------|------------------|-----------|------------|-------------------|-----------------|
| Qualtrics | Full survey builder with branch logic (complex paths via Survey Flow), skip logic (forward-only), display logic per question, 20+ question types, randomizer, embedded data | Most powerful logic engine; enterprise-grade; supports compound conditions, quotas, randomization | Complex UI; steep learning curve; expensive ($1,500+/yr); overkill for simple surveys | "Powerful but overwhelming" — common sentiment | Market leader in enterprise CX |
| SurveyMonkey | Drag-and-drop builder with multiple choice, Likert, text, dropdown; advanced logic paths; AI question suggestions | Easy to use; good template library; AI-powered suggestions; affordable plans | Limited logic compared to Qualtrics; less flexible question types; NPS locked behind paid plan | "Good for basics, limited for complex surveys" | Market leader in SMB |
| Typeform | Conversational one-at-a-time format; logic jumps; AI form generator; beautiful default design | Best visual design; highest completion rates; engaging respondent experience | Limited to conversational format; complex logic is harder to configure; less suited for long surveys | "Beautiful but limiting for research" | Niche leader in design-first surveys |
| Medallia | Enterprise CX platform with Admin Suite survey builder + Ask Now for ad-hoc surveys; GenAI-powered summaries, root cause, smart response | Action orchestration (insight → action); omni-channel; enterprise scale; GenAI features | Very expensive; complex implementation; overkill for mid-market; pricing not public | "Best enterprise platform but massive overhead" | Enterprise market leader alongside Qualtrics |
| Qualaroo | Website intercept surveys ("Nudges"); pre-built templates; branching; advanced audience targeting | Affordable (free tier, $40/mo business); great for in-page feedback; targeting by behavior | Limited to intercept use case; not a full CX platform; fewer question types | "Great for quick website feedback" | Niche leader in website intercepts |
| Delighted | NPS/CSAT/CES templates; multi-channel (email, SMS, web, in-app, link) | Simple setup; clean UI; good multi-channel; now part of Qualtrics | Limited to standard survey types; no custom builder; no skip logic | "Easy NPS but grows out of it" | SMB/mid-market NPS specialist (acquired by Qualtrics) |

### Competitive Positioning Strategy

#### Our Differentiation
- **CX-to-Action Loop**: Unlike pure survey tools, CustomerEQ connects survey responses directly to loyalty campaigns, point awards, and closed-loop actions — surveys aren't just data collection, they're triggers.
- **AI-Native Analysis**: Every response is automatically sentiment-analyzed, topic-extracted, and clustered. Competitors require separate analytics tools or expensive add-ons (Qualtrics Text iQ).
- **MCP-Agent Compatible**: Surveys can be created, distributed, and analyzed by AI agents via MCP tools — no other CX platform offers this.

#### Competitive Response Strategy
- **If Qualtrics emphasizes enterprise logic**: We match core skip logic/branching and differentiate on the AI-powered action pipeline.
- **If Typeform emphasizes design**: We offer theming (#36) and focus on the post-survey value (loyalty, campaigns) that Typeform can't touch.

#### Market Positioning
- **Target Segment**: Mid-market CX teams (50-500 employees) who need more than SurveyMonkey but don't want Qualtrics complexity/cost.
- **Value Proposition**: The only CX platform where survey feedback automatically drives loyalty actions, powered by AI.
- **Pricing Strategy**: Position below Qualtrics, competitive with SurveyMonkey Business, with the AI+loyalty differentiator justifying premium over basic survey tools.

### Research Sources
- [Qualtrics Branch Logic Documentation](https://www.qualtrics.com/support/survey-platform/survey-module/survey-flow/standard-elements/branch-logic/)
- [Qualtrics Skip Logic Documentation](https://www.qualtrics.com/support/survey-platform/survey-module/question-options/skip-logic/)
- [SurveyMonkey vs Typeform 2026 Comparison — Software Advice](https://www.softwareadvice.com/customer-satisfaction/surveymonkey-profile/vs/typeform/)
- [Qualaroo Skip Logic Best Practices 2026](https://qualaroo.com/blog/skip-logic-survey/)
- [Medallia Admin Suite](https://www.medallia.com/platform/admin-suite/)
- [Medallia Ask Now](https://www.medallia.com/platform/ask-now/)
- [Qualaroo Features & Pricing — Capterra 2026](https://www.capterra.com/p/114046/Qualaroo/)
- [Delighted Alternatives — Qualaroo 2026](https://qualaroo.com/blog/delighted-alternatives/)
- Research date: 2026-03-27
- Methodology: Web research of competitor documentation, comparison sites, and review platforms

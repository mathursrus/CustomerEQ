# Feature: Survey Theming & White-Labeling

Issue: #36
Owner: Claude (feature-specification job)

## Customer

CustomerEQ brand administrators who need surveys to match their company's visual identity. These admins work at companies with established brand guidelines and cannot send surveys that look like a third-party tool.

## Customer's Desired Outcome

Every survey sent by a brand looks like it came from the brand — matching colors, logos, fonts, and messaging — increasing respondent trust and completion rates. Admins can create reusable themes and customize per-survey where needed.

## Customer Problem Being Solved

Today, all CustomerEQ surveys use the same default white/indigo styling. This means:
- Surveys look generic and don't build brand trust with respondents
- Enterprise customers with brand guidelines cannot use CustomerEQ for customer-facing surveys
- Thank-you pages cannot be customized (no redirect, no branded messaging)
- Survey URLs use `customereq.com/survey/...` which doesn't match the brand's domain
- Email invitations (when distribution is implemented) have no brand templating

This is a dealbreaker for any company with a marketing or brand team.

## User Experience That Will Solve the Problem

### UX Flow

1. **Brand-Level Theme Management**: Admin navigates to `/admin/settings/themes`
   - List of saved themes (brand can have multiple)
   - "Create Theme" button opens the theme editor
   - One theme can be set as the brand default

2. **Theme Editor** (`/admin/settings/themes/new` or `/admin/settings/themes/:id`):
   - **Live preview panel** on the right showing a mock survey question with the current theme applied
   - Settings organized in tabs:
     - **Brand**: Logo upload (URL or file), brand name display
     - **Colors**: Primary color, secondary color, background color, text color, button color, button text color, accent color
     - **Typography**: Font family (from Google Fonts or system fonts), heading size, body size
     - **Layout**: Background image/pattern, card style (shadow, border, rounded), padding, max width
     - **Thank You**: Custom thank-you message, redirect URL, show/hide incentive points earned
   - Color picker inputs with hex/rgb support
   - "Save Theme" button

3. **Per-Survey Theme Selection**: On the survey builder (or current creation page), a "Theme" dropdown lets the admin:
   - Select a saved theme
   - Choose "Default" (brand default theme)
   - Choose "None" (CustomerEQ default styling)

4. **Custom Domain** (advanced, can be phased):
   - Admin configures a custom domain (e.g., `feedback.brand.com`) in settings
   - CNAME/DNS verification flow
   - Surveys served on the custom domain with the brand's SSL cert

### Theme Data Model

```typescript
SurveyTheme {
  id: string
  brandId: string
  name: string                    // Admin-friendly name (e.g., "Corporate Blue")
  isDefault: boolean              // One default per brand

  // Brand
  logoUrl: string | null          // URL to brand logo
  brandName: string | null        // Override display name

  // Colors
  primaryColor: string            // Hex, e.g., "#1a56db"
  secondaryColor: string          // Hex
  backgroundColor: string         // Hex, e.g., "#ffffff"
  textColor: string               // Hex, e.g., "#111827"
  buttonColor: string             // Hex
  buttonTextColor: string         // Hex
  accentColor: string             // Hex (progress bar, highlights)

  // Typography
  fontFamily: string              // e.g., "Inter", "Roboto", "system-ui"
  headingSize: "sm" | "md" | "lg" // Maps to rem values
  bodySize: "sm" | "md" | "lg"

  // Layout
  backgroundImageUrl: string | null
  cardStyle: "flat" | "shadow" | "border"
  borderRadius: "none" | "sm" | "md" | "lg"  // rounded corners
  maxWidth: "sm" | "md" | "lg"   // 480px, 640px, 800px

  // Thank You Page
  thankYouMessage: string         // Custom message (supports {{points}} piping)
  thankYouRedirectUrl: string | null  // Redirect URL after completion
  showIncentivePoints: boolean    // Show "You earned X points!"

  createdAt: DateTime
  updatedAt: DateTime
}
```

### Prisma Model

```prisma
model SurveyTheme {
  id                  String   @id @default(cuid())
  brandId             String
  brand               Brand    @relation(fields: [brandId], references: [id])
  name                String
  isDefault           Boolean  @default(false)

  logoUrl             String?
  brandName           String?

  primaryColor        String   @default("#6366f1")
  secondaryColor      String   @default("#818cf8")
  backgroundColor     String   @default("#ffffff")
  textColor           String   @default("#111827")
  buttonColor         String   @default("#6366f1")
  buttonTextColor     String   @default("#ffffff")
  accentColor         String   @default("#6366f1")

  fontFamily          String   @default("system-ui")
  headingSize         String   @default("md")
  bodySize            String   @default("md")

  backgroundImageUrl  String?
  cardStyle           String   @default("shadow")
  borderRadius        String   @default("md")
  maxWidth            String   @default("md")

  thankYouMessage     String   @default("Thank you for your feedback!")
  thankYouRedirectUrl String?
  showIncentivePoints Boolean  @default(true)

  surveys             Survey[]

  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  @@index([brandId])
  @@map("survey_themes")
}
```

**Survey model changes:**
```prisma
model Survey {
  // ... existing fields ...
  themeId  String?
  theme    SurveyTheme? @relation(fields: [themeId], references: [id])
}
```

### How Theming Is Applied

The public survey page (`/survey/:id`) will:
1. Fetch the survey with its theme (or the brand's default theme if none set)
2. Inject CSS custom properties from the theme into a `<style>` block:
```css
:root {
  --ceq-primary: #1a56db;
  --ceq-secondary: #3b82f6;
  --ceq-bg: #ffffff;
  --ceq-text: #111827;
  --ceq-btn: #1a56db;
  --ceq-btn-text: #ffffff;
  --ceq-accent: #1a56db;
  --ceq-font: 'Inter', system-ui, sans-serif;
  --ceq-radius: 12px;
  --ceq-max-width: 640px;
}
```
3. All survey components use these CSS variables instead of hardcoded values
4. Logo and brand name render in a header above the survey
5. Thank-you page uses the theme's custom message and redirect URL

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/themes` | List all themes for the brand |
| `POST` | `/v1/themes` | Create a new theme |
| `GET` | `/v1/themes/:id` | Get theme details |
| `PATCH` | `/v1/themes/:id` | Update a theme |
| `DELETE` | `/v1/themes/:id` | Delete a theme (fails if in use by active surveys) |
| `POST` | `/v1/themes/:id/default` | Set as brand default |

The public survey endpoint (`GET /v1/public/surveys/:id`) will be extended to include the resolved theme in its response.

### UI Mocks

- [Theme Editor — Admin View](mocks/36-theme-editor.html)

## Compliance Requirements

No formal compliance regulations are configured for this project. Inferred requirements:

- **WCAG 2.1 AA Color Contrast**: Theme color combinations SHALL meet minimum contrast ratios (4.5:1 for normal text, 3:1 for large text). The theme editor SHOULD display a contrast warning when selected colors don't meet WCAG standards.
- **Content Security Policy**: Logo URLs and background image URLs SHALL be validated to prevent XSS via malicious image sources. Only HTTPS URLs SHALL be accepted.
- **Custom Domain Security**: Custom domains SHALL require SSL/TLS. Surveys SHALL NOT be served over plain HTTP.

## Validation Plan

| Step | Method | Expected Result |
|------|--------|-----------------|
| Create a theme with custom colors | Browser: admin theme editor | Theme saves; preview updates live |
| Apply theme to a survey | Browser: admin survey builder | Theme dropdown shows available themes |
| Load public survey with theme | Browser: `/survey/:id` | Survey renders with brand colors, logo, fonts |
| Load public survey without theme | Browser: `/survey/:id` | Survey renders with CustomerEQ defaults |
| Set brand default theme | Browser: admin theme list | Default badge appears; new surveys auto-use it |
| Custom thank-you message with `{{points}}` piping | Browser: complete a survey | Thank-you page shows custom message with points value |
| Redirect after completion | Browser: complete a survey | Respondent redirected to configured URL |
| Delete theme in use by active survey | API: `DELETE /v1/themes/:id` | 409 Conflict error returned |
| WCAG contrast check | Browser: theme editor | Warning shown for low-contrast color combinations |
| Logo upload with non-HTTPS URL | Browser: theme editor | Validation error: HTTPS required |

## Alternatives

| Alternative | Why Discard? |
|-------------|-------------|
| Custom CSS textarea (raw CSS input) | Only usable by technical users; error-prone; security risk (CSS injection). Visual editor is the industry standard. |
| Per-question styling | Too granular; increases complexity without proportional value. Theme-level styling covers 95% of use cases. |
| Brand-level-only theming (no per-survey override) | Some brands run multiple programs with different visual identities (e.g., B2C rewards vs B2B NPS). Per-survey override is essential. |
| Inline style overrides on the creation form | Poor UX; doesn't promote reuse; hard to maintain consistency. Separate theme entity is cleaner. |

## Competitive Analysis

### Configured Competitors Analysis

No competitors configured in `fraim/config.json`.

### Additional Competitors Analysis

| Competitor | Current Solution | Strengths | Weaknesses | Customer Feedback | Market Position |
|------------|------------------|-----------|------------|-------------------|-----------------|
| Qualtrics | Dynamic Themes (free, WCAG 2.1 compliant) + Static Themes (paid, designed by Qualtrics team). Brand administrators create org-wide themes. Custom CSS supported. | Most powerful theming; org-wide theme management; accessibility built-in; custom domain support | Complex theme creation UI; static themes are expensive add-on; overkill for simple branding | "Dynamic themes are good enough for most use cases" | Market leader — enterprise-grade theming |
| SurveyMonkey | Brand kit with logo, colors, fonts. Custom themes on Business+ plans. | Simple to configure; good defaults; quick setup | Limited customization depth; no custom CSS; custom domain only on Enterprise | "Covers basics well but limited for pixel-perfect branding" | Strong SMB theming |
| Typeform | Beautiful default design; custom fonts, colors, backgrounds per form. | Best out-of-box design; respondents love the look; no theme needed for good results | Limited layout control; no org-wide theme management; less configurable than Qualtrics | "Looks great without effort" | Design leader |
| Medallia | Enterprise admin suite with full white-labeling; custom domains; GenAI-powered smart response | Enterprise-grade branding; multi-brand hierarchy support; omni-channel theming | Complex setup; pricing not public; requires implementation team | "Professional but heavy lift to configure" | Enterprise market leader |
| Delighted | Simple branding (logo, colors) built into NPS/CSAT templates; clean minimal design | Beautiful defaults; quick branding setup; consistent across channels | Very limited customization; no custom CSS; no custom domains | "Clean but one-size-fits-all" | SMB NPS specialist (Qualtrics-owned) |

### Competitive Positioning Strategy

#### Our Differentiation
- **Live Preview Editor**: Real-time visual preview as admins adjust colors/fonts — faster feedback loop than Qualtrics' multi-step theme process.
- **Integrated with Loyalty**: Thank-you pages can display earned incentive points, creating a direct link between survey completion and loyalty rewards that no competitor offers.
- **Simple but Sufficient**: Covers the 95% use case (colors, logo, fonts, thank-you) without Qualtrics' complexity or Typeform's limitations.

#### Competitive Response Strategy
- **If Qualtrics emphasizes WCAG compliance**: We match with contrast checking in the editor.
- **If Typeform emphasizes beauty**: We provide strong defaults and a live preview that makes it easy to achieve good-looking results.

#### Market Positioning
- **Target Segment**: Mid-market brands that need professional branding without a design team dedicated to survey styling.
- **Value Proposition**: Professional branded surveys in minutes, with a live preview and built-in loyalty integration.
- **Pricing Strategy**: Include theming in the standard plan (unlike Qualtrics' paid static themes). Custom domains on higher tiers.

### Research Sources
- [Qualtrics Branded Themes Documentation](https://www.qualtrics.com/support/survey-platform/sp-administration/brand-customization-services/branded-themes/)
- [Qualtrics Survey Theming Documentation](https://www.qualtrics.com/support/survey-platform/survey-module/look-feel/applying-survey-themes/)
- [Qualtrics Themes Tab Documentation](https://www.qualtrics.com/support/survey-platform/sp-administration/themes-tab/)
- [SurveyMonkey vs Typeform 2026 Comparison — Software Advice](https://www.softwareadvice.com/customer-satisfaction/surveymonkey-profile/vs/typeform/)
- [Medallia Admin Suite](https://www.medallia.com/platform/admin-suite/)
- [Medallia Experience '26 — CMSWire](https://www.cmswire.com/customer-experience/medallia-experience-26-insight-generation-to-customer-action-orchestration/)
- [Delighted Alternatives — Qualaroo 2026](https://qualaroo.com/blog/delighted-alternatives/)
- Research date: 2026-03-27
- Methodology: Web research of competitor documentation, comparison sites, and review platforms

/// <reference types="vitest" />
import { gzipSync } from 'node:zlib'

import { describe, it, expect } from 'vitest'
import { generateWidgetJs, PublicSurveyResponseSchema } from './public.js'

// ---------------------------------------------------------------------------
// PublicSurveyResponseSchema validation
// ---------------------------------------------------------------------------

describe('PublicSurveyResponseSchema', () => {
  // Issue #231 PR2 — accepts memberId (new) or memberEmail (legacy back-compat).
  const valid = {
    memberId: 'user@example.com',
    answers: { q1: 'Great product!' },
    score: 9,
    channel: 'email' as const,
  }

  it('accepts a valid payload with memberId', () => {
    expect(PublicSurveyResponseSchema.safeParse(valid).success).toBe(true)
  })

  it('accepts legacy memberEmail field for back-compat with existing widget.js', () => {
    const legacy = {
      memberEmail: 'user@example.com',
      answers: { q1: 'Great product!' },
      score: 9,
    }
    expect(PublicSurveyResponseSchema.safeParse(legacy).success).toBe(true)
  })

  it('accepts payload without optional score', () => {
    const { score: _, ...noScore } = valid
    expect(PublicSurveyResponseSchema.safeParse(noScore).success).toBe(true)
  })

  it('accepts payload without memberId — handler enforces URL-query-or-body identifier', () => {
    // The schema permits both memberId and memberEmail to be absent because
    // the URL-query path (?member_id=…) is also a valid identifier carrier;
    // the route handler enforces "at least one of (query, body)".
    const { memberId: _, ...noId } = valid
    expect(PublicSurveyResponseSchema.safeParse(noId).success).toBe(true)
  })

  it('defaults channel to "link" when omitted', () => {
    const { channel: _, ...noChannel } = valid
    const result = PublicSurveyResponseSchema.safeParse(noChannel)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.channel).toBe('link')
  })

  it('rejects invalid memberEmail when supplied', () => {
    const bad = { memberEmail: 'not-email', answers: { q1: 'x' } }
    expect(PublicSurveyResponseSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects empty answers', () => {
    expect(PublicSurveyResponseSchema.safeParse({ ...valid, answers: {} }).success).toBe(false)
  })

  it('rejects score above 10', () => {
    expect(PublicSurveyResponseSchema.safeParse({ ...valid, score: 11 }).success).toBe(false)
  })

  it('rejects score below 0', () => {
    expect(PublicSurveyResponseSchema.safeParse({ ...valid, score: -1 }).success).toBe(false)
  })

  it('rejects invalid channel', () => {
    expect(PublicSurveyResponseSchema.safeParse({ ...valid, channel: 'carrier_pigeon' }).success).toBe(false)
  })

  it('accepts optional consent boolean (R16 EXPLICIT-mode opt-in marker)', () => {
    expect(PublicSurveyResponseSchema.safeParse({ ...valid, consent: true }).success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// SurveyTriggerSchema removed in Issue #378 along with the
// POST /v1/public/surveys/trigger endpoint — see public.ts. Brands now use
// POST /v1/surveys/:id/distribution-batches instead.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// generateWidgetJs
// ---------------------------------------------------------------------------

describe('generateWidgetJs', () => {
  const survey = {
    id: 'survey-001',
    name: 'Customer NPS',
    type: 'NPS',
    questions: [{ id: 'q1', text: 'How likely to recommend?', type: 'rating', required: true }],
    brand: { name: 'TestBrand' },
  }

  it('returns a self-invoking function', () => {
    const js = generateWidgetJs(survey, 'https://api.example.com')
    expect(js).toMatch(/^\(function\(\) \{/)
    expect(js).toMatch(/\}\)\(\);$/)
  })

  it('includes the survey id in the container element id', () => {
    const js = generateWidgetJs(survey, 'https://api.example.com')
    expect(js).toContain(`ceq-survey-widget-${survey.id}`)
  })

  it('includes the API URL for form submission', () => {
    const js = generateWidgetJs(survey, 'https://api.example.com')
    expect(js).toContain('https://api.example.com/v1/public/surveys/survey-001/respond')
  })

  it('escapes < and > to prevent XSS via </script> injection', () => {
    const malicious = {
      ...survey,
      name: '<script>alert("xss")</script>',
    }
    const js = generateWidgetJs(malicious, 'https://api.example.com')
    expect(js).not.toContain('<script>')
    expect(js).toContain('\\u003c')
    expect(js).toContain('\\u003e')
  })

  // Issue #241 — the prior "incentive points badge" tests are removed.
  // `Survey.incentivePoints` is gone (D19/D40/D50); points never appear on
  // the form. The widget no longer renders or references incentive points.
  it('does not render an incentive points badge', () => {
    const js = generateWidgetJs(survey, 'https://api.example.com')
    expect(js).not.toContain('incentivePoints')
  })

  // -------------------------------------------------------------------------
  // Issue #413 — Phase 3 (implement-tests) baseline + footer scaffolds.
  //
  // The widget bundle size assertion (R10) guards the +1 KB gzipped budget
  // for #413's footer addition. The baseline below is captured pre-#413 on
  // 2026-05-20 and serves as the comparison point through Phase 4. Test
  // runs in Phase 3 trivially pass (delta = 0). Post-Phase-4 runs must still
  // fit within baseline + 1024 bytes.
  //
  // The `it.todo` declarations below define the footer-presence assertions
  // Phase 4 (implement-code) must satisfy.
  // -------------------------------------------------------------------------

  describe('Issue #413 — widget footer', () => {
    // Baseline captured 2026-05-20 against the `survey` fixture above
    // (1 question, NPS, ~one-line brand name) — pre-#413 with no footer in
    // the widget. Update this constant ONLY when intentionally widening
    // the budget — never to mask a regression.
    // To re-capture: run this suite with the `console.log` below visible
    // and record the value here.
    const PRE_413_BASELINE_GZIPPED_BYTES = 2193

    // R10: the footer addition must not grow the gzipped widget by more
    // than 1 KB above the pre-#413 baseline. 1 KB = 1024 bytes.
    const R10_BUDGET_BYTES = PRE_413_BASELINE_GZIPPED_BYTES + 1024

    it('R10 — widget gzipped size stays within baseline + 1 KB budget', () => {
      const js = generateWidgetJs(survey, 'https://api.example.com')
      const gzippedSize = gzipSync(js).byteLength

      // Surface the actual size in test output so future PRs can update the
      // baseline intentionally if the no-op-delta band drifts.
      console.log(`[widget bundle] gzipped size = ${gzippedSize} bytes (baseline ${PRE_413_BASELINE_GZIPPED_BYTES}, R10 budget ${R10_BUDGET_BYTES})`)

      expect(gzippedSize).toBeLessThanOrEqual(R10_BUDGET_BYTES)
    })

    it('R3 — footer HTML is present in the widget container AFTER the form append', () => {
      const js = generateWidgetJs(survey, 'https://api.example.com')
      // The widget appends form to container, then immediately appends the
      // footer via insertAdjacentHTML('beforeend', ...). Both calls must
      // appear, with the footer call positioned after the form append.
      const formAppendIdx = js.indexOf('container.appendChild(form)')
      const footerInsertIdx = js.indexOf("insertAdjacentHTML('beforeend',")
      expect(formAppendIdx, 'form append must exist').toBeGreaterThan(-1)
      expect(footerInsertIdx, 'footer insertAdjacentHTML must exist').toBeGreaterThan(-1)
      expect(footerInsertIdx).toBeGreaterThan(formAppendIdx)
      expect(js).toContain('data-survey-footer')
      expect(js).toContain('ceq-powered-by--neutral')
    })

    it('R3 — footer HTML is present in the thank-you container.innerHTML swap (survives DOM replacement)', () => {
      const js = generateWidgetJs(survey, 'https://api.example.com')
      // Both the active-form path AND the thank-you swap reference the
      // same data-survey-footer marker. The two occurrences guarantee the
      // post-submit DOM replacement doesn't drop the footer (R3).
      const matches = js.match(/data-survey-footer/g)
      expect(matches).not.toBeNull()
      expect(matches!.length).toBeGreaterThanOrEqual(2)

      // The thank-you swap concatenates the existing innerHTML literal with
      // the footer HTML — that concatenation is the load-bearing line.
      expect(js).toMatch(/Your feedback has been recorded\.<\/p><\/div>'\s*\+\s*'<p class="ceq-powered-by/)
    })

    it('R4 — footer link href contains utm_source=survey_footer&utm_medium=embed&utm_campaign=powered_by', () => {
      const js = generateWidgetJs(survey, 'https://api.example.com')
      expect(js).toContain('utm_source=survey_footer')
      expect(js).toContain('utm_medium=embed')
      expect(js).toContain('utm_campaign=powered_by')
    })

    it('R4 — footer link href contains no respondent-specific data (no email, surveyId, brandId in querystring)', () => {
      const js = generateWidgetJs(survey, 'https://api.example.com')
      // Parse out the footer href to inspect it directly.
      const hrefMatch = js.match(/href="(https:\/\/customereq\.com\/[^"]+)"/)
      expect(hrefMatch, 'footer href must be present').not.toBeNull()
      const url = new URL(hrefMatch![1])
      const paramKeys = [...url.searchParams.keys()].sort()
      // Exactly three params — no fourth carrying surveyId/brandId/email/etc.
      expect(paramKeys).toEqual(['utm_campaign', 'utm_medium', 'utm_source'])
      // Defense-in-depth — the href must not contain any obvious
      // respondent-identifier shape.
      const href = hrefMatch![1].toLowerCase()
      expect(href).not.toContain('email')
      expect(href).not.toContain('survey-001') // survey.id from the fixture above
      expect(href).not.toContain('memberid')
      expect(href).not.toContain('brandid')
    })

    it('R7 — widget JS contains no toggle-shaped identifier', () => {
      const js = generateWidgetJs(survey, 'https://api.example.com')
      // Defense-in-depth: the repo-level R7 grep gate
      // (scripts/check-no-attribution-toggle.sh) catches these at the
      // source-tree level; this assertion catches anyone who tries to
      // smuggle a toggle into the generated-JS string at runtime.
      expect(js).not.toMatch(/hideFooter|hideAttribution|showPoweredBy|disableFooter|attributionEnabled|poweredByEnabled/i)
    })

    it('R8 — footer link has target="_blank" rel="noopener noreferrer" aria-label="Powered by CustomerEQ — opens customereq.com in a new tab"', () => {
      const js = generateWidgetJs(survey, 'https://api.example.com')
      expect(js).toContain('target="_blank"')
      expect(js).toContain('rel="noopener noreferrer"')
      expect(js).toContain('aria-label="Powered by CustomerEQ — opens customereq.com in a new tab"')
    })
  })
})

// Issue #378 — tests for the shared host-page glue hook.
// The hook owns survey/brand fetch, answers/consent/memberId state, the
// clear-on-change handlers, required-question + explicit-consent validation,
// and the effective-consent-mode projection. Both live-respondent host pages
// (public BYO-member-id at apps/web/src/app/survey/[id]/page.tsx, and tokenized
// at apps/web/src/app/survey/[id]/r/[token]/page.tsx) consume it.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

import {
  DEFAULT_THEME,
  useSurveyResponseForm,
  type PublicSurveyPayload,
} from './useSurveyResponseForm'

// Survey override is EXPLICIT, brand default is IMPLIED_ON_SUBMIT — so
// effectiveConsentMode resolves to EXPLICIT (the survey override wins).
const SURVEY_FIXTURE: PublicSurveyPayload = {
  id: 'srv_test',
  name: 'Test survey',
  title: 'Test survey',
  description: null,
  type: 'NPS',
  status: 'ACTIVE',
  programId: 'prog_test',
  themeId: null,
  questions: [
    {
      id: 'q_required',
      type: 'text',
      text: 'Why?',
      required: true,
      config: { multiline: false },
    },
    {
      id: 'q_optional',
      type: 'text',
      text: 'Tell me more?',
      required: false,
      config: { multiline: false },
    },
  ],
  settings: {},
  responsePolicy: 'ONCE',
  consentMode: 'EXPLICIT',
  consentTextOverride: 'I agree to share my response.',
  thankYouMessage: 'Thanks!',
  thankYouRedirectUrl: null,
  brand: {
    id: 'brd_test',
    name: 'Test brand',
    logoUrl: null,
    consentMode: 'IMPLIED_ON_SUBMIT',
    consentTextDefault: null,
    termsUrl: null,
    privacyPolicyUrl: null,
    memberIdentifierKind: 'email',
  },
  theme: null,
}

function stubFetchOk(payload: PublicSurveyPayload = SURVEY_FIXTURE): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => payload,
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('useSurveyResponseForm', () => {
  beforeEach(() => {
    // validate() scrolls the first errored control into view — stub it so
    // jsdom doesn't throw on the non-existent method.
    Element.prototype.scrollIntoView = vi.fn() as unknown as Element['scrollIntoView']
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('fetches the survey on mount and exposes resolvedSurvey / brandLite / DEFAULT theme', async () => {
    stubFetchOk()
    const { result } = renderHook(() => useSurveyResponseForm({ surveyId: 'srv_test' }))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.survey).not.toBeNull()
    expect(result.current.resolvedSurvey?.id).toBe('srv_test')
    expect(result.current.brandLite?.memberIdentifierKind).toBe('email')
    // survey.theme === null in the fixture → hook falls back to DEFAULT_THEME.
    expect(result.current.theme).toBe(DEFAULT_THEME)
  })

  it('skips the fetch when enabled=false (tokenized page during token-status preflight)', () => {
    const fetchMock = stubFetchOk()
    const { result } = renderHook(() =>
      useSurveyResponseForm({ surveyId: 'srv_test', enabled: false }),
    )
    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.current.loading).toBe(false)
    expect(result.current.survey).toBeNull()
  })

  it('exposes effectiveConsentMode = survey override ?? brand default', async () => {
    stubFetchOk()
    const { result } = renderHook(() => useSurveyResponseForm({ surveyId: 'srv_test' }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.effectiveConsentMode).toBe('EXPLICIT')
  })

  describe('validate()', () => {
    it('flags required questions whose answer is missing', async () => {
      stubFetchOk()
      const { result } = renderHook(() =>
        useSurveyResponseForm({
          surveyId: 'srv_test',
          memberIdRequiredMessage: () => 'Your email is required.',
        }),
      )
      await waitFor(() => expect(result.current.loading).toBe(false))

      act(() => {
        result.current.handleMemberIdChange('me@example.com')
        result.current.handleConsentChange(true)
      })

      let ok = true
      act(() => {
        ok = result.current.validate()
      })

      expect(ok).toBe(false)
      expect(result.current.fieldErrors.questions?.q_required).toBe('This question is required.')
      // Optional question is never flagged.
      expect(result.current.fieldErrors.questions?.q_optional).toBeUndefined()
    })

    it('flags missing explicit consent', async () => {
      stubFetchOk()
      const { result } = renderHook(() =>
        useSurveyResponseForm({
          surveyId: 'srv_test',
          memberIdRequiredMessage: () => 'Your email is required.',
        }),
      )
      await waitFor(() => expect(result.current.loading).toBe(false))

      act(() => {
        result.current.handleAnswerChange('q_required', 'an answer')
        result.current.handleMemberIdChange('me@example.com')
      })

      let ok = true
      act(() => {
        ok = result.current.validate()
      })

      expect(ok).toBe(false)
      expect(result.current.fieldErrors.consent).toBe('Please confirm you agree before submitting.')
    })

    it('flags missing memberId in the public flow using the caller-supplied message', async () => {
      stubFetchOk()
      const memberIdRequiredMessage = vi.fn(() => 'Your email is required.')
      const { result } = renderHook(() =>
        useSurveyResponseForm({
          surveyId: 'srv_test',
          memberIdRequiredMessage,
        }),
      )
      await waitFor(() => expect(result.current.loading).toBe(false))

      act(() => {
        result.current.handleAnswerChange('q_required', 'an answer')
        result.current.handleConsentChange(true)
      })

      let ok = true
      act(() => {
        ok = result.current.validate()
      })

      expect(ok).toBe(false)
      expect(result.current.fieldErrors.memberId).toBe('Your email is required.')
      expect(memberIdRequiredMessage).toHaveBeenCalled()
    })

    it('skips the memberId check when identityFromToken=true (tokenized flow)', async () => {
      stubFetchOk()
      const { result } = renderHook(() =>
        useSurveyResponseForm({ surveyId: 'srv_test', identityFromToken: true }),
      )
      await waitFor(() => expect(result.current.loading).toBe(false))

      act(() => {
        result.current.handleAnswerChange('q_required', 'an answer')
        result.current.handleConsentChange(true)
      })

      let ok = false
      act(() => {
        ok = result.current.validate()
      })

      expect(ok).toBe(true)
      expect(result.current.fieldErrors.memberId).toBeUndefined()
    })

    it('returns true and clears errors when every required field is satisfied (public flow)', async () => {
      stubFetchOk()
      const { result } = renderHook(() =>
        useSurveyResponseForm({
          surveyId: 'srv_test',
          memberIdRequiredMessage: () => 'Your email is required.',
        }),
      )
      await waitFor(() => expect(result.current.loading).toBe(false))

      act(() => {
        result.current.handleAnswerChange('q_required', 'an answer')
        result.current.handleConsentChange(true)
        result.current.handleMemberIdChange('me@example.com')
      })

      let ok = false
      act(() => {
        ok = result.current.validate()
      })

      expect(ok).toBe(true)
      expect(result.current.fieldErrors).toEqual({})
    })

    it('treats whitespace-only / empty-array / empty-object answers as missing', async () => {
      stubFetchOk({
        ...SURVEY_FIXTURE,
        questions: [
          {
            id: 'q_text',
            type: 'text',
            text: 'Text',
            required: true,
            config: { multiline: false },
          },
          {
            id: 'q_choice',
            type: 'multiple_choice',
            text: 'Choice',
            required: true,
            config: { options: ['A', 'B'] },
          },
          {
            id: 'q_cb',
            type: 'checkbox',
            text: 'Cb',
            required: true,
            config: { options: ['A', 'B'], minSelect: 0, maxSelect: 2 },
          },
        ],
      })
      const { result } = renderHook(() =>
        useSurveyResponseForm({ surveyId: 'srv_test', identityFromToken: true }),
      )
      await waitFor(() => expect(result.current.loading).toBe(false))

      act(() => {
        result.current.handleConsentChange(true)
        result.current.handleAnswerChange('q_text', '   ')
        result.current.handleAnswerChange('q_choice', '')
        result.current.handleAnswerChange('q_cb', [])
      })

      let ok = true
      act(() => {
        ok = result.current.validate()
      })

      expect(ok).toBe(false)
      expect(result.current.fieldErrors.questions).toEqual({
        q_text: 'This question is required.',
        q_choice: 'This question is required.',
        q_cb: 'This question is required.',
      })
    })
  })

  describe('clear-on-change', () => {
    it('handleAnswerChange clears the per-question error for that question only', async () => {
      stubFetchOk()
      const { result } = renderHook(() =>
        useSurveyResponseForm({ surveyId: 'srv_test', identityFromToken: true }),
      )
      await waitFor(() => expect(result.current.loading).toBe(false))

      // Force a question error.
      act(() => {
        result.current.handleConsentChange(true)
      })
      act(() => {
        result.current.validate()
      })
      expect(result.current.fieldErrors.questions?.q_required).toBe('This question is required.')

      // Answering clears just that question's error.
      act(() => {
        result.current.handleAnswerChange('q_required', 'an answer')
      })
      expect(result.current.fieldErrors.questions?.q_required).toBeUndefined()
    })

    it('handleConsentChange(true) clears the consent error; (false) does not re-clear', async () => {
      stubFetchOk()
      const { result } = renderHook(() =>
        useSurveyResponseForm({ surveyId: 'srv_test', identityFromToken: true }),
      )
      await waitFor(() => expect(result.current.loading).toBe(false))

      // Force a consent error.
      act(() => {
        result.current.handleAnswerChange('q_required', 'an answer')
      })
      act(() => {
        result.current.validate()
      })
      expect(result.current.fieldErrors.consent).toBe('Please confirm you agree before submitting.')

      act(() => {
        result.current.handleConsentChange(true)
      })
      expect(result.current.fieldErrors.consent).toBeUndefined()
    })

    it('handleMemberIdChange clears the memberId error once the value is non-empty', async () => {
      stubFetchOk()
      const { result } = renderHook(() =>
        useSurveyResponseForm({
          surveyId: 'srv_test',
          memberIdRequiredMessage: () => 'Your email is required.',
        }),
      )
      await waitFor(() => expect(result.current.loading).toBe(false))

      // Force a memberId error.
      act(() => {
        result.current.handleAnswerChange('q_required', 'an answer')
        result.current.handleConsentChange(true)
      })
      act(() => {
        result.current.validate()
      })
      expect(result.current.fieldErrors.memberId).toBe('Your email is required.')

      // Whitespace doesn't clear (the validator would still reject it).
      act(() => {
        result.current.handleMemberIdChange('   ')
      })
      expect(result.current.fieldErrors.memberId).toBe('Your email is required.')

      // Real value clears.
      act(() => {
        result.current.handleMemberIdChange('me@example.com')
      })
      expect(result.current.fieldErrors.memberId).toBeUndefined()
    })
  })

  it('falls back to a generic message when memberIdRequiredMessage is not supplied (public flow)', async () => {
    stubFetchOk()
    const { result } = renderHook(() =>
      useSurveyResponseForm({ surveyId: 'srv_test' }), // no memberIdRequiredMessage
    )
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.handleAnswerChange('q_required', 'an answer')
      result.current.handleConsentChange(true)
    })

    act(() => {
      result.current.validate()
    })

    expect(result.current.fieldErrors.memberId).toBe('This field is required.')
  })

  it('sets loadError when the survey fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({}),
      }),
    )
    const { result } = renderHook(() => useSurveyResponseForm({ surveyId: 'srv_test' }))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.survey).toBeNull()
    expect(result.current.loadError).toBe('Survey not found')
  })
})

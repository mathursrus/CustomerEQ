import { describe, it, expect, vi } from 'vitest'
import { buildMenuItems, type SurveyState } from './survey-row-menu.logic'

/**
 * Issue #241 Slice 3 — state-aware ⋯ row menu (spec §1).
 *
 * The menu items each have a `visible(state) → boolean` rule. The matrix below
 * captures the spec: for each survey state, exactly these items render.
 */

describe('SurveyRowMenu — state × visibility matrix', () => {
  const callApi = vi.fn(async () => new Response(null, { status: 204 }))
  const items = buildMenuItems(callApi)

  function visibleKeys(state: SurveyState): string[] {
    return items.filter((i) => i.visible(state)).map((i) => i.key)
  }

  it('DRAFT shows Duplicate + Discard draft only', () => {
    expect(visibleKeys('DRAFT').sort()).toEqual(['discard', 'duplicate'].sort())
  })

  it('ACTIVE shows Duplicate + Pause + Stop', () => {
    expect(visibleKeys('ACTIVE').sort()).toEqual(['duplicate', 'pause', 'stop'].sort())
  })

  it('PAUSED shows Duplicate + Stop (no Pause, no Restart yet — Stop first)', () => {
    expect(visibleKeys('PAUSED').sort()).toEqual(['duplicate', 'stop'].sort())
  })

  it('STOPPED shows Duplicate + Restart + Delete', () => {
    expect(visibleKeys('STOPPED').sort()).toEqual(['delete', 'duplicate', 'restart'].sort())
  })
})

describe('SurveyRowMenu — action paths', () => {
  function makeFakeApi() {
    const calls: Array<{ path: string; method?: string; body?: unknown }> = []
    const callApi = vi.fn(async (path: string, init?: { method?: string; body?: unknown }) => {
      calls.push({ path, method: init?.method, body: init?.body })
      return new Response(null, { status: 204 })
    })
    return { callApi, calls }
  }

  it('Duplicate calls POST /v1/surveys/:id/duplicate', async () => {
    const { callApi, calls } = makeFakeApi()
    const item = buildMenuItems(callApi).find((i) => i.key === 'duplicate')!
    await item.action('srv_abc')
    expect(calls).toEqual([{ path: '/v1/surveys/srv_abc/duplicate', method: 'POST', body: undefined }])
  })

  it('Pause calls PATCH /v1/surveys/:id/status with status:PAUSED', async () => {
    const { callApi, calls } = makeFakeApi()
    const item = buildMenuItems(callApi).find((i) => i.key === 'pause')!
    await item.action('srv_abc')
    expect(calls).toEqual([{ path: '/v1/surveys/srv_abc/status', method: 'PATCH', body: { status: 'PAUSED' } }])
  })

  it('Stop calls PATCH /v1/surveys/:id/status with status:STOPPED', async () => {
    const { callApi, calls } = makeFakeApi()
    const item = buildMenuItems(callApi).find((i) => i.key === 'stop')!
    await item.action('srv_abc')
    expect(calls).toEqual([{ path: '/v1/surveys/srv_abc/status', method: 'PATCH', body: { status: 'STOPPED' } }])
  })

  it('Restart calls PATCH /v1/surveys/:id/status with status:ACTIVE', async () => {
    const { callApi, calls } = makeFakeApi()
    const item = buildMenuItems(callApi).find((i) => i.key === 'restart')!
    await item.action('srv_abc')
    expect(calls).toEqual([{ path: '/v1/surveys/srv_abc/status', method: 'PATCH', body: { status: 'ACTIVE' } }])
  })

  it('Discard draft calls DELETE /v1/surveys/:id', async () => {
    const { callApi, calls } = makeFakeApi()
    const item = buildMenuItems(callApi).find((i) => i.key === 'discard')!
    await item.action('srv_abc')
    expect(calls).toEqual([{ path: '/v1/surveys/srv_abc', method: 'DELETE', body: undefined }])
  })

  it('Delete calls DELETE /v1/surveys/:id', async () => {
    const { callApi, calls } = makeFakeApi()
    const item = buildMenuItems(callApi).find((i) => i.key === 'delete')!
    await item.action('srv_abc')
    expect(calls).toEqual([{ path: '/v1/surveys/srv_abc', method: 'DELETE', body: undefined }])
  })

  it('Discard + Delete carry confirm prompts that include the survey name', () => {
    const { callApi } = makeFakeApi()
    const discard = buildMenuItems(callApi).find((i) => i.key === 'discard')!
    const del = buildMenuItems(callApi).find((i) => i.key === 'delete')!
    expect(discard.confirm).toBeDefined()
    expect(del.confirm).toBeDefined()
    expect(discard.confirm!('Q2 NPS')).toContain('Q2 NPS')
    expect(del.confirm!('Q2 NPS')).toContain('Q2 NPS')
  })

  it('Duplicate and lifecycle transitions do NOT prompt for confirm', () => {
    const { callApi } = makeFakeApi()
    const items = buildMenuItems(callApi).filter((i) => !['discard', 'delete'].includes(i.key))
    for (const it of items) expect(it.confirm).toBeUndefined()
  })
})

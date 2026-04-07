import { describe, it, expect } from 'vitest'
import { getTriggerRecommendation } from './triggerRecommendation.js'

describe('getTriggerRecommendation', () => {
  const VALID_TYPES = ['NPS', 'CSAT', 'CES', 'CUSTOM'] as const

  it('tier_upgrade → CSAT', () => {
    const r = getTriggerRecommendation('tier_upgrade')
    expect(r.type).toBe('CSAT')
    expect(r.rationale.length).toBeGreaterThan(10)
    expect(r.isDefault).toBeFalsy()
  })

  it('first_redemption → CSAT', () => {
    expect(getTriggerRecommendation('first_redemption').type).toBe('CSAT')
  })

  it('5th_purchase → CSAT', () => {
    expect(getTriggerRecommendation('5th_purchase').type).toBe('CSAT')
  })

  it('enrollment → CES', () => {
    expect(getTriggerRecommendation('enrollment').type).toBe('CES')
  })

  it('anniversary → NPS', () => {
    expect(getTriggerRecommendation('anniversary').type).toBe('NPS')
  })

  it('inactive_30d → NPS', () => {
    expect(getTriggerRecommendation('inactive_30d').type).toBe('NPS')
  })

  it('after_support → CES', () => {
    expect(getTriggerRecommendation('after_support').type).toBe('CES')
  })

  it('nps_drop → NPS', () => {
    expect(getTriggerRecommendation('nps_drop').type).toBe('NPS')
  })

  it('quarterly_pulse → NPS', () => {
    expect(getTriggerRecommendation('quarterly_pulse').type).toBe('NPS')
  })

  it('monthly_csat → CSAT', () => {
    expect(getTriggerRecommendation('monthly_csat').type).toBe('CSAT')
  })

  it('annual_program → NPS', () => {
    expect(getTriggerRecommendation('annual_program').type).toBe('NPS')
  })

  it('unknown key → NPS fallback with isDefault=true', () => {
    const r = getTriggerRecommendation('completely_unknown_key')
    expect(r.type).toBe('NPS')
    expect(r.isDefault).toBe(true)
    expect(r.rationale.length).toBeGreaterThan(10)
  })

  it('all 11 known keys return a valid type', () => {
    const keys = [
      'tier_upgrade', 'first_redemption', '5th_purchase', 'enrollment', 'anniversary',
      'inactive_30d', 'after_support', 'nps_drop', 'quarterly_pulse', 'monthly_csat', 'annual_program',
    ]
    for (const key of keys) {
      const r = getTriggerRecommendation(key)
      expect(VALID_TYPES).toContain(r.type)
      expect(r.rationale).toBeTruthy()
    }
  })

  it('all 11 known keys have isDefault falsy', () => {
    const keys = [
      'tier_upgrade', 'first_redemption', '5th_purchase', 'enrollment', 'anniversary',
      'inactive_30d', 'after_support', 'nps_drop', 'quarterly_pulse', 'monthly_csat', 'annual_program',
    ]
    for (const key of keys) {
      expect(getTriggerRecommendation(key).isDefault).toBeFalsy()
    }
  })

  it('empty string → fallback', () => {
    const r = getTriggerRecommendation('')
    expect(r.type).toBe('NPS')
    expect(r.isDefault).toBe(true)
  })
})

import { describe, it, expect } from 'vitest'
import { wizardReducer, type WizardState } from './program-wizard'

const EMPTY_STATE: WizardState = {
  step: 1,
  programType: null,
  name: '',
  description: '',
  startDate: '',
  endDate: '',
  currencyName: 'Stars',
  currencyCustom: '',
  earningRules: [],
  tiers: [],
  rewards: [],
  totalBudget: '',
  monthlyCap: '',
  alertThreshold: '80',
  haltBehavior: 'PAUSE_RULES',
  simBalance: 840,
  simResult: null,
}

const LOADED_STATE: WizardState = {
  ...EMPTY_STATE,
  programType: 'TIERED',
  name: 'Diamond Loyalty Club',
  description: 'A tiered loyalty program',
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  currencyName: 'Points',
  earningRules: [
    {
      id: 'rule-1',
      trigger: 'purchase',
      conditions: [],
      conditionLogic: 'AND',
      action: 'AWARD_POINTS',
      actionValue: '10',
      budgetCapPoints: '',
      priority: 1,
      stackable: false,
    },
  ],
  tiers: [
    {
      id: 'tier-1',
      name: 'Gold',
      icon: '🥇',
      minPoints: '1000',
      minSpend: '',
      multiplier: '2×',
      benefits: 'Free shipping',
    },
  ],
  rewards: [
    {
      id: 'reward-1',
      name: '$10 Off',
      description: 'Discount code',
      rewardType: 'Discount Code',
      pointsCost: '500',
      stock: 'UNLIMITED',
      stockQty: '',
      eligibleTiers: 'Gold',
      availability: 'ALWAYS',
      availFrom: '',
      availUntil: '',
    },
  ],
}

describe('wizardReducer', () => {
  describe('LOAD action', () => {
    it('replaces empty state with loaded program data', () => {
      const result = wizardReducer(EMPTY_STATE, {
        type: 'LOAD',
        state: LOADED_STATE,
      })

      expect(result.name).toBe('Diamond Loyalty Club')
      expect(result.programType).toBe('TIERED')
      expect(result.description).toBe('A tiered loyalty program')
      expect(result.startDate).toBe('2026-01-01')
      expect(result.endDate).toBe('2026-12-31')
      expect(result.currencyName).toBe('Points')
      expect(result.earningRules).toHaveLength(1)
      expect(result.earningRules[0].trigger).toBe('purchase')
      expect(result.tiers).toHaveLength(1)
      expect(result.tiers[0].name).toBe('Gold')
      expect(result.rewards).toHaveLength(1)
      expect(result.rewards[0].name).toBe('$10 Off')
    })

    it('overwrites stale state with fresh data', () => {
      const staleState: WizardState = {
        ...EMPTY_STATE,
        name: 'Old Program',
        programType: 'POINTS',
      }

      const result = wizardReducer(staleState, {
        type: 'LOAD',
        state: LOADED_STATE,
      })

      expect(result.name).toBe('Diamond Loyalty Club')
      expect(result.programType).toBe('TIERED')
    })

    it('preserves step position from loaded state', () => {
      const loadedWithStep: WizardState = { ...LOADED_STATE, step: 3 }
      const result = wizardReducer(EMPTY_STATE, {
        type: 'LOAD',
        state: loadedWithStep,
      })

      expect(result.step).toBe(3)
    })
  })
})

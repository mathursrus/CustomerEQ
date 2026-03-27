/**
 * Shared condition-evaluation logic used by both the API (simulate endpoint)
 * and the worker (earning-rule evaluation).
 */

export type ConditionGroup = {
  operator: 'AND' | 'OR'
  conditions: Array<{ field: string; op: string; value: unknown }>
}

/**
 * Evaluates a condition group (AND/OR logic) against an event payload.
 * Returns true when `conditions` is null or the conditions array is empty
 * (i.e. no restrictions — the rule always fires for any payload).
 */
export function evaluateConditions(
  conditions: ConditionGroup | null,
  payload: Record<string, unknown>,
): boolean {
  if (conditions === null) return true
  if (conditions.conditions.length === 0) return true

  const results = conditions.conditions.map((cond) => {
    const actual = payload[cond.field]
    if (actual === undefined) return false

    switch (cond.op) {
      case 'eq':  return actual === cond.value
      case 'ne':  return actual !== cond.value
      case 'gt':  return typeof actual === 'number' && typeof cond.value === 'number' && actual > cond.value
      case 'gte': return typeof actual === 'number' && typeof cond.value === 'number' && actual >= cond.value
      case 'lt':  return typeof actual === 'number' && typeof cond.value === 'number' && actual < cond.value
      case 'lte': return typeof actual === 'number' && typeof cond.value === 'number' && actual <= cond.value
      default:    return false
    }
  })

  return conditions.operator === 'AND' ? results.every(Boolean) : results.some(Boolean)
}

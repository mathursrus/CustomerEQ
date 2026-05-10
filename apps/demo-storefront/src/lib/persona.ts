'use client'

export interface Persona {
  email: string
  firstName: string
  lastName: string
  description: string
}

export const PERSONAS: Persona[] = [
  {
    email: 'alex.chen@starbrew.demo',
    firstName: 'Alex',
    lastName: 'Chen',
    description: 'Gold member — happy regular, 5 visits',
  },
  {
    email: 'maria.lopez@starbrew.demo',
    firstName: 'Maria',
    lastName: 'Lopez',
    description: 'Bronze member — brand new, 1 visit',
  },
  {
    email: 'james.park@starbrew.demo',
    firstName: 'James',
    lastName: 'Park',
    description: 'Platinum member — high-value, at-risk (45-day gap)',
  },
  {
    email: 'sara.kim@starbrew.demo',
    firstName: 'Sara',
    lastName: 'Kim',
    description: 'Bronze member — left a 2-star review (recovery target)',
  },
  {
    email: 'david.wu@starbrew.demo',
    firstName: 'David',
    lastName: 'Wu',
    description: 'Gold member — active redeemer, 4 visits',
  },
]

const PERSONA_KEY = 'ceq_demo_persona'

export function getPersonaEmail(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(PERSONA_KEY)
}

export function setPersonaEmail(email: string): void {
  localStorage.setItem(PERSONA_KEY, email)
  localStorage.removeItem('ceq_demo_cart')
  window.dispatchEvent(new Event('ceq_persona_changed'))
  window.dispatchEvent(new Event('ceq_cart_updated'))
}

export function getPersona(email: string | null): Persona | null {
  if (!email) return null
  return PERSONAS.find((p) => p.email === email) ?? null
}

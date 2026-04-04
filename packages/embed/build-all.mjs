#!/usr/bin/env node
/**
 * Build all embeddable web components sequentially.
 * Each component is built as a standalone IIFE bundle via Vite.
 */
import { execSync } from 'child_process'

const components = ['ceq-spin-wheel', 'ceq-support-chat']

for (const component of components) {
  console.log(`\nBuilding ${component}...`)
  execSync('npx vite build', {
    stdio: 'inherit',
    env: { ...process.env, EMBED_COMPONENT: component },
  })
}

console.log('\nAll embed components built successfully.')

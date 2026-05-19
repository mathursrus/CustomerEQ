import { spawnSync } from 'node:child_process'

const mode = process.argv[2]
const DEFAULT_AZURE_OPENAI_BASE_URL = 'https://sid-mj8313v0-eastus2.openai.azure.com/openai/v1'

if (!['smoke', 'all'].includes(mode)) {
  console.error('Usage: node scripts/test-suite-runner.mjs <smoke|all>')
  process.exit(1)
}

const buildPrereqs = [
  '@customerEQ/shared',
  '@customerEQ/connectors',
  '@customerEQ/consent-text',
  '@customerEQ/database',
  '@customerEQ/ui',
  '@customerEQ/mcp-server',
  '@customerEQ/ai',
]

const smokeSuites = [
  { name: 'api-unit', command: 'pnpm --filter @customerEQ/api test -- src/routes/healthz.test.ts' },
  {
    name: 'api-integration',
    command:
      'pnpm --filter @customerEQ/api exec vitest run --config vitest.integration.config.ts --reporter=verbose test/integration/public-survey.test.ts',
  },
  { name: 'web-unit', command: 'pnpm --filter @customerEQ/web test -- src/components/survey-form/SurveyFormRenderer.test.tsx' },
  {
    name: 'web-e2e',
    command: 'pnpm --filter @customerEQ/web exec playwright test test/e2e/demo-request.spec.ts',
  },
  {
    name: 'demo-storefront-e2e',
    command: 'pnpm --filter @customerEQ/demo-storefront exec playwright test test/e2e/checkout.spec.ts',
  },
  { name: 'worker-unit', command: 'pnpm --filter @customerEQ/worker test -- src/processors/loyaltyEvents.test.ts' },
  { name: 'mcp-server-unit', command: 'pnpm --filter @customerEQ/mcp-server test -- src/api-client.test.ts' },
  { name: 'ai-unit', command: 'pnpm --filter @customerEQ/ai test -- src/analysis/sentiment.test.ts' },
  // ai-baml-evals moved to nightly-regression.yml (#428) — no LLM calls in smoke path.
  { name: 'connectors-unit', command: 'pnpm --filter @customerEQ/connectors test -- src/google.test.ts' },
  { name: 'consent-text-unit', command: 'pnpm --filter @customerEQ/consent-text test -- src/validator.test.ts' },
  { name: 'database-unit', command: 'pnpm --filter @customerEQ/database test -- src/middleware/tenantScope.test.ts' },
  { name: 'shared-unit', command: 'pnpm --filter @customerEQ/shared test -- src/random.test.ts' },
  { name: 'ui-unit', command: 'pnpm --filter @customerEQ/ui test -- src/utils.test.ts' },
]

const allSuites = [
  { name: 'api-unit', command: 'pnpm --filter @customerEQ/api test' },
  { name: 'api-integration', command: 'pnpm --filter @customerEQ/api test:integration' },
  { name: 'web-unit', command: 'pnpm --filter @customerEQ/web test' },
  { name: 'web-e2e', command: 'pnpm --filter @customerEQ/web test:e2e' },
  { name: 'demo-storefront-e2e', command: 'pnpm --filter @customerEQ/demo-storefront test:e2e' },
  { name: 'worker-unit', command: 'pnpm --filter @customerEQ/worker test' },
  { name: 'mcp-server-unit', command: 'pnpm --filter @customerEQ/mcp-server test' },
  { name: 'ai-unit', command: 'pnpm --filter @customerEQ/ai test' },
  {
    name: 'ai-baml-evals',
    command:
      'pnpm --filter @customerEQ/ai run generate && pnpm --filter @customerEQ/ai exec vitest run --config vitest.eval.config.ts --reporter=verbose',
    env: { AZURE_OPENAI_BASE_URL: process.env.AZURE_OPENAI_BASE_URL || DEFAULT_AZURE_OPENAI_BASE_URL },
  },
  { name: 'connectors-unit', command: 'pnpm --filter @customerEQ/connectors test' },
  { name: 'consent-text-unit', command: 'pnpm --filter @customerEQ/consent-text test' },
  { name: 'database-unit', command: 'pnpm --filter @customerEQ/database test' },
  { name: 'shared-unit', command: 'pnpm --filter @customerEQ/shared test' },
  { name: 'ui-unit', command: 'pnpm --filter @customerEQ/ui test' },
]

function run(command, label, extraEnv = {}) {
  console.log(`\n==> ${label}`)

  const result = spawnSync(command, {
    cwd: process.cwd(),
    shell: true,
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

for (const pkg of buildPrereqs) {
  run(`pnpm --filter ${pkg} build`, `build prerequisite: ${pkg}`)
}

run('pnpm db:migrate', 'apply database migrations')

const suites = mode === 'smoke' ? smokeSuites : allSuites

for (const suite of suites) {
  run(suite.command, `run ${suite.name}`, suite.env)
}

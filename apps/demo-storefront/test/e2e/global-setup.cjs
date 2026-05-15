const { execSync } = require('node:child_process')
const path = require('node:path')

const repoRoot = path.resolve(__dirname, '../../../..')

module.exports = async function globalSetup() {
  execSync('pnpm exec tsx scripts/setup-dev-brand.ts', {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env,
  })

  execSync('pnpm exec tsx scripts/seed-demo.ts', {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env,
  })
}

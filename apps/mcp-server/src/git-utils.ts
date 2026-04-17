import { execSync } from 'node:child_process'

function parseIssueNumber(branchName: string): number | null {
  const issueMatch =
    branchName.match(/issue-(\d+)/i) ??
    branchName.match(/feature\/issue-(\d+)/i) ??
    branchName.match(/(\d+)-/)

  return issueMatch ? Number.parseInt(issueMatch[1], 10) : null
}

export function getCurrentGitBranch(): string {
  const branchName =
    process.env.FRAIM_BRANCH ||
    process.env.FRAIM_BRANCH_NAME ||
    process.env.GITHUB_HEAD_REF ||
    process.env.GITHUB_REF?.replace('refs/heads/', '') ||
    process.env.BRANCH_NAME ||
    process.env.GIT_BRANCH

  if (branchName) {
    return branchName
  }

  try {
    return execSync('git rev-parse --abbrev-ref HEAD', {
      timeout: 2000,
      stdio: 'pipe',
    }).toString().trim()
  } catch {
    return 'main'
  }
}

export function getPort(): number {
  const issueNumber = parseIssueNumber(getCurrentGitBranch())
  if (issueNumber !== null) {
    return 10000 + (issueNumber % 55535)
  }

  return Number(process.env.PORT) ||
    Number(process.env.WEBSITES_PORT) ||
    Number(process.env.FRAIM_MCP_PORT) ||
    Number(process.env.API_PORT) ||
    15302
}

export function determineDatabaseName(): string {
  const issueNumber = parseIssueNumber(getCurrentGitBranch())
  if (issueNumber !== null) {
    return `customereq_issue_${issueNumber}`
  }

  return process.env.POSTGRES_DB ||
    process.env.MONGODB_DB_NAME ||
    (process.env.NODE_ENV === 'production' ? 'customereq_prod' : 'customereq_dev')
}

export function getLocalApiBaseUrl(): string {
  return `http://localhost:${getPort()}`
}

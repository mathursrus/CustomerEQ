#!/usr/bin/env node
// Writes a per-deploy CD metrics table to $GITHUB_STEP_SUMMARY.
// Called as the final step of the build-and-deploy job in deploy.yml.
import { execSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

const SUMMARY_FILE = process.env.GITHUB_STEP_SUMMARY;
const REPO         = process.env.GITHUB_REPOSITORY;
const RUN_ID       = process.env.GITHUB_RUN_ID;
const DEPLOY_SHA   = process.env.DEPLOY_SHA; // head_sha that was deployed

if (!SUMMARY_FILE || !REPO || !RUN_ID) {
  console.log('Not in GitHub Actions context — skipping summary.');
  process.exit(0);
}

function ghApi(path) {
  return JSON.parse(execSync(`gh api "${path}"`, { encoding: 'utf8' }));
}

function durSec(startedAt, completedAt) {
  if (!startedAt || !completedAt || startedAt === '0001-01-01T00:00:00Z') return null;
  return Math.round((new Date(completedAt) - new Date(startedAt)) / 1000);
}

function fmt(sec) {
  if (sec === null || sec === undefined) return '—';
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

const jobs = ghApi(`repos/${REPO}/actions/runs/${RUN_ID}/jobs`).jobs;
const deployJob = jobs.find(j => j.name === 'build-and-deploy');

if (!deployJob) {
  console.log('build-and-deploy job not found — skipping summary.');
  process.exit(0);
}

// Total CD wall clock: from job start to now (completed_at may be null as this is the last step)
const cdTotal = deployJob.completed_at
  ? durSec(deployJob.started_at, deployJob.completed_at)
  : Math.round((Date.now() - new Date(deployJob.started_at)) / 1000);

const P90_THRESHOLD_S = 25 * 60; // 25m CD P90 threshold (to be refined with data)
const cdFlag = cdTotal > P90_THRESHOLD_S ? ' ⚠️ exceeds P90' : '';

// Phase groupings — sum durations across related steps
const PHASE_STEPS = {
  'Image builds':     ['Build and push API image', 'Build and push Worker image', 'Build and push Web image', 'Build and push Demo Storefront image', 'Build and push Turbo Cache image'],
  'Migration':        ['Run database migrations'],
  'Container deploy': ['Deploy API', 'Set API non-secret env vars', 'Deploy Worker', 'Deploy Web', 'Deploy Demo Storefront', 'Deploy Turbo Cache'],
  'Verification':     ['Verify deployed image SHAs', 'Verify API health', 'Canary API checks'],
};

function sumSteps(stepNames) {
  let total = 0;
  let found = false;
  for (const name of stepNames) {
    const step = deployJob.steps?.find(s => s.name.startsWith(name));
    if (step && step.conclusion !== 'skipped') {
      const d = durSec(step.started_at, step.completed_at);
      if (d !== null) { total += d; found = true; }
    }
  }
  return found ? total : null;
}

// Attempt to compute time-from-merge-to-live using the deployed SHA
let mergeToLive = null;
if (DEPLOY_SHA) {
  try {
    // Find the PR that was merged at this SHA
    const prs = ghApi(`repos/${REPO}/pulls?state=closed&per_page=10`);
    const pr = prs.find(p => p.merge_commit_sha === DEPLOY_SHA || p.head?.sha === DEPLOY_SHA);
    if (pr?.merged_at && deployJob.completed_at) {
      mergeToLive = durSec(pr.merged_at, deployJob.completed_at);
    }
  } catch {
    // Non-fatal: SHA correlation is best-effort
  }
}

const deployConclusion = deployJob.conclusion;
const runIcon = deployConclusion === 'failure' ? '❌' : deployConclusion === 'success' ? '✅' : '🔄';
const ts = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

const phaseRows = Object.entries(PHASE_STEPS).map(([phase, steps]) => {
  const dur = sumSteps(steps);
  return `| ${phase} | ${fmt(dur)} |`;
});

const lines = [
  `## CD Metrics — ${ts} ${runIcon}`,
  '',
  `| | Duration |`,
  `|--|----------|`,
  `| **Total CD wall clock** | **${fmt(cdTotal)}${cdFlag}** |`,
  mergeToLive !== null ? `| Merge → production live | ${fmt(mergeToLive)} |` : null,
  '',
  '### Phase breakdown',
  '',
  '| Phase | Duration |',
  '|-------|----------|',
  ...phaseRows,
  '',
  `_P90 alert threshold: 25m — [30-day trend](../docs/cd-metrics.md)_`,
  '',
].filter(l => l !== null);

appendFileSync(SUMMARY_FILE, lines.join('\n') + '\n');
console.log(`CD run summary written — total: ${fmt(cdTotal)}${cdFlag}${mergeToLive !== null ? `, merge→live: ${fmt(mergeToLive)}` : ''}`);

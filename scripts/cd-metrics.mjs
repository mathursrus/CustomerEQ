#!/usr/bin/env node
// Nightly CD metrics trend report generator.
// Reads the last 30 days of Deploy workflow runs via the GitHub Actions API,
// computes P50/P90 wall clocks, phase breakdowns, and success rates,
// then writes docs/cd-metrics.md with ⚠️ flags for threshold breaches.
//
// Called by .github/workflows/cd-metrics.yml on a daily schedule.
import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO   = process.env.GITHUB_REPOSITORY ?? 'mathursrus/CustomerEQ';
const OUT    = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'cd-metrics.md');
const DAYS   = 30;
const SINCE  = new Date(Date.now() - DAYS * 864e5).toISOString();

const P90_THRESHOLD_S    = 25 * 60; // 25m CD wall clock
const TTL_THRESHOLD_S    = 30 * 60; // 30m merge-to-live

function ghApi(path) {
  return JSON.parse(execSync(`gh api --paginate "${path}"`, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }));
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

function percentile(sorted, p) {
  if (!sorted.length) return null;
  return sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)];
}

function flag(condition) { return condition ? ' ⚠️' : ''; }
function statusIcon(ok) { return ok ? '✅' : '⚠️'; }

const PHASE_STEPS = {
  imageBuilds:   ['Build and push API image', 'Build and push Worker image', 'Build and push Web image', 'Build and push Demo Storefront image', 'Build and push Turbo Cache image'],
  migration:     ['Run database migrations'],
  containerDeploy: ['Deploy API', 'Set API non-secret env vars', 'Deploy Worker', 'Deploy Web', 'Deploy Demo Storefront', 'Deploy Turbo Cache'],
  verification:  ['Verify deployed image SHAs', 'Verify API health', 'Canary API checks'],
};

function sumPhase(steps, phaseStepNames) {
  let total = 0; let found = false;
  for (const name of phaseStepNames) {
    const step = steps?.find(s => s.name.startsWith(name));
    if (step && step.conclusion !== 'skipped') {
      const d = durSec(step.started_at, step.completed_at);
      if (d !== null) { total += d; found = true; }
    }
  }
  return found ? total : null;
}

// ── 1. Fetch deploy runs ──────────────────────────────────────────────────────
console.log(`Fetching CD runs since ${SINCE}…`);
const runsRaw = ghApi(
  `repos/${REPO}/actions/workflows/deploy.yml/runs?per_page=100&created=>=${SINCE}`
);
const runs = (runsRaw.workflow_runs ?? runsRaw).filter(r => r.status === 'completed');
console.log(`Found ${runs.length} completed CD runs.`);

if (!runs.length) {
  console.log('No runs found — skipping report.');
  process.exit(0);
}

// Fetch closed PRs once for SHA correlation (merge-to-live metric)
let closedPRs = [];
try {
  closedPRs = ghApi(`repos/${REPO}/pulls?state=closed&per_page=100`);
} catch { /* non-fatal */ }

// ── 2. Fetch job details ──────────────────────────────────────────────────────
const runData = [];

for (let i = 0; i < runs.length; i++) {
  const run = runs[i];
  if (i % 10 === 0) console.log(`  Processing run ${i + 1}/${runs.length}…`);

  let deployJob;
  try {
    const jobs = ghApi(`repos/${REPO}/actions/runs/${run.id}/jobs`).jobs ?? [];
    deployJob = jobs.find(j => j.name === 'build-and-deploy');
  } catch { continue; }

  if (!deployJob) continue;

  const cdTotal = durSec(deployJob.started_at, deployJob.completed_at);
  const steps   = deployJob.steps ?? [];

  const phases = {
    imageBuilds:     sumPhase(steps, PHASE_STEPS.imageBuilds),
    migration:       sumPhase(steps, PHASE_STEPS.migration),
    containerDeploy: sumPhase(steps, PHASE_STEPS.containerDeploy),
    verification:    sumPhase(steps, PHASE_STEPS.verification),
  };

  // Merge-to-live: correlate head SHA to closed PR merge time
  const headSha = run.head_sha;
  let mergeToLive = null;
  if (headSha && deployJob.completed_at) {
    const pr = closedPRs.find(p => p.merge_commit_sha === headSha || p.head?.sha === headSha);
    if (pr?.merged_at) {
      mergeToLive = durSec(pr.merged_at, deployJob.completed_at);
    }
  }

  runData.push({
    id: run.id,
    date: run.created_at,
    trigger: run.event === 'workflow_run' ? 'auto' : 'manual',
    conclusion: run.conclusion,
    cdTotal,
    phases,
    mergeToLive,
    url: run.html_url,
  });
}

// ── 3. Compute stats ──────────────────────────────────────────────────────────
const valid = runData.filter(r => r.cdTotal !== null);
const cdTimes = valid.map(r => r.cdTotal).sort((a, b) => a - b);
const ttlTimes = valid.map(r => r.mergeToLive).filter(v => v !== null && v > 0).sort((a, b) => a - b);

const p50 = percentile(cdTimes, 0.50);
const p90 = percentile(cdTimes, 0.90);
const ttlP50 = percentile(ttlTimes, 0.50);
const ttlP90 = percentile(ttlTimes, 0.90);

const last7Days = new Date(Date.now() - 7 * 864e5);
const recent = valid.filter(r => new Date(r.date) >= last7Days);
const successRate = recent.length
  ? recent.filter(r => r.conclusion === 'success').length / recent.length
  : null;

const phaseKeys = ['imageBuilds', 'migration', 'containerDeploy', 'verification'];
const phaseLabels = { imageBuilds: 'Image builds', migration: 'Migration', containerDeploy: 'Container deploy', verification: 'Verification' };
const phaseAvgs = {};
for (const key of phaseKeys) {
  const vals = valid.map(r => r.phases[key]).filter(v => v !== null);
  phaseAvgs[key] = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
}

// ── 4. Render markdown ────────────────────────────────────────────────────────
const ts = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
const last20 = [...runData].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 20);

const reportLines = [
  `# CD Pipeline Metrics`,
  ``,
  `_Last updated: ${ts} by the [cd-metrics workflow](../.github/workflows/cd-metrics.yml)_`,
  ``,
  `## 30-Day Summary`,
  ``,
  `| Metric | Value | Status |`,
  `|--------|-------|--------|`,
  `| CD P50 wall clock | ${fmt(p50)} | ${statusIcon(p50 === null || p50 <= P90_THRESHOLD_S)} |`,
  `| CD P90 wall clock | ${fmt(p90)}${flag(p90 !== null && p90 > P90_THRESHOLD_S)} | ${statusIcon(p90 === null || p90 <= P90_THRESHOLD_S)} |`,
  `| Merge → live P50 | ${fmt(ttlP50)} | ${statusIcon(ttlP50 === null || ttlP50 <= TTL_THRESHOLD_S)} |`,
  `| Merge → live P90 | ${fmt(ttlP90)}${flag(ttlP90 !== null && ttlP90 > TTL_THRESHOLD_S)} | ${statusIcon(ttlP90 === null || ttlP90 <= TTL_THRESHOLD_S)} |`,
  `| CD success rate (7d) | ${successRate !== null ? (successRate * 100).toFixed(0) + '%' : '—'}${flag(successRate !== null && successRate < 0.99)} | ${statusIcon(successRate === null || successRate >= 0.99)} |`,
  `| Deploys analysed (${DAYS}d) | ${valid.length} | — |`,
  ``,
  `> ⚠️ = threshold breached. P90 alert: >25m · Any failure alerts immediately · Merge→live >30m.`,
  ``,
  `## Phase Breakdown (avg, last ${DAYS} days)`,
  ``,
  `| Phase | Avg Duration |`,
  `|-------|-------------|`,
  ...phaseKeys.map(k => `| ${phaseLabels[k]} | ${fmt(phaseAvgs[k])} |`),
  ``,
  `## Last 20 Deploys`,
  ``,
  `| Date (UTC) | Trigger | Total | Merge→Live | Outcome |`,
  `|------------|---------|-------|------------|---------|`,
  ...last20.map(r => {
    const d = r.date.replace('T', ' ').slice(0, 16);
    const icon = r.conclusion === 'success' ? '✅' : r.conclusion === 'failure' ? '❌' : '⏭️';
    const totalStr = r.cdTotal !== null ? fmt(r.cdTotal) + (r.cdTotal > P90_THRESHOLD_S ? ' ⚠️' : '') : '—';
    const ttlStr = r.mergeToLive !== null ? fmt(r.mergeToLive) + (r.mergeToLive > TTL_THRESHOLD_S ? ' ⚠️' : '') : '—';
    return `| [${d}](${r.url}) | ${r.trigger} | ${totalStr} | ${ttlStr} | ${icon} |`;
  }),
  ``,
];

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, reportLines.join('\n') + '\n');
console.log(`Report written to ${OUT}`);
console.log(`  P50: ${fmt(p50)}  P90: ${fmt(p90)}  Merge→live P50: ${fmt(ttlP50)}`);

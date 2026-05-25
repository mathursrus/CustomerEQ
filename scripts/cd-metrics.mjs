#!/usr/bin/env node
// Nightly CD metrics trend report generator.
// On the first run (or after schema changes) fetches the full 30-day window.
// On subsequent runs reads docs/cd-metrics.json and fetches only new runs
// since the last recorded date, then merges and trims to 30 days.
//
// Called by .github/workflows/cd-metrics.yml on a daily schedule.
import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO     = process.env.GITHUB_REPOSITORY ?? 'mathursrus/CustomerEQ';
const __dir    = dirname(fileURLToPath(import.meta.url));
const OUT      = join(__dir, '..', 'docs', 'cd-metrics.md');
const OUT_JSON = join(__dir, '..', 'docs', 'cd-metrics.json');
const DAYS     = 30;
const CUTOFF   = new Date(Date.now() - DAYS * 864e5);

const P90_THRESHOLD_S = 25 * 60;
const TTL_THRESHOLD_S = 30 * 60;

const PHASE_STEPS = {
  imageBuilds:     ['Build and push API image', 'Build and push Worker image', 'Build and push Web image', 'Build and push Demo Storefront image', 'Build and push Turbo Cache image'],
  migration:       ['Run database migrations'],
  containerDeploy: ['Deploy API', 'Set API non-secret env vars', 'Deploy Worker', 'Deploy Web', 'Deploy Demo Storefront', 'Deploy Turbo Cache'],
  verification:    ['Verify deployed image SHAs', 'Verify API health', 'Canary API checks'],
};

// Single-page API call with retries. No --paginate.
async function ghApi(path, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const raw = execSync(`gh api "${path}"`, {
        encoding: 'utf8',
        maxBuffer: 20 * 1024 * 1024,
      });
      return JSON.parse(raw);
    } catch (err) {
      if (attempt === retries) throw err;
      const delay = attempt * 5000;
      console.warn(`  Attempt ${attempt}/${retries} failed, retrying in ${delay / 1000}s: ${err.message.split('\n')[0]}`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

// Manually paginate workflow runs, stopping when we go past sinceDate.
async function fetchWorkflowRuns(workflow, sinceDate) {
  const results = [];
  let page = 1;
  while (true) {
    const res = await ghApi(`repos/${REPO}/actions/workflows/${workflow}/runs?per_page=100&page=${page}`);
    const batch = res.workflow_runs ?? res;
    if (!batch.length) break;

    let reachedCutoff = false;
    for (const run of batch) {
      if (new Date(run.created_at) < sinceDate) { reachedCutoff = true; break; }
      if (run.status === 'completed') results.push(run);
    }
    if (reachedCutoff) break;
    page++;
  }
  return results;
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

function flag(cond) { return cond ? ' ⚠️' : ''; }
function statusIcon(ok) { return ok ? '✅' : '⚠️'; }

function sumPhase(steps, phaseStepNames) {
  let total = 0, found = false;
  for (const name of phaseStepNames) {
    const step = steps?.find(s => s.name.startsWith(name));
    if (step && step.conclusion !== 'skipped') {
      const d = durSec(step.started_at, step.completed_at);
      if (d !== null) { total += d; found = true; }
    }
  }
  return found ? total : null;
}

// ── 1. Load existing data, determine fetch window ─────────────────────────────
let existingRuns = [];
let since = CUTOFF;

if (existsSync(OUT_JSON)) {
  try {
    const stored = JSON.parse(readFileSync(OUT_JSON, 'utf8'));
    const withinWindow = (stored.runs ?? []).filter(r => new Date(r.date) >= CUTOFF);
    if (withinWindow.length > 0 && withinWindow[0].id) {
      existingRuns = withinWindow;
      const latest = existingRuns.reduce((max, r) => r.date > max ? r.date : max, '');
      if (latest) since = new Date(latest);
      console.log(`Incremental: ${existingRuns.length} cached runs, fetching since ${since.toISOString()}`);
    } else {
      console.log(`Full fetch: cached data lacks run IDs (schema migration), fetching full ${DAYS} days`);
    }
  } catch (e) {
    console.warn(`Could not read ${OUT_JSON}: ${e.message} — fetching full ${DAYS} days`);
  }
} else {
  console.log(`Full fetch: no prior data, fetching since ${since.toISOString()}`);
}

// ── 2. Fetch new deploy runs ──────────────────────────────────────────────────
const newRuns = await fetchWorkflowRuns('deploy.yml', since);
console.log(`Found ${newRuns.length} completed CD runs since ${since.toISOString()}`);

// ── 3. Fetch recent closed PRs for merge-to-live correlation (single page) ───
let closedPRs = [];
try {
  closedPRs = (await ghApi(`repos/${REPO}/pulls?state=closed&per_page=100`)) ?? [];
} catch { /* non-fatal — mergeToLive will be null */ }

// ── 4. Fetch job details for new runs not already cached ─────────────────────
const existingIds = new Set(existingRuns.map(r => r.id));
const newRunData  = [];

for (let i = 0; i < newRuns.length; i++) {
  const run = newRuns[i];
  if (existingIds.has(run.id)) continue;
  if (i % 10 === 0) console.log(`  Processing run ${i + 1}/${newRuns.length}…`);

  let deployJob;
  try {
    const jobsRes = await ghApi(`repos/${REPO}/actions/runs/${run.id}/jobs`);
    deployJob = (jobsRes.jobs ?? jobsRes).find(j => j.name === 'build-and-deploy');
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

  const headSha = run.head_sha;
  let mergeToLive = null;
  if (headSha && deployJob.completed_at) {
    const pr = closedPRs.find(p => p.merge_commit_sha === headSha || p.head?.sha === headSha);
    if (pr?.merged_at) mergeToLive = durSec(pr.merged_at, deployJob.completed_at);
  }

  newRunData.push({
    id:          run.id,
    date:        run.created_at,
    trigger:     run.event === 'workflow_run' ? 'auto' : 'manual',
    conclusion:  run.conclusion,
    cdTotal,
    phases,
    mergeToLive,
    url:         run.html_url,
  });
}

// ── 5. Merge, deduplicate, trim to 30-day window ──────────────────────────────
const seen    = new Set();
const allRuns = [...existingRuns, ...newRunData]
  .filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; })
  .filter(r => new Date(r.date) >= CUTOFF)
  .sort((a, b) => new Date(a.date) - new Date(b.date));

console.log(`Total runs in 30d window: ${allRuns.length} (${newRunData.length} new)`);

// ── 6. Compute stats ──────────────────────────────────────────────────────────
const valid    = allRuns.filter(r => r.cdTotal !== null);
const cdTimes  = valid.map(r => r.cdTotal).sort((a, b) => a - b);
const ttlTimes = valid.map(r => r.mergeToLive).filter(v => v !== null && v > 0).sort((a, b) => a - b);

const p50    = percentile(cdTimes, 0.50);
const p90    = percentile(cdTimes, 0.90);
const ttlP50 = percentile(ttlTimes, 0.50);
const ttlP90 = percentile(ttlTimes, 0.90);

const last7Days   = new Date(Date.now() - 7 * 864e5);
const recent      = valid.filter(r => new Date(r.date) >= last7Days);
const successRate = recent.length
  ? recent.filter(r => r.conclusion === 'success').length / recent.length
  : null;

const phaseKeys   = ['imageBuilds', 'migration', 'containerDeploy', 'verification'];
const phaseLabels = { imageBuilds: 'Image builds', migration: 'Migration', containerDeploy: 'Container deploy', verification: 'Verification' };
const phaseAvgs   = {};
for (const key of phaseKeys) {
  const vals = valid.map(r => r.phases?.[key]).filter(v => v != null);
  phaseAvgs[key] = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
}

// ── 7. Render markdown ────────────────────────────────────────────────────────
const ts     = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
const last20 = [...allRuns].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 20);

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
    const d       = r.date.replace('T', ' ').slice(0, 16);
    const icon    = r.conclusion === 'success' ? '✅' : r.conclusion === 'failure' ? '❌' : '⏭️';
    const totalStr = r.cdTotal !== null ? fmt(r.cdTotal) + (r.cdTotal > P90_THRESHOLD_S ? ' ⚠️' : '') : '—';
    const ttlStr   = r.mergeToLive !== null ? fmt(r.mergeToLive) + (r.mergeToLive > TTL_THRESHOLD_S ? ' ⚠️' : '') : '—';
    return `| [${d}](${r.url}) | ${r.trigger} | ${totalStr} | ${ttlStr} | ${icon} |`;
  }),
  ``,
];

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, reportLines.join('\n') + '\n');
console.log(`Report written to ${OUT}`);
console.log(`  P50: ${fmt(p50)}  P90: ${fmt(p90)}  Merge→live P50: ${fmt(ttlP50)}`);

// ── 8. Write JSON (includes id + phases for incremental deduplication) ────────
const jsonOut = {
  generatedAt:   new Date().toISOString(),
  thresholdS:    P90_THRESHOLD_S,
  ttlThresholdS: TTL_THRESHOLD_S,
  summary:       { p50, p90, ttlP50, ttlP90, successRate7d: successRate, totalRuns30d: valid.length },
  phaseAvgs,
  runs: allRuns.map(r => ({
    id: r.id, date: r.date, cdTotal: r.cdTotal, mergeToLive: r.mergeToLive,
    conclusion: r.conclusion, trigger: r.trigger, url: r.url, phases: r.phases,
  })),
};
writeFileSync(OUT_JSON, JSON.stringify(jsonOut));
console.log(`JSON written to ${OUT_JSON}`);

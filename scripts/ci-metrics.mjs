#!/usr/bin/env node
// Nightly CI metrics trend report generator.
// On the first run (or after schema changes) fetches the full 30-day window.
// On subsequent runs reads docs/ci-metrics.json and fetches only new runs
// since the last recorded date, then merges and trims to 30 days.
//
// Called by .github/workflows/ci-metrics.yml on a daily schedule.
// Requires: GH_TOKEN env var (provided automatically in Actions jobs).
import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO     = process.env.GITHUB_REPOSITORY ?? 'mathursrus/CustomerEQ';
const __dir    = dirname(fileURLToPath(import.meta.url));
const OUT      = join(__dir, '..', 'docs', 'ci-cd-metrics.md');
const OUT_JSON = join(__dir, '..', 'docs', 'ci-metrics.json');
const DAYS     = 30;
const CUTOFF   = new Date(Date.now() - DAYS * 864e5);

const P90_THRESHOLD_S    = 14 * 60;
const FAILURE_RATE_LIMIT = 0.10;

const STEP_KEYS = {
  'Build':                         'build',
  'Verify BAML module resolution':  'bamlProbe',
  'Type check':                     'typecheck',
  'Smoke Test Suite':               'smoke',
  'Run migrations':                 'migrations',
};

async function ghApi(path, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const raw = execSync(`gh api --paginate "${path}"`, {
        encoding: 'utf8',
        maxBuffer: 20 * 1024 * 1024,
      });
      try {
        return JSON.parse(raw);
      } catch {
        const pages = [];
        let depth = 0, start = -1;
        for (let i = 0; i < raw.length; i++) {
          const c = raw[i];
          if (c === '{' || c === '[') { if (depth++ === 0) start = i; }
          else if (c === '}' || c === ']') {
            if (--depth === 0 && start !== -1) { pages.push(JSON.parse(raw.slice(start, i + 1))); start = -1; }
          }
        }
        if (!pages.length) throw new Error(`unparseable output for: ${path}`);
        if (Array.isArray(pages[0])) return pages.flat();
        const arrayKey = Object.keys(pages[0]).find(k => Array.isArray(pages[0][k]));
        return arrayKey ? { ...pages[0], [arrayKey]: pages.flatMap(p => p[arrayKey] ?? []) } : pages[0];
      }
    } catch (err) {
      if (attempt === retries) throw err;
      const delay = attempt * 5000;
      console.warn(`  Attempt ${attempt}/${retries} failed, retrying in ${delay / 1000}s: ${err.message.split('\n')[0]}`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
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
  const idx = Math.ceil(p * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function flag(cond) { return cond ? ' ⚠️' : ''; }
function statusIcon(ok) { return ok ? '✅' : '⚠️'; }

// ── 1. Load existing data, determine fetch window ─────────────────────────────
let existingRuns = [];
let since = CUTOFF.toISOString();

if (existsSync(OUT_JSON)) {
  try {
    const stored = JSON.parse(readFileSync(OUT_JSON, 'utf8'));
    const withinWindow = (stored.runs ?? []).filter(r => new Date(r.date) >= CUTOFF);
    // Only use incremental if stored runs have `id` (post-migration schema).
    // Without id we can't deduplicate, so fall back to a full fetch.
    if (withinWindow.length > 0 && withinWindow[0].id) {
      existingRuns = withinWindow;
      const latest = existingRuns.reduce((max, r) => r.date > max ? r.date : max, '');
      since = latest || since;
      console.log(`Incremental: ${existingRuns.length} cached runs, fetching since ${since}`);
    } else {
      console.log(`Full fetch: cached data lacks run IDs (schema migration), fetching full ${DAYS} days`);
    }
  } catch (e) {
    console.warn(`Could not read ${OUT_JSON}: ${e.message} — fetching full ${DAYS} days`);
  }
} else {
  console.log(`Full fetch: no prior data, fetching since ${since}`);
}

// ── 2. Fetch new runs from GitHub ─────────────────────────────────────────────
const runsRaw  = await ghApi(`repos/${REPO}/actions/workflows/ci.yml/runs?per_page=100&created=>=${since}`);
const newRuns  = (runsRaw.workflow_runs ?? runsRaw).filter(r => r.status === 'completed');
console.log(`Found ${newRuns.length} completed runs since ${since}`);

// ── 3. Fetch job details for runs not already in cache ────────────────────────
const existingIds = new Set(existingRuns.map(r => r.id));
const newRunData  = [];

for (let i = 0; i < newRuns.length; i++) {
  const run = newRuns[i];
  if (existingIds.has(run.id)) continue;
  if (i % 10 === 0) console.log(`  Processing run ${i + 1}/${newRuns.length}…`);

  let btJob, lintJob;
  try {
    const jobsRes = await ghApi(`repos/${REPO}/actions/runs/${run.id}/jobs`);
    const jobs = jobsRes.jobs ?? jobsRes;
    btJob   = jobs.find(j => j.name === 'Build & Test');
    lintJob = jobs.find(j => j.name === 'Lint');
  } catch {
    continue;
  }

  const btTotal   = btJob   ? durSec(btJob.started_at,   btJob.completed_at)   : null;
  const lintTotal = lintJob ? durSec(lintJob.started_at, lintJob.completed_at) : null;

  const steps = {};
  if (btJob) {
    for (const [prefix, key] of Object.entries(STEP_KEYS)) {
      const step = btJob.steps?.find(s => s.name.startsWith(prefix));
      steps[key] = step ? durSec(step.started_at, step.completed_at) : null;
    }
  }

  const INFRA_STEPS = new Set(['Set up job','Checkout','Determine if CI is needed','Skip if doc-only','Initialize containers','Stop containers','Complete job']);
  const docOnly = btJob?.steps?.every(s => s.conclusion === 'skipped' || INFRA_STEPS.has(s.name)) ?? false;

  newRunData.push({
    id:         run.id,
    date:       run.created_at,
    trigger:    run.event === 'pull_request' ? 'PR' : run.event === 'push' ? 'push→main' : run.event,
    conclusion: run.conclusion,
    btTotal,
    lintTotal,
    steps,
    docOnly,
    url:        run.html_url,
  });
}

// ── 4. Merge, deduplicate by id, trim to 30-day window ───────────────────────
const seen   = new Set();
const allRuns = [...existingRuns, ...newRunData]
  .filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; })
  .filter(r => new Date(r.date) >= CUTOFF)
  .sort((a, b) => new Date(a.date) - new Date(b.date));

console.log(`Total runs in 30d window: ${allRuns.length} (${newRunData.length} new)`);

// ── 5. Compute stats ──────────────────────────────────────────────────────────
const nonSkipped  = allRuns.filter(r => !r.docOnly && r.btTotal !== null);
const btTimes     = nonSkipped.map(r => r.btTotal).sort((a, b) => a - b);
const p50         = percentile(btTimes, 0.50);
const p90         = percentile(btTimes, 0.90);

const last7Days   = new Date(Date.now() - 7 * 864e5);
const recent      = nonSkipped.filter(r => new Date(r.date) >= last7Days);
const successRate = recent.length
  ? recent.filter(r => r.conclusion === 'success').length / recent.length
  : null;
const docOnlyCount7d = allRuns.filter(r => r.docOnly && new Date(r.date) >= last7Days).length;

const stepAvgs = {};
for (const key of Object.values(STEP_KEYS)) {
  const vals = nonSkipped.map(r => r.steps?.[key]).filter(v => v != null && v > 0);
  stepAvgs[key] = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
}

// ── 6. Render markdown ────────────────────────────────────────────────────────
const ts     = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
const last20 = [...allRuns].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 20);

const reportLines = [
  `# CI Pipeline Metrics`,
  ``,
  `_Last updated: ${ts} by the [ci-metrics workflow](../.github/workflows/ci-metrics.yml)_`,
  ``,
  `## 30-Day Summary`,
  ``,
  `| Metric | Value | Status |`,
  `|--------|-------|--------|`,
  `| B&T P50 wall clock | ${fmt(p50)} | ${statusIcon(p50 === null || p50 <= P90_THRESHOLD_S)} |`,
  `| B&T P90 wall clock | ${fmt(p90)}${flag(p90 !== null && p90 > P90_THRESHOLD_S)} | ${statusIcon(p90 === null || p90 <= P90_THRESHOLD_S)} |`,
  `| CI success rate (7d) | ${successRate !== null ? (successRate * 100).toFixed(0) + '%' : '—'}${flag(successRate !== null && successRate < (1 - FAILURE_RATE_LIMIT))} | ${statusIcon(successRate === null || successRate >= (1 - FAILURE_RATE_LIMIT))} |`,
  `| Doc-only skips (7d) | ${docOnlyCount7d} | — |`,
  `| Runs analysed (${DAYS}d) | ${nonSkipped.length} | — |`,
  ``,
  `> ⚠️ = threshold breached. P90 alert: >14m · Failure rate alert: >10% over 7 days.`,
  ``,
  `## Step Breakdown (avg, last ${DAYS} days)`,
  ``,
  `| Step | Avg Duration |`,
  `|------|-------------|`,
  `| Build | ${fmt(stepAvgs.build)} |`,
  `| Type check | ${fmt(stepAvgs.typecheck)} |`,
  `| Smoke Test Suite | ${fmt(stepAvgs.smoke)} |`,
  `| Verify BAML module resolution | ${fmt(stepAvgs.bamlProbe)} |`,
  `| Run migrations | ${fmt(stepAvgs.migrations)} |`,
  ``,
  `## Last 20 Runs`,
  ``,
  `| Date (UTC) | Trigger | B&T | Lint | Outcome | Notes |`,
  `|------------|---------|-----|------|---------|-------|`,
  ...last20.map(r => {
    const d       = r.date.replace('T', ' ').slice(0, 16);
    const icon    = r.conclusion === 'success' ? '✅' : r.conclusion === 'failure' ? '❌' : '⏭️';
    const btStr   = r.docOnly ? '(skipped)' : (r.btTotal !== null ? fmt(r.btTotal) + (r.btTotal > P90_THRESHOLD_S ? ' ⚠️' : '') : '—');
    const lintStr = r.docOnly ? '(skipped)' : fmt(r.lintTotal);
    const notes   = r.docOnly ? 'doc-only skip' : '';
    return `| [${d}](${r.url}) | ${r.trigger} | ${btStr} | ${lintStr} | ${icon} | ${notes} |`;
  }),
  ``,
];

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, reportLines.join('\n') + '\n');
console.log(`Report written to ${OUT}`);
console.log(`  P50: ${fmt(p50)}  P90: ${fmt(p90)}  Success rate (7d): ${successRate !== null ? (successRate * 100).toFixed(0) + '%' : '—'}`);

// ── 7. Write JSON (includes id + steps for incremental support) ───────────────
const jsonOut = {
  generatedAt: new Date().toISOString(),
  thresholdS:  P90_THRESHOLD_S,
  summary:     { p50, p90, successRate7d: successRate, docOnlySkips7d: docOnlyCount7d, totalRuns30d: nonSkipped.length },
  stepAvgs,
  runs: allRuns.map(r => ({
    id: r.id, date: r.date, btTotal: r.btTotal, lintTotal: r.lintTotal,
    conclusion: r.conclusion, trigger: r.trigger, url: r.url, docOnly: r.docOnly,
    steps: r.steps,
  })),
};
writeFileSync(OUT_JSON, JSON.stringify(jsonOut));
console.log(`JSON written to ${OUT_JSON}`);

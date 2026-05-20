#!/usr/bin/env node
// Writes a per-run CI metrics table to $GITHUB_STEP_SUMMARY.
// Called as the final step of the Build & Test job in ci.yml.
// Reads step timings from the GitHub Actions API using the GITHUB_TOKEN
// available in every Actions job — no additional secrets required.
import { execSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

const SUMMARY_FILE = process.env.GITHUB_STEP_SUMMARY;
const REPO = process.env.GITHUB_REPOSITORY;
const RUN_ID = process.env.GITHUB_RUN_ID;

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
const bt   = jobs.find(j => j.name === 'Build & Test');
const lint = jobs.find(j => j.name === 'Lint');

if (!bt) {
  console.log('Build & Test job not found — skipping summary.');
  process.exit(0);
}

// completed_at may still be null (this step is the last one running).
// Fall back to "now" so we get an approximation of total wall clock.
const btTotal = bt.completed_at
  ? durSec(bt.started_at, bt.completed_at)
  : Math.round((Date.now() - new Date(bt.started_at)) / 1000);

const P90_THRESHOLD_S = 14 * 60; // 14m — current P90 baseline
const btFlag = btTotal > P90_THRESHOLD_S ? ' ⚠️ exceeds P90' : '';

const STEPS_OF_INTEREST = [
  'Build',
  'Verify BAML module resolution',
  'Type check',
  'Smoke Test Suite',
  'Run migrations',
];

const stepRows = STEPS_OF_INTEREST.flatMap(name => {
  const step = bt.steps.find(s => s.name.startsWith(name));
  if (!step || step.conclusion === 'skipped') return [];
  const dur = durSec(step.started_at, step.completed_at);
  const icon = step.conclusion === 'success' ? '✅' : step.conclusion === 'failure' ? '❌' : '⏭️';
  return [`| ${name} | ${fmt(dur)} | ${icon} |`];
});

const lintTotal = lint ? durSec(lint.started_at, lint.completed_at) : null;
const runIcon   = bt.conclusion === 'failure' ? '❌' : bt.conclusion === 'success' ? '✅' : '🔄';
const ts        = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

const lines = [
  `## CI Metrics — ${ts} ${runIcon}`,
  '',
  `| | Duration |`,
  `|--|----------|`,
  `| **B&T (critical path)** | **${fmt(btTotal)}${btFlag}** |`,
  lintTotal !== null ? `| Lint (parallel) | ${fmt(lintTotal)} |` : null,
  '',
  '### B&T step breakdown',
  '',
  '| Step | Duration | |',
  '|------|----------|--|',
  ...stepRows,
  '',
  `_P90 alert threshold: 14m — [30-day trend](../docs/ci-cd-metrics.md)_`,
  '',
].filter(l => l !== null);

appendFileSync(SUMMARY_FILE, lines.join('\n') + '\n');
console.log(`CI run summary written — B&T: ${fmt(btTotal)}${btFlag}`);

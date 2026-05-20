#!/usr/bin/env node
// Generates docs/index.html — the visual CI/CD metrics dashboard.
// Reads docs/ci-metrics.json and docs/cd-metrics.json written by the nightly
// metrics scripts, then produces a self-contained HTML page served via GitHub Pages.
//
// Called by .github/workflows/cd-metrics.yml after both JSON files are committed.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT     = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOCS     = join(ROOT, 'docs');
const CI_JSON  = join(DOCS, 'ci-metrics.json');
const CD_JSON  = join(DOCS, 'cd-metrics.json');
const OUT      = join(DOCS, 'index.html');

function fmt(sec) {
  if (sec === null || sec === undefined) return '—';
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${String(sec % 60).padStart(2, '0')}s`;
}

function fmtMin(sec) {
  if (sec === null || sec === undefined) return null;
  return +(sec / 60).toFixed(2);
}

function pct(rate) {
  if (rate === null || rate === undefined) return '—';
  return `${(rate * 100).toFixed(0)}%`;
}

function shortDate(iso) {
  return iso ? iso.slice(0, 10) : '—';
}

const ci = existsSync(CI_JSON) ? JSON.parse(readFileSync(CI_JSON, 'utf8')) : null;
const cd = existsSync(CD_JSON) ? JSON.parse(readFileSync(CD_JSON, 'utf8')) : null;

const ts = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

// ── Build chart datasets ──────────────────────────────────────────────────────

function buildCiChartData(ci) {
  if (!ci) return null;
  const runs = ci.runs.filter(r => !r.docOnly && r.btTotal !== null);
  const threshold = ci.thresholdS / 60;
  return {
    labels:    runs.map(r => shortDate(r.date)),
    btSeries:  runs.map(r => fmtMin(r.btTotal)),
    threshold: runs.map(() => threshold),
    outcomes:  runs.map(r => r.conclusion),
    urls:      runs.map(r => r.url),
  };
}

function buildCdChartData(cd) {
  if (!cd) return null;
  const runs = cd.runs.filter(r => r.cdTotal !== null);
  const threshold = cd.thresholdS / 60;
  return {
    labels:      runs.map(r => shortDate(r.date)),
    cdSeries:    runs.map(r => fmtMin(r.cdTotal)),
    ttlSeries:   runs.map(r => fmtMin(r.mergeToLive)),
    threshold:   runs.map(() => threshold),
    outcomes:    runs.map(r => r.conclusion),
    urls:        runs.map(r => r.url),
  };
}

const ciChart = buildCiChartData(ci);
const cdChart = buildCdChartData(cd);

// ── Status helpers ────────────────────────────────────────────────────────────

function statusBadge(ok, label) {
  const cls = ok ? 'badge-ok' : 'badge-warn';
  const icon = ok ? '✓' : '⚠';
  return `<span class="badge ${cls}">${icon} ${label}</span>`;
}

function ciStatus() {
  if (!ci) return statusBadge(true, 'No data yet');
  const p90ok = ci.summary.p90 === null || ci.summary.p90 <= ci.thresholdS;
  const rateOk = ci.summary.successRate7d === null || ci.summary.successRate7d >= 0.90;
  return [
    statusBadge(p90ok,  `P90 ${fmt(ci.summary.p90)}`),
    statusBadge(rateOk, `${pct(ci.summary.successRate7d)} pass (7d)`),
  ].join(' ');
}

function cdStatus() {
  if (!cd) return statusBadge(true, 'No data yet');
  const p90ok  = cd.summary.p90  === null || cd.summary.p90  <= cd.thresholdS;
  const ttlOk  = cd.summary.ttlP90 === null || cd.summary.ttlP90 <= cd.ttlThresholdS;
  const rateOk = cd.summary.successRate7d === null || cd.summary.successRate7d >= 0.99;
  return [
    statusBadge(p90ok,  `CD P90 ${fmt(cd.summary.p90)}`),
    statusBadge(ttlOk,  `Merge→live P90 ${fmt(cd.summary.ttlP90)}`),
    statusBadge(rateOk, `${pct(cd.summary.successRate7d)} success (7d)`),
  ].join(' ');
}

// ── Recent runs table ─────────────────────────────────────────────────────────

function ciRunsTable() {
  if (!ci) return '<p>No data yet.</p>';
  const rows = [...ci.runs].reverse().slice(0, 20).map(r => {
    const icon = r.conclusion === 'success' ? '✅' : r.conclusion === 'failure' ? '❌' : '⏭';
    const warn = r.btTotal !== null && r.btTotal > ci.thresholdS ? ' class="cell-warn"' : '';
    return `<tr>
      <td><a href="${r.url}" target="_blank">${shortDate(r.date)}</a></td>
      <td>${r.trigger}</td>
      <td${warn}>${r.docOnly ? '<em>skipped</em>' : fmt(r.btTotal)}</td>
      <td>${r.docOnly ? '<em>skipped</em>' : fmt(r.lintTotal)}</td>
      <td>${icon}</td>
    </tr>`;
  }).join('\n');
  return `<table><thead><tr><th>Date</th><th>Trigger</th><th>B&T</th><th>Lint</th><th>Result</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function cdRunsTable() {
  if (!cd) return '<p>No data yet.</p>';
  const rows = [...cd.runs].reverse().slice(0, 20).map(r => {
    const icon = r.conclusion === 'success' ? '✅' : r.conclusion === 'failure' ? '❌' : '⏭';
    const warnCd  = r.cdTotal    !== null && r.cdTotal    > cd.thresholdS    ? ' class="cell-warn"' : '';
    const warnTtl = r.mergeToLive !== null && r.mergeToLive > cd.ttlThresholdS ? ' class="cell-warn"' : '';
    return `<tr>
      <td><a href="${r.url}" target="_blank">${shortDate(r.date)}</a></td>
      <td>${r.trigger}</td>
      <td${warnCd}>${fmt(r.cdTotal)}</td>
      <td${warnTtl}>${fmt(r.mergeToLive)}</td>
      <td>${icon}</td>
    </tr>`;
  }).join('\n');
  return `<table><thead><tr><th>Date</th><th>Trigger</th><th>CD Total</th><th>Merge→Live</th><th>Result</th></tr></thead><tbody>${rows}</tbody></table>`;
}

// ── Render ────────────────────────────────────────────────────────────────────

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>CustomerEQ CI/CD Dashboard</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0d1117; color: #c9d1d9; font-size: 14px; line-height: 1.5; }
    a { color: #58a6ff; text-decoration: none; }
    a:hover { text-decoration: underline; }
    header { padding: 24px 32px 16px; border-bottom: 1px solid #21262d; }
    header h1 { font-size: 22px; font-weight: 600; color: #e6edf3; }
    header .sub { color: #8b949e; font-size: 12px; margin-top: 4px; }
    .panels { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; padding: 24px 32px; }
    @media (max-width: 900px) { .panels { grid-template-columns: 1fr; } }
    .panel { background: #161b22; border: 1px solid #21262d; border-radius: 8px; padding: 20px; }
    .panel h2 { font-size: 16px; font-weight: 600; color: #e6edf3; margin-bottom: 12px; }
    .badges { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
    .badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; }
    .badge-ok   { background: #1a4731; color: #3fb950; border: 1px solid #2ea043; }
    .badge-warn { background: #4d2600; color: #f0883e; border: 1px solid #bd561d; }
    .chart-wrap { position: relative; height: 220px; margin-bottom: 20px; }
    .summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 20px; }
    .stat { background: #0d1117; border: 1px solid #21262d; border-radius: 6px; padding: 10px 14px; }
    .stat .label { color: #8b949e; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; }
    .stat .value { color: #e6edf3; font-size: 18px; font-weight: 600; margin-top: 2px; }
    .stat.warn .value { color: #f0883e; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { color: #8b949e; text-align: left; padding: 6px 8px; border-bottom: 1px solid #21262d; font-weight: 500; }
    td { padding: 5px 8px; border-bottom: 1px solid #161b22; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: #1c2128; }
    .cell-warn { color: #f0883e; font-weight: 600; }
    .section-label { color: #8b949e; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; margin: 16px 0 8px; }
    em { color: #6e7681; font-style: normal; }
  </style>
</head>
<body>
<header>
  <h1>CustomerEQ CI/CD Dashboard</h1>
  <div class="sub">Updated ${ts} · <a href="https://github.com/mathursrus/CustomerEQ/actions" target="_blank">Actions</a> · <a href="ci-cd-metrics.md">CI report</a> · <a href="cd-metrics.md">CD report</a></div>
</header>

<div class="panels">

  <!-- CI Panel -->
  <div class="panel">
    <h2>CI Pipeline</h2>
    <div class="badges">${ciStatus()}</div>

    <div class="chart-wrap">
      <canvas id="ciChart"></canvas>
    </div>

    <div class="summary-grid">
      ${ci ? `
      <div class="stat${ci.summary.p50 !== null && ci.summary.p50 > ci.thresholdS ? ' warn' : ''}">
        <div class="label">B&T P50 (30d)</div>
        <div class="value">${fmt(ci.summary.p50)}</div>
      </div>
      <div class="stat${ci.summary.p90 !== null && ci.summary.p90 > ci.thresholdS ? ' warn' : ''}">
        <div class="label">B&T P90 (30d)</div>
        <div class="value">${fmt(ci.summary.p90)}</div>
      </div>
      <div class="stat${ci.summary.successRate7d !== null && ci.summary.successRate7d < 0.90 ? ' warn' : ''}">
        <div class="label">Success rate (7d)</div>
        <div class="value">${pct(ci.summary.successRate7d)}</div>
      </div>
      <div class="stat">
        <div class="label">Runs analysed (30d)</div>
        <div class="value">${ci.summary.totalRuns30d}</div>
      </div>` : '<div class="stat"><div class="label">Status</div><div class="value">No data yet</div></div>'}
    </div>

    <div class="section-label">Recent runs</div>
    ${ciRunsTable()}
  </div>

  <!-- CD Panel -->
  <div class="panel">
    <h2>CD Pipeline</h2>
    <div class="badges">${cdStatus()}</div>

    <div class="chart-wrap">
      <canvas id="cdChart"></canvas>
    </div>

    <div class="summary-grid">
      ${cd ? `
      <div class="stat${cd.summary.p50 !== null && cd.summary.p50 > cd.thresholdS ? ' warn' : ''}">
        <div class="label">CD P50 (30d)</div>
        <div class="value">${fmt(cd.summary.p50)}</div>
      </div>
      <div class="stat${cd.summary.p90 !== null && cd.summary.p90 > cd.thresholdS ? ' warn' : ''}">
        <div class="label">CD P90 (30d)</div>
        <div class="value">${fmt(cd.summary.p90)}</div>
      </div>
      <div class="stat${cd.summary.ttlP90 !== null && cd.summary.ttlP90 > cd.ttlThresholdS ? ' warn' : ''}">
        <div class="label">Merge→live P90 (30d)</div>
        <div class="value">${fmt(cd.summary.ttlP90)}</div>
      </div>
      <div class="stat${cd.summary.successRate7d !== null && cd.summary.successRate7d < 0.99 ? ' warn' : ''}">
        <div class="label">CD success rate (7d)</div>
        <div class="value">${pct(cd.summary.successRate7d)}</div>
      </div>` : '<div class="stat"><div class="label">Status</div><div class="value">No data yet</div></div>'}
    </div>

    <div class="section-label">Recent deploys</div>
    ${cdRunsTable()}
  </div>

</div>

<script>
const CI  = ${JSON.stringify(ciChart)};
const CD  = ${JSON.stringify(cdChart)};

Chart.defaults.color = '#8b949e';
Chart.defaults.borderColor = '#21262d';

const chartOpts = (yLabel) => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12, font: { size: 11 } } } },
  scales: {
    x: { ticks: { maxTicksLimit: 8, font: { size: 10 } }, grid: { color: '#21262d' } },
    y: { title: { display: true, text: yLabel, font: { size: 11 } }, beginAtZero: true, grid: { color: '#21262d' } },
  },
  elements: { point: { radius: 3, hoverRadius: 5 } },
});

if (CI) {
  new Chart(document.getElementById('ciChart'), {
    type: 'line',
    data: {
      labels: CI.labels,
      datasets: [
        {
          label: 'B&T wall clock (min)',
          data: CI.btSeries,
          borderColor: '#58a6ff',
          backgroundColor: 'rgba(88,166,255,.1)',
          fill: true,
          tension: 0.3,
          pointBackgroundColor: CI.outcomes.map(o => o === 'failure' ? '#f85149' : '#58a6ff'),
        },
        {
          label: 'Alert threshold (14m)',
          data: CI.threshold,
          borderColor: '#f0883e',
          borderDash: [6, 3],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
        },
      ],
    },
    options: chartOpts('Minutes'),
  });
}

if (CD) {
  new Chart(document.getElementById('cdChart'), {
    type: 'line',
    data: {
      labels: CD.labels,
      datasets: [
        {
          label: 'CD total (min)',
          data: CD.cdSeries,
          borderColor: '#3fb950',
          backgroundColor: 'rgba(63,185,80,.1)',
          fill: true,
          tension: 0.3,
          pointBackgroundColor: CD.outcomes.map(o => o === 'failure' ? '#f85149' : '#3fb950'),
        },
        {
          label: 'Merge→live (min)',
          data: CD.ttlSeries,
          borderColor: '#a5d6ff',
          borderDash: [4, 2],
          borderWidth: 1.5,
          tension: 0.3,
          pointRadius: 2,
          fill: false,
        },
        {
          label: 'Alert threshold (25m)',
          data: CD.threshold,
          borderColor: '#f0883e',
          borderDash: [6, 3],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
        },
      ],
    },
    options: chartOpts('Minutes'),
  });
}
</script>
</body>
</html>
`;

mkdirSync(DOCS, { recursive: true });
writeFileSync(OUT, html);
console.log(`Dashboard written to ${OUT}`);

#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const repoRoot = process.cwd();
const outputDir = path.join(repoRoot, 'acceptance-output');
const reportJsonPath = path.join(outputDir, 'report.json');
const reportHtmlPath = path.join(outputDir, 'report.html');

const STEP_DEFINITIONS = [
  {
    id: 'SERVER_SELFCHECK',
    command: 'pnpm --filter @geox/server run test:p1:selfcheck',
    logFile: 'SERVER_SELFCHECK.log',
    notes: 'Runs p1 minimal selfcheck to validate baseline skill loop invariants.'
  },
  {
    id: 'P1_SMOKE',
    command: 'pnpm --filter @geox/server run test:p1:smoke',
    logFile: 'P1_SMOKE.log',
    notes: 'Runs p1 minimal smoke scenario against current server behavior.'
  },
  {
    id: 'P1_ACCEPTANCE_SMOKE',
    command: 'pnpm --filter @geox/server run test:p1:acceptance-smoke',
    logFile: 'P1_ACCEPTANCE_SMOKE.log',
    notes: 'Runs acceptance-oriented p1 smoke and checks acceptance verdict transitions.'
  },
  {
    id: 'EVIDENCE_EXPORT_S3_SMOKE',
    command: 'pnpm --filter @geox/server run test:evidence-export:s3-smoke',
    logFile: 'EVIDENCE_EXPORT_S3_SMOKE.log',
    notes: 'Runs evidence export S3 smoke flow to confirm export path availability.'
  },
  {
    id: 'OPENAPI_SELFCHECK',
    command: 'pnpm --filter @geox/server run test:p1:openapi-selfcheck',
    logFile: 'OPENAPI_SELFCHECK.log',
    notes: 'Runs OpenAPI selfcheck for p1-3 alignment sanity.'
  }
];

const args = new Set(process.argv.slice(2));
if (args.has('--list')) {
  console.log(STEP_DEFINITIONS.map((step) => `${step.id}: ${step.command}`).join('\n'));
  process.exit(0);
}

ensureOutputDir(outputDir);

(async () => {
  const startedAt = new Date();
  const results = [];

  for (const step of STEP_DEFINITIONS) {
    const result = await runStep(step);
    results.push(result);
  }

  const endedAt = new Date();
  const ok = results.every((step) => step.passed);
  const summary = {
    ok,
    started_at: startedAt.toISOString(),
    ended_at: endedAt.toISOString(),
    duration_ms: endedAt.getTime() - startedAt.getTime(),
    totals: {
      steps: results.length,
      passed: results.filter((step) => step.passed).length,
      failed: results.filter((step) => !step.passed).length
    },
    steps: results
  };

  fs.writeFileSync(reportJsonPath, JSON.stringify(summary, null, 2), 'utf8');
  fs.writeFileSync(reportHtmlPath, buildHtml(summary), 'utf8');

  console.log(`\n[acceptance] report json: ${path.relative(repoRoot, reportJsonPath)}`);
  console.log(`[acceptance] report html: ${path.relative(repoRoot, reportHtmlPath)}`);

  process.exit(ok ? 0 : 1);
})().catch((error) => {
  const failure = {
    ok: false,
    error: error && error.stack ? error.stack : String(error),
    generated_at: new Date().toISOString(),
    steps: []
  };
  ensureOutputDir(outputDir);
  fs.writeFileSync(reportJsonPath, JSON.stringify(failure, null, 2), 'utf8');
  fs.writeFileSync(reportHtmlPath, buildHtml(failure), 'utf8');
  console.error('[acceptance] fatal error', error);
  process.exit(1);
});

function ensureOutputDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function runStep(step) {
  const stepStarted = Date.now();
  const logPath = path.join(outputDir, step.logFile);

  return new Promise((resolve) => {
    const logStream = fs.createWriteStream(logPath, { flags: 'w' });
    logStream.write(`# ${step.id}\n`);
    logStream.write(`# command: ${step.command}\n`);
    logStream.write(`# started_at: ${new Date(stepStarted).toISOString()}\n\n`);

    console.log(`\n[acceptance] START ${step.id}`);
    console.log(`[acceptance] CMD   ${step.command}`);

    const child = spawn('bash', ['-lc', step.command], {
      cwd: repoRoot,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    child.stdout.on('data', (chunk) => {
      process.stdout.write(chunk);
      logStream.write(chunk);
    });

    child.stderr.on('data', (chunk) => {
      process.stderr.write(chunk);
      logStream.write(chunk);
    });

    child.on('close', (code, signal) => {
      const finishedAt = Date.now();
      const passed = code === 0;
      const notes = [step.notes];
      if (signal) {
        notes.push(`Process terminated by signal: ${signal}`);
      }
      notes.push(`Exit code: ${code === null ? 'null' : String(code)}`);

      logStream.write('\n');
      logStream.write(`# finished_at: ${new Date(finishedAt).toISOString()}\n`);
      logStream.write(`# duration_ms: ${finishedAt - stepStarted}\n`);
      logStream.write(`# exit_code: ${code === null ? 'null' : String(code)}\n`);
      logStream.write(`# signal: ${signal || 'none'}\n`);
      logStream.end();

      console.log(`[acceptance] END   ${step.id} => ${passed ? 'PASS' : 'FAIL'} (${finishedAt - stepStarted}ms)`);

      resolve({
        id: step.id,
        passed,
        command: step.command,
        duration_ms: finishedAt - stepStarted,
        evidence: path.relative(repoRoot, logPath),
        notes: notes.join(' | ')
      });
    });

    child.on('error', (error) => {
      const finishedAt = Date.now();
      const notes = [
        step.notes,
        'Spawn failure before process completion.',
        `Error: ${error && error.message ? error.message : String(error)}`
      ];

      logStream.write('\n');
      logStream.write(`# finished_at: ${new Date(finishedAt).toISOString()}\n`);
      logStream.write(`# duration_ms: ${finishedAt - stepStarted}\n`);
      logStream.write(`# spawn_error: ${error && error.stack ? error.stack : String(error)}\n`);
      logStream.end();

      console.error(`[acceptance] END   ${step.id} => FAIL (${finishedAt - stepStarted}ms)`);

      resolve({
        id: step.id,
        passed: false,
        command: step.command,
        duration_ms: finishedAt - stepStarted,
        evidence: path.relative(repoRoot, logPath),
        notes: notes.join(' | ')
      });
    });
  });
}

function buildHtml(summary) {
  const ok = Boolean(summary && summary.ok);
  const steps = Array.isArray(summary && summary.steps) ? summary.steps : [];
  const title = `Acceptance Report - ${ok ? 'PASS' : 'FAIL'}`;

  const rows = steps
    .map((step) => {
      const status = step.passed ? 'PASS' : 'FAIL';
      return `<tr>
        <td>${escapeHtml(String(step.id || 'N/A'))}</td>
        <td class="${step.passed ? 'pass' : 'fail'}">${status}</td>
        <td>${escapeHtml(String(step.duration_ms ?? 'N/A'))}</td>
        <td><code>${escapeHtml(String(step.command || ''))}</code></td>
        <td><code>${escapeHtml(String(step.evidence || ''))}</code></td>
        <td>${escapeHtml(String(step.notes || ''))}</td>
      </tr>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { margin-bottom: 0.25rem; }
    .status { font-weight: bold; color: ${ok ? '#0a7a0a' : '#b00020'}; }
    table { border-collapse: collapse; width: 100%; margin-top: 1rem; }
    th, td { border: 1px solid #ccc; padding: 8px; vertical-align: top; text-align: left; }
    th { background: #f5f5f5; }
    .pass { color: #0a7a0a; font-weight: bold; }
    .fail { color: #b00020; font-weight: bold; }
    code { white-space: pre-wrap; word-break: break-word; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="status">Overall: ${ok ? 'PASS' : 'FAIL'}</div>
  <div>Started at: ${escapeHtml(String(summary.started_at || 'N/A'))}</div>
  <div>Ended at: ${escapeHtml(String(summary.ended_at || 'N/A'))}</div>
  <div>Total duration (ms): ${escapeHtml(String(summary.duration_ms || 'N/A'))}</div>
  <div>Totals: ${escapeHtml(JSON.stringify(summary.totals || {}))}</div>

  <table>
    <thead>
      <tr>
        <th>Step ID</th>
        <th>Status</th>
        <th>Duration (ms)</th>
        <th>Command</th>
        <th>Evidence</th>
        <th>Notes</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="6">No step results available.</td></tr>'}
    </tbody>
  </table>
</body>
</html>`;
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

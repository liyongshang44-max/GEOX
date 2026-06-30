// scripts/governance_acceptance/POST_P8_04_FREEZE_INDEX_PATCH.cjs
// Purpose: verify README_MIGRATION.md contains the P8 freeze snapshot after post-P8 convergence.
// Boundary: read-only verification; does not modify runtime, frontend, database, package, or CI files.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = process.cwd();
const ACCEPTANCE = 'POST_P8_04_FREEZE_INDEX_PATCH';
const TARGET = 'README_MIGRATION.md';
const REQUIRED_TOKENS = [
  'GEOX – P8 Real Evidence Closed-Loop Acceptance / Product Replay Demo Freeze Snapshot',
  'p8_real_evidence_closed_loop_demo_completion',
  'p8_real_evidence_closed_loop_demo_main_merge',
  '3441fc7157741a80800aec69e54c680a862e111b',
  '36fbe07528af7ace9c04d087e21f87491e30633e',
  'P8_10_REAL_EVIDENCE_CLOSED_LOOP_COMPLETION_REVIEW.cjs',
  'real evidence closed-loop replay demo',
  'No database write by replay runtime',
  'Prediction is not authorization',
  'Calibration candidate is not model update',
];
const FORBIDDEN_RUNTIME_PREFIXES = [
  'apps/server/',
  'apps/web/',
  'apps/executor/',
  'apps/telemetry-ingest/',
  'apps/jobs/',
  'packages/',
  'docker/',
  'db/',
  'prisma/',
  'migrations/',
  'seeds/',
];
const assertions = [];

function abs(file) {
  return path.resolve(ROOT, file);
}

function exists(file) {
  return fs.existsSync(abs(file));
}

function read(file) {
  return fs.readFileSync(abs(file), 'utf8');
}

function tryGit(args) {
  try {
    return childProcess.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function changedFilesFromMain() {
  const output = tryGit(['diff', '--name-only', 'main...HEAD']);
  return [...new Set(output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))].sort();
}

function assert(name, condition, details = {}) {
  assertions.push({ name, passed: condition === true, details });
  if (condition !== true) {
    const error = new Error(`ASSERTION_FAILED:${name}`);
    error.details = details;
    throw error;
  }
}

function summary() {
  const failed = assertions.filter((item) => !item.passed);
  return {
    assertion_count: assertions.length,
    failed_assertion_count: failed.length,
    failed_assertions: failed.map((item) => item.name),
  };
}

try {
  assert('post_p8_04_doc_exists', exists('docs/tasks/POST-P8-04-Freeze-Index-Patch.md'), {});
  assert('patch_script_exists', exists('scripts/maintenance/POST_P8_04_PATCH_README_MIGRATION_P8_FREEZE.cjs'), {});
  assert('readme_migration_exists', exists(TARGET), {});

  const content = read(TARGET);
  for (const token of REQUIRED_TOKENS) assert(`readme_migration_contains:${token}`, content.includes(token), { token });

  const changed = changedFilesFromMain();
  const runtimeChanged = changed.filter((file) => FORBIDDEN_RUNTIME_PREFIXES.some((prefix) => file.startsWith(prefix)));
  assert('no_runtime_surface_changed', runtimeChanged.length === 0, { runtimeChanged, changed });

  console.log(JSON.stringify({
    ok: true,
    acceptance: ACCEPTANCE,
    readme_migration_p8_freeze_present: true,
    completion_tag_recorded: true,
    main_merge_tag_recorded: true,
    p8_acceptance_recorded: true,
    no_runtime_surface_changed: true,
    changed_file_count: changed.length,
    changed_files: changed,
    ...summary(),
    next_step: 'POST_P8_05_REPOSITORY_CONVERGENCE_COMPLETION_REVIEW'
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    acceptance: ACCEPTANCE,
    error: error.message,
    details: error.details || null,
    assertions,
  }, null, 2));
  process.exit(1);
}

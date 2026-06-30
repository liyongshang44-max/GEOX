// scripts/governance_acceptance/POST_P8_03_FIRST_ARCHIVE_MIGRATION_BATCH.cjs
// Purpose: verify the first post-P8 historical task-doc archive migration batch.
// Boundary: read-only verification; does not move files, delete files, or modify runtime surfaces.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = process.cwd();
const ACCEPTANCE = 'POST_P8_03_FIRST_ARCHIVE_MIGRATION_BATCH';
const BATCH = [
  ['docs/tasks/P1-Completion-Review-Before-P2.md', 'docs/legacy/tasks/P1-Completion-Review-Before-P2.md'],
  ['docs/tasks/P2-01-Adapter-Contract-Reconciliation.md', 'docs/legacy/tasks/P2-01-Adapter-Contract-Reconciliation.md'],
  ['docs/tasks/P2-02-Adapter-Capability-Manifest-and-Registry-Audit.md', 'docs/legacy/tasks/P2-02-Adapter-Capability-Manifest-and-Registry-Audit.md'],
  ['docs/tasks/P2-03-Safe-Real-Adapter-Sandbox-Harness.md', 'docs/legacy/tasks/P2-03-Safe-Real-Adapter-Sandbox-Harness.md'],
  ['docs/tasks/P2-04-Production-Ingestion-Adapter-Boundary.md', 'docs/legacy/tasks/P2-04-Production-Ingestion-Adapter-Boundary.md'],
  ['docs/tasks/P2-05-Real-Adapter-Negative-Runtime-Matrix.md', 'docs/legacy/tasks/P2-05-Real-Adapter-Negative-Runtime-Matrix.md'],
  ['docs/tasks/P2-06-Operator-Controlled-Pilot-Dry-Run.md', 'docs/legacy/tasks/P2-06-Operator-Controlled-Pilot-Dry-Run.md'],
  ['docs/tasks/P2-Completion-Review-Before-P3.md', 'docs/legacy/tasks/P2-Completion-Review-Before-P3.md'],
  ['docs/tasks/P2-Real-Adapter-Integration-Planning.md', 'docs/legacy/tasks/P2-Real-Adapter-Integration-Planning.md'],
  ['docs/tasks/P3-01-Operator-Workflow-Surface-Inventory.md', 'docs/legacy/tasks/P3-01-Operator-Workflow-Surface-Inventory.md'],
  ['docs/tasks/P3-02-Operator-Preflight-Read-Model-Planning.md', 'docs/legacy/tasks/P3-02-Operator-Preflight-Read-Model-Planning.md'],
  ['docs/tasks/P3-03-Operator-Gate-Read-Model-Planning.md', 'docs/legacy/tasks/P3-03-Operator-Gate-Read-Model-Planning.md'],
  ['docs/tasks/P3-04-Dry-Run-Report-Read-Model-Planning.md', 'docs/legacy/tasks/P3-04-Dry-Run-Report-Read-Model-Planning.md'],
  ['docs/tasks/P3-05-Operator-Audit-Trail-Planning.md', 'docs/legacy/tasks/P3-05-Operator-Audit-Trail-Planning.md'],
  ['docs/tasks/P3-06-Operator-UX-Negative-Boundary-Matrix.md', 'docs/legacy/tasks/P3-06-Operator-UX-Negative-Boundary-Matrix.md'],
  ['docs/tasks/P3-07-Operator-UX-Completion-Review-Before-P4.md', 'docs/legacy/tasks/P3-07-Operator-UX-Completion-Review-Before-P4.md'],
  ['docs/tasks/P3-Operator-UX-Refinement-Planning.md', 'docs/legacy/tasks/P3-Operator-UX-Refinement-Planning.md'],
  ['docs/tasks/P4-01-ROI-Source-Boundary-Reconciliation.md', 'docs/legacy/tasks/P4-01-ROI-Source-Boundary-Reconciliation.md'],
  ['docs/tasks/P4-02-ROI-Policy-Gate-Contract.md', 'docs/legacy/tasks/P4-02-ROI-Policy-Gate-Contract.md'],
  ['docs/tasks/P4-03-ROI-Read-Model-Output-Contract.md', 'docs/legacy/tasks/P4-03-ROI-Read-Model-Output-Contract.md'],
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
  assert('post_p8_03_doc_exists', exists('docs/tasks/POST-P8-03-First-Archive-Migration-Batch.md'), {});
  assert('migration_script_exists', exists('scripts/maintenance/POST_P8_03_ARCHIVE_FIRST_BATCH.cjs'), {});

  for (const [source, destination] of BATCH) {
    assert(`source_absent:${source}`, !exists(source), { source, destination });
    assert(`destination_present:${destination}`, exists(destination), { source, destination });
    assert(`destination_preserves_original_header:${destination}`, read(destination).startsWith(`# ${source}`), { source, destination });
  }

  const changed = changedFilesFromMain();
  const runtimeChanged = changed.filter((file) => FORBIDDEN_RUNTIME_PREFIXES.some((prefix) => file.startsWith(prefix)));
  assert('no_runtime_surface_changed', runtimeChanged.length === 0, { runtimeChanged, changed });

  console.log(JSON.stringify({
    ok: true,
    acceptance: ACCEPTANCE,
    migrated_file_count: BATCH.length,
    source_paths_absent: true,
    destination_paths_present: true,
    original_headers_preserved: true,
    no_runtime_surface_changed: true,
    changed_file_count: changed.length,
    changed_files: changed,
    ...summary(),
    next_step: 'POST_P8_04_FREEZE_INDEX_PATCH'
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

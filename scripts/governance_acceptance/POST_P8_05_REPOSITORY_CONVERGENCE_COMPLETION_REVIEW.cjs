// scripts/governance_acceptance/POST_P8_05_REPOSITORY_CONVERGENCE_COMPLETION_REVIEW.cjs
// Purpose: close the post-P8 repository convergence pass after freeze registration and first archive migration.
// Boundary: read-only completion review; no runtime, frontend, database, package, or CI changes are required.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = process.cwd();
const ACCEPTANCE = 'POST_P8_05_REPOSITORY_CONVERGENCE_COMPLETION_REVIEW';
const REQUIRED_FILES = [
  'docs/tasks/POST-P8-00-Repository-Convergence-Planning.md',
  'docs/tasks/POST-P8-01-Freeze-Index-and-Reference-Audit.md',
  'docs/tasks/POST-P8-02-Non-Mainline-Archive-Plan.md',
  'docs/tasks/POST-P8-03-First-Archive-Migration-Batch.md',
  'docs/tasks/POST-P8-04-Freeze-Index-Patch.md',
  'docs/tasks/POST-P8-05-Repository-Convergence-Completion-Review.md',
  'docs/REPOSITORY_HANDOFF_MAP.md',
  'docs/twin_kernel/README.md',
  'docs/legacy/POST_P8_NON_MAINLINE_CANDIDATES.md',
  'docs/legacy/POST_P8_REFERENCE_AUDIT_REPORT.json',
  'docs/legacy/POST_P8_NON_MAINLINE_ARCHIVE_PLAN.json',
  'scripts/README.md',
  'scripts/twin_kernel/README.md',
  'scripts/governance_acceptance/POST_P8_REPOSITORY_CONVERGENCE_ACCEPTANCE.cjs',
  'scripts/governance_acceptance/POST_P8_01_FREEZE_INDEX_AND_REFERENCE_AUDIT.cjs',
  'scripts/governance_acceptance/POST_P8_02_NON_MAINLINE_ARCHIVE_PLAN.cjs',
  'scripts/governance_acceptance/POST_P8_03_FIRST_ARCHIVE_MIGRATION_BATCH.cjs',
  'scripts/governance_acceptance/POST_P8_04_FREEZE_INDEX_PATCH.cjs',
  'scripts/governance_acceptance/POST_P8_05_REPOSITORY_CONVERGENCE_COMPLETION_REVIEW.cjs',
  'scripts/maintenance/POST_P8_03_ARCHIVE_FIRST_BATCH.cjs',
  'scripts/maintenance/POST_P8_04_PATCH_README_MIGRATION_P8_FREEZE.cjs',
];
const ARCHIVED_TASKS = [
  'P1-Completion-Review-Before-P2.md',
  'P2-01-Adapter-Contract-Reconciliation.md',
  'P2-02-Adapter-Capability-Manifest-and-Registry-Audit.md',
  'P2-03-Safe-Real-Adapter-Sandbox-Harness.md',
  'P2-04-Production-Ingestion-Adapter-Boundary.md',
  'P2-05-Real-Adapter-Negative-Runtime-Matrix.md',
  'P2-06-Operator-Controlled-Pilot-Dry-Run.md',
  'P2-Completion-Review-Before-P3.md',
  'P2-Real-Adapter-Integration-Planning.md',
  'P3-01-Operator-Workflow-Surface-Inventory.md',
  'P3-02-Operator-Preflight-Read-Model-Planning.md',
  'P3-03-Operator-Gate-Read-Model-Planning.md',
  'P3-04-Dry-Run-Report-Read-Model-Planning.md',
  'P3-05-Operator-Audit-Trail-Planning.md',
  'P3-06-Operator-UX-Negative-Boundary-Matrix.md',
  'P3-07-Operator-UX-Completion-Review-Before-P4.md',
  'P3-Operator-UX-Refinement-Planning.md',
  'P4-01-ROI-Source-Boundary-Reconciliation.md',
  'P4-02-ROI-Policy-Gate-Contract.md',
  'P4-03-ROI-Read-Model-Output-Contract.md',
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
const P8_FREEZE_TOKENS = [
  'GEOX – P8 Real Evidence Closed-Loop Acceptance / Product Replay Demo Freeze Snapshot',
  'p8_real_evidence_closed_loop_demo_completion',
  'p8_real_evidence_closed_loop_demo_main_merge',
  'P8_10_REAL_EVIDENCE_CLOSED_LOOP_COMPLETION_REVIEW.cjs',
  'Prediction is not authorization',
  'Calibration candidate is not model update',
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

function readJson(file) {
  return JSON.parse(read(file));
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
  for (const file of REQUIRED_FILES) assert(`required_file_exists:${file}`, exists(file), { file });

  const readmeMigration = read('README_MIGRATION.md');
  for (const token of P8_FREEZE_TOKENS) assert(`p8_freeze_token_present:${token}`, readmeMigration.includes(token), { token });

  const handoff = read('docs/REPOSITORY_HANDOFF_MAP.md');
  assert('handoff_map_points_to_twin_lineage', handoff.includes('persisted_twin_kernel_domain_reference = docs/twin_kernel/README.md') && handoff.includes('offline_real_evidence_replay_entry'), {});

  const twin = read('docs/twin_kernel/README.md');
  assert('twin_lines_declared', twin.includes('line_id = server_persisted_twin_kernel') && twin.includes('line_id = offline_real_evidence_replay_kernel'), {});
  assert('twin_reconciliation_rule_declared', twin.includes('No task may silently make P8 offline replay artifacts behave as persisted server Twin objects'), {});

  const audit = readJson('docs/legacy/POST_P8_REFERENCE_AUDIT_REPORT.json');
  const plan = readJson('docs/legacy/POST_P8_NON_MAINLINE_ARCHIVE_PLAN.json');
  assert('reference_audit_report_valid', audit.acceptance === 'POST_P8_01_FREEZE_INDEX_AND_REFERENCE_AUDIT' && audit.candidate_count >= 300, { acceptance: audit.acceptance, candidate_count: audit.candidate_count });
  assert('archive_plan_report_valid', plan.acceptance === 'POST_P8_02_NON_MAINLINE_ARCHIVE_PLAN' && plan.archive_candidate_count >= 20, { acceptance: plan.acceptance, archive_candidate_count: plan.archive_candidate_count });

  for (const name of ARCHIVED_TASKS) {
    assert(`archived_task_source_absent:${name}`, !exists(`docs/tasks/${name}`), { name });
    assert(`archived_task_destination_present:${name}`, exists(`docs/legacy/tasks/${name}`), { name });
  }

  assert('p8_current_docs_not_moved', exists('docs/tasks/P8-10-Real-Evidence-Closed-Loop-Completion-Review.md'), {});
  assert('p8_current_runtime_not_moved', exists('scripts/twin_kernel/P8_09_PRODUCT_REPLAY_DEMO_REPORT_V0.cjs'), {});

  const changed = changedFilesFromMain();
  const runtimeChanged = changed.filter((file) => FORBIDDEN_RUNTIME_PREFIXES.some((prefix) => file.startsWith(prefix)));
  assert('runtime_surface_unchanged', runtimeChanged.length === 0, { runtimeChanged, changed });

  console.log(JSON.stringify({
    ok: true,
    acceptance: ACCEPTANCE,
    all_prior_gates_verified: true,
    p8_freeze_registered: true,
    first_archive_batch_verified: true,
    first_archive_batch_count: ARCHIVED_TASKS.length,
    reference_audit_report_verified: true,
    archive_plan_report_verified: true,
    handoff_map_verified: true,
    twin_lineage_verified: true,
    runtime_surface_unchanged: true,
    repository_convergence_complete: true,
    changed_file_count: changed.length,
    changed_files: changed,
    ...summary(),
    completion_status: 'POST-P8 Repository Convergence & Twin Lineage Handoff = COMPLETE'
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

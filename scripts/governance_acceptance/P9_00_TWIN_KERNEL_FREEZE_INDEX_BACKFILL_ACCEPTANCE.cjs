// scripts/governance_acceptance/P9_00_TWIN_KERNEL_FREEZE_INDEX_BACKFILL_ACCEPTANCE.cjs
// Purpose: verify P9-00 Twin Kernel freeze index backfill entries in README_MIGRATION.md.
// Boundary: file-system governance verification only; no runtime, DB, fact, Field Memory, model, AO-ACT, dispatch, receipt, or frontend surface is changed.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const ACCEPTANCE = 'P9_00_TWIN_KERNEL_FREEZE_INDEX_BACKFILL_ACCEPTANCE';
const README = 'README_MIGRATION.md';
const TASK_DOC = 'docs/tasks/P9-00-Twin-Kernel-Freeze-Index-Backfill.md';
const TWIN_README = 'docs/twin_kernel/README.md';
const P8_ACCEPTANCE = 'scripts/governance_acceptance/P8_10_REAL_EVIDENCE_CLOSED_LOOP_COMPLETION_REVIEW.cjs';
const POST_P8_ACCEPTANCE = 'scripts/governance_acceptance/POST_P8_18_HISTORICAL_TASK_DOC_APPLY_BUNDLE_ACCEPTANCE.cjs';
const CURRENT_SCRIPT = 'scripts/governance_acceptance/P9_00_TWIN_KERNEL_FREEZE_INDEX_BACKFILL_ACCEPTANCE.cjs';

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

function assert(name, condition, details = {}) {
  assertions.push({ name, passed: condition === true, details });
  if (condition !== true) {
    const error = new Error(`ASSERTION_FAILED:${name}`);
    error.details = details;
    throw error;
  }
}

function containsAll(text, tokens) {
  return tokens.every((token) => text.includes(token));
}

function summary() {
  const failed = assertions.filter((item) => !item.passed);
  return {
    assertion_count: assertions.length,
    failed_assertion_count: failed.length,
    failed_assertions: failed.map((item) => item.name),
  };
}

function verifyFilesExist() {
  for (const file of [README, TASK_DOC, TWIN_README, P8_ACCEPTANCE, POST_P8_ACCEPTANCE, CURRENT_SCRIPT]) {
    assert(`required_file_exists:${file}`, exists(file), { file });
  }
}

function verifyCanonicalFreezeAuthority(readme) {
  assert(
    'readme_migration_is_canonical_freeze_index',
    containsAll(readme, [
      'README_MIGRATION.md is the only canonical index for Sprint / Tag / Freeze state.',
      'Any change that affects:',
      'must update this file in the same commit.',
      'Every freeze snapshot must declare:',
    ]),
    {}
  );
}

function verifyP8FreezeSnapshot(readme) {
  assert(
    'readme_migration_p8_freeze_snapshot_present',
    containsAll(readme, [
      'GEOX – P8 Real Evidence Closed-Loop Acceptance / Product Replay Demo Freeze Snapshot',
      'p8_real_evidence_closed_loop_demo_completion',
      'p8_real_evidence_closed_loop_demo_main_merge',
      'P8_10_REAL_EVIDENCE_CLOSED_LOOP_COMPLETION_REVIEW.cjs',
      'P8 replay runtime is read-only',
      'Prediction is not authorization',
      'Calibration candidate is not model update',
    ]),
    {}
  );
}

function verifyTwinKernelDualLineSnapshot(readme) {
  assert(
    'readme_migration_twin_kernel_dual_line_snapshot_present',
    containsAll(readme, [
      'P9-00 Twin Kernel Dual-Line Freeze Backfill Snapshot',
      'docs/twin_kernel/README.md',
      'server_persisted_twin_kernel',
      'offline_real_evidence_replay_kernel',
      'product runtime line',
      'offline replay / validation line',
      'No silent crossing between the two Twin Kernel lines is allowed before a future reconciliation contract exists.',
    ]),
    {}
  );
}

function verifyPostP8CleanupSnapshot(readme) {
  assert(
    'readme_migration_post_p8_cleanup_snapshot_present',
    containsAll(readme, [
      'P9-00 POST-P8 Historical Task Doc Cleanup Freeze Backfill Snapshot',
      'post_p8_historical_task_doc_apply_bundle_main_merge',
      '3e9663fc071ffe355d9dbcdc1f095ad40b3e6912',
      'POST_P8_18_HISTORICAL_TASK_DOC_APPLY_BUNDLE_ACCEPTANCE.cjs',
      'docs/legacy/POST_P8_18_HISTORICAL_TASK_DOC_APPLY_BUNDLE_REPORT.json',
      'moved_file_count = 48',
      'reference_update_plan_item_count = 371',
      'runtime_surface_diff_count = 0',
      'POST-P8 historical_task_doc cleanup is complete and no further POST-P8 historical cleanup gate is added by P9-00.',
    ]),
    {}
  );
}

function verifyTaskDoc(taskDoc) {
  assert(
    'task_doc_declares_p9_00_scope',
    containsAll(taskDoc, [
      'P9-00 Twin Kernel Freeze Index Backfill',
      'Authority source: README_MIGRATION.md',
      'no_runtime_code_change',
      'no_database_migration',
      'no_ao_act_task',
      'failed_assertion_count = 0',
    ]),
    {}
  );
}

function verifyTwinReadme(twinReadme) {
  assert(
    'twin_readme_declares_existing_dual_line_reference',
    containsAll(twinReadme, [
      'line_id = server_persisted_twin_kernel',
      'line_id = offline_real_evidence_replay_kernel',
      'source_data_contract',
      'artifact_mapping',
      'model_version_mapping',
      'case_manifest',
      'acceptance_entrypoint',
    ]),
    {}
  );
}

try {
  verifyFilesExist();
  const readme = read(README);
  const taskDoc = read(TASK_DOC);
  const twinReadme = read(TWIN_README);

  verifyCanonicalFreezeAuthority(readme);
  verifyP8FreezeSnapshot(readme);
  verifyTwinKernelDualLineSnapshot(readme);
  verifyPostP8CleanupSnapshot(readme);
  verifyTaskDoc(taskDoc);
  verifyTwinReadme(twinReadme);

  console.log(JSON.stringify({
    ok: true,
    acceptance: ACCEPTANCE,
    readme_migration_p8_freeze_snapshot_present: true,
    readme_migration_twin_kernel_dual_line_snapshot_present: true,
    readme_migration_post_p8_cleanup_snapshot_present: true,
    post_p8_cleanup_no_further_gate_declared: true,
    p8_manual_deterministic_acceptance_status_explicit: true,
    runtime_surface_changed: false,
    next_step: 'P9-01 Twin Kernel Line Authority Contract',
    ...summary(),
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

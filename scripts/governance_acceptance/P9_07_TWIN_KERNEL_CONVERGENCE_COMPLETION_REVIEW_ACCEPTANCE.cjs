// scripts/governance_acceptance/P9_07_TWIN_KERNEL_CONVERGENCE_COMPLETION_REVIEW_ACCEPTANCE.cjs
// Purpose: verify P9-07 Twin Kernel convergence completion review and re-run prior P9 governance acceptances.
// Boundary: read-only file-system governance verification; no runtime, DB, fact, Field Memory, model, AO-ACT, dispatch, receipt, frontend surface, replay algorithm, or kernel line merge is changed.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = process.cwd();
const ACCEPTANCE = 'P9_07_TWIN_KERNEL_CONVERGENCE_COMPLETION_REVIEW_ACCEPTANCE';

const REVIEW = 'docs/twin_kernel/TWIN_KERNEL_CONVERGENCE_COMPLETION_REVIEW_V0.json';
const TASK_DOC = 'docs/tasks/P9-07-Twin-Kernel-Convergence-Completion-Review.md';
const TWIN_README = 'docs/twin_kernel/README.md';
const SCRIPTS_README = 'scripts/twin_kernel/README.md';

const PRIOR_ACCEPTANCES = [
  ['P9-00', 'scripts/governance_acceptance/P9_00_TWIN_KERNEL_FREEZE_INDEX_BACKFILL_ACCEPTANCE.cjs'],
  ['P9-01', 'scripts/governance_acceptance/P9_01_TWIN_KERNEL_LINE_AUTHORITY_CONTRACT_ACCEPTANCE.cjs'],
  ['P9-02', 'scripts/governance_acceptance/P9_02_REPLAY_REGISTRY_V0_ACCEPTANCE.cjs'],
  ['P9-03', 'scripts/governance_acceptance/P9_03_REPLAY_CASE_MANIFEST_V0_ACCEPTANCE.cjs'],
  ['P9-04', 'scripts/governance_acceptance/P9_04_MODEL_VERSION_MANIFEST_V0_ACCEPTANCE.cjs'],
  ['P9-05', 'scripts/governance_acceptance/P9_05_ACCEPTANCE_ENTRY_UNIFICATION_ACCEPTANCE.cjs'],
  ['P9-06', 'scripts/governance_acceptance/P9_06_REPLAY_ARTIFACT_MAPPING_CONTRACT_V0_ACCEPTANCE.cjs'],
];

const REQUIRED_ARTIFACTS = [
  'docs/tasks/P9-00-Twin-Kernel-Freeze-Index-Backfill.md',
  'docs/twin_kernel/TWIN_KERNEL_LINE_AUTHORITY_CONTRACT_V0.md',
  'docs/twin_kernel/REPLAY_REGISTRY_V0.json',
  'docs/twin_kernel/replay_cases/p8_real_evidence_closed_loop_caf009_soil_moisture_v0.json',
  'docs/twin_kernel/model_versions/p8_real_soil_moisture_model_version_manifest_v0.json',
  'docs/twin_kernel/ACCEPTANCE_ENTRYPOINTS_V0.json',
  'docs/twin_kernel/REPLAY_ARTIFACT_MAPPING_CONTRACT_V0.json',
];

const assertions = [];
const priorResults = [];

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

function assert(name, condition, details = {}) {
  assertions.push({ name, passed: condition === true, details });
  if (condition !== true) {
    const error = new Error('ASSERTION_FAILED:' + name);
    error.details = details;
    throw error;
  }
}

function containsAll(text, tokens) {
  return tokens.every((token) => text.includes(token));
}

function containsAllArray(values, tokens) {
  return tokens.every((token) => Array.isArray(values) && values.includes(token));
}

function summary() {
  const failed = assertions.filter((item) => !item.passed);
  return {
    assertion_count: assertions.length,
    failed_assertion_count: failed.length,
    failed_assertions: failed.map((item) => item.name),
  };
}

function verifyRequiredFiles() {
  for (const file of [REVIEW, TASK_DOC, TWIN_README, SCRIPTS_README, ...REQUIRED_ARTIFACTS]) {
    assert('required_file_exists:' + file, exists(file), { file });
  }

  for (const [, script] of PRIOR_ACCEPTANCES) {
    assert('prior_acceptance_script_exists:' + script, exists(script), { script });
  }
}

function verifyCompletionReview(review) {
  assert('completion_review_schema_version_is_v0', review.schema_version === 'twin_kernel_convergence_completion_review_v0', { schema_version: review.schema_version });
  assert('completion_review_acceptance_is_p9_07', review.acceptance === 'scripts/governance_acceptance/P9_07_TWIN_KERNEL_CONVERGENCE_COMPLETION_REVIEW_ACCEPTANCE.cjs', { acceptance: review.acceptance });
  assert('completion_scope_declares_governance_complete_not_runtime_complete', review.completion_scope && review.completion_scope.convergence_status === 'governance_convergence_complete' && review.completion_scope.runtime_convergence_status === 'not_started', { completion_scope: review.completion_scope });
  assert('completion_scope_declares_lines_not_merged', review.completion_scope && review.completion_scope.kernel_lines_merged === false && review.completion_scope.persisted_runtime_changed === false && review.completion_scope.offline_replay_runtime_changed === false, { completion_scope: review.completion_scope });

  assert('completed_governance_artifact_count_is_expected', Array.isArray(review.completed_governance_artifacts) && review.completed_governance_artifacts.length === 7, { count: review.completed_governance_artifacts && review.completed_governance_artifacts.length });

  for (const [taskId, script] of PRIOR_ACCEPTANCES) {
    const row = review.completed_governance_artifacts.find((item) => item.task_id === taskId);
    assert('completion_artifact_row_present:' + taskId, Boolean(row), { taskId });
    assert('completion_artifact_row_script_matches:' + taskId, row.acceptance === script && row.status === 'complete', { row, script });
    assert('completion_artifact_path_exists:' + taskId, exists(row.artifact), { artifact: row.artifact });
  }

  assert('line_authority_result_blocks_silent_crossing', review.line_authority_result && review.line_authority_result.silent_crossing_allowed === false && review.line_authority_result.p8_artifacts_are_persisted_twin_objects === false && review.line_authority_result.future_reconciliation_contract_required_before_runtime_convergence === true, { line_authority_result: review.line_authority_result });
  assert('registry_result_matches_p9_02', review.registry_result && review.registry_result.registered_case_count === 1 && review.registry_result.artifact_record_count === 7 && review.registry_result.committed_artifact_paths_required === false, { registry_result: review.registry_result });
  assert('manifest_result_matches_p9_03_p9_04', review.manifest_result && review.manifest_result.model_version_count === 5 && review.manifest_result.trained_model === false && review.manifest_result.model_update_allowed === false && review.manifest_result.calibration_candidate_applied === false, { manifest_result: review.manifest_result });
  assert('mapping_result_matches_p9_06', review.mapping_result && review.mapping_result.mapping_record_count === 7 && review.mapping_result.candidate_mapping_only === true && review.mapping_result.all_mappings_non_executable === true && review.mapping_result.automatic_materialization_allowed === false && review.mapping_result.all_writes_forbidden === true, { mapping_result: review.mapping_result });

  assert('completion_review_declares_hard_boundaries', containsAllArray(review.hard_boundaries, [
    'completion_review_only',
    'no_runtime_code_change',
    'no_server_route_change',
    'no_frontend_change',
    'no_database_migration',
    'no_replay_algorithm_change',
    'no_model_update',
    'no_field_memory_write',
    'no_db_write',
    'no_fact_write',
    'no_ao_act_task',
    'no_persisted_twin_object_creation',
    'no_kernel_line_merge',
  ]), { hard_boundaries: review.hard_boundaries });
}

function runPriorAcceptances() {
  for (const [taskId, script] of PRIOR_ACCEPTANCES) {
    const result = spawnSync(process.execPath, [script], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let parsed = null;
    try {
      parsed = JSON.parse(String(result.stdout || result.stderr || '').trim());
    } catch {
      parsed = null;
    }

    const passed = result.status === 0 && parsed && parsed.ok === true && parsed.failed_assertion_count === 0;
    priorResults.push({ task_id: taskId, script, status: result.status, ok: parsed && parsed.ok, failed_assertion_count: parsed && parsed.failed_assertion_count });
    assert('prior_acceptance_passed:' + taskId, passed, { taskId, script, status: result.status, stdout: result.stdout, stderr: result.stderr });
  }
}

function verifyDocs() {
  const taskDoc = read(TASK_DOC);
  const twinReadme = read(TWIN_README);
  const scriptsReadme = read(SCRIPTS_README);

  assert('task_doc_declares_p9_07_scope', containsAll(taskDoc, [
    'P9-07 Twin Kernel Convergence Completion Review',
    REVIEW,
    'governance_convergence_complete = true',
    'runtime_convergence_status = not_started',
    'P9 branch ready for PR or main merge review',
  ]), {});

  assert('twin_readme_links_p9_07_completion_review', containsAll(twinReadme, [
    'P9-07 Twin Kernel Convergence Completion Review',
    REVIEW,
    'governance_convergence_complete = true',
    'runtime_convergence_status = not_started',
    'P9 branch ready for PR or main merge review',
  ]), {});

  assert('scripts_readme_links_p9_07_completion_review', containsAll(scriptsReadme, [
    'P9-07 Twin Kernel Convergence Completion Review',
    REVIEW,
    'kernel_lines_merged = false',
    'future_reconciliation_contract_required_before_runtime_convergence = true',
  ]), {});
}

try {
  verifyRequiredFiles();

  const review = readJson(REVIEW);
  verifyCompletionReview(review);
  verifyDocs();
  runPriorAcceptances();

  console.log(JSON.stringify({
    ok: true,
    acceptance: ACCEPTANCE,
    completion_review_present: true,
    completed_governance_artifact_count: review.completed_governance_artifacts.length,
    prior_p9_acceptance_count: PRIOR_ACCEPTANCES.length,
    prior_p9_acceptances_passed: true,
    governance_convergence_complete: true,
    runtime_convergence_status: 'not_started',
    kernel_lines_merged: false,
    runtime_surface_changed: false,
    next_step: 'P9 branch ready for PR or main merge review',
    prior_results: priorResults,
    ...summary(),
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    acceptance: ACCEPTANCE,
    error: error.message,
    details: error.details || null,
    assertions,
    prior_results: priorResults,
  }, null, 2));
  process.exit(1);
}

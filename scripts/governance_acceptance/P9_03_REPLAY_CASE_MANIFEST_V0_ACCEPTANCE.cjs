// scripts/governance_acceptance/P9_03_REPLAY_CASE_MANIFEST_V0_ACCEPTANCE.cjs
// Purpose: verify P9-03 Replay Case Manifest v0 without executing replay runtime or creating artifacts.
// Boundary: read-only file-system governance verification; no runtime, DB, fact, Field Memory, model, AO-ACT, dispatch, receipt, or frontend surface is changed.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const ACCEPTANCE = 'P9_03_REPLAY_CASE_MANIFEST_V0_ACCEPTANCE';

const REGISTRY = 'docs/twin_kernel/REPLAY_REGISTRY_V0.json';
const CASE_MANIFEST = 'docs/twin_kernel/replay_cases/p8_real_evidence_closed_loop_caf009_soil_moisture_v0.json';
const TASK_DOC = 'docs/tasks/P9-03-Replay-Case-Manifest-v0.md';
const CONTRACT = 'docs/twin_kernel/TWIN_KERNEL_LINE_AUTHORITY_CONTRACT_V0.md';
const TWIN_README = 'docs/twin_kernel/README.md';
const SCRIPTS_README = 'scripts/twin_kernel/README.md';
const P8_COMPLETION_ACCEPTANCE = 'scripts/governance_acceptance/P8_10_REAL_EVIDENCE_CLOSED_LOOP_COMPLETION_REVIEW.cjs';

const EXPECTED_CASE_ID = 'p8_real_evidence_closed_loop_caf009_soil_moisture_v0';
const EXPECTED_STEPS = [
  ['p8_02_real_evidence_window', 1, 'scripts/twin_kernel/P8_02_REAL_EVIDENCE_WINDOW_BUILDER_V0.cjs', 'real_evidence_window_v0'],
  ['p8_04_real_state_estimate', 2, 'scripts/twin_kernel/P8_04_REAL_STATE_ESTIMATE_RUNTIME_V1.cjs', 'real_soil_moisture_state_estimate_v1'],
  ['p8_05_real_prediction_run', 3, 'scripts/twin_kernel/P8_05_REAL_PREDICTION_RUN_V1.cjs', 'real_soil_moisture_prediction_run_v1'],
  ['p8_06_real_actual_observation_window', 4, 'scripts/twin_kernel/P8_06_REAL_ACTUAL_OBSERVATION_WINDOW_V0.cjs', 'real_actual_observation_window_v0'],
  ['p8_07_real_backtest_error_report', 5, 'scripts/twin_kernel/P8_07_REAL_BACKTEST_ERROR_REPORT_V1.cjs', 'real_backtest_error_report_v1'],
  ['p8_08_real_calibration_report', 6, 'scripts/twin_kernel/P8_08_REAL_CALIBRATION_REPORT_V1.cjs', 'real_calibration_report_v1'],
  ['p8_09_product_replay_demo_report', 7, 'scripts/twin_kernel/P8_09_PRODUCT_REPLAY_DEMO_REPORT_V0.cjs', 'product_replay_demo_report_v0'],
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
  for (const file of [REGISTRY, CASE_MANIFEST, TASK_DOC, CONTRACT, TWIN_README, SCRIPTS_README, P8_COMPLETION_ACCEPTANCE]) {
    assert('required_file_exists:' + file, exists(file), { file });
  }
}

function verifyRegistryLink(registry) {
  assert('registry_schema_still_replay_registry_v0', registry.schema_version === 'replay_registry_v0', { schema_version: registry.schema_version });
  assert('registry_has_p9_03_case_manifest_acceptance', registry.case_manifest_acceptance === 'scripts/governance_acceptance/P9_03_REPLAY_CASE_MANIFEST_V0_ACCEPTANCE.cjs', { case_manifest_acceptance: registry.case_manifest_acceptance });
  assert('registry_case_count_still_one', Array.isArray(registry.registered_replay_cases) && registry.registered_replay_cases.length === 1, { count: registry.registered_replay_cases && registry.registered_replay_cases.length });

  const replayCase = registry.registered_replay_cases[0];
  assert('registry_points_to_case_manifest', replayCase.case_id === EXPECTED_CASE_ID && replayCase.case_manifest_path === CASE_MANIFEST && replayCase.case_manifest_schema_version === 'replay_case_manifest_v0', { replayCase });
  assert('registry_keeps_committed_artifact_paths_not_required', replayCase.committed_artifact_paths_required === false && replayCase.artifact_materialization === 'stdout_json_contract', { replayCase });

  return replayCase;
}

function verifyCaseManifest(manifest, registryCase) {
  assert('case_manifest_schema_version_is_v0', manifest.schema_version === 'replay_case_manifest_v0', { schema_version: manifest.schema_version });
  assert('case_manifest_id_matches_registry', manifest.case_id === registryCase.case_id && manifest.case_id === EXPECTED_CASE_ID, { manifest_case_id: manifest.case_id, registry_case_id: registryCase.case_id });
  assert('case_manifest_acceptance_is_p9_03', manifest.acceptance === 'scripts/governance_acceptance/P9_03_REPLAY_CASE_MANIFEST_V0_ACCEPTANCE.cjs', { acceptance: manifest.acceptance });
  assert('case_manifest_line_is_offline_replay', manifest.case_identity && manifest.case_identity.source_line_id === 'offline_real_evidence_replay_kernel', { case_identity: manifest.case_identity });
  assert('case_manifest_reuses_existing_p8_completion_acceptance', manifest.case_identity && manifest.case_identity.completion_acceptance === P8_COMPLETION_ACCEPTANCE && exists(manifest.case_identity.completion_acceptance), { case_identity: manifest.case_identity });

  assert('case_manifest_data_scope_matches_registry', manifest.data_scope &&
    manifest.data_scope.project_id === registryCase.project_id &&
    manifest.data_scope.sensor_group_id === registryCase.sensor_group_id &&
    manifest.data_scope.sensor_id === registryCase.sensor_id &&
    manifest.data_scope.metric_kind === registryCase.metric_kind &&
    manifest.data_scope.expected_interval_ms === registryCase.expected_interval_ms &&
    manifest.data_scope.source_table === 'raw_samples',
    { data_scope: manifest.data_scope, registryCase });

  assert('case_manifest_windows_match_registry', JSON.stringify(manifest.data_scope.history_window) === JSON.stringify(registryCase.history_window) && JSON.stringify(manifest.data_scope.prediction_window) === JSON.stringify(registryCase.prediction_window) && JSON.stringify(manifest.data_scope.actual_window) === JSON.stringify(registryCase.actual_window), { data_scope: manifest.data_scope, registryCase });

  assert('case_manifest_data_precondition_is_external_manual', manifest.data_precondition && manifest.data_precondition.preloaded_by_replay_runtime === false && manifest.data_precondition.replay_runtime_may_seed_raw_samples === false && manifest.data_precondition.data_prep_script_in_scope === false, { data_precondition: manifest.data_precondition });
}

function verifyRuntimeChain(manifest) {
  assert('runtime_chain_step_count_is_expected', Array.isArray(manifest.runtime_chain) && manifest.runtime_chain.length === EXPECTED_STEPS.length, { count: manifest.runtime_chain && manifest.runtime_chain.length });

  for (const [stepId, order, script, artifactKind] of EXPECTED_STEPS) {
    const step = manifest.runtime_chain.find((item) => item.step_id === stepId);
    assert('runtime_chain_step_present:' + stepId, Boolean(step), { stepId });
    assert('runtime_chain_step_matches:' + stepId, step.order === order && step.script === script && step.output_artifact_kind === artifactKind, { expected: { order, script, artifactKind }, actual: step });
    assert('runtime_chain_script_exists:' + stepId, exists(step.script), { script: step.script });
  }
}

function verifyPoliciesAndBoundaries(manifest) {
  assert('artifact_policy_keeps_stdout_only', manifest.artifact_policy && manifest.artifact_policy.artifact_materialization === 'stdout_json_contract' && manifest.artifact_policy.committed_artifact_paths_required === false && manifest.artifact_policy.committed_artifact_files_created_by_p9_03 === false && manifest.artifact_policy.artifact_mapping_contract_created_by_p9_03 === false, { artifact_policy: manifest.artifact_policy });

  assert('determinism_policy_does_not_execute_replay', manifest.determinism_policy && manifest.determinism_policy.fixed_case_windows === true && manifest.determinism_policy.fixed_project_sensor_scope === true && manifest.determinism_policy.case_manifest_does_not_execute_replay === true, { determinism_policy: manifest.determinism_policy });

  assert('case_manifest_declares_hard_boundaries', containsAllArray(manifest.hard_boundaries, [
    'runtime_read_only',
    'no_db_write_by_replay_runtime',
    'no_fact_write',
    'no_field_memory_write',
    'no_model_write',
    'no_ao_act_task',
    'no_server_route',
    'no_frontend_authority',
    'no_new_replay_case',
    'no_replay_execution_by_manifest_acceptance',
    'no_persisted_twin_object_creation',
    'no_model_version_manifest_creation',
  ]), { hard_boundaries: manifest.hard_boundaries });
}

function verifyDocs() {
  const taskDoc = read(TASK_DOC);
  const twinReadme = read(TWIN_README);
  const scriptsReadme = read(SCRIPTS_README);

  assert('task_doc_declares_p9_03_scope', containsAll(taskDoc, [
    'P9-03 Replay Case Manifest v0',
    CASE_MANIFEST,
    'no_new_replay_case',
    'no_replay_execution',
    'no_model_version_manifest_creation',
    'P9-04 Model Version Manifest v0',
  ]), {});

  assert('twin_readme_links_p9_03_manifest', containsAll(twinReadme, [
    'P9-03 Replay Case Manifest v0',
    CASE_MANIFEST,
    'case_manifest_schema_version = replay_case_manifest_v0',
    'P9-04 Model Version Manifest v0',
  ]), {});

  assert('scripts_readme_links_p9_03_manifest', containsAll(scriptsReadme, [
    'P9-03 Replay Case Manifest v0',
    CASE_MANIFEST,
    'case_manifest_does_not_execute_replay = true',
  ]), {});
}

try {
  verifyRequiredFiles();

  const registry = readJson(REGISTRY);
  const manifest = readJson(CASE_MANIFEST);

  const registryCase = verifyRegistryLink(registry);
  verifyCaseManifest(manifest, registryCase);
  verifyRuntimeChain(manifest);
  verifyPoliciesAndBoundaries(manifest);
  verifyDocs();

  console.log(JSON.stringify({
    ok: true,
    acceptance: ACCEPTANCE,
    case_manifest_present: true,
    registry_points_to_case_manifest: true,
    runtime_chain_step_count: manifest.runtime_chain.length,
    generator_scripts_exist: true,
    committed_artifact_paths_required: false,
    runtime_surface_changed: false,
    next_step: 'P9-04 Model Version Manifest v0',
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

// scripts/governance_acceptance/P9_04_MODEL_VERSION_MANIFEST_V0_ACCEPTANCE.cjs
// Purpose: verify P9-04 Model Version Manifest v0 without training, updating, or applying model state.
// Boundary: read-only file-system governance verification; no runtime, DB, fact, Field Memory, model, AO-ACT, dispatch, receipt, or frontend surface is changed.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const ACCEPTANCE = 'P9_04_MODEL_VERSION_MANIFEST_V0_ACCEPTANCE';

const MODEL_MANIFEST = 'docs/twin_kernel/model_versions/p8_real_soil_moisture_model_version_manifest_v0.json';
const CASE_MANIFEST = 'docs/twin_kernel/replay_cases/p8_real_evidence_closed_loop_caf009_soil_moisture_v0.json';
const TASK_DOC = 'docs/tasks/P9-04-Model-Version-Manifest-v0.md';
const TWIN_README = 'docs/twin_kernel/README.md';
const SCRIPTS_README = 'scripts/twin_kernel/README.md';

const EXPECTED_MODELS = [
  ['weighted_recent_mean_v1', 'state_estimation', 'scripts/twin_kernel/P8_04_REAL_STATE_ESTIMATE_RUNTIME_V1.cjs', 'weighted_recent_mean_v1'],
  ['linear_recent_window_trend_v1', 'prediction', 'scripts/twin_kernel/P8_05_REAL_PREDICTION_RUN_V1.cjs', 'linear_recent_window_trend_v1'],
  ['observed_window_range_mean_v1', 'state_uncertainty', 'scripts/twin_kernel/P8_04_REAL_STATE_ESTIMATE_RUNTIME_V1.cjs', 'observed_window_range_mean'],
  ['state_uncertainty_growth_v1', 'prediction_uncertainty', 'scripts/twin_kernel/P8_05_REAL_PREDICTION_RUN_V1.cjs', 'state_uncertainty_growth_v1'],
  ['real_backtest_bias_summary_v1', 'calibration_candidate_summary', 'scripts/twin_kernel/P8_08_REAL_CALIBRATION_REPORT_V1.cjs', 'real_backtest_bias_summary_v1'],
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
  for (const file of [MODEL_MANIFEST, CASE_MANIFEST, TASK_DOC, TWIN_README, SCRIPTS_README]) {
    assert('required_file_exists:' + file, exists(file), { file });
  }
}

function verifyCaseManifestLink(caseManifest) {
  assert('case_manifest_points_to_model_version_manifest', caseManifest.model_version_manifest === MODEL_MANIFEST && caseManifest.model_version_manifest_schema_version === 'model_version_manifest_v0', { model_version_manifest: caseManifest.model_version_manifest, model_version_manifest_schema_version: caseManifest.model_version_manifest_schema_version });
  assert('case_manifest_model_policy_blocks_updates', caseManifest.model_policy && caseManifest.model_policy.model_update_allowed === false && caseManifest.model_policy.trained_model === false && caseManifest.model_policy.calibration_candidate_applied === false && caseManifest.model_policy.automatic_learning_loop === false, { model_policy: caseManifest.model_policy });
}

function verifyModelManifestTopLevel(manifest, caseManifest) {
  assert('model_manifest_schema_version_is_v0', manifest.schema_version === 'model_version_manifest_v0', { schema_version: manifest.schema_version });
  assert('model_manifest_scope_matches_case', manifest.scope && manifest.scope.case_id === caseManifest.case_id && manifest.scope.source_line_id === 'offline_real_evidence_replay_kernel', { scope: manifest.scope, case_id: caseManifest.case_id });
  assert('model_manifest_has_no_runtime_effect', manifest.scope && manifest.scope.runtime_effect === 'none' && manifest.scope.persistence_effect === 'none' && manifest.scope.model_state_effect === 'none', { scope: manifest.scope });
  assert('model_manifest_acceptance_is_p9_04', manifest.acceptance === 'scripts/governance_acceptance/P9_04_MODEL_VERSION_MANIFEST_V0_ACCEPTANCE.cjs', { acceptance: manifest.acceptance });
}

function verifyModelSet(manifest) {
  const modelSet = manifest.model_set || {};
  assert('model_set_identity_is_expected', modelSet.model_set_id === 'p8_real_soil_moisture_replay_model_set_v0' && modelSet.metric_kind === 'soil_moisture' && modelSet.unit === 'vwc_fraction', { modelSet });
  assert('model_set_is_not_trained_or_external', modelSet.trained_model === false && modelSet.external_model_dependency === false && modelSet.learned_parameter_state === false && modelSet.model_state_materialization === 'none', { modelSet });
  assert('model_set_blocks_update', modelSet.model_update_allowed === false && modelSet.calibration_candidate_applied === false, { modelSet });
}

function verifyModelVersions(manifest) {
  assert('model_version_count_is_expected', Array.isArray(manifest.model_versions) && manifest.model_versions.length === EXPECTED_MODELS.length, { count: manifest.model_versions && manifest.model_versions.length });

  for (const [modelVersionId, role, runtimeRef, methodName] of EXPECTED_MODELS) {
    const model = manifest.model_versions.find((item) => item.model_version_id === modelVersionId);
    assert('model_version_present:' + modelVersionId, Boolean(model), { modelVersionId });
    assert('model_version_role_matches:' + modelVersionId, model.model_role === role, { expected: role, actual: model.model_role });
    assert('model_version_runtime_exists:' + modelVersionId, model.runtime_ref === runtimeRef && exists(model.runtime_ref), { expected: runtimeRef, actual: model.runtime_ref });
    assert('model_version_method_matches:' + modelVersionId, model.method_name === methodName, { expected: methodName, actual: model.method_name });
    assert('model_version_source_script_contains_method:' + modelVersionId, read(model.runtime_ref).includes(methodName), { runtime_ref: model.runtime_ref, methodName });
    assert('model_version_blocks_state_write:' + modelVersionId, model.state_write_allowed === false && model.model_update_allowed === false, { model });
  }
}

function verifyCalibrationPolicy(manifest) {
  const policy = manifest.calibration_policy || {};
  assert('calibration_policy_candidate_only', policy.calibration_candidate_only === true && policy.applied_to_model === false && policy.model_update_ref === null && policy.field_memory_write_ref === null && policy.automatic_learning_loop === false, { policy });
}

function verifyImmutabilityAndBoundaries(manifest) {
  const policy = manifest.immutability_policy || {};
  assert('immutability_policy_blocks_model_changes', policy.p9_04_writes_model_state === false && policy.p9_04_changes_runtime_algorithm === false && policy.p9_04_changes_replay_outputs === false && policy.p9_04_creates_training_run === false && policy.p9_04_creates_model_artifact_file === false, { policy });

  assert('model_manifest_declares_hard_boundaries', containsAllArray(manifest.hard_boundaries, [
    'no_runtime_code_change',
    'no_server_route_change',
    'no_frontend_change',
    'no_database_migration',
    'no_replay_algorithm_change',
    'no_training_run',
    'no_model_artifact_file',
    'no_model_state_write',
    'no_model_update',
    'no_calibration_application',
    'no_field_memory_write',
    'no_db_write',
    'no_fact_write',
    'no_ao_act_task',
    'no_persisted_twin_object_creation',
    'calibration_candidate_is_not_model_update',
  ]), { hard_boundaries: manifest.hard_boundaries });
}

function verifyDocs() {
  const taskDoc = read(TASK_DOC);
  const twinReadme = read(TWIN_README);
  const scriptsReadme = read(SCRIPTS_README);

  assert('task_doc_declares_p9_04_scope', containsAll(taskDoc, [
    'P9-04 Model Version Manifest v0',
    MODEL_MANIFEST,
    'trained_model = false',
    'model_update_allowed = false',
    'calibration_candidate_applied = false',
    'P9-05 Acceptance Entry Unification',
  ]), {});

  assert('twin_readme_links_p9_04_model_manifest', containsAll(twinReadme, [
    'P9-04 Model Version Manifest v0',
    MODEL_MANIFEST,
    'model_update_allowed = false',
    'calibration_candidate_applied = false',
    'P9-05 Acceptance Entry Unification',
  ]), {});

  assert('scripts_readme_links_p9_04_model_manifest', containsAll(scriptsReadme, [
    'P9-04 Model Version Manifest v0',
    MODEL_MANIFEST,
    'deterministic_heuristic_replay_models',
    'automatic_learning_loop = false',
  ]), {});
}

try {
  verifyRequiredFiles();

  const manifest = readJson(MODEL_MANIFEST);
  const caseManifest = readJson(CASE_MANIFEST);

  verifyCaseManifestLink(caseManifest);
  verifyModelManifestTopLevel(manifest, caseManifest);
  verifyModelSet(manifest);
  verifyModelVersions(manifest);
  verifyCalibrationPolicy(manifest);
  verifyImmutabilityAndBoundaries(manifest);
  verifyDocs();

  console.log(JSON.stringify({
    ok: true,
    acceptance: ACCEPTANCE,
    model_version_manifest_present: true,
    model_version_count: manifest.model_versions.length,
    case_manifest_points_to_model_version_manifest: true,
    model_update_allowed: false,
    calibration_candidate_applied: false,
    runtime_surface_changed: false,
    next_step: 'P9-05 Acceptance Entry Unification',
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

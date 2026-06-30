// scripts/governance_acceptance/P9_02_REPLAY_REGISTRY_V0_ACCEPTANCE.cjs
// Purpose: verify P9-02 Replay Registry v0 without executing replay runtime or creating artifacts.
// Boundary: read-only file-system governance verification; no runtime, DB, fact, Field Memory, model, AO-ACT, dispatch, receipt, or frontend surface is changed.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const ACCEPTANCE = 'P9_02_REPLAY_REGISTRY_V0_ACCEPTANCE';

const REGISTRY = 'docs/twin_kernel/REPLAY_REGISTRY_V0.json';
const TASK_DOC = 'docs/tasks/P9-02-Replay-Registry-v0.md';
const CONTRACT = 'docs/twin_kernel/TWIN_KERNEL_LINE_AUTHORITY_CONTRACT_V0.md';
const TWIN_README = 'docs/twin_kernel/README.md';
const SCRIPTS_README = 'scripts/twin_kernel/README.md';
const P8_COMPLETION_ACCEPTANCE = 'scripts/governance_acceptance/P8_10_REAL_EVIDENCE_CLOSED_LOOP_COMPLETION_REVIEW.cjs';

const EXPECTED_ARTIFACTS = [
  ['real_evidence_window_v0', 'scripts/twin_kernel/P8_02_REAL_EVIDENCE_WINDOW_BUILDER_V0.cjs'],
  ['real_soil_moisture_state_estimate_v1', 'scripts/twin_kernel/P8_04_REAL_STATE_ESTIMATE_RUNTIME_V1.cjs'],
  ['real_soil_moisture_prediction_run_v1', 'scripts/twin_kernel/P8_05_REAL_PREDICTION_RUN_V1.cjs'],
  ['real_actual_observation_window_v0', 'scripts/twin_kernel/P8_06_REAL_ACTUAL_OBSERVATION_WINDOW_V0.cjs'],
  ['real_backtest_error_report_v1', 'scripts/twin_kernel/P8_07_REAL_BACKTEST_ERROR_REPORT_V1.cjs'],
  ['real_calibration_report_v1', 'scripts/twin_kernel/P8_08_REAL_CALIBRATION_REPORT_V1.cjs'],
  ['product_replay_demo_report_v0', 'scripts/twin_kernel/P8_09_PRODUCT_REPLAY_DEMO_REPORT_V0.cjs'],
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

function summary() {
  const failed = assertions.filter((item) => !item.passed);
  return {
    assertion_count: assertions.length,
    failed_assertion_count: failed.length,
    failed_assertions: failed.map((item) => item.name),
  };
}

function verifyRequiredFiles() {
  for (const file of [REGISTRY, TASK_DOC, CONTRACT, TWIN_README, SCRIPTS_README, P8_COMPLETION_ACCEPTANCE]) {
    assert('required_file_exists:' + file, exists(file), { file });
  }
}

function parseRegistry() {
  const text = read(REGISTRY);
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error('REGISTRY_JSON_PARSE_FAILED:' + error.message);
  }
}

function verifyRegistryTopLevel(registry) {
  assert('registry_schema_version_is_v0', registry.schema_version === 'replay_registry_v0', { schema_version: registry.schema_version });
  assert('registry_id_is_expected', registry.registry_id === 'twin_kernel_replay_registry_v0', { registry_id: registry.registry_id });
  assert('registry_scope_is_offline_replay_only', registry.scope && registry.scope.line_id === 'offline_real_evidence_replay_kernel' && registry.scope.runtime_effect === 'none' && registry.scope.persistence_effect === 'none', { scope: registry.scope });
  assert('registry_acceptance_points_to_p9_02', registry.acceptance === 'scripts/governance_acceptance/P9_02_REPLAY_REGISTRY_V0_ACCEPTANCE.cjs', { acceptance: registry.acceptance });
}

function verifyRegisteredCase(registry) {
  assert('registered_case_count_is_one', Array.isArray(registry.registered_replay_cases) && registry.registered_replay_cases.length === 1, { count: registry.registered_replay_cases && registry.registered_replay_cases.length });

  const replayCase = registry.registered_replay_cases[0];

  assert('registered_case_identity_is_p8_caf009_soil_moisture', replayCase.case_id === 'p8_real_evidence_closed_loop_caf009_soil_moisture_v0' && replayCase.project_id === 'P_DEFAULT' && replayCase.sensor_group_id === 'G_CAF' && replayCase.sensor_id === 'CAF009' && replayCase.metric_kind === 'soil_moisture', { replayCase });
  assert('registered_case_uses_existing_p8_completion_acceptance', replayCase.completion_acceptance === P8_COMPLETION_ACCEPTANCE && exists(replayCase.completion_acceptance), { completion_acceptance: replayCase.completion_acceptance });
  assert('registered_case_is_stdout_contract_not_committed_artifact', replayCase.artifact_materialization === 'stdout_json_contract' && replayCase.committed_artifact_paths_required === false, { artifact_materialization: replayCase.artifact_materialization, committed_artifact_paths_required: replayCase.committed_artifact_paths_required });
  assert('registered_case_does_not_seed_raw_samples_by_replay_runtime', replayCase.data_precondition && replayCase.data_precondition.preloaded_by_replay_runtime === false, { data_precondition: replayCase.data_precondition });

  return replayCase;
}

function verifyArtifactRecords(replayCase) {
  assert('artifact_record_count_is_expected', Array.isArray(replayCase.artifact_records) && replayCase.artifact_records.length === EXPECTED_ARTIFACTS.length, { count: replayCase.artifact_records && replayCase.artifact_records.length });

  for (const [artifactKind, generatorScript] of EXPECTED_ARTIFACTS) {
    const record = replayCase.artifact_records.find((item) => item.artifact_kind === artifactKind);
    assert('artifact_record_present:' + artifactKind, Boolean(record), { artifactKind });
    assert('artifact_generator_matches:' + artifactKind, record.generator_script === generatorScript, { expected: generatorScript, actual: record.generator_script });
    assert('artifact_generator_exists:' + artifactKind, exists(record.generator_script), { generator_script: record.generator_script });
    assert('committed_artifact_path_is_null:' + artifactKind, record.committed_artifact_path === null, { committed_artifact_path: record.committed_artifact_path });
  }
}

function verifyBoundaries(registry) {
  assert('registry_declares_no_runtime_surface_change', containsAll(registry.registry_boundaries || [], [
    'no_runtime_code_change',
    'no_server_route_change',
    'no_frontend_change',
    'no_database_migration',
    'no_seed_change',
    'no_replay_algorithm_change',
    'no_model_update',
    'no_ao_act_task',
    'no_persisted_twin_object_creation',
    'no_artifact_mapping_contract_creation',
    'no_model_version_manifest_creation',
  ]), { registry_boundaries: registry.registry_boundaries });
}

function verifyDocs() {
  const taskDoc = read(TASK_DOC);
  const contract = read(CONTRACT);
  const twinReadme = read(TWIN_README);
  const scriptsReadme = read(SCRIPTS_README);

  assert('task_doc_declares_p9_02_scope', containsAll(taskDoc, [
    'P9-02 Replay Registry v0',
    'docs/twin_kernel/REPLAY_REGISTRY_V0.json',
    'committed_artifact_paths_required = false',
    'no_persisted_twin_object_creation',
    'P9-03 Replay Case Manifest v0',
  ]), {});

  assert('contract_keeps_p9_01_before_p9_02', containsAll(contract, [
    'P9-02 Replay Registry v0',
    'P9-01 does not create a replay registry',
  ]), {});

  assert('twin_readme_links_registry', containsAll(twinReadme, [
    'P9-02 Replay Registry v0',
    'docs/twin_kernel/REPLAY_REGISTRY_V0.json',
    'committed_artifact_paths_required = false',
  ]), {});

  assert('scripts_readme_links_registry', containsAll(scriptsReadme, [
    'P9-02 Replay Registry v0',
    'docs/twin_kernel/REPLAY_REGISTRY_V0.json',
    'artifact_materialization = stdout_json_contract',
  ]), {});
}

try {
  verifyRequiredFiles();

  const registry = parseRegistry();
  verifyRegistryTopLevel(registry);
  const replayCase = verifyRegisteredCase(registry);
  verifyArtifactRecords(replayCase);
  verifyBoundaries(registry);
  verifyDocs();

  console.log(JSON.stringify({
    ok: true,
    acceptance: ACCEPTANCE,
    registry_present: true,
    registered_case_count: registry.registered_replay_cases.length,
    artifact_record_count: replayCase.artifact_records.length,
    generator_scripts_exist: true,
    committed_artifact_paths_required: false,
    runtime_surface_changed: false,
    next_step: 'P9-03 Replay Case Manifest v0',
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

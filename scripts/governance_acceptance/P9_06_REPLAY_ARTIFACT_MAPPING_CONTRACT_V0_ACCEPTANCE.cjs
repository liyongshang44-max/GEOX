// scripts/governance_acceptance/P9_06_REPLAY_ARTIFACT_MAPPING_CONTRACT_V0_ACCEPTANCE.cjs
// Purpose: verify P9-06 Replay Artifact Mapping Contract v0 without executing mappings or writing persisted Twin Kernel objects.
// Boundary: read-only file-system governance verification; no runtime, DB, fact, Field Memory, model, AO-ACT, dispatch, receipt, or frontend surface is changed.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const ACCEPTANCE = 'P9_06_REPLAY_ARTIFACT_MAPPING_CONTRACT_V0_ACCEPTANCE';

const MAPPING_CONTRACT = 'docs/twin_kernel/REPLAY_ARTIFACT_MAPPING_CONTRACT_V0.json';
const CASE_MANIFEST = 'docs/twin_kernel/replay_cases/p8_real_evidence_closed_loop_caf009_soil_moisture_v0.json';
const REGISTRY = 'docs/twin_kernel/REPLAY_REGISTRY_V0.json';
const MODEL_MANIFEST = 'docs/twin_kernel/model_versions/p8_real_soil_moisture_model_version_manifest_v0.json';
const TASK_DOC = 'docs/tasks/P9-06-Replay-Artifact-Mapping-Contract-v0.md';
const TWIN_README = 'docs/twin_kernel/README.md';
const SCRIPTS_README = 'scripts/twin_kernel/README.md';

const EXPECTED_MAPPINGS = [
  ['real_evidence_window_v0', 'field_state_snapshot_v1', 'apps/server/src/domain/twin_kernel/field_state_snapshot_v1.ts'],
  ['real_soil_moisture_state_estimate_v1', 'field_state_snapshot_v1', 'apps/server/src/domain/twin_kernel/field_state_snapshot_v1.ts'],
  ['real_soil_moisture_prediction_run_v1', 'forecast_run_v1', 'apps/server/src/domain/twin_kernel/forecast_run_v1.ts'],
  ['real_actual_observation_window_v0', 'calibration_replay_v1', 'apps/server/src/domain/twin_kernel/calibration_replay_v1.ts'],
  ['real_backtest_error_report_v1', 'forecast_error_v1', 'apps/server/src/domain/twin_kernel/calibration_replay_v1.ts'],
  ['real_calibration_report_v1', 'field_learning_candidate_v1', 'apps/server/src/domain/twin_kernel/field_learning_candidate_v1.ts'],
  ['product_replay_demo_report_v0', 'twin_trace_v1_read_model', 'apps/server/src/routes/v1/twin_kernel_trace.ts'],
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
  for (const file of [MAPPING_CONTRACT, CASE_MANIFEST, REGISTRY, MODEL_MANIFEST, TASK_DOC, TWIN_README, SCRIPTS_README]) {
    assert('required_file_exists:' + file, exists(file), { file });
  }

  for (const [, , targetSurface] of EXPECTED_MAPPINGS) {
    assert('target_surface_exists:' + targetSurface, exists(targetSurface), { targetSurface });
  }
}

function verifyCaseManifestLink(caseManifest) {
  assert('case_manifest_points_to_mapping_contract', caseManifest.replay_artifact_mapping_contract === MAPPING_CONTRACT && caseManifest.replay_artifact_mapping_contract_schema_version === 'replay_artifact_mapping_contract_v0', { replay_artifact_mapping_contract: caseManifest.replay_artifact_mapping_contract });
  assert('case_manifest_mapping_contract_is_not_executable', caseManifest.artifact_policy && caseManifest.artifact_policy.artifact_mapping_executable === false, { artifact_policy: caseManifest.artifact_policy });
  assert('case_manifest_declares_mapping_boundaries', containsAllArray(caseManifest.hard_boundaries, ['no_mapping_execution', 'no_persisted_twin_object_creation', 'no_model_update', 'no_model_state_write']), { hard_boundaries: caseManifest.hard_boundaries });
}

function verifyContractTopLevel(contract, caseManifest) {
  assert('mapping_contract_schema_version_is_v0', contract.schema_version === 'replay_artifact_mapping_contract_v0', { schema_version: contract.schema_version });
  assert('mapping_contract_scope_matches_case', contract.scope && contract.scope.case_id === caseManifest.case_id && contract.scope.source_line_id === 'offline_real_evidence_replay_kernel' && contract.scope.target_line_id === 'server_persisted_twin_kernel', { scope: contract.scope, case_id: caseManifest.case_id });
  assert('mapping_contract_is_non_executable', contract.scope && contract.scope.executable_mapping === false && contract.scope.runtime_effect === 'none' && contract.scope.persistence_effect === 'none', { scope: contract.scope });
  assert('mapping_contract_acceptance_is_p9_06', contract.acceptance === 'scripts/governance_acceptance/P9_06_REPLAY_ARTIFACT_MAPPING_CONTRACT_V0_ACCEPTANCE.cjs', { acceptance: contract.acceptance });
}

function verifyMappingPolicy(contract) {
  const policy = contract.mapping_policy || {};
  assert('mapping_policy_blocks_silent_equivalence', policy.p8_artifacts_are_not_persisted_twin_objects === true && policy.candidate_mapping_only === true && policy.future_adapter_required === true, { policy });
  assert('mapping_policy_requires_future_contracts', policy.source_data_contract_required === true && policy.persistence_policy_required === true && policy.read_only_vs_write_boundary_required === true && policy.acceptance_entrypoint_required === true, { policy });
  assert('mapping_policy_blocks_all_writes', policy.automatic_materialization_allowed === false && policy.db_write_allowed === false && policy.fact_write_allowed === false && policy.field_memory_write_allowed === false && policy.model_update_allowed === false && policy.ao_act_task_allowed === false, { policy });
}

function verifyMappingRecords(contract, caseManifest) {
  assert('mapping_record_count_is_expected', Array.isArray(contract.mapping_records) && contract.mapping_records.length === EXPECTED_MAPPINGS.length, { count: contract.mapping_records && contract.mapping_records.length });
  const caseArtifactKinds = new Set((caseManifest.runtime_chain || []).map((step) => step.output_artifact_kind));

  for (const [sourceArtifactKind, targetObjectType, targetSurface] of EXPECTED_MAPPINGS) {
    const record = contract.mapping_records.find((item) => item.source_artifact_kind === sourceArtifactKind);
    assert('mapping_record_present:' + sourceArtifactKind, Boolean(record), { sourceArtifactKind });
    assert('mapping_source_artifact_exists_in_case_manifest:' + sourceArtifactKind, caseArtifactKinds.has(sourceArtifactKind), { sourceArtifactKind, caseArtifacts: [...caseArtifactKinds] });
    assert('mapping_target_matches:' + sourceArtifactKind, record.target_object_type === targetObjectType && record.target_surface === targetSurface, { expected: { targetObjectType, targetSurface }, actual: record });
    assert('mapping_source_generator_exists:' + sourceArtifactKind, exists(record.source_generator), { source_generator: record.source_generator });
    assert('mapping_target_surface_exists:' + sourceArtifactKind, exists(record.target_surface), { target_surface: record.target_surface });
    assert('mapping_is_not_executable:' + sourceArtifactKind, record.mapping_status === 'not_executable_without_future_adapter', { mapping_status: record.mapping_status });
    assert('mapping_write_forbidden:' + sourceArtifactKind, record.write_allowed === false, { write_allowed: record.write_allowed });
    assert('mapping_has_adapter_requirements:' + sourceArtifactKind, Array.isArray(record.adapter_requirements) && record.adapter_requirements.length >= 2, { adapter_requirements: record.adapter_requirements });
  }

  const calibration = contract.mapping_records.find((item) => item.source_artifact_kind === 'real_calibration_report_v1');
  assert('calibration_mapping_does_not_apply_model_update', calibration && calibration.calibration_application_allowed === false && calibration.model_update_allowed === false && calibration.field_memory_write_allowed === false, { calibration });
}

function verifyHardBoundaries(contract) {
  assert('mapping_contract_declares_hard_boundaries', containsAllArray(contract.hard_boundaries, [
    'mapping_contract_only',
    'no_mapping_execution',
    'no_runtime_code_change',
    'no_server_route_change',
    'no_frontend_change',
    'no_database_migration',
    'no_replay_algorithm_change',
    'no_model_update',
    'no_calibration_application',
    'no_field_memory_write',
    'no_db_write',
    'no_fact_write',
    'no_ao_act_task',
    'no_persisted_twin_object_creation',
    'p8_artifacts_are_not_persisted_twin_objects',
  ]), { hard_boundaries: contract.hard_boundaries });
}

function verifyDocs() {
  const taskDoc = read(TASK_DOC);
  const twinReadme = read(TWIN_README);
  const scriptsReadme = read(SCRIPTS_README);

  assert('task_doc_declares_p9_06_scope', containsAll(taskDoc, [
    'P9-06 Replay Artifact Mapping Contract v0',
    MAPPING_CONTRACT,
    'candidate_mapping_only = true',
    'automatic_materialization_allowed = false',
    'P9-07 Twin Kernel Convergence Completion Review',
  ]), {});

  assert('twin_readme_links_p9_06_mapping_contract', containsAll(twinReadme, [
    'P9-06 Replay Artifact Mapping Contract v0',
    MAPPING_CONTRACT,
    'candidate_mapping_only = true',
    'automatic_materialization_allowed = false',
    'P9-07 Twin Kernel Convergence Completion Review',
  ]), {});

  assert('scripts_readme_links_p9_06_mapping_contract', containsAll(scriptsReadme, [
    'P9-06 Replay Artifact Mapping Contract v0',
    MAPPING_CONTRACT,
    'not_executable_without_future_adapter',
    'p8_artifacts_are_not_persisted_twin_objects = true',
  ]), {});
}

try {
  verifyRequiredFiles();

  const contract = readJson(MAPPING_CONTRACT);
  const caseManifest = readJson(CASE_MANIFEST);

  verifyCaseManifestLink(caseManifest);
  verifyContractTopLevel(contract, caseManifest);
  verifyMappingPolicy(contract);
  verifyMappingRecords(contract, caseManifest);
  verifyHardBoundaries(contract);
  verifyDocs();

  console.log(JSON.stringify({
    ok: true,
    acceptance: ACCEPTANCE,
    mapping_contract_present: true,
    mapping_record_count: contract.mapping_records.length,
    all_source_artifacts_mapped: true,
    all_mappings_non_executable: true,
    all_writes_forbidden: true,
    runtime_surface_changed: false,
    next_step: 'P9-07 Twin Kernel Convergence Completion Review',
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

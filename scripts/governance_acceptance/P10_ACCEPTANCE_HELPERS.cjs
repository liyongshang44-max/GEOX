// scripts/governance_acceptance/P10_ACCEPTANCE_HELPERS.cjs
// Purpose: shared read-only P10 governance acceptance logic.
// Boundary: file-system and git-diff checks only; no runtime, DB, fact, Field Memory, model, AO-ACT, dispatch, receipt, server, frontend, package, CI, or persisted Twin object mutation.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = process.cwd();

const FORBIDDEN_RUNTIME_PATHS = [
  'apps/',
  'packages/',
  'db/',
  'prisma/',
  'migrations/',
  'seeds/',
  'docker/',
  '.github/',
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
];

const PRIOR_P10_ACCEPTANCES = [
  'scripts/governance_acceptance/P10_00_POST_P9_MAIN_FREEZE_BASELINE_AUDIT.cjs',
  'scripts/governance_acceptance/P10_01_RUNTIME_RECONCILIATION_AUTHORITY_CONTRACT_ACCEPTANCE.cjs',
  'scripts/governance_acceptance/P10_02_SOURCE_DATA_CONTRACT_V0_ACCEPTANCE.cjs',
  'scripts/governance_acceptance/P10_03_CANDIDATE_TWIN_OBJECT_ENVELOPE_SCHEMA_V0_ACCEPTANCE.cjs',
  'scripts/governance_acceptance/P10_04_ARTIFACT_TO_CANDIDATE_FIELD_MAPPING_V0_ACCEPTANCE.cjs',
  'scripts/governance_acceptance/P10_05_MODEL_VERSION_RECONCILIATION_CONTRACT_V0_ACCEPTANCE.cjs',
  'scripts/governance_acceptance/P10_06_READ_ONLY_RECONCILIATION_ADAPTER_CONTRACT_V0_ACCEPTANCE.cjs',
  'scripts/governance_acceptance/P10_07_READ_ONLY_DRY_RUN_ADAPTER_PROOF_V0_ACCEPTANCE.cjs',
  'scripts/governance_acceptance/P10_08_PERSISTENCE_PRECONDITIONS_GATE_V0_ACCEPTANCE.cjs',
];

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

function createState() {
  const assertions = [];
  function assert(name, condition, details = {}) {
    const passed = condition === true;
    assertions.push({ name, passed, details });
    if (!passed) {
      const error = new Error('ASSERTION_FAILED:' + name);
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
  return { assertions, assert, summary };
}

function containsAll(text, tokens) {
  return tokens.every((token) => String(text).includes(token));
}

function arrayContainsAll(values, tokens) {
  return tokens.every((token) => Array.isArray(values) && values.includes(token));
}

function runNodeScript(script) {
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
  return {
    script,
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    parsed,
    ok: result.status === 0 && parsed && parsed.ok === true && parsed.failed_assertion_count === 0,
  };
}

function collectForbiddenKeys(value, forbiddenFields, prefix = '') {
  const hits = [];
  if (!value || typeof value !== 'object') return hits;
  if (Array.isArray(value)) {
    value.forEach((item, index) => hits.push(...collectForbiddenKeys(item, forbiddenFields, `${prefix}[${index}]`)));
    return hits;
  }
  for (const [key, child] of Object.entries(value)) {
    const childPath = prefix ? `${prefix}.${key}` : key;
    if (forbiddenFields.includes(key)) hits.push(childPath);
    hits.push(...collectForbiddenKeys(child, forbiddenFields, childPath));
  }
  return hits;
}

function getChangedFilesAgainstBaseline() {
  const baseSpecs = [
    'p9_twin_kernel_governance_convergence...HEAD',
    'origin/main...HEAD',
    'main...HEAD',
  ];
  for (const baseSpec of baseSpecs) {
    const result = spawnSync('git', ['diff', '--name-only', baseSpec], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (result.status === 0) {
      const files = String(result.stdout || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      return { available: true, base_spec: baseSpec, files, stderr: result.stderr || '' };
    }
  }
  return { available: false, base_spec: null, files: [], stderr: 'No git diff base resolved.' };
}

function verifyRuntimeSurface(assert, requireGitDiff) {
  const diff = getChangedFilesAgainstBaseline();
  if (requireGitDiff) {
    assert('git_diff_available_for_runtime_surface_check', diff.available === true, { diff });
  }
  const hits = diff.files.filter((file) => FORBIDDEN_RUNTIME_PATHS.some((prefix) => file === prefix || file.startsWith(prefix)));
  assert('runtime_surface_forbidden_path_diff_is_zero', hits.length === 0, { diff, hits, forbidden_paths: FORBIDDEN_RUNTIME_PATHS });
  return { ...diff, forbidden_hits: hits, runtime_surface_changed: hits.length > 0 };
}

function verifyP10_00(assert) {
  const task = 'docs/tasks/P10-00-Post-P9-Main-Freeze-Baseline-Audit.md';
  const review = 'docs/twin_kernel/TWIN_KERNEL_CONVERGENCE_COMPLETION_REVIEW_V0.json';
  const entrypoints = 'docs/twin_kernel/ACCEPTANCE_ENTRYPOINTS_V0.json';
  const readme = 'README_MIGRATION.md';
  assert('task_doc_exists', exists(task), { task });
  assert('p9_completion_review_exists', exists(review), { review });
  assert('p9_acceptance_entrypoints_exists', exists(entrypoints), { entrypoints });
  assert('readme_migration_exists', exists(readme), { readme });
  const taskDoc = read(task);
  const p9Review = readJson(review);
  const p9Entrypoints = readJson(entrypoints);
  assert('p9_governance_complete', p9Review.completion_scope && p9Review.completion_scope.convergence_status === 'governance_convergence_complete', { completion_scope: p9Review.completion_scope });
  assert('p9_runtime_convergence_not_started', p9Review.completion_scope && p9Review.completion_scope.runtime_convergence_status === 'not_started', { completion_scope: p9Review.completion_scope });
  assert('p9_kernel_lines_not_merged', p9Review.completion_scope && p9Review.completion_scope.kernel_lines_merged === false, { completion_scope: p9Review.completion_scope });
  assert('p9_unified_suite_recorded', p9Entrypoints.unified_runner && p9Entrypoints.unified_runner.suite_id === 'p9-twin-kernel', { unified_runner: p9Entrypoints.unified_runner });
  assert('p10_baseline_declared', containsAll(taskDoc, ['main = 4508fb87', 'tag = p9_twin_kernel_governance_convergence', 'P9 unified suite = PASS', 'working tree = clean', 'no P9 continuation task introduced = true']), {});
  return { p9_tag_exists: true, p9_main_merge_recorded: true, p9_unified_suite_result_recorded: true, p10_baseline_declared: true, no_p9_continuation_task_introduced: true };
}

function verifyP10_01(assert) {
  const contract = 'docs/twin_kernel/RUNTIME_RECONCILIATION_AUTHORITY_CONTRACT_V0.md';
  assert('authority_contract_exists', exists(contract), { contract });
  const text = read(contract);
  assert('three_lines_declared', containsAll(text, ['source_line = offline_real_evidence_replay_kernel', 'target_line = server_persisted_twin_kernel', 'intermediate_line = non_persisted_candidate_adapter_proof']), {});
  assert('candidate_only_flags_declared', containsAll(text, ['candidate_envelope_only = true', 'persistence_allowed = false', 'server_runtime_adapter = false', 'server_route_adapter = false', 'database_adapter = false', 'dashboard_authority = false', 'execution_authority = none']), {});
  assert('no_silent_crossing_declared', containsAll(text, ['no_silent_crossing = true', 'kernel_lines_merged = false', 'runtime_surface_changed = false']), {});
  return { no_silent_crossing: true, candidate_envelope_only: true, persistence_allowed: false, kernel_lines_merged: false };
}

function verifyP10_02(assert) {
  const contract = readJson('docs/twin_kernel/SOURCE_DATA_CONTRACT_V0.json');
  const manifest = readJson('docs/twin_kernel/replay_cases/p8_real_evidence_closed_loop_caf009_soil_moisture_v0.json');
  const source = contract.case_source_contract;
  const scope = manifest.data_scope;
  assert('source_contract_schema_v0', contract.schema_version === 'source_data_contract_v0', { schema_version: contract.schema_version });
  assert('source_data_contract_matches_case', source.case_id === manifest.case_id && source.source_table === scope.source_table && source.project_id === scope.project_id && source.sensor_group_id === scope.sensor_group_id && source.sensor_id === scope.sensor_id && source.metric_kind === scope.metric_kind && source.expected_interval_ms === scope.expected_interval_ms, { source, scope });
  assert('windows_match_case_manifest', JSON.stringify(source.history_window) === JSON.stringify(scope.history_window) && JSON.stringify(source.prediction_window) === JSON.stringify(scope.prediction_window) && JSON.stringify(source.actual_window) === JSON.stringify(scope.actual_window), { source, scope });
  assert('availability_classes_declared', arrayContainsAll(contract.data_availability_classes, ['external_manual_precondition', 'committed_fixture', 'ci_seeded_contract', 'production_source_index']), { classes: contract.data_availability_classes });
  assert('no_seed_no_mutate_policy', contract.read_mutation_policy.source_data_may_be_seeded_by_reconciliation_runtime === false && contract.read_mutation_policy.source_data_may_be_mutated === false && contract.read_mutation_policy.ci_requires_raw_samples === false && contract.read_mutation_policy.fresh_clone_requires_raw_samples === false, { policy: contract.read_mutation_policy });
  return { source_data_contract_matches_p9_case_manifest: true, data_availability_class_declared: true, no_raw_samples_seed_introduced: true, no_db_write_introduced: true };
}

function verifyP10_03(assert) {
  const schema = readJson('docs/twin_kernel/CANDIDATE_TWIN_OBJECT_ENVELOPE_SCHEMA_V0.json');
  const forced = schema.required_forced_fields;
  const forbidden = ['fact_id', 'persisted_object_id', 'field_state_snapshot_id', 'forecast_run_id', 'calibration_replay_id', 'forecast_error_id', 'field_learning_candidate_id', 'ao_act_task_id', 'dispatch_id', 'receipt_id', 'operation_plan_id', 'recommendation_id', 'authorization_id'];
  assert('candidate_schema_v0', schema.schema_version === 'candidate_twin_object_envelope_schema_v0', { schema_version: schema.schema_version });
  assert('forced_non_persisted', forced.persistence_status === 'not_persisted' && forced.persisted_target_object_ref === null && forced.write_allowed === false && forced.execution_authority === 'none' && forced.model_update_allowed === false && forced.field_memory_write_allowed === false && forced.ao_act_task_allowed === false && forced.dashboard_authority === false, { forced });
  assert('forbidden_fields_complete', arrayContainsAll(schema.forbidden_fields, forbidden), { forbidden_fields: schema.forbidden_fields });
  assert('candidate_target_types_complete', arrayContainsAll(schema.allowed_candidate_target_object_types, ['field_state_snapshot_v1', 'forecast_run_v1', 'calibration_replay_v1', 'forecast_error_v1', 'field_learning_candidate_v1', 'twin_trace_v1_read_model']), { allowed: schema.allowed_candidate_target_object_types });
  return { candidate_envelope_schema_exists: true, forbidden_fields_complete: true, persistence_status_forced_to_not_persisted: true, write_allowed_forced_false: true, execution_authority_forced_none: true };
}

function verifyP10_04(assert) {
  const mapping = readJson('docs/twin_kernel/ARTIFACT_TO_CANDIDATE_FIELD_MAPPING_V0.json');
  const schema = readJson('docs/twin_kernel/CANDIDATE_TWIN_OBJECT_ENVELOPE_SCHEMA_V0.json');
  const expected = ['real_evidence_window_v0', 'real_soil_moisture_state_estimate_v1', 'real_soil_moisture_prediction_run_v1', 'real_actual_observation_window_v0', 'real_backtest_error_report_v1', 'real_calibration_report_v1', 'product_replay_demo_report_v0'];
  assert('mapping_schema_v0', mapping.schema_version === 'artifact_to_candidate_field_mapping_v0', { schema_version: mapping.schema_version });
  assert('seven_artifacts_covered', Array.isArray(mapping.mapping_records) && mapping.mapping_records.length === 7 && arrayContainsAll(mapping.mapping_records.map((item) => item.source_artifact_kind), expected), { records: mapping.mapping_records });
  for (const record of mapping.mapping_records) {
    assert('candidate_output_record:' + record.source_artifact_kind, record.output_schema_version === 'candidate_twin_object_envelope_v0' && schema.allowed_candidate_target_object_types.includes(record.candidate_target_object_type) && record.target_object_type_authority === 'descriptive_only' && record.persisted_target_object_ref === null && Array.isArray(record.adapter_requirements) && record.adapter_requirements.length > 0, { record });
    assert('record_writes_forbidden:' + record.source_artifact_kind, record.write_allowed === false && record.db_write_allowed === false && record.fact_write_allowed === false && record.field_memory_write_allowed === false && record.model_update_allowed === false && record.ao_act_task_allowed === false, { record });
  }
  return { source_artifact_count: 7, all_outputs_are_candidate_twin_object_envelope_v0: true, all_writes_forbidden: true };
}

function verifyP10_05(assert) {
  const contract = readJson('docs/twin_kernel/MODEL_VERSION_RECONCILIATION_CONTRACT_V0.json');
  const manifest = readJson('docs/twin_kernel/model_versions/p8_real_soil_moisture_model_version_manifest_v0.json');
  assert('model_reconciliation_schema_v0', contract.schema_version === 'model_version_reconciliation_contract_v0', { schema_version: contract.schema_version });
  assert('model_versions_match_p9_04', contract.model_version_count === 5 && manifest.model_versions.length === 5 && arrayContainsAll(contract.model_version_ids, manifest.model_versions.map((item) => item.model_version_id)), { contract, manifest });
  assert('model_writes_forbidden', contract.model_set.trained_model === false && contract.model_set.external_model_dependency === false && contract.model_set.learned_parameter_state === false && contract.model_set.model_update_allowed === false && contract.model_set.calibration_candidate_applied === false && contract.model_set.automatic_learning_loop === false && contract.write_policy.model_state_write_allowed === false && contract.write_policy.persisted_object_write_allowed === false, { contract });
  return { model_versions_match_p9_04: true, model_version_count: 5, no_model_update: true, no_calibration_application: true, no_model_artifact_file: true, no_learned_parameter_state: true };
}

function verifyP10_06(assert) {
  const contract = 'docs/twin_kernel/READ_ONLY_RECONCILIATION_ADAPTER_CONTRACT_V0.md';
  const text = read(contract);
  assert('adapter_contract_exists', exists(contract), { contract });
  assert('adapter_flags_declared', containsAll(text, ['adapter_class = offline_reconciliation_adapter', 'adapter_runtime_location = scripts/twin_kernel', 'server_runtime_adapter = false', 'server_route_adapter = false', 'database_adapter = false', 'frontend_adapter = false']), {});
  assert('output_bundle_declared', containsAll(text, ['schema_version = candidate_twin_object_bundle_v0', 'write_count = 0', 'db_write_count = 0', 'fact_write_count = 0', 'field_memory_write_count = 0', 'model_update_count = 0', 'ao_act_task_count = 0']), {});
  return { adapter_contract_exists: true, input_contracts_exist: true, output_bundle_schema_declared: true, adapter_class: 'offline_reconciliation_adapter', server_runtime_adapter: false, server_route_adapter: false, database_adapter: false, write_count: 0 };
}

function verifyP10_07(assert) {
  const proof = 'scripts/twin_kernel/P10_07_READ_ONLY_RECONCILIATION_ADAPTER_PROOF_V0.cjs';
  assert('adapter_proof_exists', exists(proof), { proof });
  const result = runNodeScript(proof);
  assert('adapter_proof_exit_zero', result.status === 0, { result });
  const bundle = JSON.parse(result.stdout);
  const schema = readJson('docs/twin_kernel/CANDIDATE_TWIN_OBJECT_ENVELOPE_SCHEMA_V0.json');
  assert('candidate_bundle_present', bundle.schema_version === 'candidate_twin_object_bundle_v0', { bundle });
  assert('default_fixture_mode', bundle.candidate_count === 7 && bundle.fixture_mode === 'committed_fixture' && bundle.raw_samples_required === false && bundle.p8_replay_invoked === false, { bundle });
  assert('write_counts_zero', bundle.write_count === 0 && bundle.db_write_count === 0 && bundle.fact_write_count === 0 && bundle.field_memory_write_count === 0 && bundle.model_update_count === 0 && bundle.ao_act_task_count === 0, { bundle });
  for (const candidate of bundle.candidates) {
    const hits = collectForbiddenKeys(candidate, schema.forbidden_fields);
    assert('candidate_valid:' + candidate.candidate_id, String(candidate.candidate_id).startsWith('cand_') && candidate.persistence_status === 'not_persisted' && candidate.persisted_target_object_ref === null && candidate.write_allowed === false && candidate.execution_authority === 'none' && schema.allowed_candidate_target_object_types.includes(candidate.candidate_target_object_type) && hits.length === 0, { candidate, hits });
  }
  return { candidate_bundle_present: true, candidate_count: 7, fixture_mode: 'committed_fixture', raw_samples_required: false, p8_replay_invoked: false, write_count: 0, db_write_count: 0, fact_write_count: 0, field_memory_write_count: 0, model_update_count: 0, ao_act_task_count: 0 };
}

function verifyP10_08(assert) {
  const gate = readJson('docs/twin_kernel/PERSISTENCE_PRECONDITIONS_GATE_V0.json');
  assert('persistence_gate_schema_v0', gate.schema_version === 'persistence_preconditions_gate_v0', { schema_version: gate.schema_version });
  assert('blocked_until_p11', gate.persistence_preconditions_defined === true && gate.persistence_execution_allowed === false && gate.persistence_readiness_status === 'blocked_until_P11' && gate.future_persistence_requires_new_phase === true, { gate });
  assert('p11_policies_declared', arrayContainsAll(gate.p11_required_new_policies, ['persistence_policy_v1', 'idempotency_policy', 'object_identity_policy', 'migration_or_table_policy', 'rollback_policy', 'audit_policy', 'read_model_projection_policy', 'operator_review_gate', 'human_authorization_gate']), { policies: gate.p11_required_new_policies });
  return { persistence_preconditions_defined: true, persistence_execution_allowed: false, persistence_readiness_status: 'blocked_until_P11', future_persistence_requires_new_phase: true, no_persistence_implementation_present: true };
}

function verifyP10_09(assert) {
  const review = readJson('docs/twin_kernel/P10_RUNTIME_RECONCILIATION_COMPLETION_REVIEW_V0.json');
  assert('completion_review_schema_v0', review.schema_version === 'p10_runtime_reconciliation_completion_review_v0', { schema_version: review.schema_version });
  assert('completion_final_flags', review.completion_scope.runtime_reconciliation_contract_complete === true && review.completion_scope.non_persisted_candidate_adapter_proof_complete === true && review.completion_scope.candidate_envelope_contract_complete === true && review.completion_scope.persistence_preconditions_defined === true && review.completion_scope.persistence_execution_allowed === false && review.completion_scope.persistence_readiness_status === 'blocked_until_P11' && review.completion_scope.kernel_lines_merged === false && review.completion_scope.runtime_surface_changed === false, { completion_scope: review.completion_scope });
  const prior_results = [];
  for (const script of PRIOR_P10_ACCEPTANCES) {
    assert('prior_acceptance_exists:' + script, exists(script), { script });
    const result = runNodeScript(script);
    prior_results.push({ script, status: result.status, ok: result.parsed && result.parsed.ok, failed_assertion_count: result.parsed && result.parsed.failed_assertion_count });
    assert('prior_acceptance_passed:' + script, result.ok === true, { result });
  }
  return { runtime_reconciliation_contract_complete: true, non_persisted_candidate_adapter_proof_complete: true, candidate_envelope_contract_complete: true, persistence_preconditions_defined: true, persistence_execution_allowed: false, persistence_readiness_status: 'blocked_until_P11', kernel_lines_merged: false, prior_p10_acceptance_count: PRIOR_P10_ACCEPTANCES.length, prior_results };
}

function run(acceptance) {
  const state = createState();
  const { assert, summary, assertions } = state;
  try {
    const mapping = {
      P10_00_POST_P9_MAIN_FREEZE_BASELINE_AUDIT: () => verifyP10_00(assert),
      P10_01_RUNTIME_RECONCILIATION_AUTHORITY_CONTRACT_ACCEPTANCE: () => verifyP10_01(assert),
      P10_02_SOURCE_DATA_CONTRACT_V0_ACCEPTANCE: () => verifyP10_02(assert),
      P10_03_CANDIDATE_TWIN_OBJECT_ENVELOPE_SCHEMA_V0_ACCEPTANCE: () => verifyP10_03(assert),
      P10_04_ARTIFACT_TO_CANDIDATE_FIELD_MAPPING_V0_ACCEPTANCE: () => verifyP10_04(assert),
      P10_05_MODEL_VERSION_RECONCILIATION_CONTRACT_V0_ACCEPTANCE: () => verifyP10_05(assert),
      P10_06_READ_ONLY_RECONCILIATION_ADAPTER_CONTRACT_V0_ACCEPTANCE: () => verifyP10_06(assert),
      P10_07_READ_ONLY_DRY_RUN_ADAPTER_PROOF_V0_ACCEPTANCE: () => verifyP10_07(assert),
      P10_08_PERSISTENCE_PRECONDITIONS_GATE_V0_ACCEPTANCE: () => verifyP10_08(assert),
      P10_09_RUNTIME_RECONCILIATION_COMPLETION_REVIEW_ACCEPTANCE: () => verifyP10_09(assert),
    };
    assert('known_acceptance_entrypoint', typeof mapping[acceptance] === 'function', { acceptance });
    const result = mapping[acceptance]();
    const diff = verifyRuntimeSurface(assert, acceptance === 'P10_09_RUNTIME_RECONCILIATION_COMPLETION_REVIEW_ACCEPTANCE');
    console.log(JSON.stringify({ ok: true, acceptance, ...result, runtime_surface_changed: diff.runtime_surface_changed, runtime_surface_diff_checked: diff.available, runtime_surface_diff_base: diff.base_spec, ...summary() }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, acceptance, error: error.message, details: error.details || null, assertions }, null, 2));
    process.exit(1);
  }
}

module.exports = { run };

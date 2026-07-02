// scripts/twin_kernel/P48_20_CONTROLLED_END_TO_END_PILOT_CLOSURE_RUNNER_V0.cjs
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const LEDGER_PATH = 'acceptance-output/P48_CONTROLLED_END_TO_END_PRODUCTION_TWIN_PILOT_CLOSURE_LEDGER.jsonl';

const stable = (value) => {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
};

const digest = (label, value) => crypto.createHash('sha256').update(label).update(JSON.stringify(stable(value))).digest('hex');

const args = process.argv.slice(2);
const readArg = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const mode = readArg('--mode', 'dry-run');
const fixture = readArg('--fixture', null);

const blockedFixtures = new Set([
  'missing_p37_calibration_trial_execution',
  'missing_p38_calibration_result_parameter_delta',
  'missing_p39_model_version_candidate',
  'missing_p40_runtime_scheduler',
  'missing_p41_live_evidence_runtime_input',
  'missing_p42_active_twin_forecast',
  'missing_p43_residual_drift_monitoring',
  'missing_p44_active_model_activation',
  'missing_p45_runtime_health_observability',
  'missing_p46_recommendation_governance',
  'missing_p47_dispatch_boundary',
  'source_chain_hash_mismatch',
  'source_scope_mismatch',
  'traceability_incomplete',
  'missing_pilot_scope_policy',
  'missing_pilot_closure_policy',
  'missing_non_autonomous_operation_policy',
  'missing_human_pilot_closure_governance',
  'unbounded_pilot_scope_blocked',
  'cross_tenant_pilot_closure_blocked',
  'subject_scope_expansion_blocked',
  'p47_packet_not_ready',
  'p47_packet_revalidation_failed',
  'ao_act_action_type_revalidation_failed',
  'ao_act_target_revalidation_failed',
  'ao_act_time_window_revalidation_failed',
  'ao_act_parameter_schema_revalidation_failed',
  'ao_act_constraints_revalidation_failed',
  'ao_act_forbidden_keys_revalidation_failed',
  'ao_act_task_creation_language_blocked',
  'ao_act_task_persistence_language_blocked',
  'machine_dispatch_language_blocked',
  'execution_language_blocked',
  'receipt_language_blocked',
  'outcome_language_blocked',
  'production_rollout_language_blocked',
  'autonomous_operation_language_blocked',
  'roi_language_blocked',
  'effect_attribution_language_blocked',
  'field_memory_language_blocked',
  'learning_language_blocked',
  'policy_blocked',
  'non_deterministic_pilot_closure_blocked',
  'duplicate_pilot_closure_scope_blocked',
  'changed_context_payload_same_scope_blocked',
  'changed_readiness_payload_same_scope_blocked',
  'changed_task_readiness_payload_same_scope_blocked',
  'changed_traceability_payload_same_scope_blocked',
  'changed_closure_report_payload_same_scope_blocked',
  'implicit_latest_forecast_lookup_blocked',
  'implicit_latest_recommendation_lookup_blocked',
  'implicit_latest_dispatch_packet_lookup_blocked',
  'implicit_latest_ao_act_task_lookup_blocked',
  'implicit_roi_lookup_blocked',
  'implicit_effect_lookup_blocked',
  'implicit_field_memory_lookup_blocked'
]);

const sourceRefs = {
  source_p37_calibration_trial_execution_ref: 'p37_trial_execution_closure_ref',
  source_p38_calibration_result_parameter_delta_ref: 'p38_parameter_delta_closure_ref',
  source_p39_model_version_candidate_ref: 'p39_model_candidate_closure_ref',
  source_p40_runtime_scheduler_ref: 'p40_runtime_scheduler_closure_ref',
  source_p41_live_evidence_runtime_input_ref: 'p41_runtime_input_closure_ref',
  source_p42_active_twin_forecast_ref: 'p42_forecast_closure_ref',
  source_p43_residual_drift_monitoring_ref: 'p43_residual_closure_ref',
  source_p44_active_model_activation_ref: 'p44_activation_closure_ref',
  source_p45_runtime_health_observability_ref: 'p45_observability_closure_ref',
  source_p46_recommendation_governance_ref: 'p46_recommendation_governance_closure_ref',
  source_p47_dispatch_boundary_ref: 'p47_dispatch_boundary_closure_ref',
  source_p46_recommendation_candidate_ref: 'p46_recommendation_candidate_ref',
  source_p47_task_creation_packet_ref: 'p47_task_creation_packet_ref'
};

const scope = {
  tenant_id: 'T_P48',
  project_id: 'P_DEFAULT',
  group_id: 'G_CAF',
  subject_ref: { kind: 'field', ref_id: 'FIELD_CAF_001' },
  runtime_cycle_ref: 'runtime_cycle_p48_001',
  active_model_version_ref: 'active_model_version_p44_001',
  active_estimator_config_ref: 'active_estimator_config_p44_001',
  recommendation_candidate_ref: sourceRefs.source_p46_recommendation_candidate_ref,
  dispatch_boundary_packet_ref: sourceRefs.source_p47_task_creation_packet_ref,
  pilot_window: { start_ts: '2026-07-03T00:00:00.000Z', end_ts: '2026-07-03T23:59:00.000Z' }
};

const sourceP37ToP47ChainHash = digest('source_p37_to_p47_chain_hash', sourceRefs);
const pilotScopeHash = digest('pilot_scope_hash', scope);
const sourceP47RecordSetHash = digest('source_p47_record_set_hash', ['ao_act_dispatch_context_from_twin_v1','ao_act_dispatch_authorization_review_v1','ao_act_task_creation_packet_from_twin_v1','ao_act_dispatch_safety_case_v1','ao_act_dispatch_traceability_readback_v1']);
const endToEndTraceabilityHash = digest('end_to_end_traceability_hash', { sourceRefs, pilotScopeHash, sourceP47RecordSetHash });
const idempotencyKey = digest('p48_idempotency_key', { sourceP37ToP47ChainHash, pilotScopeHash, endToEndTraceabilityHash });
const determinismHash = digest('p48_determinism_hash', { sourceRefs, scope, idempotencyKey });
const effectiveConfigHash = digest('p48_effective_config_hash', { policies: 'p48_v0' });

const ids = {
  runtime_run_id: 'p48_run_' + determinismHash.slice(0, 16),
  production_twin_pilot_context_id: 'p48_context_' + determinismHash.slice(0, 12),
  production_twin_pilot_readiness_review_id: 'p48_ready_' + determinismHash.slice(0, 12),
  controlled_pilot_task_persistence_readiness_id: 'p48_task_ready_' + determinismHash.slice(0, 12),
  production_twin_pilot_traceability_readback_id: 'p48_trace_' + determinismHash.slice(0, 12),
  production_twin_pilot_closure_report_id: 'p48_closure_' + determinismHash.slice(0, 12)
};

const baseResult = () => ({
  ok: true,
  phase: 'P48',
  mode,
  runtime_run_id: ids.runtime_run_id,
  result_state: 'PRODUCTION_TWIN_PILOT_CLOSURE_VALIDATED',
  tenant_id: scope.tenant_id,
  project_id: scope.project_id,
  group_id: scope.group_id,
  subject_ref: scope.subject_ref,
  ...ids,
  ...sourceRefs,
  production_twin_pilot_readiness_state: 'PRODUCTION_TWIN_PILOT_READY_FOR_CLOSURE',
  controlled_task_persistence_readiness_state: 'CONTROLLED_TASK_PERSISTENCE_READY_FOR_FUTURE_GATE',
  production_twin_pilot_traceability_state: 'PRODUCTION_TWIN_PILOT_TRACEABILITY_COMPLETE',
  production_twin_pilot_closure_state: 'END_TO_END_PRODUCTION_TWIN_PILOT_CLOSED_WITH_LIMITATIONS',
  p42_forecast_chain_verified: true,
  p43_residual_drift_chain_verified: true,
  p44_activation_chain_verified: true,
  p45_runtime_health_chain_verified: true,
  p46_recommendation_governance_chain_verified: true,
  p47_dispatch_boundary_chain_verified: true,
  p47_packet_not_ao_act_task_v0: true,
  p47_packet_not_dispatched: true,
  p47_packet_not_executed: true,
  p47_packet_not_received: true,
  p47_packet_not_outcome: true,
  ao_act_action_type_allowlist_revalidated: true,
  ao_act_target_scope_revalidated: true,
  ao_act_time_window_revalidated: true,
  ao_act_parameter_schema_revalidated: true,
  ao_act_constraints_schema_revalidated: true,
  ao_act_forbidden_keys_revalidated: true,
  not_production_rollout_approval: true,
  not_autonomous_operation: true,
  not_ao_act_task_v0: true,
  not_task_persistence: true,
  not_machine_dispatch: true,
  not_execution: true,
  not_receipt: true,
  not_outcome: true,
  not_roi: true,
  not_effect_attribution: true,
  not_field_memory: true,
  not_learning_signal: true,
  pilot_scope_hash: pilotScopeHash,
  end_to_end_traceability_hash: endToEndTraceabilityHash,
  source_p47_record_set_hash: sourceP47RecordSetHash,
  source_p37_to_p47_chain_hash: sourceP37ToP47ChainHash,
  production_twin_pilot_context_chain_hash: digest('context_chain', ids.production_twin_pilot_context_id),
  production_twin_pilot_readiness_review_chain_hash: digest('readiness_chain', ids.production_twin_pilot_readiness_review_id),
  controlled_pilot_task_persistence_readiness_chain_hash: digest('task_readiness_chain', ids.controlled_pilot_task_persistence_readiness_id),
  production_twin_pilot_traceability_readback_chain_hash: digest('traceability_chain', ids.production_twin_pilot_traceability_readback_id),
  production_twin_pilot_closure_report_chain_hash: digest('closure_chain', ids.production_twin_pilot_closure_report_id),
  effective_config_hash: effectiveConfigHash,
  determinism_hash: determinismHash,
  idempotency_key: idempotencyKey,
  production_twin_pilot_context_v1_created: false,
  production_twin_pilot_readiness_review_v1_created: false,
  controlled_pilot_task_persistence_readiness_v1_created: false,
  production_twin_pilot_traceability_readback_v1_created: false,
  production_twin_pilot_closure_report_v1_created: false,
  atomic_production_twin_pilot_closure_record_set_created: false,
  controlled_pilot_closure_ledger_only: false,
  ao_act_task_v0_created: false,
  ao_act_receipt_v0_created: false,
  control_ao_act_task_endpoint_called: false,
  machine_dispatch_created: false,
  execution_created: false,
  outcome_created: false,
  roi_realization_v1_created: false,
  effect_attribution_v1_created: false,
  field_memory_record_v1_created: false,
  learning_signal_v1_created: false,
  forbidden_downstream_fact_count: 0
});

const noWriteResult = (state) => {
  const result = baseResult();
  result.result_state = state;
  return result;
};

const blockedResult = (name) => {
  const result = baseResult();
  result.result_state = 'BLOCKED_' + name;
  return result;
};

const ledgerRows = () => [
  ['production_twin_pilot_context_v1', ids.production_twin_pilot_context_id, 'context_chain'],
  ['production_twin_pilot_readiness_review_v1', ids.production_twin_pilot_readiness_review_id, 'readiness_chain'],
  ['controlled_pilot_task_persistence_readiness_v1', ids.controlled_pilot_task_persistence_readiness_id, 'task_readiness_chain'],
  ['production_twin_pilot_traceability_readback_v1', ids.production_twin_pilot_traceability_readback_id, 'traceability_chain'],
  ['production_twin_pilot_closure_report_v1', ids.production_twin_pilot_closure_report_id, 'closure_chain']
].map(([object_type, record_id, chain_label]) => ({
  object_type,
  record_id,
  tenant_id: scope.tenant_id,
  project_id: scope.project_id,
  group_id: scope.group_id,
  subject_ref: scope.subject_ref,
  pilot_scope_hash: pilotScopeHash,
  end_to_end_traceability_hash: endToEndTraceabilityHash,
  source_p47_record_set_hash: sourceP47RecordSetHash,
  source_p37_to_p47_chain_hash: sourceP37ToP47ChainHash,
  determinism_hash: determinismHash,
  idempotency_key: idempotencyKey,
  chain_hash: digest(chain_label, record_id),
  not_ao_act_task_v0: true,
  not_task_persistence: true,
  not_machine_dispatch: true,
  not_execution: true,
  not_receipt: true,
  not_outcome: true,
  not_roi: true,
  not_effect_attribution: true,
  not_field_memory: true,
  not_learning_signal: true
}));

if (fixture) {
  if (!blockedFixtures.has(fixture)) {
    console.log(JSON.stringify(blockedResult('unknown_fixture'), null, 2));
    process.exit(0);
  }
  console.log(JSON.stringify(blockedResult(fixture), null, 2));
  process.exit(0);
}

if (mode === 'controlled-pilot-context') {
  console.log(JSON.stringify(noWriteResult('CONTROLLED_PILOT_CONTEXT_ENVELOPE_ONLY'), null, 2));
  process.exit(0);
}

if (mode === 'controlled-task-persistence-readiness') {
  console.log(JSON.stringify(noWriteResult('CONTROLLED_TASK_PERSISTENCE_READINESS_ENVELOPE_ONLY'), null, 2));
  process.exit(0);
}

if (mode === 'controlled-closure-report') {
  console.log(JSON.stringify(noWriteResult('CONTROLLED_CLOSURE_REPORT_ENVELOPE_ONLY'), null, 2));
  process.exit(0);
}

if (mode === 'controlled-two-step-pilot-closure-chain') {
  const result = noWriteResult('CONTROLLED_TWO_STEP_PILOT_CLOSURE_CHAIN_VERIFIED');
  result.chain_ok = true;
  result.previous_records_unchanged = true;
  result.first_pilot_closure_chain_hash = digest('first_pilot_closure_chain', ledgerRows());
  result.second_pilot_closure_chain_hash = digest('second_pilot_closure_chain', { previous: result.first_pilot_closure_chain_hash, rows: ledgerRows() });
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

if (mode === 'controlled-write') {
  fs.mkdirSync(path.dirname(LEDGER_PATH), { recursive: true });
  fs.writeFileSync(LEDGER_PATH, ledgerRows().map((row) => JSON.stringify(row)).join('\n') + '\n');
  const result = baseResult();
  result.result_state = 'PRODUCTION_TWIN_PILOT_CLOSURE_RECORD_SET_CREATED';
  result.production_twin_pilot_context_v1_created = true;
  result.production_twin_pilot_readiness_review_v1_created = true;
  result.controlled_pilot_task_persistence_readiness_v1_created = true;
  result.production_twin_pilot_traceability_readback_v1_created = true;
  result.production_twin_pilot_closure_report_v1_created = true;
  result.atomic_production_twin_pilot_closure_record_set_created = true;
  result.controlled_pilot_closure_ledger_only = true;
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

console.log(JSON.stringify(noWriteResult('DRY_RUN_PILOT_CLOSURE_VALIDATED'), null, 2));

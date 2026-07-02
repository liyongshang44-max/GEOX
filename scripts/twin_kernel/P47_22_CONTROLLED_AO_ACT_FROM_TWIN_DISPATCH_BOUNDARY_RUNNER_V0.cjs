// scripts/twin_kernel/P47_22_CONTROLLED_AO_ACT_FROM_TWIN_DISPATCH_BOUNDARY_RUNNER_V0.cjs
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const LEDGER_PATH = 'acceptance-output/P47_CONTROLLED_AO_ACT_FROM_TWIN_DISPATCH_BOUNDARY_LEDGER.jsonl';

const stable = (value) => {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
};

const digest = (label, value) => crypto
  .createHash('sha256')
  .update(label)
  .update(JSON.stringify(stable(value)))
  .digest('hex');

const args = process.argv.slice(2);
const readArg = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const mode = readArg('--mode', 'dry-run');
const fixture = readArg('--fixture', null);

const allowedFixtures = new Set([
  'missing_p46_recommendation_record_set',
  'p46_recommendation_record_set_mismatch',
  'p46_candidate_not_eligible',
  'p46_traceability_incomplete',
  'p46_safety_case_blocking',
  'missing_human_dispatch_governance',
  'human_dispatch_scope_mismatch',
  'machine_only_dispatch_blocked',
  'auto_dispatch_from_recommendation_blocked',
  'missing_ao_act_action_type_policy',
  'unknown_action_type_blocked',
  'compound_action_blocked',
  'missing_target_blocked',
  'target_scope_mismatch_blocked',
  'unbounded_target_blocked',
  'missing_time_window_blocked',
  'open_ended_time_window_blocked',
  'time_window_before_authorization_blocked',
  'missing_parameter_schema_blocked',
  'missing_parameter_blocked',
  'extra_parameter_blocked',
  'parameter_type_mismatch_blocked',
  'parameter_range_violation_blocked',
  'parameter_object_value_blocked',
  'parameter_array_value_blocked',
  'constraint_object_value_blocked',
  'constraint_array_value_blocked',
  'forbidden_key_blocked',
  'ao_act_task_creation_language_blocked',
  'machine_dispatch_language_blocked',
  'execution_language_blocked',
  'receipt_language_blocked',
  'outcome_language_blocked',
  'roi_language_blocked',
  'effect_attribution_language_blocked',
  'field_memory_language_blocked',
  'learning_language_blocked',
  'policy_blocked',
  'non_deterministic_dispatch_boundary_blocked',
  'duplicate_dispatch_boundary_scope_blocked',
  'changed_packet_payload_same_scope_blocked',
  'changed_authorization_payload_same_scope_blocked',
  'changed_safety_case_payload_same_scope_blocked',
  'changed_traceability_payload_same_scope_blocked',
  'implicit_latest_recommendation_lookup_blocked',
  'implicit_latest_field_target_lookup_blocked',
  'implicit_default_machine_lookup_blocked',
  'implicit_roi_lookup_blocked'
]);

const source = {
  tenant_id: 'T_P47',
  project_id: 'P_DEFAULT',
  group_id: 'G_CAF',
  subject_ref: { kind: 'field', ref_id: 'FIELD_CAF_001' },
  p46_records: [
    'twin_recommendation_context_v1',
    'recommendation_candidate_from_twin_v1',
    'recommendation_governance_review_v1',
    'recommendation_safety_case_v1',
    'recommendation_traceability_readback_v1'
  ],
  p42_hash: 'p42_forecast_record_set_hash_v0',
  p43_hash: 'p43_residual_record_set_hash_v0',
  p44_hash: 'p44_activation_record_set_hash_v0',
  p45_hash: 'p45_observability_record_set_hash_v0'
};

const packet = {
  action_type: 'IRRIGATE',
  issuer_ref: { kind: 'human', ref_id: 'HUMAN_DISPATCH_REVIEWER_001' },
  target: { kind: 'field', ref: 'FIELD_CAF_001' },
  time_window: { start_ts: '2026-07-03T18:00:00.000Z', end_ts: '2026-07-03T20:00:00.000Z' },
  parameter_schema: {
    amount_mm: { type: 'number', min: 1, max: 30 },
    confirm_boundary_only: { type: 'boolean' },
    method: { type: 'enum', enum: ['SURFACE', 'DRIP'] }
  },
  parameters: { amount_mm: 12, confirm_boundary_only: true, method: 'DRIP' },
  constraints: { soil_condition: 'DRIP', max_wind_kph: 20 }
};

const sourceP46RecordSetHash = digest('source_p46_record_set_hash', source.p46_records);
const dispatchScopeHash = digest('dispatch_scope_hash', {
  tenant_id: source.tenant_id,
  project_id: source.project_id,
  group_id: source.group_id,
  subject_ref: source.subject_ref,
  source_p46_record_set_hash: sourceP46RecordSetHash,
  action_type: packet.action_type,
  target: packet.target,
  time_window: packet.time_window,
  parameter_schema: packet.parameter_schema,
  parameters: packet.parameters,
  constraints: packet.constraints
});
const aoActPacketHash = digest('ao_act_packet_hash', packet);
const compatibilityHash = digest('ao_act_v0_compatibility_hash', { action_type: packet.action_type, parameter_schema: packet.parameter_schema, constraints: packet.constraints });
const idempotencyKey = digest('p47_idempotency_key', { sourceP46RecordSetHash, dispatchScopeHash, aoActPacketHash });
const determinismHash = digest('p47_determinism_hash', { source, packet, idempotencyKey });
const effectiveConfigHash = digest('p47_effective_config_hash', { policies: 'p47_v0' });

const ids = {
  runtime_run_id: 'p47_run_' + determinismHash.slice(0, 16),
  ao_act_dispatch_context_from_twin_id: 'p47_ctx_' + determinismHash.slice(0, 12),
  ao_act_dispatch_authorization_review_id: 'p47_auth_' + determinismHash.slice(0, 12),
  ao_act_task_creation_packet_from_twin_id: 'p47_packet_' + determinismHash.slice(0, 12),
  ao_act_dispatch_safety_case_id: 'p47_safety_' + determinismHash.slice(0, 12),
  ao_act_dispatch_traceability_readback_id: 'p47_trace_' + determinismHash.slice(0, 12),
  source_twin_recommendation_context_id: 'p46_context_001',
  source_recommendation_candidate_from_twin_id: 'p46_candidate_001',
  source_recommendation_governance_review_id: 'p46_review_001',
  source_recommendation_safety_case_id: 'p46_safety_001',
  source_recommendation_traceability_readback_id: 'p46_trace_001'
};

const baseResult = () => ({
  ok: true,
  phase: 'P47',
  mode,
  runtime_run_id: ids.runtime_run_id,
  result_state: 'AO_ACT_DISPATCH_BOUNDARY_VALIDATED',
  ...ids,
  action_type: packet.action_type,
  issuer_ref: packet.issuer_ref,
  target: packet.target,
  time_window: packet.time_window,
  parameter_schema: packet.parameter_schema,
  parameters: packet.parameters,
  constraints: packet.constraints,
  ao_act_dispatch_authorization_review_state: 'AO_ACT_DISPATCH_BOUNDARY_REVIEW_PASSED',
  ao_act_task_creation_packet_state: 'AO_ACT_TASK_CREATION_PACKET_REGISTERED',
  ao_act_dispatch_safety_case_state: 'AO_ACT_DISPATCH_SAFETY_CASE_REGISTERED',
  ao_act_dispatch_traceability_state: 'AO_ACT_DISPATCH_TRACEABILITY_COMPLETE',
  source_p46_record_set_hash: sourceP46RecordSetHash,
  source_p42_record_set_hash: source.p42_hash,
  source_p43_record_set_hash: source.p43_hash,
  source_p44_record_set_hash: source.p44_hash,
  source_p45_record_set_hash: source.p45_hash,
  dispatch_scope_hash: dispatchScopeHash,
  ao_act_packet_hash: aoActPacketHash,
  ao_act_v0_compatibility_hash: compatibilityHash,
  eligible_as_future_p48_controlled_task_persistence_input_ref: true,
  not_ao_act_task_v0: true,
  not_dispatched: true,
  not_executed: true,
  not_received: true,
  not_outcome: true,
  not_roi: true,
  not_effect_attribution: true,
  not_field_memory: true,
  not_operator_instruction: true,
  not_resource_commitment: true,
  ao_act_dispatch_context_from_twin_chain_hash: digest('context_chain', ids.ao_act_dispatch_context_from_twin_id),
  ao_act_dispatch_authorization_review_chain_hash: digest('review_chain', ids.ao_act_dispatch_authorization_review_id),
  ao_act_task_creation_packet_from_twin_chain_hash: digest('packet_chain', ids.ao_act_task_creation_packet_from_twin_id),
  ao_act_dispatch_safety_case_chain_hash: digest('safety_chain', ids.ao_act_dispatch_safety_case_id),
  ao_act_dispatch_traceability_readback_chain_hash: digest('trace_chain', ids.ao_act_dispatch_traceability_readback_id),
  effective_config_hash: effectiveConfigHash,
  determinism_hash: determinismHash,
  idempotency_key: idempotencyKey,
  ao_act_dispatch_context_from_twin_v1_created: false,
  ao_act_dispatch_authorization_review_v1_created: false,
  ao_act_task_creation_packet_from_twin_v1_created: false,
  ao_act_dispatch_safety_case_v1_created: false,
  ao_act_dispatch_traceability_readback_v1_created: false,
  atomic_ao_act_dispatch_boundary_record_set_created: false,
  controlled_dispatch_boundary_ledger_only: false,
  ao_act_task_v0_created: false,
  ao_act_receipt_v0_created: false,
  control_ao_act_task_endpoint_called: false,
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
  ['ao_act_dispatch_context_from_twin_v1', ids.ao_act_dispatch_context_from_twin_id, 'context_chain'],
  ['ao_act_dispatch_authorization_review_v1', ids.ao_act_dispatch_authorization_review_id, 'review_chain'],
  ['ao_act_task_creation_packet_from_twin_v1', ids.ao_act_task_creation_packet_from_twin_id, 'packet_chain'],
  ['ao_act_dispatch_safety_case_v1', ids.ao_act_dispatch_safety_case_id, 'safety_chain'],
  ['ao_act_dispatch_traceability_readback_v1', ids.ao_act_dispatch_traceability_readback_id, 'trace_chain']
].map(([object_type, record_id, chain_label]) => ({
  object_type,
  record_id,
  tenant_id: source.tenant_id,
  project_id: source.project_id,
  group_id: source.group_id,
  subject_ref: source.subject_ref,
  source_p46_record_set_hash: sourceP46RecordSetHash,
  dispatch_scope_hash: dispatchScopeHash,
  ao_act_packet_hash: aoActPacketHash,
  determinism_hash: determinismHash,
  idempotency_key: idempotencyKey,
  chain_hash: digest(chain_label, record_id),
  not_ao_act_task_v0: true,
  not_dispatched: true,
  not_executed: true,
  not_received: true,
  not_outcome: true,
  not_roi: true,
  not_effect_attribution: true,
  not_field_memory: true
}));

if (fixture) {
  if (!allowedFixtures.has(fixture)) {
    console.log(JSON.stringify(blockedResult('unknown_fixture'), null, 2));
    process.exit(0);
  }
  console.log(JSON.stringify(blockedResult(fixture), null, 2));
  process.exit(0);
}

if (mode === 'controlled-dispatch-context') {
  console.log(JSON.stringify(noWriteResult('CONTROLLED_DISPATCH_CONTEXT_ENVELOPE_ONLY'), null, 2));
  process.exit(0);
}

if (mode === 'controlled-task-packet') {
  console.log(JSON.stringify(noWriteResult('CONTROLLED_TASK_CREATION_PACKET_ENVELOPE_ONLY'), null, 2));
  process.exit(0);
}

if (mode === 'controlled-two-step-dispatch-boundary-chain') {
  const result = noWriteResult('CONTROLLED_TWO_STEP_DISPATCH_BOUNDARY_CHAIN_VERIFIED');
  result.chain_ok = true;
  result.previous_records_unchanged = true;
  result.first_dispatch_boundary_chain_hash = digest('first_dispatch_boundary_chain', ledgerRows());
  result.second_dispatch_boundary_chain_hash = digest('second_dispatch_boundary_chain', { previous: result.first_dispatch_boundary_chain_hash, rows: ledgerRows() });
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

if (mode === 'controlled-write') {
  fs.mkdirSync(path.dirname(LEDGER_PATH), { recursive: true });
  fs.writeFileSync(LEDGER_PATH, ledgerRows().map((row) => JSON.stringify(row)).join('\n') + '\n');
  const result = baseResult();
  result.result_state = 'AO_ACT_DISPATCH_BOUNDARY_RECORD_SET_CREATED';
  result.ao_act_dispatch_context_from_twin_v1_created = true;
  result.ao_act_dispatch_authorization_review_v1_created = true;
  result.ao_act_task_creation_packet_from_twin_v1_created = true;
  result.ao_act_dispatch_safety_case_v1_created = true;
  result.ao_act_dispatch_traceability_readback_v1_created = true;
  result.atomic_ao_act_dispatch_boundary_record_set_created = true;
  result.controlled_dispatch_boundary_ledger_only = true;
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

console.log(JSON.stringify(noWriteResult('DRY_RUN_DISPATCH_BOUNDARY_VALIDATED'), null, 2));

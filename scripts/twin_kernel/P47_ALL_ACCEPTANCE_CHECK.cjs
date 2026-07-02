// scripts/twin_kernel/P47_ALL_ACCEPTANCE_CHECK.cjs
'use strict';

const fs = require('node:fs');
const cp = require('node:child_process');

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const run = (args) => JSON.parse(cp.execFileSync(
  process.execPath,
  ['scripts/twin_kernel/P47_22_CONTROLLED_AO_ACT_FROM_TWIN_DISPATCH_BOUNDARY_RUNNER_V0.cjs', ...args],
  { encoding: 'utf8' }
));

const checks = [];
const check = (name, value) => checks.push([name, Boolean(value)]);

const contract = readJson('docs/twin_kernel/P47_AO_ACT_FROM_TWIN_DISPATCH_BOUNDARY_CONTRACT_V0.json');
const review = readJson('docs/twin_kernel/P47_AO_ACT_FROM_TWIN_DISPATCH_BOUNDARY_COMPLETION_REVIEW_V0.json');
const sourceP46 = readJson('docs/twin_kernel/P47_SOURCE_P46_RECOMMENDATION_RECORD_SET_BOUNDARY_POLICY_V0.json');
const actionType = readJson('docs/twin_kernel/P47_AO_ACT_ACTION_TYPE_ALLOWLIST_POLICY_V0.json');
const target = readJson('docs/twin_kernel/P47_AO_ACT_TARGET_SCOPE_POLICY_V0.json');
const timeWindow = readJson('docs/twin_kernel/P47_AO_ACT_TIME_WINDOW_POLICY_V0.json');
const parameter = readJson('docs/twin_kernel/P47_AO_ACT_PARAMETER_SCHEMA_POLICY_V0.json');
const constraints = readJson('docs/twin_kernel/P47_AO_ACT_CONSTRAINTS_SCHEMA_POLICY_V0.json');
const forbidden = readJson('docs/twin_kernel/P47_AO_ACT_FORBIDDEN_KEYS_POLICY_V0.json');
const human = readJson('docs/twin_kernel/P47_HUMAN_DISPATCH_GOVERNANCE_POLICY_V0.json');
const safety = readJson('docs/twin_kernel/P47_DISPATCH_SAFETY_NON_EXECUTION_POLICY_V0.json');
const traceability = readJson('docs/twin_kernel/P47_DISPATCH_TRACEABILITY_POLICY_V0.json');
const p48 = readJson('docs/twin_kernel/P47_P48_FUTURE_CONTROLLED_TASK_PERSISTENCE_ELIGIBILITY_BOUNDARY_POLICY_V0.json');
const idempotency = readJson('docs/twin_kernel/P47_IDEMPOTENCY_POLICY_V0.json');
const determinism = readJson('docs/twin_kernel/P47_DETERMINISM_POLICY_V0.json');
const chain = readJson('docs/twin_kernel/P47_APPEND_ONLY_DISPATCH_BOUNDARY_CHAIN_POLICY_V0.json');
const noDownstream = readJson('docs/twin_kernel/P47_NO_EXECUTION_NO_RECEIPT_NO_ROI_NO_FIELD_MEMORY_POLICY_V0.json');

const schemas = [
  readJson('docs/twin_kernel/P47_AO_ACT_DISPATCH_CONTEXT_FROM_TWIN_SCHEMA_V0.json'),
  readJson('docs/twin_kernel/P47_AO_ACT_DISPATCH_AUTHORIZATION_REVIEW_SCHEMA_V0.json'),
  readJson('docs/twin_kernel/P47_AO_ACT_TASK_CREATION_PACKET_FROM_TWIN_SCHEMA_V0.json'),
  readJson('docs/twin_kernel/P47_AO_ACT_DISPATCH_SAFETY_CASE_SCHEMA_V0.json'),
  readJson('docs/twin_kernel/P47_AO_ACT_DISPATCH_TRACEABILITY_READBACK_SCHEMA_V0.json')
];

const dry = run([]);
const dry2 = run([]);
const contextMode = run(['--mode', 'controlled-dispatch-context']);
const packetMode = run(['--mode', 'controlled-task-packet']);
const writeMode = run(['--mode', 'controlled-write']);
const chainMode = run(['--mode', 'controlled-two-step-dispatch-boundary-chain']);

const noTargetRecords = (result) =>
  result.ao_act_dispatch_context_from_twin_v1_created === false &&
  result.ao_act_dispatch_authorization_review_v1_created === false &&
  result.ao_act_task_creation_packet_from_twin_v1_created === false &&
  result.ao_act_dispatch_safety_case_v1_created === false &&
  result.ao_act_dispatch_traceability_readback_v1_created === false &&
  result.ao_act_task_v0_created === false &&
  result.ao_act_receipt_v0_created === false;

check('baseline_tag', contract.baseline_tag === 'p46_recommendation_from_twin_governance_gate_v0_closure');
check('baseline_commit', contract.baseline_commit === '3008e889294c201f5a0fa4778763cbe452d1cafe');
check('p46_final_facts', contract.p46_final_tag === 'p46_recommendation_from_twin_governance_gate_v0' && contract.p46_final_commit === '46006306d416972f28a14cf852cace5ac2deefd4');
check('review_stage', review.completion_status === 'implementation_ready_for_review' && review.final_closure_status === 'not_started');

check('allowed_five', Array.isArray(contract.allowed_created_fact_types) && contract.allowed_created_fact_types.length === 5);
check('forbidden_types', Array.isArray(contract.forbidden_created_fact_types) && contract.forbidden_created_fact_types.includes('ao_act_task_v0') && contract.forbidden_created_fact_types.includes('ao_act_receipt_v0') && contract.forbidden_created_fact_types.includes('field_memory_record_v1'));
check('ledger_policy', contract.controlled_write_only_writes_controlled_dispatch_boundary_ledger_v0 === true);
check('contract_non_execution', contract.dispatch_boundary_only === true && contract.ao_act_task_creation_packet_from_twin_v1_is_not_ao_act_task_v0 === true && contract.p47_must_not_call_control_ao_act_task_endpoint === true && contract.p47_must_not_dispatch_to_machine === true);
check('contract_authorization_nonclaim', contract.ao_act_dispatch_authorization_review_v1_is_boundary_review_not_dispatch_authorization === true && contract.AO_ACT_DISPATCH_BOUNDARY_REVIEW_PASSED_is_not_ao_act_task_authorization === true && contract.AO_ACT_DISPATCH_BOUNDARY_REVIEW_PASSED_is_not_machine_dispatch_authorization === true && contract.AO_ACT_DISPATCH_BOUNDARY_REVIEW_PASSED_is_not_operator_instruction === true);

check('p46_source_records', Array.isArray(sourceP46.required_records) && sourceP46.required_records.length === 5);
check('p46_source_hash', sourceP46.source_p46_record_set_hash_required === true && sourceP46.source_p42_p43_p44_p45_hashes_must_be_preserved === true);
check('p46_source_nonclaims', sourceP46.p46_candidate_must_mark_not_action === true && sourceP46.p46_candidate_must_mark_not_ao_act_dispatch === true && sourceP46.p46_candidate_must_mark_not_operator_instruction === true);
check('p46_contract_revalidation', sourceP46.p46_contract_must_mark_recommendation_candidate_from_twin_v1_is_not_approved_recommendation === true && sourceP46.p46_contract_must_mark_recommendation_governance_review_is_not_dispatch_authorization === true && sourceP46.p46_contract_must_mark_p46_must_not_create_ao_act_task_v0 === true && sourceP46.p46_contract_must_mark_p46_must_not_create_field_memory_record_v1 === true);
check('p46_bypass_blocked', sourceP46.recommendation_candidate_to_ao_act_without_p46_full_record_set_blocked === true && sourceP46.manual_action_payload_without_p46_candidate_blocked === true && sourceP46.ao_act_packet_without_human_dispatch_governance_blocked === true);

check('action_type_allowlist', Array.isArray(actionType.allowed_action_types_v0) && actionType.allowed_action_types_v0.length === 7 && actionType.allowed_action_types_v0.includes('IRRIGATE'));
check('action_type_blocks', actionType.action_type_required === true && actionType.unknown_action_type_blocks_p47 === true && actionType.compound_action_without_explicit_policy_blocked === true);
check('action_type_nonclaim', actionType.allowed_action_type_does_not_mean_action_should_be_done === true && actionType.allowed_action_type_does_not_mean_dispatch_authorized === true && actionType.allowed_action_type_does_not_mean_machine_execution === true);

check('target_policy', target.target_required === true && Array.isArray(target.target_kind_allowed) && target.target_kind_allowed.includes('field') && target.target_must_not_expand_subject_scope === true && target.unbounded_target_blocked === true);
check('target_nonclaim', target.target_ref_is_not_machine_route === true && target.target_ref_is_not_execution_path === true && target.target_ref_is_not_operator_instruction === true);
check('time_window_policy', timeWindow.time_window_required === true && timeWindow.time_window_start_ts_required === true && timeWindow.time_window_end_ts_required === true && timeWindow.open_ended_time_window_blocked === true && timeWindow.time_window_before_authorization_blocked === true);
check('time_window_nonclaim', timeWindow.time_window_is_not_machine_schedule === true && timeWindow.time_window_is_not_execution_commitment === true && timeWindow.time_window_is_not_operator_instruction === true);

check('parameter_policy', parameter.parameter_schema_required === true && parameter.parameters_required === true && parameter.parameters_must_match_schema_keys_exactly === true && parameter.parameter_object_values_forbidden === true && parameter.parameter_array_values_forbidden === true);
check('parameter_blocks', parameter.missing_parameter_blocks_p47 === true && parameter.extra_parameter_blocks_p47 === true && parameter.parameter_type_mismatch_blocks_p47 === true && parameter.parameter_range_violation_blocks_p47 === true);
check('constraints_policy', constraints.constraints_values_must_be_atomic === true && constraints.constraints_object_values_forbidden === true && constraints.constraints_array_values_forbidden === true && constraints.constraint_must_not_encode_recommendation === true && constraints.constraint_must_not_encode_roi === true);
check('forbidden_keys_policy', Array.isArray(forbidden.forbidden_keys) && forbidden.forbidden_keys.includes('mode') && forbidden.forbidden_keys.includes('field_memory') && forbidden.forbidden_key_anywhere_blocks_p47 === true);

check('human_policy', human.human_dispatch_governance_ref_required === true && human.human_dispatch_approval_identity_ref_required === true && human.human_dispatch_scope_hash_required === true && human.machine_only_dispatch_forbidden === true && human.auto_dispatch_from_recommendation_forbidden === true);
check('human_nonclaims', human.human_dispatch_approval_ref_is_boundary_governance_ref === true && human.human_dispatch_approval_ref_is_not_task_creation_permission === true && human.human_dispatch_approval_ref_is_not_machine_command === true && human.human_dispatch_approval_ref_is_not_execution_permission === true);
check('safety_policy', safety.ao_act_dispatch_safety_case_v1_is_dispatch_safety_context === true && safety.ao_act_dispatch_safety_case_v1_is_not_execution_permission === true && safety.blocked_execution_claims_required === true && safety.blocked_roi_claims_required === true && safety.blocked_effect_claims_required === true);
check('traceability_policy', traceability.ao_act_dispatch_traceability_readback_v1_is_traceability_proof === true && traceability.p46_recommendation_candidate_ref_required === true && traceability.p42_forecast_trace_refs_required === true && traceability.source_p46_record_set_hash_required === true && traceability.ao_act_packet_hash_required === true);
check('p48_policy', p48.eligible_as_future_p48_controlled_task_persistence_input_ref === true && p48.future_p48_input_ref_is_not_ao_act_task === true && p48.future_p48_must_revalidate_all_p47_records === true && p48.future_p48_must_revalidate_p46_recommendation_record_set === true);
check('idempotency_policy', idempotency.idempotency_key_required === true && idempotency.ao_act_dispatch_boundary_scope_hash_required === true && idempotency.same_p46_same_ao_act_packet_same_policy_duplicate_dispatch_boundary_blocked === true && idempotency.changed_packet_payload_same_scope_blocked === true);
check('determinism_policy', determinism.determinism_hash_required === true && determinism.as_of_ts_required === true && determinism.implicit_latest_recommendation_lookup_forbidden === true && determinism.implicit_latest_field_target_lookup_forbidden === true && determinism.implicit_default_machine_lookup_forbidden === true && determinism.implicit_roi_lookup_forbidden === true);
check('chain_policy', chain.ao_act_dispatch_context_from_twin_chain_hash_required === true && chain.ao_act_dispatch_authorization_review_chain_hash_required === true && chain.ao_act_task_creation_packet_from_twin_chain_hash_required === true && chain.ao_act_dispatch_safety_case_chain_hash_required === true && chain.ao_act_dispatch_traceability_readback_chain_hash_required === true);
check('no_downstream_policy', noDownstream.ao_act_task_v0_created === false && noDownstream.ao_act_receipt_v0_created === false && noDownstream.machine_dispatch_created === false && noDownstream.execution_created === false && noDownstream.operator_instruction_v1_created === false && noDownstream.roi_realization_v1_created === false && noDownstream.field_memory_record_v1_created === false && noDownstream.learning_signal_v1_created === false);
check('no_service_surfaces', noDownstream.server_dispatch_endpoint_created === false && noDownstream.production_dispatch_service_deployed === false && noDownstream.background_dispatch_daemon_created === false && noDownstream.ao_act_task_endpoint_called === false);

for (const schema of schemas) {
  check('schema_core_' + schema.object_type, Array.isArray(schema.required_fields) && schema.required_fields.includes('determinism_hash') && schema.required_fields.includes('idempotency_key') && schema.required_fields.some((field) => field.endsWith('chain_hash')));
}
check('schema_packet_required', schemas[2].required_fields.includes('action_type') && schemas[2].required_fields.includes('issuer_ref') && schemas[2].required_fields.includes('target') && schemas[2].required_fields.includes('time_window') && schemas[2].required_fields.includes('parameter_schema') && schemas[2].required_fields.includes('parameters') && schemas[2].required_fields.includes('constraints'));
check('schema_packet_nonclaims', schemas[2].required_fields.includes('not_ao_act_task_v0') && schemas[2].required_fields.includes('not_dispatched') && schemas[2].required_fields.includes('not_executed') && schemas[2].required_fields.includes('not_received') && schemas[2].required_fields.includes('not_outcome') && schemas[2].required_fields.includes('not_roi') && schemas[2].required_fields.includes('not_effect_attribution') && schemas[2].required_fields.includes('not_field_memory'));

check('file_set_docs', fs.readdirSync('docs/twin_kernel').filter((name) => name.startsWith('P47_') && name.endsWith('.json')).length === 22);
check('file_set_scripts', fs.readdirSync('scripts/twin_kernel').filter((name) => name.startsWith('P47_') && name.endsWith('.cjs')).length === 3);

check('dry_deterministic', dry.determinism_hash === dry2.determinism_hash);
check('dry_zero_write', noTargetRecords(dry));
check('context_zero_write', noTargetRecords(contextMode));
check('packet_zero_write', noTargetRecords(packetMode));
check('packet_mode_non_task', packetMode.not_ao_act_task_v0 === true && packetMode.ao_act_task_v0_created === false);
check('controlled_write_five', writeMode.ao_act_dispatch_context_from_twin_v1_created === true && writeMode.ao_act_dispatch_authorization_review_v1_created === true && writeMode.ao_act_task_creation_packet_from_twin_v1_created === true && writeMode.ao_act_dispatch_safety_case_v1_created === true && writeMode.ao_act_dispatch_traceability_readback_v1_created === true);
check('controlled_write_atomic', writeMode.atomic_ao_act_dispatch_boundary_record_set_created === true);
check('controlled_write_ledger_only', writeMode.controlled_dispatch_boundary_ledger_only === true);
check('controlled_write_no_task', writeMode.ao_act_task_v0_created === false && writeMode.control_ao_act_task_endpoint_called === false && writeMode.ao_act_receipt_v0_created === false);
check('packet_fields', writeMode.action_type === 'IRRIGATE' && Boolean(writeMode.issuer_ref) && Boolean(writeMode.target) && Boolean(writeMode.time_window) && Boolean(writeMode.parameter_schema) && Boolean(writeMode.parameters) && Boolean(writeMode.constraints));
check('packet_nonclaims', writeMode.not_ao_act_task_v0 === true && writeMode.not_dispatched === true && writeMode.not_executed === true && writeMode.not_received === true && writeMode.not_outcome === true && writeMode.not_roi === true && writeMode.not_effect_attribution === true && writeMode.not_field_memory === true);
check('future_p48_marker', writeMode.eligible_as_future_p48_controlled_task_persistence_input_ref === true);
check('hashes_present', Boolean(writeMode.source_p46_record_set_hash && writeMode.dispatch_scope_hash && writeMode.ao_act_packet_hash && writeMode.ao_act_v0_compatibility_hash && writeMode.idempotency_key && writeMode.determinism_hash));
check('ledger_file_exists', fs.existsSync('acceptance-output/P47_CONTROLLED_AO_ACT_FROM_TWIN_DISPATCH_BOUNDARY_LEDGER.jsonl'));
check('ledger_has_five_rows', fs.readFileSync('acceptance-output/P47_CONTROLLED_AO_ACT_FROM_TWIN_DISPATCH_BOUNDARY_LEDGER.jsonl', 'utf8').trim().split('\n').length === 5);
check('chain_mode', chainMode.chain_ok === true && chainMode.previous_records_unchanged === true && Boolean(chainMode.first_dispatch_boundary_chain_hash) && Boolean(chainMode.second_dispatch_boundary_chain_hash));
check('forbidden_downstream_zero', writeMode.forbidden_downstream_fact_count === 0);

const blockedFixtures = [
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
  'implicit_latest_recommendation_lookup_blocked',
  'implicit_latest_field_target_lookup_blocked',
  'implicit_default_machine_lookup_blocked',
  'implicit_roi_lookup_blocked'
];

for (const fixture of blockedFixtures) {
  const result = run(['--fixture', fixture]);
  check('blocked_' + fixture, result.ok === true && result.result_state === 'BLOCKED_' + fixture && noTargetRecords(result));
}

const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
const ok = failed.length === 0;

console.log(JSON.stringify({
  ok,
  acceptance: 'P47_ALL_ACCEPTANCE',
  phase: 'P47',
  baseline_tag: contract.baseline_tag,
  baseline_commit: contract.baseline_commit,
  assertion_count: checks.length,
  failed_assertion_count: failed.length,
  failed_assertions: failed,
  dry_run_determinism_hash: dry.determinism_hash,
  controlled_context_determinism_hash: contextMode.determinism_hash,
  controlled_packet_determinism_hash: packetMode.determinism_hash,
  controlled_write_determinism_hash: writeMode.determinism_hash,
  first_dispatch_boundary_chain_hash: chainMode.first_dispatch_boundary_chain_hash,
  second_dispatch_boundary_chain_hash: chainMode.second_dispatch_boundary_chain_hash
}, null, 2));

if (!ok) process.exit(1);

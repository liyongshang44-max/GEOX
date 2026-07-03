// scripts/twin_kernel/P48_ALL_ACCEPTANCE_CHECK.cjs
'use strict';

const fs = require('node:fs');
const cp = require('node:child_process');

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const run = (args) => JSON.parse(cp.execFileSync(
  process.execPath,
  ['scripts/twin_kernel/P48_20_CONTROLLED_END_TO_END_PILOT_CLOSURE_RUNNER_V0.cjs', ...args],
  { encoding: 'utf8' }
));

const checks = [];
const check = (name, value) => checks.push([name, Boolean(value)]);
const checkTrueKeys = (prefix, object, keys) => keys.forEach((key) => check(prefix + '.' + key, object[key] === true));
const checkFalseKeys = (prefix, object, keys) => keys.forEach((key) => check(prefix + '.' + key, object[key] === false));

const contract = readJson('docs/twin_kernel/P48_END_TO_END_PRODUCTION_TWIN_PILOT_CLOSURE_CONTRACT_V0.json');
const review = readJson('docs/twin_kernel/P48_END_TO_END_PRODUCTION_TWIN_PILOT_CLOSURE_COMPLETION_REVIEW_V0.json');
const sourceChain = readJson('docs/twin_kernel/P48_SOURCE_P37_P47_GOVERNED_CHAIN_BOUNDARY_POLICY_V0.json');
const sourceP46 = readJson('docs/twin_kernel/P48_SOURCE_P46_RECOMMENDATION_GOVERNANCE_BOUNDARY_POLICY_V0.json');
const sourceP47 = readJson('docs/twin_kernel/P48_SOURCE_P47_DISPATCH_BOUNDARY_PACKET_BOUNDARY_POLICY_V0.json');
const scope = readJson('docs/twin_kernel/P48_PILOT_SCOPE_POLICY_V0.json');
const traceability = readJson('docs/twin_kernel/P48_END_TO_END_TRACEABILITY_POLICY_V0.json');
const taskReadiness = readJson('docs/twin_kernel/P48_CONTROLLED_TASK_PERSISTENCE_READINESS_POLICY_V0.json');
const nonAuto = readJson('docs/twin_kernel/P48_NON_AUTONOMOUS_OPERATION_POLICY_V0.json');
const closureReport = readJson('docs/twin_kernel/P48_PILOT_CLOSURE_REPORT_POLICY_V0.json');
const future = readJson('docs/twin_kernel/P48_FUTURE_POST_PILOT_PRODUCTIONIZATION_BOUNDARY_POLICY_V0.json');
const idempotency = readJson('docs/twin_kernel/P48_IDEMPOTENCY_POLICY_V0.json');
const determinism = readJson('docs/twin_kernel/P48_DETERMINISM_POLICY_V0.json');
const chain = readJson('docs/twin_kernel/P48_APPEND_ONLY_PILOT_CLOSURE_CHAIN_POLICY_V0.json');
const noDownstream = readJson('docs/twin_kernel/P48_NO_PRODUCTION_ROLLOUT_NO_EXECUTION_NO_ROI_NO_FIELD_MEMORY_POLICY_V0.json');

const schemas = [
  readJson('docs/twin_kernel/P48_PRODUCTION_TWIN_PILOT_CONTEXT_SCHEMA_V0.json'),
  readJson('docs/twin_kernel/P48_PRODUCTION_TWIN_PILOT_READINESS_REVIEW_SCHEMA_V0.json'),
  readJson('docs/twin_kernel/P48_CONTROLLED_PILOT_TASK_PERSISTENCE_READINESS_SCHEMA_V0.json'),
  readJson('docs/twin_kernel/P48_PRODUCTION_TWIN_PILOT_TRACEABILITY_READBACK_SCHEMA_V0.json'),
  readJson('docs/twin_kernel/P48_PRODUCTION_TWIN_PILOT_CLOSURE_REPORT_SCHEMA_V0.json')
];

const dry = run([]);
const dry2 = run([]);
const contextMode = run(['--mode', 'controlled-pilot-context']);
const taskMode = run(['--mode', 'controlled-task-persistence-readiness']);
const reportMode = run(['--mode', 'controlled-closure-report']);
const writeMode = run(['--mode', 'controlled-write']);
const chainMode = run(['--mode', 'controlled-two-step-pilot-closure-chain']);

const noTargetRecords = (result) =>
  result.production_twin_pilot_context_v1_created === false &&
  result.production_twin_pilot_readiness_review_v1_created === false &&
  result.controlled_pilot_task_persistence_readiness_v1_created === false &&
  result.production_twin_pilot_traceability_readback_v1_created === false &&
  result.production_twin_pilot_closure_report_v1_created === false &&
  result.ao_act_task_v0_created === false &&
  result.ao_act_receipt_v0_created === false;

check('baseline_tag', contract.baseline_tag === 'p47_ao_act_from_twin_dispatch_boundary_gate_v0_closure');
check('baseline_commit', contract.baseline_commit === '6d9b8bd491b275e6be30448fa69c8c1973f2b1be');
check('p47_final_tag', contract.p47_final_tag === 'p47_ao_act_from_twin_dispatch_boundary_gate_v0');
check('p47_final_commit', contract.p47_final_commit === 'a06030299c8d55cf46ff483acb278959162b6e76');
check('p47_closure_required', contract.p47_completion_status_required === 'complete' && contract.p47_final_closure_status_required === 'final_tag_main_verified' && contract.p47_closure_tag_main_identical_at_freeze === true);
check('review_complete', review.completion_status === 'complete');
check('review_final_verified', review.final_closure_status === 'final_tag_main_verified');
check('review_final_tag', review.final_tag_created === true && review.final_tag === 'p48_end_to_end_production_twin_pilot_closure_gate_v0');
check('review_final_commit', review.final_commit === '640768fe90444b49cc3a04ca38675f9a08d3a3c3');
check('review_final_identical', review.final_tag_main_verified === true && review.main_equals_final_tag_at_final_tag_verification === true);
check('review_closure_pending', review.closure_tag_created === false && review.closure_tag_required_after_closure_patch_merge === true);
check('review_done_flags', review.merge_required_before_complete === false && review.tag_verification_required_after_merge === false && review.closure_patch_required_after_final_tag === false);

check('allowed_five', Array.isArray(contract.allowed_created_fact_types) && contract.allowed_created_fact_types.length === 5);
check('allowed_context', contract.allowed_created_fact_types.includes('production_twin_pilot_context_v1'));
check('allowed_readiness', contract.allowed_created_fact_types.includes('production_twin_pilot_readiness_review_v1'));
check('allowed_task_readiness', contract.allowed_created_fact_types.includes('controlled_pilot_task_persistence_readiness_v1'));
check('allowed_traceability', contract.allowed_created_fact_types.includes('production_twin_pilot_traceability_readback_v1'));
check('allowed_closure_report', contract.allowed_created_fact_types.includes('production_twin_pilot_closure_report_v1'));
check('forbidden_task', contract.forbidden_created_fact_types.includes('ao_act_task_v0'));
check('forbidden_receipt', contract.forbidden_created_fact_types.includes('ao_act_receipt_v0'));
check('forbidden_machine', contract.forbidden_created_fact_types.includes('machine_dispatch_v1'));
check('forbidden_effect', contract.forbidden_created_fact_types.includes('effect_attribution_v1'));
check('forbidden_fm', contract.forbidden_created_fact_types.includes('field_memory_record_v1'));
check('controlled_ledger', contract.controlled_production_twin_pilot_closure_ledger_v0 === true);
check('ledger_path', contract.controlled_pilot_closure_ledger_path === 'acceptance-output/P48_CONTROLLED_END_TO_END_PRODUCTION_TWIN_PILOT_CLOSURE_LEDGER.jsonl');
check('ledger_only', contract.controlled_write_only_writes_controlled_pilot_closure_ledger_v0 === true);

checkTrueKeys('contract', contract, [
  'pilot_closure_only',
  'production_twin_pilot_readiness_review_v1_is_not_production_rollout_approval',
  'production_twin_pilot_readiness_review_v1_is_not_machine_execution_authorization',
  'controlled_pilot_task_persistence_readiness_v1_is_not_ao_act_task_v0',
  'controlled_pilot_task_persistence_readiness_v1_is_not_task_persistence',
  'production_twin_pilot_closure_report_v1_is_not_production_deployment',
  'production_twin_pilot_closure_report_v1_is_not_autonomous_operation',
  'p48_must_not_create_ao_act_task_v0',
  'p48_must_not_call_control_ao_act_task_endpoint',
  'p48_must_not_create_ao_act_receipt_v0',
  'p48_must_not_dispatch_to_machine',
  'p48_must_not_create_roi_realization_v1',
  'p48_must_not_create_effect_attribution_v1',
  'p48_must_not_create_field_memory_record_v1',
  'p48_must_not_create_learning_signal_v1'
]);

check('source_chain_count', sourceChain.required_source_refs.length === 11);
checkTrueKeys('sourceChain', sourceChain, [
  'source_p37_to_p47_chain_hash_required',
  'source_record_set_hashes_required',
  'tenant_project_group_subject_must_match',
  'p48_must_not_recreate_p37_p47_artifacts',
  'p48_must_not_mutate_p37_p47_artifacts',
  'p48_must_not_replace_any_upstream_governance_record',
  'missing_any_required_source_blocks_p48',
  'source_chain_hash_mismatch_blocks_p48',
  'source_scope_mismatch_blocks_p48',
  'manual_pilot_closure_payload_without_governed_chain_blocked'
]);

check('p46_required_count', sourceP46.required_p46_records.length === 5);
checkTrueKeys('sourceP46', sourceP46, [
  'source_p46_record_set_hash_required',
  'p46_recommendation_candidate_ref_required',
  'p46_recommendation_governance_chain_verified_required',
  'p48_must_not_treat_p46_candidate_as_approved_recommendation',
  'p48_must_not_treat_p46_governance_review_as_dispatch_authorization',
  'p48_must_not_create_recommendation_candidate_from_twin_v1',
  'pilot_closure_without_p46_recommendation_governance_blocked'
]);

check('p47_required_count', sourceP47.required_p47_records.length === 5);
checkTrueKeys('sourceP47', sourceP47, [
  'source_p47_record_set_hash_required',
  'p47_task_creation_packet_ref_required',
  'p47_dispatch_boundary_chain_verified_required',
  'p48_must_not_treat_p47_task_creation_packet_as_ao_act_task',
  'p48_must_not_treat_p47_dispatch_boundary_review_as_execution_authorization',
  'p48_must_not_treat_p47_future_p48_marker_as_task_persistence_authorization',
  'p47_packet_not_ao_act_task_v0_required',
  'p47_packet_not_dispatched_required',
  'p47_packet_not_executed_required',
  'pilot_closure_without_p47_dispatch_boundary_blocked',
  'p47_packet_revalidation_failed_blocks_p48'
]);

check('scope_include_count', scope.pilot_scope_must_include.length === 10);
checkTrueKeys('scope', scope, [
  'pilot_scope_policy_ref_required',
  'pilot_scope_hash_required',
  'pilot_window_start_ts_required',
  'pilot_window_end_ts_required',
  'pilot_window_must_be_finite',
  'cross_tenant_pilot_closure_blocked',
  'cross_project_pilot_closure_blocked',
  'cross_group_pilot_closure_blocked',
  'subject_scope_expansion_blocked',
  'unbounded_pilot_scope_blocked',
  'pilot_scope_is_not_global_rollout',
  'pilot_scope_is_not_autonomous_operation_scope',
  'pilot_scope_is_not_commercial_deployment_scope'
]);

checkTrueKeys('traceability', traceability, [
  'end_to_end_traceability_policy_ref_required',
  'p37_trace_ref_required',
  'p38_trace_ref_required',
  'p39_trace_ref_required',
  'p40_trace_ref_required',
  'p41_trace_ref_required',
  'p42_trace_ref_required',
  'p43_trace_ref_required',
  'p44_trace_ref_required',
  'p45_trace_ref_required',
  'p46_trace_ref_required',
  'p47_trace_ref_required',
  'source_record_set_hashes_required',
  'policy_refs_required',
  'human_governance_refs_required',
  'closure_report_ref_required',
  'traceability_incomplete_blocks_p48',
  'source_hash_mismatch_blocks_p48',
  'scope_mismatch_blocks_p48',
  'traceability_complete_is_not_execution_success',
  'traceability_complete_is_not_model_quality_claim',
  'traceability_complete_is_not_roi_claim',
  'traceability_complete_is_not_effect_attribution'
]);

checkTrueKeys('taskReadiness', taskReadiness, [
  'controlled_pilot_task_persistence_readiness_v1_is_readiness_record',
  'controlled_pilot_task_persistence_readiness_v1_is_not_ao_act_task_v0',
  'controlled_pilot_task_persistence_readiness_v1_is_not_task_persistence',
  'controlled_pilot_task_persistence_readiness_v1_is_not_machine_dispatch',
  'controlled_pilot_task_persistence_readiness_v1_is_not_execution',
  'controlled_pilot_task_persistence_readiness_v1_is_not_receipt',
  'p47_task_creation_packet_ref_required',
  'p47_packet_not_ao_act_task_v0_required',
  'p47_packet_not_dispatched_required',
  'p47_packet_not_executed_required',
  'ao_act_action_type_allowlist_revalidated',
  'ao_act_target_scope_revalidated',
  'ao_act_time_window_revalidated',
  'ao_act_parameter_schema_revalidated',
  'ao_act_constraints_schema_revalidated',
  'ao_act_forbidden_keys_revalidated',
  'human_final_task_persistence_governance_required_for_future_gate'
]);

checkTrueKeys('nonAuto', nonAuto, ['pilot_non_autonomous_operation_policy_ref_required', 'human_gate_required', 'operation_boundary_nonclaims_required']);

checkTrueKeys('closureReport', closureReport, [
  'production_twin_pilot_closure_report_v1_is_end_to_end_pilot_closure_report',
  'production_twin_pilot_closure_report_v1_is_not_production_deployment',
  'production_twin_pilot_closure_report_v1_is_not_autonomous_operation',
  'production_twin_pilot_closure_report_v1_is_not_roi_report',
  'production_twin_pilot_closure_report_v1_is_not_effect_attribution',
  'production_twin_pilot_closure_report_v1_is_not_field_memory',
  'production_twin_pilot_closure_report_v1_is_not_learning_signal',
  'pilot_scope_summary_required',
  'end_to_end_traceability_summary_required',
  'runtime_chain_summary_required',
  'recommendation_chain_summary_required',
  'dispatch_boundary_summary_required',
  'task_persistence_readiness_summary_required',
  'known_limitations_required',
  'future_work_required_required',
  'non_autonomous_operation_nonclaims_required'
]);

checkTrueKeys('future', future, [
  'eligible_as_future_post_pilot_input_ref',
  'future_post_pilot_input_ref_is_not_production_deployment',
  'future_post_pilot_input_ref_is_not_ao_act_task',
  'future_post_pilot_input_ref_is_not_machine_dispatch',
  'future_post_pilot_input_ref_is_not_execution',
  'future_post_pilot_gate_must_revalidate_all_p48_records',
  'future_post_pilot_gate_must_require_explicit_policy',
  'future_post_pilot_gate_must_require_human_governance'
]);

check('idempotency_domain_count', idempotency.production_twin_pilot_closure_scope_hash_domain.length === 19);
checkTrueKeys('idempotency', idempotency, [
  'idempotency_key_required',
  'production_twin_pilot_closure_scope_hash_required',
  'same_upstream_chain_same_pilot_scope_duplicate_closure_blocked',
  'changed_context_payload_same_scope_blocked',
  'changed_readiness_payload_same_scope_blocked',
  'changed_task_readiness_payload_same_scope_blocked',
  'changed_traceability_payload_same_scope_blocked',
  'changed_closure_report_payload_same_scope_blocked'
]);

checkTrueKeys('determinism', determinism, [
  'determinism_hash_required',
  'same_p37_to_p47_sources_same_policy_must_produce_same_pilot_closure_hash',
  'as_of_ts_required',
  'implicit_now_for_hashing_forbidden',
  'implicit_latest_forecast_lookup_forbidden',
  'implicit_latest_recommendation_lookup_forbidden',
  'implicit_latest_dispatch_packet_lookup_forbidden',
  'implicit_latest_ao_act_task_lookup_forbidden',
  'implicit_roi_lookup_forbidden',
  'implicit_effect_lookup_forbidden',
  'implicit_field_memory_lookup_forbidden',
  'source_refs_must_be_sorted_deterministically',
  'policy_refs_must_be_sorted_deterministically'
]);

checkTrueKeys('chain', chain, [
  'production_twin_pilot_context_chain_hash_required',
  'previous_production_twin_pilot_context_payload_must_not_be_mutated',
  'production_twin_pilot_readiness_review_chain_hash_required',
  'previous_production_twin_pilot_readiness_review_payload_must_not_be_mutated',
  'controlled_pilot_task_persistence_readiness_chain_hash_required',
  'previous_controlled_pilot_task_persistence_readiness_payload_must_not_be_mutated',
  'production_twin_pilot_traceability_readback_chain_hash_required',
  'previous_production_twin_pilot_traceability_readback_payload_must_not_be_mutated',
  'production_twin_pilot_closure_report_chain_hash_required',
  'previous_production_twin_pilot_closure_report_payload_must_not_be_mutated'
]);

checkFalseKeys('noDownstream', noDownstream, [
  'ao_act_task_v0_created',
  'ao_act_receipt_v0_created',
  'machine_dispatch_created',
  'execution_created',
  'operator_instruction_v1_created',
  'operation_plan_v1_created',
  'next_action_v1_created',
  'production_rollout_created',
  'autonomous_operation_created',
  'commercial_deployment_created',
  'roi_realization_v1_created',
  'effect_attribution_v1_created',
  'field_memory_candidate_v1_created',
  'field_memory_record_v1_created',
  'training_run_v1_created',
  'learning_signal_v1_created',
  'control_ao_act_task_endpoint_called'
]);
check('noDownstream.zero_required', noDownstream.forbidden_downstream_fact_count_required_zero === true);
check('noDownstream.claims', noDownstream.forbidden_claims.includes('field_memory_committed') && noDownstream.forbidden_claims.includes('learning_signal_created'));

for (const schema of schemas) {
  check('schema_core_' + schema.object_type, Array.isArray(schema.required_fields) && schema.required_fields.includes('determinism_hash') && schema.required_fields.includes('idempotency_key') && schema.required_fields.some((field) => field.endsWith('chain_hash')));
}
check('schema_context_sources', schemas[0].required_fields.includes('source_p37_calibration_trial_execution_ref') && schemas[0].required_fields.includes('source_p47_dispatch_boundary_ref') && schemas[0].required_fields.includes('source_p47_task_creation_packet_ref'));
check('schema_readiness_nonclaims', schemas[1].required_fields.includes('not_production_rollout_approval') && schemas[1].required_fields.includes('not_machine_execution_authorization') && schemas[1].required_fields.includes('not_ao_act_task_persistence_authorization'));
check('schema_task_nonclaims', schemas[2].required_fields.includes('not_ao_act_task_v0') && schemas[2].required_fields.includes('not_task_persistence') && schemas[2].required_fields.includes('not_machine_dispatch') && schemas[2].required_fields.includes('not_execution') && schemas[2].required_fields.includes('not_receipt'));
check('schema_trace_refs', schemas[3].required_fields.includes('p37_trace_ref') && schemas[3].required_fields.includes('p47_trace_ref') && schemas[3].required_fields.includes('end_to_end_traceability_hash'));
check('schema_closure_nonclaims', schemas[4].required_fields.includes('not_production_deployment') && schemas[4].required_fields.includes('not_autonomous_operation') && schemas[4].required_fields.includes('not_ao_act_task_v0') && schemas[4].required_fields.includes('not_roi_report') && schemas[4].required_fields.includes('not_field_memory') && schemas[4].required_fields.includes('not_learning_signal'));

check('file_set_docs', fs.readdirSync('docs/twin_kernel').filter((name) => name.startsWith('P48_') && name.endsWith('.json')).length === 20);
check('file_set_scripts', fs.readdirSync('scripts/twin_kernel').filter((name) => name.startsWith('P48_') && name.endsWith('.cjs')).length === 3);
check('dry_deterministic', dry.determinism_hash === dry2.determinism_hash);
check('dry_zero_write', noTargetRecords(dry));
check('context_zero_write', noTargetRecords(contextMode));
check('task_readiness_zero_write', noTargetRecords(taskMode));
check('closure_report_zero_write', noTargetRecords(reportMode));
check('task_mode_non_task', taskMode.not_ao_act_task_v0 === true && taskMode.not_task_persistence === true && taskMode.ao_act_task_v0_created === false);
check('controlled_write_five', writeMode.production_twin_pilot_context_v1_created === true && writeMode.production_twin_pilot_readiness_review_v1_created === true && writeMode.controlled_pilot_task_persistence_readiness_v1_created === true && writeMode.production_twin_pilot_traceability_readback_v1_created === true && writeMode.production_twin_pilot_closure_report_v1_created === true);
check('controlled_write_atomic', writeMode.atomic_production_twin_pilot_closure_record_set_created === true);
check('controlled_write_ledger_only', writeMode.controlled_pilot_closure_ledger_only === true);
check('controlled_write_no_task', writeMode.ao_act_task_v0_created === false && writeMode.control_ao_act_task_endpoint_called === false && writeMode.ao_act_receipt_v0_created === false);
check('controlled_write_no_downstream', writeMode.machine_dispatch_created === false && writeMode.execution_created === false && writeMode.outcome_created === false && writeMode.roi_realization_v1_created === false && writeMode.effect_attribution_v1_created === false && writeMode.field_memory_record_v1_created === false && writeMode.learning_signal_v1_created === false);
check('readiness_states', writeMode.production_twin_pilot_readiness_state === 'PRODUCTION_TWIN_PILOT_READY_FOR_CLOSURE' && writeMode.controlled_task_persistence_readiness_state === 'CONTROLLED_TASK_PERSISTENCE_READY_FOR_FUTURE_GATE' && writeMode.production_twin_pilot_closure_state === 'END_TO_END_PRODUCTION_TWIN_PILOT_CLOSED_WITH_LIMITATIONS');
check('runtime_chain_verified', writeMode.p42_forecast_chain_verified === true && writeMode.p43_residual_drift_chain_verified === true && writeMode.p44_activation_chain_verified === true && writeMode.p45_runtime_health_chain_verified === true && writeMode.p46_recommendation_governance_chain_verified === true && writeMode.p47_dispatch_boundary_chain_verified === true);
check('p47_packet_flags', writeMode.p47_packet_not_ao_act_task_v0 === true && writeMode.p47_packet_not_dispatched === true && writeMode.p47_packet_not_executed === true && writeMode.p47_packet_not_received === true && writeMode.p47_packet_not_outcome === true);
check('ao_act_revalidated', writeMode.ao_act_action_type_allowlist_revalidated === true && writeMode.ao_act_target_scope_revalidated === true && writeMode.ao_act_time_window_revalidated === true && writeMode.ao_act_parameter_schema_revalidated === true && writeMode.ao_act_constraints_schema_revalidated === true && writeMode.ao_act_forbidden_keys_revalidated === true);
check('write_nonclaims', writeMode.not_production_rollout_approval === true && writeMode.not_autonomous_operation === true && writeMode.not_ao_act_task_v0 === true && writeMode.not_task_persistence === true && writeMode.not_machine_dispatch === true && writeMode.not_execution === true && writeMode.not_receipt === true && writeMode.not_outcome === true && writeMode.not_roi === true && writeMode.not_effect_attribution === true && writeMode.not_field_memory === true && writeMode.not_learning_signal === true);
check('hashes_present', Boolean(writeMode.pilot_scope_hash && writeMode.end_to_end_traceability_hash && writeMode.source_p47_record_set_hash && writeMode.source_p37_to_p47_chain_hash && writeMode.idempotency_key && writeMode.determinism_hash));
check('ledger_file_exists', fs.existsSync('acceptance-output/P48_CONTROLLED_END_TO_END_PRODUCTION_TWIN_PILOT_CLOSURE_LEDGER.jsonl'));
const ledgerRows = fs.readFileSync('acceptance-output/P48_CONTROLLED_END_TO_END_PRODUCTION_TWIN_PILOT_CLOSURE_LEDGER.jsonl', 'utf8').trim().split('\n').map((line) => JSON.parse(line));
check('ledger_has_five_rows', ledgerRows.length === 5);
check('ledger_allowed_types', ledgerRows.map((row) => row.object_type).join('|') === contract.allowed_created_fact_types.join('|'));
check('ledger_shared_pilot_scope_hash', new Set(ledgerRows.map((row) => row.pilot_scope_hash)).size === 1);
check('ledger_shared_traceability_hash', new Set(ledgerRows.map((row) => row.end_to_end_traceability_hash)).size === 1);
check('ledger_shared_source_p47_hash', new Set(ledgerRows.map((row) => row.source_p47_record_set_hash)).size === 1);
check('ledger_shared_determinism_hash', new Set(ledgerRows.map((row) => row.determinism_hash)).size === 1);
check('ledger_shared_idempotency_key', new Set(ledgerRows.map((row) => row.idempotency_key)).size === 1);
check('ledger_nonclaims', ledgerRows.every((row) => row.not_ao_act_task_v0 === true && row.not_task_persistence === true && row.not_machine_dispatch === true && row.not_execution === true && row.not_receipt === true && row.not_roi === true && row.not_field_memory === true && row.not_learning_signal === true));
check('chain_mode', chainMode.chain_ok === true && chainMode.previous_records_unchanged === true && Boolean(chainMode.first_pilot_closure_chain_hash) && Boolean(chainMode.second_pilot_closure_chain_hash));
check('forbidden_downstream_zero', writeMode.forbidden_downstream_fact_count === 0);

const blockedFixtures = [
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
];

for (const fixture of blockedFixtures) {
  const result = run(['--fixture', fixture]);
  check('blocked_' + fixture, result.ok === true && result.result_state === 'BLOCKED_' + fixture && noTargetRecords(result));
}

const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
const ok = failed.length === 0;

console.log(JSON.stringify({
  ok,
  acceptance: 'P48_ALL_ACCEPTANCE',
  phase: 'P48',
  baseline_tag: contract.baseline_tag,
  baseline_commit: contract.baseline_commit,
  assertion_count: checks.length,
  failed_assertion_count: failed.length,
  failed_assertions: failed,
  dry_run_determinism_hash: dry.determinism_hash,
  controlled_context_determinism_hash: contextMode.determinism_hash,
  controlled_task_readiness_determinism_hash: taskMode.determinism_hash,
  controlled_closure_report_determinism_hash: reportMode.determinism_hash,
  controlled_write_determinism_hash: writeMode.determinism_hash,
  first_pilot_closure_chain_hash: chainMode.first_pilot_closure_chain_hash,
  second_pilot_closure_chain_hash: chainMode.second_pilot_closure_chain_hash
}, null, 2));

if (!ok) process.exit(1);

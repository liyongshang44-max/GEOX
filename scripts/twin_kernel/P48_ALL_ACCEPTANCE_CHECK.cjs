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
check('p47_final_facts', contract.p47_final_tag === 'p47_ao_act_from_twin_dispatch_boundary_gate_v0' && contract.p47_final_commit === 'a06030299c8d55cf46ff483acb278959162b6e76');
check('p47_closure_verified', contract.p47_completion_status_required === 'complete' && contract.p47_final_closure_status_required === 'final_tag_main_verified' && contract.p47_closure_tag_main_identical_at_freeze === true);
check('review_stage', review.completion_status === 'implementation_ready_for_review' && review.final_closure_status === 'not_started');
check('allowed_five', Array.isArray(contract.allowed_created_fact_types) && contract.allowed_created_fact_types.length === 5);
check('forbidden_types', Array.isArray(contract.forbidden_created_fact_types) && contract.forbidden_created_fact_types.includes('ao_act_task_v0') && contract.forbidden_created_fact_types.includes('ao_act_receipt_v0') && contract.forbidden_created_fact_types.includes('field_memory_record_v1'));
check('ledger_policy', contract.controlled_write_only_writes_controlled_pilot_closure_ledger_v0 === true && contract.controlled_pilot_closure_ledger_path === 'acceptance-output/P48_CONTROLLED_END_TO_END_PRODUCTION_TWIN_PILOT_CLOSURE_LEDGER.jsonl');
check('contract_nonclaims', contract.pilot_closure_only === true && contract.production_twin_pilot_readiness_review_v1_is_not_production_rollout_approval === true && contract.production_twin_pilot_readiness_review_v1_is_not_machine_execution_authorization === true && contract.controlled_pilot_task_persistence_readiness_v1_is_not_ao_act_task_v0 === true && contract.controlled_pilot_task_persistence_readiness_v1_is_not_task_persistence === true && contract.production_twin_pilot_closure_report_v1_is_not_production_deployment === true && contract.production_twin_pilot_closure_report_v1_is_not_autonomous_operation === true);
check('contract_downstream_blocks', contract.p48_must_not_create_ao_act_task_v0 === true && contract.p48_must_not_call_control_ao_act_task_endpoint === true && contract.p48_must_not_create_ao_act_receipt_v0 === true && contract.p48_must_not_dispatch_to_machine === true && contract.p48_must_not_create_roi_realization_v1 === true && contract.p48_must_not_create_effect_attribution_v1 === true && contract.p48_must_not_create_field_memory_record_v1 === true && contract.p48_must_not_create_learning_signal_v1 === true);

check('source_chain_count', Array.isArray(sourceChain.required_source_refs) && sourceChain.required_source_refs.length === 11);
check('source_chain_hash', sourceChain.source_p37_to_p47_chain_hash_required === true && sourceChain.source_record_set_hashes_required === true && sourceChain.tenant_project_group_subject_must_match === true);
check('source_chain_boundary', sourceChain.p48_must_not_recreate_p37_p47_artifacts === true && sourceChain.p48_must_not_mutate_p37_p47_artifacts === true && sourceChain.p48_must_not_replace_any_upstream_governance_record === true);
check('source_chain_blocks', sourceChain.missing_any_required_source_blocks_p48 === true && sourceChain.source_chain_hash_mismatch_blocks_p48 === true && sourceChain.source_scope_mismatch_blocks_p48 === true && sourceChain.manual_pilot_closure_payload_without_governed_chain_blocked === true);
check('p46_required', Array.isArray(sourceP46.required_p46_records) && sourceP46.required_p46_records.length === 5 && sourceP46.source_p46_record_set_hash_required === true);
check('p46_nonclaims', sourceP46.p48_must_not_treat_p46_candidate_as_approved_recommendation === true && sourceP46.p48_must_not_treat_p46_governance_review_as_dispatch_authorization === true && sourceP46.p48_must_not_create_recommendation_candidate_from_twin_v1 === true);
check('p46_blocks', sourceP46.pilot_closure_without_p46_recommendation_governance_blocked === true);
check('p47_required', Array.isArray(sourceP47.required_p47_records) && sourceP47.required_p47_records.length === 5 && sourceP47.source_p47_record_set_hash_required === true && sourceP47.p47_task_creation_packet_ref_required === true);
check('p47_nonclaims', sourceP47.p48_must_not_treat_p47_task_creation_packet_as_ao_act_task === true && sourceP47.p48_must_not_treat_p47_dispatch_boundary_review_as_execution_authorization === true && sourceP47.p48_must_not_treat_p47_future_p48_marker_as_task_persistence_authorization === true);
check('p47_packet_revalidation', sourceP47.p47_packet_not_ao_act_task_v0_required === true && sourceP47.p47_packet_not_dispatched_required === true && sourceP47.p47_packet_not_executed_required === true && sourceP47.p47_packet_revalidation_failed_blocks_p48 === true);

check('pilot_scope_policy', scope.pilot_scope_policy_ref_required === true && Array.isArray(scope.pilot_scope_must_include) && scope.pilot_scope_must_include.length === 10 && scope.pilot_scope_hash_required === true && scope.pilot_window_must_be_finite === true);
check('pilot_scope_blocks', scope.cross_tenant_pilot_closure_blocked === true && scope.cross_project_pilot_closure_blocked === true && scope.cross_group_pilot_closure_blocked === true && scope.subject_scope_expansion_blocked === true && scope.unbounded_pilot_scope_blocked === true);
check('pilot_scope_nonclaims', scope.pilot_scope_is_not_global_rollout === true && scope.pilot_scope_is_not_autonomous_operation_scope === true && scope.pilot_scope_is_not_commercial_deployment_scope === true);
check('traceability_policy', traceability.end_to_end_traceability_policy_ref_required === true && traceability.p37_trace_ref_required === true && traceability.p47_trace_ref_required === true && traceability.source_record_set_hashes_required === true && traceability.human_governance_refs_required === true);
check('traceability_blocks', traceability.traceability_incomplete_blocks_p48 === true && traceability.source_hash_mismatch_blocks_p48 === true && traceability.scope_mismatch_blocks_p48 === true);
check('traceability_nonclaims', traceability.traceability_complete_is_not_execution_success === true && traceability.traceability_complete_is_not_model_quality_claim === true && traceability.traceability_complete_is_not_roi_claim === true && traceability.traceability_complete_is_not_effect_attribution === true);
check('task_readiness_nonclaims', taskReadiness.controlled_pilot_task_persistence_readiness_v1_is_readiness_record === true && taskReadiness.controlled_pilot_task_persistence_readiness_v1_is_not_ao_act_task_v0 === true && taskReadiness.controlled_pilot_task_persistence_readiness_v1_is_not_task_persistence === true && taskReadiness.controlled_pilot_task_persistence_readiness_v1_is_not_machine_dispatch === true && taskReadiness.controlled_pilot_task_persistence_readiness_v1_is_not_execution === true && taskReadiness.controlled_pilot_task_persistence_readiness_v1_is_not_receipt === true);
check('task_readiness_revalidation', taskReadiness.p47_task_creation_packet_ref_required === true && taskReadiness.p47_packet_not_ao_act_task_v0_required === true && taskReadiness.p47_packet_not_dispatched_required === true && taskReadiness.p47_packet_not_executed_required === true && taskReadiness.ao_act_action_type_allowlist_revalidated === true && taskReadiness.ao_act_forbidden_keys_revalidated === true && taskReadiness.human_final_task_persistence_governance_required_for_future_gate === true);
check('non_autonomous_policy', nonAuto.pilot_non_autonomous_operation_policy_ref_required === true && nonAuto.human_gate_required === true && nonAuto.operation_boundary_nonclaims_required === true);
check('closure_report_policy', closureReport.production_twin_pilot_closure_report_v1_is_end_to_end_pilot_closure_report === true && closureReport.production_twin_pilot_closure_report_v1_is_not_production_deployment === true && closureReport.production_twin_pilot_closure_report_v1_is_not_autonomous_operation === true && closureReport.production_twin_pilot_closure_report_v1_is_not_roi_report === true && closureReport.production_twin_pilot_closure_report_v1_is_not_field_memory === true && closureReport.production_twin_pilot_closure_report_v1_is_not_learning_signal === true);
check('closure_report_required', closureReport.pilot_scope_summary_required === true && closureReport.end_to_end_traceability_summary_required === true && closureReport.runtime_chain_summary_required === true && closureReport.recommendation_chain_summary_required === true && closureReport.dispatch_boundary_summary_required === true && closureReport.task_persistence_readiness_summary_required === true && closureReport.known_limitations_required === true && closureReport.non_autonomous_operation_nonclaims_required === true);
check('future_boundary', future.eligible_as_future_post_pilot_input_ref === true && future.future_post_pilot_input_ref_is_not_production_deployment === true && future.future_post_pilot_input_ref_is_not_ao_act_task === true && future.future_post_pilot_input_ref_is_not_machine_dispatch === true && future.future_post_pilot_input_ref_is_not_execution === true && future.future_post_pilot_gate_must_revalidate_all_p48_records === true && future.future_post_pilot_gate_must_require_human_governance === true);
check('idempotency_policy', idempotency.idempotency_key_required === true && idempotency.production_twin_pilot_closure_scope_hash_required === true && Array.isArray(idempotency.production_twin_pilot_closure_scope_hash_domain) && idempotency.production_twin_pilot_closure_scope_hash_domain.length === 18 && idempotency.same_upstream_chain_same_pilot_scope_duplicate_closure_blocked === true && idempotency.changed_closure_report_payload_same_scope_blocked === true);
check('determinism_policy', determinism.determinism_hash_required === true && determinism.same_p37_to_p47_sources_same_policy_must_produce_same_pilot_closure_hash === true && determinism.as_of_ts_required === true && determinism.implicit_latest_forecast_lookup_forbidden === true && determinism.implicit_latest_recommendation_lookup_forbidden === true && determinism.implicit_latest_dispatch_packet_lookup_forbidden === true && determinism.implicit_latest_ao_act_task_lookup_forbidden === true && determinism.implicit_roi_lookup_forbidden === true && determinism.implicit_effect_lookup_forbidden === true && determinism.implicit_field_memory_lookup_forbidden === true);
check('chain_policy', chain.production_twin_pilot_context_chain_hash_required === true && chain.production_twin_pilot_readiness_review_chain_hash_required === true && chain.controlled_pilot_task_persistence_readiness_chain_hash_required === true && chain.production_twin_pilot_traceability_readback_chain_hash_required === true && chain.production_twin_pilot_closure_report_chain_hash_required === true);
check('no_downstream_policy', noDownstream.ao_act_task_v0_created === false && noDownstream.ao_act_receipt_v0_created === false && noDownstream.machine_dispatch_created === false && noDownstream.execution_created === false && noDownstream.operator_instruction_v1_created === false && noDownstream.production_rollout_created === false && noDownstream.autonomous_operation_created === false && noDownstream.roi_realization_v1_created === false && noDownstream.effect_attribution_v1_created === false && noDownstream.field_memory_record_v1_created === false && noDownstream.learning_signal_v1_created === false);
check('no_endpoint_policy', noDownstream.control_ao_act_task_endpoint_called === false && noDownstream.forbidden_downstream_fact_count_required_zero === true && Array.isArray(noDownstream.forbidden_claims) && noDownstream.forbidden_claims.includes('field_memory_committed'));

for (const schema of schemas) {
  check('schema_core_' + schema.object_type, Array.isArray(schema.required_fields) && schema.required_fields.includes('determinism_hash') && schema.required_fields.includes('idempotency_key') && schema.required_fields.some((field) => field.endsWith('chain_hash')));
}
check('schema_context_sources', schemas[0].required_fields.includes('source_p37_calibration_trial_execution_ref') && schemas[0].required_fields.includes('source_p47_dispatch_boundary_ref') && schemas[0].required_fields.includes('source_p47_task_creation_packet_ref'));
check('schema_readiness_nonclaims', schemas[1].required_fields.includes('not_production_rollout_approval') && schemas[1].required_fields.includes('not_machine_execution_authorization') && schemas[1].required_fields.includes('not_ao_act_task_persistence_authorization'));
check('schema_task_readiness_nonclaims', schemas[2].required_fields.includes('not_ao_act_task_v0') && schemas[2].required_fields.includes('not_task_persistence') && schemas[2].required_fields.includes('not_machine_dispatch') && schemas[2].required_fields.includes('not_execution') && schemas[2].required_fields.includes('not_receipt'));
check('schema_traceability_refs', schemas[3].required_fields.includes('p37_trace_ref') && schemas[3].required_fields.includes('p47_trace_ref') && schemas[3].required_fields.includes('end_to_end_traceability_hash'));
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

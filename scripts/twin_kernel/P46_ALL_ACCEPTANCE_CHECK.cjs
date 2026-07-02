// scripts/twin_kernel/P46_ALL_ACCEPTANCE_CHECK.cjs
'use strict';

const fs = require('node:fs');
const cp = require('node:child_process');

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const run = (args) => JSON.parse(cp.execFileSync(
  process.execPath,
  ['scripts/twin_kernel/P46_21_CONTROLLED_RECOMMENDATION_FROM_TWIN_RUNNER_V0.cjs', ...args],
  { encoding: 'utf8' }
));

const checks = [];
const check = (name, value) => checks.push([name, Boolean(value)]);

const contract = readJson('docs/twin_kernel/P46_RECOMMENDATION_FROM_TWIN_GOVERNANCE_CONTRACT_V0.json');
const review = readJson('docs/twin_kernel/P46_RECOMMENDATION_FROM_TWIN_GOVERNANCE_COMPLETION_REVIEW_V0.json');

const p42 = readJson('docs/twin_kernel/P46_SOURCE_P42_FORECAST_RECORD_SET_BOUNDARY_POLICY_V0.json');
const p43 = readJson('docs/twin_kernel/P46_SOURCE_P43_RESIDUAL_DRIFT_RECORD_SET_BOUNDARY_POLICY_V0.json');
const p44 = readJson('docs/twin_kernel/P46_SOURCE_P44_ACTIVE_MODEL_ACTIVATION_RECORD_SET_BOUNDARY_POLICY_V0.json');
const p45 = readJson('docs/twin_kernel/P46_SOURCE_P45_RUNTIME_OBSERVABILITY_RECORD_SET_BOUNDARY_POLICY_V0.json');

const eligibility = readJson('docs/twin_kernel/P46_RECOMMENDATION_ELIGIBILITY_POLICY_V0.json');
const scope = readJson('docs/twin_kernel/P46_RECOMMENDATION_SCOPE_POLICY_V0.json');
const safety = readJson('docs/twin_kernel/P46_RECOMMENDATION_SAFETY_NON_ACTIONABILITY_POLICY_V0.json');
const governance = readJson('docs/twin_kernel/P46_RECOMMENDATION_GOVERNANCE_REVIEW_POLICY_V0.json');
const traceability = readJson('docs/twin_kernel/P46_RECOMMENDATION_TRACEABILITY_POLICY_V0.json');
const p47 = readJson('docs/twin_kernel/P46_P47_FUTURE_DISPATCH_BOUNDARY_ELIGIBILITY_POLICY_V0.json');
const idempotency = readJson('docs/twin_kernel/P46_IDEMPOTENCY_POLICY_V0.json');
const determinism = readJson('docs/twin_kernel/P46_DETERMINISM_POLICY_V0.json');
const chain = readJson('docs/twin_kernel/P46_APPEND_ONLY_RECOMMENDATION_CHAIN_POLICY_V0.json');
const noDownstream = readJson('docs/twin_kernel/P46_NO_AO_ACT_NO_ACTION_NO_ROI_NO_FIELD_MEMORY_POLICY_V0.json');

const schemas = [
  readJson('docs/twin_kernel/P46_TWIN_RECOMMENDATION_CONTEXT_SCHEMA_V0.json'),
  readJson('docs/twin_kernel/P46_RECOMMENDATION_CANDIDATE_FROM_TWIN_SCHEMA_V0.json'),
  readJson('docs/twin_kernel/P46_RECOMMENDATION_GOVERNANCE_REVIEW_SCHEMA_V0.json'),
  readJson('docs/twin_kernel/P46_RECOMMENDATION_SAFETY_CASE_SCHEMA_V0.json'),
  readJson('docs/twin_kernel/P46_RECOMMENDATION_TRACEABILITY_READBACK_SCHEMA_V0.json')
];

const dry = run([]);
const dry2 = run([]);
const contextMode = run(['--mode', 'controlled-recommendation-context']);
const candidateMode = run(['--mode', 'controlled-recommendation-candidate']);
const writeMode = run(['--mode', 'controlled-write']);
const chainMode = run(['--mode', 'controlled-two-step-recommendation-chain']);

const noTargetRecords = (result) =>
  result.twin_recommendation_context_v1_created === false &&
  result.recommendation_candidate_from_twin_v1_created === false &&
  result.recommendation_governance_review_v1_created === false &&
  result.recommendation_safety_case_v1_created === false &&
  result.recommendation_traceability_readback_v1_created === false;

check('baseline_tag', contract.baseline_tag === 'p45_post_activation_runtime_observability_rollback_readiness_gate_v0_closure');
check('baseline_commit', contract.baseline_commit === 'a20d83da551604a6900f9f3ee6caa30a001a2b90');
check('review_stage', review.completion_status === 'complete' && review.final_closure_status === 'final_tag_main_verified' && review.final_tag_created === true && review.final_commit === '46006306d416972f28a14cf852cace5ac2deefd4');

check('allowed_five', Array.isArray(contract.allowed_created_fact_types) && contract.allowed_created_fact_types.length === 5);
check('ledger_policy', contract.controlled_write_only_writes_controlled_recommendation_from_twin_ledger_v0 === true);
check('candidate_only_contract', contract.candidate_only === true || contract.recommendation_candidate_from_twin_v1_is_candidate_not_recommendation_approval === true);
check('contract_top_non_actionability', contract.recommendation_candidate_from_twin_v1_is_not_approved_recommendation === true && contract.recommendation_governance_review_is_not_dispatch_authorization === true && contract.recommendation_safety_case_is_not_field_operation_permission === true && contract.p46_must_not_create_approved_recommendation_v1 === true && contract.p46_must_not_create_operator_instruction_v1 === true && contract.p46_must_not_create_ao_act_task_v0 === true && contract.p46_must_not_create_roi_realization_v1 === true && contract.p46_must_not_create_field_memory_record_v1 === true);

check('p42_required_records', p42.required_records.length === 4);
check('p42_policy', p42.record_set_hash_required === true && p42.tenant_project_group_subject_must_match === true && p42.source_refs_must_be_pointer_only === true && p42.missing_source_blocks_p46 === true);

check('p43_required_records', p43.required_records.length === 4);
check('p43_policy', p43.record_set_hash_required === true && p43.tenant_project_group_subject_must_match === true && p43.source_refs_must_be_pointer_only === true && p43.hash_mismatch_blocks_p46 === true);

check('p44_required_records', p44.required_records.length === 6);
check('p44_policy', p44.record_set_hash_required === true && p44.tenant_project_group_subject_must_match === true && p44.source_refs_must_be_pointer_only === true && p44.activation_nonclaims_must_be_carried_forward === true);

check('p45_required_records', p45.required_records.length === 5);
check('p45_policy', p45.record_set_hash_required === true && p45.tenant_project_group_subject_must_match === true && p45.source_refs_must_be_pointer_only === true && p45.observability_is_context_not_authorization === true);

check('eligibility_policy', eligibility.recommendation_eligibility_policy_ref_required === true && eligibility.forecast_output_is_not_recommendation === true && eligibility.missing_recommendation_eligibility_policy_blocks_p46 === true);
check('scope_policy', scope.recommendation_scope_policy_ref_required === true && scope.source_scope_mismatch_blocks_p46 === true && scope.priority_urgency_ranking_forbidden_by_default === true);
check('safety_policy', safety.recommendation_safety_policy_ref_required === true && safety.recommendation_candidate_requires_safety_case === true && safety.safety_case_is_context_only === true && safety.candidate_summary_must_be_non_imperative === true);
check('governance_policy', governance.recommendation_candidate_requires_governance_review === true && governance.human_recommendation_governance_ref_required === true && governance.governance_review_passed_is_not_dispatch_authorization === true);
check('traceability_policy', traceability.recommendation_candidate_requires_traceability_readback === true && traceability.p42_forecast_trace_refs_required === true && traceability.source_record_set_hashes_required === true);
check('p47_policy', p47.eligible_as_future_p47_dispatch_boundary_input_ref === true && p47.eligible_as_future_p47_dispatch_boundary_input_ref_is_only_future_input_marker === true && p47.future_p47_must_revalidate_all_p46_records === true);
check('idempotency_policy', idempotency.idempotency_key_required === true && idempotency.same_twin_sources_same_policy_duplicate_candidate_blocked === true && idempotency.changed_traceability_payload_same_scope_blocked === true);
check('determinism_policy', determinism.determinism_hash_required === true && determinism.implicit_latest_forecast_lookup_forbidden === true && determinism.implicit_latest_observability_lookup_forbidden === true && determinism.implicit_roi_lookup_forbidden === true);
check('chain_policy', chain.twin_recommendation_context_chain_hash_required === true && chain.recommendation_candidate_from_twin_chain_hash_required === true && chain.recommendation_traceability_readback_chain_hash_required === true);
check('no_downstream_policy', noDownstream.approved_recommendation_v1_created === false && noDownstream.ao_act_task_v0_created === false && noDownstream.roi_realization_v1_created === false && noDownstream.field_memory_record_v1_created === false && noDownstream.learning_signal_v1_created === false);

for (const schema of schemas) {
  check('schema_' + schema.object_type, Array.isArray(schema.required_fields) && schema.required_fields.includes('determinism_hash') && schema.required_fields.includes('idempotency_key') && schema.required_fields.some((field) => field.endsWith('chain_hash')));
}

check('file_set_docs', fs.readdirSync('docs/twin_kernel').filter((name) => name.startsWith('P46_')).length === 21);
check('file_set_scripts', fs.readdirSync('scripts/twin_kernel').filter((name) => name.startsWith('P46_')).length === 3);

check('dry_deterministic', dry.determinism_hash === dry2.determinism_hash);
check('dry_zero_write', noTargetRecords(dry));
check('context_zero_write', noTargetRecords(contextMode));
check('candidate_zero_write', noTargetRecords(candidateMode));

check('controlled_write_five', writeMode.twin_recommendation_context_v1_created === true && writeMode.recommendation_candidate_from_twin_v1_created === true && writeMode.recommendation_governance_review_v1_created === true && writeMode.recommendation_safety_case_v1_created === true && writeMode.recommendation_traceability_readback_v1_created === true);
check('controlled_write_atomic', writeMode.atomic_recommendation_from_twin_record_set_created === true);
check('controlled_write_ledger_only', writeMode.ledger_only === true);

check('ledger_file_exists', fs.existsSync('acceptance-output/P46_CONTROLLED_RECOMMENDATION_FROM_TWIN_LEDGER.jsonl'));
check('ledger_has_five_rows', fs.readFileSync('acceptance-output/P46_CONTROLLED_RECOMMENDATION_FROM_TWIN_LEDGER.jsonl', 'utf8').trim().split('\n').length === 5);

check('runner_source_hashes', Boolean(writeMode.source_p42_record_set_hash && writeMode.source_p43_record_set_hash && writeMode.source_p44_record_set_hash && writeMode.source_p45_record_set_hash));
check('runner_nonclaims', writeMode.eligible_as_future_p47_boundary_input_ref === true && writeMode.not_approved_recommendation === true && writeMode.not_operator_instruction === true && writeMode.not_action === true && writeMode.not_ao_act_dispatch === true && writeMode.not_roi_claim === true && writeMode.not_effect_claim === true && writeMode.not_field_memory_commit === true);
check('chain_mode', chainMode.chain_ok === true && chainMode.previous_records_unchanged === true);
check('forbidden_downstream_zero', writeMode.forbidden_downstream_fact_count === 0);

const blockedFixtures = [
  'missing_p42_forecast_record_set',
  'missing_p43_residual_monitoring_record_set',
  'missing_p44_activation_record_set',
  'missing_p45_runtime_observability_record_set',
  'source_scope_mismatch',
  'source_record_set_hash_mismatch',
  'missing_recommendation_eligibility_policy',
  'missing_recommendation_safety_policy',
  'missing_human_recommendation_governance',
  'recommendation_language_blocked',
  'operator_instruction_language_blocked',
  'ao_act_language_blocked',
  'roi_language_blocked',
  'effect_attribution_language_blocked',
  'field_memory_language_blocked',
  'model_update_language_blocked',
  'rollback_execution_language_blocked',
  'learning_language_blocked',
  'duplicate_recommendation_scope_blocked',
  'implicit_latest_forecast_lookup_blocked',
  'implicit_latest_drift_lookup_blocked',
  'implicit_latest_active_model_lookup_blocked',
  'implicit_latest_observability_lookup_blocked',
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
  acceptance: 'P46_ALL_ACCEPTANCE',
  phase: 'P46',
  baseline_tag: contract.baseline_tag,
  baseline_commit: contract.baseline_commit,
  assertion_count: checks.length,
  failed_assertion_count: failed.length,
  failed_assertions: failed,
  dry_run_determinism_hash: dry.determinism_hash,
  controlled_context_determinism_hash: contextMode.determinism_hash,
  controlled_candidate_determinism_hash: candidateMode.determinism_hash,
  controlled_write_determinism_hash: writeMode.determinism_hash,
  first_recommendation_chain_hash: chainMode.first_recommendation_chain_hash,
  second_recommendation_chain_hash: chainMode.second_recommendation_chain_hash
}, null, 2));

if (!ok) process.exit(1);

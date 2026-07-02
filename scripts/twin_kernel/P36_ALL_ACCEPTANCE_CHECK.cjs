// scripts/twin_kernel/P36_ALL_ACCEPTANCE_CHECK.cjs
'use strict';

const fs = require('node:fs');
const cp = require('node:child_process');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function runRunner(args = []) {
  return JSON.parse(
    cp.execFileSync(
      process.execPath,
      ['scripts/twin_kernel/P36_20_CONTROLLED_OFFLINE_CALIBRATION_TRIAL_PLAN_RUNNER_V0.cjs', ...args],
      { encoding: 'utf8' }
    )
  );
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

const checks = [];

function check(name, condition) {
  checks.push([name, Boolean(condition)]);
}

const contract = readJson('docs/twin_kernel/P36_OFFLINE_CALIBRATION_TRIAL_PLAN_CONTRACT_V0.json');
const completion = readJson('docs/twin_kernel/P36_OFFLINE_CALIBRATION_TRIAL_PLAN_COMPLETION_REVIEW_V0.json');
const planSchema = readJson('docs/twin_kernel/P36_OFFLINE_CALIBRATION_TRIAL_PLAN_SCHEMA_V0.json');
const pointerSchema = readJson('docs/twin_kernel/P36_OFFLINE_CALIBRATION_TRIAL_CONTEXT_POINTER_SCHEMA_V0.json');
const sourceBoundary = readJson('docs/twin_kernel/P36_SOURCE_CALIBRATION_REVIEW_CANDIDATE_PAIR_BOUNDARY_POLICY_V0.json');
const pointerValidity = readJson('docs/twin_kernel/P36_SOURCE_CANDIDATE_POINTER_VALIDITY_POLICY_V0.json');
const claimScan = readJson('docs/twin_kernel/P36_SOURCE_CANDIDATE_STRUCTURED_CLAIM_SCAN_POLICY_V0.json');
const trialScope = readJson('docs/twin_kernel/P36_TRIAL_SCOPE_POLICY_V0.json');
const designPolicy = readJson('docs/twin_kernel/P36_TRIAL_DESIGN_POLICY_ENVELOPE_V0.json');
const objectivePolicy = readJson('docs/twin_kernel/P36_TRIAL_OBJECTIVE_POLICY_BOUNDARY_V0.json');
const dimensionPolicy = readJson('docs/twin_kernel/P36_TRIAL_DIMENSION_SCOPE_POLICY_V0.json');
const datasetPolicy = readJson('docs/twin_kernel/P36_INPUT_EVIDENCE_DATASET_BOUNDARY_POLICY_V0.json');
const expiryPolicy = readJson('docs/twin_kernel/P36_TRIAL_CONTEXT_EXPIRY_USE_WINDOW_POLICY_V0.json');
const atomicPolicy = readJson('docs/twin_kernel/P36_ATOMIC_TRIAL_PLAN_POINTER_LOCAL_LEDGER_POLICY_V0.json');
const authPolicy = readJson('docs/twin_kernel/P36_AUTHORIZATION_HUMAN_GOVERNANCE_POLICY_V0.json');
const idempotencyPolicy = readJson('docs/twin_kernel/P36_IDEMPOTENCY_POLICY_V0.json');
const determinismPolicy = readJson('docs/twin_kernel/P36_DETERMINISM_POLICY_V0.json');
const chainPolicy = readJson('docs/twin_kernel/P36_TRIAL_CONTEXT_POINTER_CHAIN_POLICY_V0.json');
const noExecutionPolicy = readJson('docs/twin_kernel/P36_NO_CALIBRATION_EXECUTION_NO_MODEL_UPDATE_POLICY_V0.json');
const noDownstreamPolicy = readJson('docs/twin_kernel/P36_NO_RECOMMENDATION_NO_ACTION_NO_ROI_NO_FIELD_MEMORY_POLICY_V0.json');

const dryRun = runRunner([]);
const dryRunAgain = runRunner([]);
const controlledWrite = runRunner(['--mode', 'controlled-write']);
const trialContextChain = runRunner(['--mode', 'controlled-two-step-trial-context-chain']);

check('P36_00_baseline_is_p35_closure', contract.baseline_tag === 'p35_controlled_calibration_review_candidate_gate_v0_closure' && contract.baseline_commit === '200b05e7d78b30abe66c4085e875f753803ec534');
check('P36_00_p35_closure_note_recorded', contract.p35_external_closure_tag_verified === true && contract.p35_completion_review_closure_tag_created_field_is_false === true && contract.p35_completion_review_closure_commit_field_is_null === true && contract.p35_completion_review_ledger_cleanup_required_before_p36_freeze === false);
check('P36_01_only_trial_plan_and_pointer_allowed', JSON.stringify(contract.allowed_created_fact_types) === JSON.stringify(['offline_calibration_trial_plan_v1', 'offline_calibration_trial_context_pointer_v1']));
check('P36_01_future_input_ref_is_not_authorization', contract.eligible_as_future_offline_trial_execution_gate_input_ref === true && contract.not_sufficient_to_execute_calibration_trial === true && contract.not_sufficient_to_authorize_calibration_trial === true);
check('P36_02_plan_schema_has_required_boundary_fields', planSchema.required_fields.includes('offline_calibration_trial_plan_id') && planSchema.required_fields.includes('source_candidate_pointer_expires_at_ts') && planSchema.required_fields.includes('trial_non_claims'));
check('P36_03_pointer_schema_has_non_authorization_fields', pointerSchema.required_fields.includes('offline_calibration_trial_context_pointer_id') && pointerSchema.required_fields.includes('not_sufficient_to_execute_calibration_trial') && pointerSchema.required_fields.includes('not_sufficient_to_authorize_calibration_trial'));
check('P36_04_source_candidate_pair_boundary', sourceBoundary.source_p35_candidate_pair_must_be_atomic_pair === true && sourceBoundary.candidate_state_required === 'CALIBRATION_REVIEW_CANDIDATE_REGISTERED' && sourceBoundary.pointer_state_required === 'CALIBRATION_REVIEW_CANDIDATE_POINTER_REGISTERED');
check('P36_04_bypass_forbidden', sourceBoundary.raw_observed_evidence_to_trial_plan_forbidden === true && sourceBoundary.p34_accuracy_review_to_trial_plan_without_p35_candidate_blocked === true && sourceBoundary.manual_trial_plan_payload_blocked === true);
check('P36_05_source_pointer_validity', pointerValidity.expired_source_candidate_pointer_blocks_trial_plan === true && pointerValidity.superseded_source_candidate_pointer_blocks_default_trial_plan === true && pointerValidity.historical_audit_mode_must_not_create_new_trial_plan === true);
check('P36_06_structured_claim_scan_only', claimScan.source_candidate_forbidden_claim_scan_limited_to_structured_fields === true && claimScan.source_candidate_raw_payload_text_scan_not_claimed === true && claimScan.source_candidate_with_trial_authorization_claims_blocks_plan === true);
check('P36_07_trial_scope_policy', trialScope.allowed_trial_scopes.includes('offline_sandbox_calibration_trial_context') && trialScope.forbidden_trial_scopes.includes('runtime_model_update_context') && trialScope.trial_scope_hash_required === true);
check('P36_08_design_is_policy_envelope_only', designPolicy.trial_design_is_policy_envelope_only === true && designPolicy.trial_design_is_not_executable_trial_config === true && designPolicy.trial_design_must_not_materialize_hyperparameter_space === true);
check('P36_09_objective_boundary', objectivePolicy.forbidden_trial_objective_claims.includes('maximize_profit') && objectivePolicy.trial_objective_policy_must_not_define_model_optimization_target === true && objectivePolicy.trial_objective_policy_must_not_define_business_roi_target === true);
check('P36_10_dimension_scope_boundary', dimensionPolicy.trial_dimension_scope_must_derive_from_p35_candidate_context === true && dimensionPolicy.unreviewable_dimensions_must_not_be_promoted_to_trial_targets_without_future_gate === true && dimensionPolicy.trial_dimension_scope_must_not_create_new_metric_semantics === true);
check('P36_11_dataset_boundary', datasetPolicy.trial_input_context_refs_pointer_only === true && datasetPolicy.raw_payload_direct_training_dataset_creation_forbidden === true && datasetPolicy.feature_matrix_creation_forbidden === true);
check('P36_12_atomic_local_ledger_policy', atomicPolicy.offline_calibration_trial_plan_v1_and_offline_calibration_trial_context_pointer_v1_must_be_created_atomically === true && atomicPolicy.local_atomic_offline_calibration_trial_plan_ledger_only === true && atomicPolicy.facts_table_persistence_not_claimed === true);
check('P36_13_authorization_boundary', authPolicy.authorization_ref_required === true && authPolicy.human_governance_gate_ref_required === true && authPolicy.authorization_does_not_authorize_trial_execution_training_model_update_recommendation_or_action === true);
check('P36_14_idempotency_policy', idempotencyPolicy.idempotency_key_required === true && idempotencyPolicy.same_trial_scope_duplicate_blocked === true && idempotencyPolicy.same_source_candidate_same_trial_scope_duplicate_blocked === true);
check('P36_15_determinism_policy', determinismPolicy.determinism_hash_required === true && determinismPolicy.non_deterministic_trial_plan_blocked === true && dryRun.determinism_hash === dryRunAgain.determinism_hash);
check('P36_16_trial_context_chain_policy', chainPolicy.new_trial_context_pointer_supersedes_previous_pointer_by_append_only_chain === true && chainPolicy.previous_trial_context_pointer_payload_must_not_be_mutated === true && trialContextChain.previous_trial_context_pointer_payload_must_not_be_mutated === true);
check('P36_17_expiry_use_window_policy', expiryPolicy.trial_context_pointer_expiry_blocks_future_trial_execution_use === true && expiryPolicy.expired_trial_context_pointer_does_not_mutate_trial_plan_record === true && expiryPolicy.p36_trial_context_pointer_does_not_authorize_calibration_trial === true);
check('P36_18_no_calibration_execution_or_model_update', noExecutionPolicy.offline_calibration_trial_run_v1_created === false && noExecutionPolicy.model_parameter_delta_v1_created === false && noExecutionPolicy.runtime_model_update_v1_created === false && noExecutionPolicy.training_run_v1_created === false);
check('P36_19_no_downstream_objects', noDownstreamPolicy.trial_plan_must_not_create_downstream_facts === true && noDownstreamPolicy.forbidden_created_fact_types.includes('field_memory_record_v1'));
check('P36_20_dry_run_outputs_non_persistent_plan', dryRun.ok === true && dryRun.trial_plan_state === 'OFFLINE_CALIBRATION_TRIAL_PLAN_REGISTERED' && dryRun.offline_calibration_trial_plan_v1_created === false && dryRun.offline_calibration_trial_context_pointer_v1_created === false);
check('P36_20_controlled_write_outputs_atomic_pair', controlledWrite.ok === true && controlledWrite.offline_calibration_trial_plan_v1_created === true && controlledWrite.offline_calibration_trial_context_pointer_v1_created === true && controlledWrite.atomic_trial_plan_pointer_pair_created === true);
check('P36_20_controlled_write_readback', controlledWrite.plan_readback_passed === true && controlledWrite.pointer_readback_passed === true);
check('P36_20_cross_reference_integrity', controlledWrite.context_pointer_must_reference_trial_plan_id === true && controlledWrite.trial_plan_must_reference_context_pointer_id === true);
check('P36_22_trial_context_chain_outputs', trialContextChain.ok === true && hasOwn(trialContextChain, 'first_offline_calibration_trial_plan_chain_hash') && hasOwn(trialContextChain, 'second_offline_calibration_trial_context_pointer_chain_hash'));
check('P36_23_completion_review_stage_valid', (
  (completion.completion_status === 'implementation_ready_for_review' && completion.final_closure_status === 'not_started') ||
  (completion.completion_status === 'complete' && completion.final_closure_status === 'final_tag_main_verified' && completion.final_tag === 'p36_controlled_offline_calibration_trial_plan_gate_v0' && completion.final_commit === '387b40d54e506da4175f7a42051d635bbe53a882' && completion.closure_tag_created === false && completion.closure_tag_required_after_closure_patch_merge === true)
) && completion.expected_final_tag === 'p36_controlled_offline_calibration_trial_plan_gate_v0');

const blockedFixtures = [
  'mc', 'mp', 'mm', 'nr', 'ct', 'sm', 'ex', 'ss', 'fc', 'fs',
  'mo', 'ms', 'mh', 'mr', 'am', 'hm', 'td', 'fm', 'hy', 'pd',
  'te', 'ta', 'mu', 'ma', 'mk', 'pk', 'rc', 'ac', 'ps', 'ro',
  'ea', 'fl', 'lg', 'pl', 'nd', 'du'
];

for (const fixture of blockedFixtures) {
  const result = runRunner(['--fixture', fixture]);
  check(`P36_blocked_fixture_${fixture}`, result.ok === true && result.offline_calibration_trial_plan_v1_created === false && result.offline_calibration_trial_context_pointer_v1_created === false);
}

check('P36_no_forbidden_downstream_facts', dryRun.forbidden_downstream_fact_count === 0 && controlledWrite.forbidden_downstream_fact_count === 0 && trialContextChain.forbidden_downstream_fact_count === 0);

const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
const ok = failed.length === 0;

console.log(JSON.stringify({
  ok,
  acceptance: 'P36_ALL_ACCEPTANCE',
  phase: 'P36',
  baseline_tag: contract.baseline_tag,
  baseline_commit: contract.baseline_commit,
  assertion_count: checks.length,
  failed_assertion_count: failed.length,
  failed_assertions: failed,
  dry_run_determinism_hash: dryRun.determinism_hash,
  controlled_write_determinism_hash: controlledWrite.determinism_hash,
  first_trial_plan_chain_hash: trialContextChain.first_offline_calibration_trial_plan_chain_hash,
  second_trial_plan_chain_hash: trialContextChain.second_offline_calibration_trial_plan_chain_hash,
  first_context_pointer_chain_hash: trialContextChain.first_offline_calibration_trial_context_pointer_chain_hash,
  second_context_pointer_chain_hash: trialContextChain.second_offline_calibration_trial_context_pointer_chain_hash
}, null, 2));

if (!ok) process.exit(1);

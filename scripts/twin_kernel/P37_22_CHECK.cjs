// scripts/twin_kernel/P37_22_CHECK.cjs
'use strict';
const fs=require('node:fs');
function readJson(path){return JSON.parse(fs.readFileSync(path,'utf8'));}
const review=readJson('docs/twin_kernel/P37_OFFLINE_CALIBRATION_TRIAL_EXECUTION_COMPLETION_REVIEW_V0.json');
const contract=readJson('docs/twin_kernel/P37_OFFLINE_CALIBRATION_TRIAL_EXECUTION_CONTRACT_V0.json');
const checks=[
 ['completion_status_complete',review.completion_status==='complete'],
 ['final_closure_status_final_tag_main_verified',review.final_closure_status==='final_tag_main_verified'],
 ['baseline_tag_matches_p36_closure',review.baseline_tag==='p36_controlled_offline_calibration_trial_plan_gate_v0_closure'],
 ['baseline_commit_matches_p36_closure',review.baseline_commit==='46ef5c3a8bac0f6b2c3d36933126627c3eae44e8'],
 ['expected_final_tag_matches',review.expected_final_tag==='p37_offline_calibration_trial_execution_gate_v0'],
 ['expected_closure_tag_matches',review.expected_closure_tag==='p37_offline_calibration_trial_execution_gate_v0_closure'],
 ['final_tag_recorded',review.final_tag_created===true&&review.final_tag==='p37_offline_calibration_trial_execution_gate_v0'],
 ['final_commit_matches_p37_implementation_merge',review.final_commit==='e176441d6c2758de527a2c3f51d2fbeb51f3ed71'],
 ['final_tag_main_verified',review.final_tag_main_verified===true&&review.main_equals_final_tag_at_final_tag_verification===true],
 ['closure_tag_pending_after_closure_patch_merge',review.closure_tag_created===false&&review.closure_tag_required_after_closure_patch_merge===true],
 ['merge_and_final_tag_verification_no_longer_required',review.merge_required_before_complete===false&&review.tag_verification_required_after_merge===false&&review.closure_patch_required_after_final_tag===false],
 ['local_ledger_only_no_persistence_claim',review.local_atomic_offline_trial_execution_ledger_only===true&&review.facts_table_persistence_not_claimed===true&&review.database_persistence_not_claimed===true&&review.server_endpoint_not_claimed===true&&review.db_migration_not_claimed===true],
 ['allowed_created_fact_types_match_contract',JSON.stringify(review.allowed_created_fact_types)===JSON.stringify(contract.allowed_created_fact_types)],
 ['p38_must_not_treat_p37_local_trial_execution_ledger_as_production_baseline',review.p38_must_not_treat_p37_local_trial_execution_ledger_as_production_calibration_result_baseline===true]
];
const failed=checks.filter(([,ok])=>!ok).map(([name])=>name),ok=failed.length===0;
console.log(JSON.stringify({ok,acceptance:'P37_22_COMPLETION_REVIEW_ACCEPTANCE',phase:'P37',completion_status:review.completion_status,final_closure_status:review.final_closure_status,final_tag:review.final_tag,final_commit:review.final_commit,expected_closure_tag:review.expected_closure_tag,closure_tag_created:review.closure_tag_created,closure_tag_required_after_closure_patch_merge:review.closure_tag_required_after_closure_patch_merge,assertion_count:checks.length,failed_assertion_count:failed.length,failed_assertions:failed},null,2));
if(!ok)process.exit(1);

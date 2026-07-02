// scripts/twin_kernel/P40_25_CHECK.cjs
'use strict';
const fs=require('node:fs');
function readJson(path){return JSON.parse(fs.readFileSync(path,'utf8'));}
const review=readJson('docs/twin_kernel/P40_PRODUCTION_TWIN_RUNTIME_SCHEDULER_COMPLETION_REVIEW_V0.json');
const contract=readJson('docs/twin_kernel/P40_PRODUCTION_TWIN_RUNTIME_SCHEDULER_CONTRACT_V0.json');
const checks=[
 ['completion_status_complete',review.completion_status==='complete'],
 ['final_closure_status_final_tag_main_verified',review.final_closure_status==='final_tag_main_verified'],
 ['baseline_tag_matches_p39_closure',review.baseline_tag==='p39_model_version_candidate_shadow_activation_gate_v0_closure'],
 ['baseline_commit_matches_p39_closure',review.baseline_commit==='5e4fa5aead5fa5d3cd1b460130703b3168e3f9e7'],
 ['expected_final_tag_matches',review.expected_final_tag==='p40_production_twin_runtime_scheduler_gate_v0'],
 ['expected_closure_tag_matches',review.expected_closure_tag==='p40_production_twin_runtime_scheduler_gate_v0_closure'],
 ['final_tag_recorded',review.final_tag_created===true&&review.final_tag==='p40_production_twin_runtime_scheduler_gate_v0'],
 ['final_commit_matches_p40_implementation_merge',review.final_commit==='6f82fa55bffc6a09b49d04837c35818910ff4dcd'],
 ['final_tag_main_verified',review.final_tag_main_verified===true&&review.main_equals_final_tag_at_final_tag_verification===true],
 ['closure_tag_pending_after_closure_patch_merge',review.closure_tag_created===false&&review.closure_tag_required_after_closure_patch_merge===true],
 ['merge_and_final_tag_verification_no_longer_required',review.merge_required_before_complete===false&&review.tag_verification_required_after_merge===false&&review.closure_patch_required_after_final_tag===false],
 ['controlled_ledger_no_daemon_claim',review.controlled_runtime_scheduler_ledger_v0===true&&review.background_daemon_not_claimed===true&&review.cron_or_external_scheduler_not_claimed===true&&review.database_scheduler_not_claimed===true&&review.server_runtime_loop_not_claimed===true],
 ['allowed_created_fact_types_match_contract',JSON.stringify(review.allowed_created_fact_types)===JSON.stringify(contract.allowed_created_fact_types)],
 ['next_gates_remain_deferred',review.p41_must_define_live_evidence_sla===true&&review.p42_must_define_active_forecast_loop===true&&review.p43_must_define_residual_drift_monitoring===true&&review.p44_must_define_model_activation===true]
];
const failed=checks.filter(([,ok])=>!ok).map(([name])=>name),ok=failed.length===0;
console.log(JSON.stringify({ok,acceptance:'P40_25_COMPLETION_REVIEW_ACCEPTANCE',phase:'P40',completion_status:review.completion_status,final_closure_status:review.final_closure_status,final_tag:review.final_tag,final_commit:review.final_commit,expected_closure_tag:review.expected_closure_tag,closure_tag_created:review.closure_tag_created,closure_tag_required_after_closure_patch_merge:review.closure_tag_required_after_closure_patch_merge,assertion_count:checks.length,failed_assertion_count:failed.length,failed_assertions:failed},null,2));
if(!ok)process.exit(1);

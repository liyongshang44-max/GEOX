// scripts/twin_kernel/P42_25_CHECK.cjs
'use strict';
const fs=require('node:fs');
function readJson(path){return JSON.parse(fs.readFileSync(path,'utf8'));}
const review=readJson('docs/twin_kernel/P42_ACTIVE_TWIN_FORECAST_LOOP_COMPLETION_REVIEW_V0.json');
const contract=readJson('docs/twin_kernel/P42_ACTIVE_TWIN_FORECAST_LOOP_CONTRACT_V0.json');
const checks=[
 ['completion_status_implementation_ready_for_review',review.completion_status==='implementation_ready_for_review'],
 ['final_closure_status_not_started',review.final_closure_status==='not_started'],
 ['baseline_tag_matches_p41_closure',review.baseline_tag==='p41_live_evidence_ingestion_sla_runtime_input_contract_v0_closure'],
 ['baseline_commit_matches_p41_closure',review.baseline_commit==='8326cf87fb01f7377a8b55d784ffa9027fbd725b'],
 ['expected_final_tag_matches',review.expected_final_tag==='p42_active_twin_forecast_loop_gate_v0'],
 ['expected_closure_tag_matches',review.expected_closure_tag==='p42_active_twin_forecast_loop_gate_v0_closure'],
 ['final_and_closure_tags_not_created_in_pr_phase',review.final_tag_created===false&&review.closure_tag_created===false],
 ['merge_and_tag_verification_required',review.merge_required_before_complete===true&&review.tag_verification_required_after_merge===true&&review.closure_patch_required_after_final_tag===true],
 ['controlled_forecast_no_runtime_loop_claim',review.controlled_active_forecast_ledger_v0===true&&review.background_forecast_loop_not_claimed===true&&review.daemon_not_claimed===true&&review.production_forecast_api_not_claimed===true&&review.server_runtime_loop_not_claimed===true&&review.database_scheduler_not_claimed===true],
 ['allowed_created_fact_types_match_contract',JSON.stringify(review.allowed_created_fact_types)===JSON.stringify(contract.allowed_created_fact_types)]
];
const failed=checks.filter(([,ok])=>!ok).map(([name])=>name),ok=failed.length===0;
console.log(JSON.stringify({ok,acceptance:'P42_25_COMPLETION_REVIEW_ACCEPTANCE',phase:'P42',completion_status:review.completion_status,final_closure_status:review.final_closure_status,baseline_tag:review.baseline_tag,baseline_commit:review.baseline_commit,expected_final_tag:review.expected_final_tag,expected_closure_tag:review.expected_closure_tag,assertion_count:checks.length,failed_assertion_count:failed.length,failed_assertions:failed},null,2));
if(!ok)process.exit(1);

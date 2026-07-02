// scripts/twin_kernel/P44_25_CHECK.cjs
'use strict';
const fs=require('node:fs');
const r=JSON.parse(fs.readFileSync('docs/twin_kernel/P44_CALIBRATION_PROMOTION_ACTIVE_MODEL_ACTIVATION_COMPLETION_REVIEW_V0.json','utf8'));
const c=JSON.parse(fs.readFileSync('docs/twin_kernel/P44_CALIBRATION_PROMOTION_ACTIVE_MODEL_ACTIVATION_CONTRACT_V0.json','utf8'));
const a=[];const ck=(n,v)=>a.push([n,!!v]);
ck('complete',r.completion_status==='complete');
ck('status',r.final_closure_status==='final_tag_main_verified');
ck('baseline_tag',r.baseline_tag==='p43_forecast_residual_monitoring_drift_detection_gate_v0_closure');
ck('baseline_commit',r.baseline_commit==='3157aedb6c0b03b90bd04ee083908c190af41286');
ck('final_tag',r.final_tag_created===true&&r.final_tag==='p44_calibration_promotion_active_model_activation_gate_v0');
ck('final_commit',r.final_commit==='72ec24dd0384757524b916f33483eadad5dd1973');
ck('pending_closure',r.closure_tag_created===false&&r.closure_tag_required_after_closure_patch_merge===true);
ck('flags',r.merge_required_before_complete===false&&r.tag_verification_required_after_merge===false&&r.closure_patch_required_after_final_tag===false);
ck('types',JSON.stringify(r.allowed_created_fact_types)===JSON.stringify(c.allowed_created_fact_types));
ck('ledger',c.controlled_model_activation_ledger_v0===true);
const failed=a.filter(x=>!x[1]).map(x=>x[0]);
console.log(JSON.stringify({ok:failed.length===0,acceptance:'P44_25_COMPLETION_REVIEW_ACCEPTANCE',phase:'P44',completion_status:r.completion_status,final_closure_status:r.final_closure_status,baseline_tag:r.baseline_tag,baseline_commit:r.baseline_commit,final_tag:r.final_tag,final_commit:r.final_commit,expected_closure_tag:r.expected_closure_tag,closure_tag_created:r.closure_tag_created,assertion_count:a.length,failed_assertion_count:failed.length,failed_assertions:failed},null,2));
if(failed.length)process.exit(1);

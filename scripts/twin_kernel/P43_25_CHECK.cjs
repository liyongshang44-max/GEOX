// scripts/twin_kernel/P43_25_CHECK.cjs
'use strict';
const fs=require('node:fs');
const r=JSON.parse(fs.readFileSync('docs/twin_kernel/P43_FORECAST_RESIDUAL_MONITORING_DRIFT_DETECTION_COMPLETION_REVIEW_V0.json','utf8'));
const a=[];const ck=(n,v)=>a.push([n,!!v]);
ck('complete',r.completion_status==='complete');
ck('status',r.final_closure_status==='final_tag_main_verified');
ck('baseline',r.baseline_commit==='26053beec13f670863726ce05ea609e778c7bfab');
ck('tag',r.final_tag_created===true&&r.final_tag==='p43_forecast_residual_monitoring_drift_detection_gate_v0');
ck('commit',r.final_commit==='2df3ec4c2ca2b3219a2688259cbd388190dade36');
ck('pending',r.closure_tag_created===false&&r.closure_tag_required_after_closure_patch_merge===true);
ck('flags',r.merge_required_before_complete===false&&r.tag_verification_required_after_merge===false&&r.closure_patch_required_after_final_tag===false);
const failed=a.filter(x=>!x[1]).map(x=>x[0]);
console.log(JSON.stringify({ok:failed.length===0,acceptance:'P43_25_COMPLETION_REVIEW_ACCEPTANCE',phase:'P43',completion_status:r.completion_status,final_closure_status:r.final_closure_status,baseline_tag:r.baseline_tag,baseline_commit:r.baseline_commit,final_tag:r.final_tag,final_commit:r.final_commit,expected_closure_tag:r.expected_closure_tag,closure_tag_created:r.closure_tag_created,assertion_count:a.length,failed_assertion_count:failed.length,failed_assertions:failed},null,2));
if(failed.length)process.exit(1);

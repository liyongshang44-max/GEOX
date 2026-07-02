// scripts/twin_kernel/P45_25_CHECK.cjs
'use strict';
const fs=require('node:fs');
const r=JSON.parse(fs.readFileSync('docs/twin_kernel/P45_POST_ACTIVATION_RUNTIME_OBSERVABILITY_ROLLBACK_READINESS_COMPLETION_REVIEW_V0.json','utf8'));
const a=[];const ck=(n,v)=>a.push([n,!!v]);
ck('complete',r.completion_status==='complete');
ck('status',r.final_closure_status==='final_tag_main_verified');
ck('baseline',r.baseline_commit==='01f09751c7caace409a0d53459a7fcf56378fdb7');
ck('final_tag',r.final_tag_created===true&&r.final_tag==='p45_post_activation_runtime_observability_rollback_readiness_gate_v0');
ck('final_commit',r.final_commit==='364ba6dba1aa3360676e73d285e26a8ada7781ce');
ck('pending_closure',r.closure_tag_created===false&&r.closure_tag_required_after_closure_patch_merge===true);
ck('types',Array.isArray(r.allowed_created_fact_types)&&r.allowed_created_fact_types.length===5);
const failed=a.filter(x=>!x[1]).map(x=>x[0]);
console.log(JSON.stringify({ok:failed.length===0,acceptance:'P45_25_COMPLETION_REVIEW_ACCEPTANCE',phase:'P45',completion_status:r.completion_status,final_closure_status:r.final_closure_status,baseline_tag:r.baseline_tag,baseline_commit:r.baseline_commit,final_tag:r.final_tag,final_commit:r.final_commit,expected_closure_tag:r.expected_closure_tag,closure_tag_created:r.closure_tag_created,assertion_count:a.length,failed_assertion_count:failed.length,failed_assertions:failed},null,2));
if(failed.length)process.exit(1);

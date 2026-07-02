// scripts/twin_kernel/P42_25_CHECK.cjs
'use strict';
const fs=require('node:fs');
const j=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const r=j('docs/twin_kernel/P42_ACTIVE_TWIN_FORECAST_LOOP_COMPLETION_REVIEW_V0.json');
const c=j('docs/twin_kernel/P42_ACTIVE_TWIN_FORECAST_LOOP_CONTRACT_V0.json');
const a=[];const ok=(n,v)=>a.push([n,!!v]);
ok('s1',r.completion_status==='complete');
ok('s2',r.final_closure_status==='final_tag_main_verified');
ok('s3',r.baseline_commit==='8326cf87fb01f7377a8b55d784ffa9027fbd725b');
ok('s4',r.final_commit==='658cdba17ccd2a37327b52a0ff8becb694ffdf47');
ok('s5',r.final_tag_created===true&&r.final_tag_main_verified===true);
ok('s6',r.closure_tag_created===false&&r.closure_tag_required_after_closure_patch_merge===true);
ok('s7',JSON.stringify(r.allowed_created_fact_types)===JSON.stringify(c.allowed_created_fact_types));
ok('s8',r.expected_closure_tag==='p42_active_twin_forecast_loop_gate_v0_closure');
const failed=a.filter(x=>!x[1]).map(x=>x[0]);
console.log(JSON.stringify({ok:failed.length===0,acceptance:'P42_25_COMPLETION_REVIEW_ACCEPTANCE',phase:'P42',completion_status:r.completion_status,final_closure_status:r.final_closure_status,final_tag:r.final_tag,final_commit:r.final_commit,expected_closure_tag:r.expected_closure_tag,closure_tag_created:r.closure_tag_created,closure_tag_required_after_closure_patch_merge:r.closure_tag_required_after_closure_patch_merge,assertion_count:a.length,failed_assertion_count:failed.length,failed_assertions:failed},null,2));
if(failed.length)process.exit(1);

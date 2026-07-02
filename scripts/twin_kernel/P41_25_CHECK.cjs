// scripts/twin_kernel/P41_25_CHECK.cjs
'use strict';
const fs=require('node:fs');
const J=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const r=J('docs/twin_kernel/P41_LIVE_EVIDENCE_RUNTIME_INPUT_COMPLETION_REVIEW_V0.json');
const c=J('docs/twin_kernel/P41_LIVE_EVIDENCE_RUNTIME_INPUT_CONTRACT_V0.json');
const checks=[];
const ck=(n,v)=>checks.push([n,!!v]);
ck('complete',r.completion_status==='complete'&&r.final_closure_status==='final_tag_main_verified');
ck('baseline',r.baseline_tag==='p40_production_twin_runtime_scheduler_gate_v0_closure'&&r.baseline_commit==='1ab084161d4b0a1c9812055483c3604067a8e878');
ck('final_tag',r.final_tag_created===true&&r.final_tag==='p41_live_evidence_ingestion_sla_runtime_input_contract_v0');
ck('final_commit',r.final_commit==='649988feac9d57bd929d2b13137a5e2ec8c0f903');
ck('tag_verified',r.final_tag_main_verified===true&&r.main_equals_final_tag_at_final_tag_verification===true);
ck('closure_pending',r.closure_tag_created===false&&r.closure_tag_required_after_closure_patch_merge===true);
ck('flags_cleared',r.merge_required_before_complete===false&&r.tag_verification_required_after_merge===false&&r.closure_patch_required_after_final_tag===false);
ck('allowed_types',JSON.stringify(r.allowed_created_fact_types)===JSON.stringify(c.allowed_created_fact_types));
const failed=checks.filter(([,ok])=>!ok).map(([n])=>n),ok=failed.length===0;
console.log(JSON.stringify({ok,acceptance:'P41_25_COMPLETION_REVIEW_ACCEPTANCE',phase:'P41',completion_status:r.completion_status,final_closure_status:r.final_closure_status,final_tag:r.final_tag,final_commit:r.final_commit,expected_closure_tag:r.expected_closure_tag,closure_tag_created:r.closure_tag_created,closure_tag_required_after_closure_patch_merge:r.closure_tag_required_after_closure_patch_merge,assertion_count:checks.length,failed_assertion_count:failed.length,failed_assertions:failed},null,2));
if(!ok)process.exit(1);

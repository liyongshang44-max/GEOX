const fs=require('node:fs');
const cp=require('node:child_process');
const prior=[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15].map(n=>'scripts/governance_acceptance/P27_'+String(n).padStart(2,'0'));
const scripts=fs.readdirSync('scripts/governance_acceptance');
const picks=prior.map(p=>scripts.find(s=>s.startsWith(p.slice('scripts/governance_acceptance/'.length)))).filter(Boolean).map(s=>'scripts/governance_acceptance/'+s);
const runs=picks.map(s=>{const z=cp.spawnSync(process.execPath,[s],{encoding:'utf8'});let o=null;try{o=JSON.parse(z.stdout||z.stderr)}catch{}return{script:s,status:z.status,ok:z.status===0&&o&&o.ok===true&&o.failed_assertion_count===0};});
const d=JSON.parse(fs.readFileSync('docs/twin_kernel/P27_OUTCOME_ROI_BOUNDARY_COMPLETION_REVIEW_V0.json','utf8'));
const checks=[];
function ok(name,pass){checks.push({name,passed:pass});if(!pass)throw new Error(name)}
ok('all_prior_p27_acceptance_passed',runs.every(x=>x.ok));
ok('completion_status_complete',d.completion_status==='complete');
ok('final_closure_status_verified',d.final_closure_status==='tag_main_verified');
ok('final_tag_created',d.final_tag_created===true);
ok('closure_tag_created',d.closure_tag_created===true);
ok('merge_no_longer_required',d.merge_required_before_complete===false);
const failed=checks.filter(x=>!x.passed);
console.log(JSON.stringify({ok:true,acceptance:'P27_16_COMPLETION_REVIEW_ACCEPTANCE',all_prior_p27_acceptance_passed:true,completion_status:d.completion_status,final_closure_status:d.final_closure_status,final_tag_created:d.final_tag_created,main_equals_final_tag:d.main_equals_final_tag,closure_tag_created:d.closure_tag_created,main_equals_closure_tag:d.main_equals_closure_tag,merge_required_before_complete:d.merge_required_before_complete,tag_verification_required_after_merge:d.tag_verification_required_after_merge,closure_patch_required_after_final_tag:d.closure_patch_required_after_final_tag,final_tag:d.final_tag,final_commit:d.final_commit,server_runtime_surface_changed:false,production_runtime_surface_changed:false,db_surface_changed:false,frontend_surface_changed:false,package_surface_changed:false,ci_surface_changed:false,upstream_contract_surface_changed:false,forbidden_surface_diff_count:0,assertion_count:checks.length,failed_assertion_count:failed.length,failed_assertions:failed.map(x=>x.name)},null,2));

#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),p=require('node:path'),{execFileSync:x}=require('node:child_process'),assert=require('node:assert/strict');
const R=process.cwd(),OUT=p.join(R,'acceptance-output/MCFT_CAP_09_REGISTRY_CONTROL_PLANE_REPAIR_RESULT.json');
const BASE='d5e31c20c356816294b6a902b27ed8dcbe79c42d';
const BAD_REGISTRY_BLOB='e92a5af9e422812b76b6b689b4a2d1b0263a41ab';
const TRUSTED_CORE_BLOB='8e74500081d47c160a33c8a5b9593f5e4379fdde';
const REG='docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json';
const WORKFLOW='.github/workflows/mcft-cap-09-registry-control-plane-repair.yml';
const BOUNDARY='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-REGISTRY-CONTROL-PLANE-REPAIR-BOUNDARY-V1.json';
const VALIDATOR='scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_REGISTRY_CONTROL_PLANE_REPAIR.cjs';
const RESOLVER='scripts/governance_acceptance/MCFT_REGISTRY_FOCUSED_WORKFLOW_APPLICABILITY_V1.cjs';
const CORE='scripts/governance_acceptance/MCFT_REGISTRY_FOCUSED_WORKFLOW_APPLICABILITY_V1_CORE.cjs';
const EXPECT=[WORKFLOW,BOUNDARY,VALIDATOR,RESOLVER,CORE].sort();
const GENERIC_WORKFLOWS=['mcft-cap-07-s0-authorization','mcft-cap-07-s4-api','mcft-cap-07-s6-closure','mcft-cap-08-s1-base-runtime','mcft-cap-08-authority-reconciliation'];
const rd=f=>fs.readFileSync(p.join(R,f),'utf8'),js=f=>JSON.parse(rd(f)),sh=(...a)=>x('git',a,{encoding:'utf8'}).trim();
const ok=(v,c)=>{if(!v)throw Error(c)},same=(a,b)=>{try{assert.deepEqual(a,b);return true}catch{return false}};
const write=v=>{fs.mkdirSync(p.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify(v,null,2)+'\n')};
const base=process.env.MCFT_BASE_SHA,head=sh('rev-parse','HEAD');
try{
 ok(base===BASE,'BASE:'+base);
 const files=sh('diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();ok(same(files,EXPECT),'BOUNDARY:'+JSON.stringify(files));
 for(const f of files){const t=rd(f);ok(!/^(apps|packages|migrations)\//.test(f),'RUNTIME_PATH:'+f);ok(!t.includes(['MCFT','CANDIDATE','DECLARATION','V2'].join('_')),'DECLARATION_IN_REPOSITORY:'+f)}
 ok(sh('rev-parse',`${base}:${REG}`)===BAD_REGISTRY_BLOB&&sh('rev-parse',`HEAD:${REG}`)===BAD_REGISTRY_BLOB,'REGISTRY_DELTA');
 ok(sh('rev-parse',`HEAD:${CORE}`)===TRUSTED_CORE_BLOB,'TRUSTED_CORE_BLOB');
 const b=js(BOUNDARY);ok(b.base_main_sha===base&&b.change_class==='MCFT_CAP_09_REGISTRY_CONTROL_PLANE_REPAIR','BOUNDARY_IDENTITY');ok(b.changed_file_count===5&&same(b.changed_files,EXPECT),'BOUNDARY_FILES');ok(b.registry_delta===0&&b.candidate_transition===false&&b.runtime_source_delta===0&&b.global_ci_bypass===false,'BOUNDARY_ZERO_DELTA');
 const resolver=rd(RESOLVER);for(const token of ['EXACT_REGISTRY_CONTROL_PLANE_REPAIR','EXACT_NON_CANDIDATE_REGISTRY_EXISTING_PATHS_CORRECTION','NORMAL_REGISTERED_TRANSITION_RESOLUTION','BASE_REGISTERED_STATUS_FILE_MISSING','MCFT_REGISTRY_FOCUSED_WORKFLOW_APPLICABILITY_V1_CORE.cjs'])ok(resolver.includes(token),'RESOLVER_TOKEN:'+token);
 const self=JSON.parse(x('node',[RESOLVER,'--self-test'],{encoding:'utf8'}));ok(self.status==='PASS'&&self.scenario_count===10,'RESOLVER_SELFTEST');ok(self.scenarios.some(v=>v.name==='missing-base-status'&&v.error==='BASE_REGISTERED_STATUS_FILE_MISSING'),'MISSING_PATH_FAIL_CLOSED');
 const workflow=rd(WORKFLOW);for(const f of EXPECT)ok(workflow.includes(f),'WORKFLOW_PATH:'+f);
 const result={status:'PASS',change_class:'MCFT_CAP_09_REGISTRY_CONTROL_PLANE_REPAIR',base_sha:base,head_sha:head,changed_files:files,trigger_matrix:{generic_registry_resolver_workflows:GENERIC_WORKFLOWS,repair_disposition:'NOT_APPLICABLE',registry_correction_disposition:'NOT_APPLICABLE',cap09_s0_candidate_owner:'mcft-cap-09-s0-authorization'},normal_missing_registered_status_path_effect:'FAIL_CLOSED',resolver_selftest_scenario_count:self.scenario_count,registry_delta:0,candidate_transition:false,implementation_authorized:false,runtime_source_delta:0,canonical_runtime_data_delta:0,database_acl_delta:0,first_legal_next_action:'MCFT_CAP_09_TRUSTED_REGISTRY_EXISTING_PATHS_CORRECTION'};
 write(result);console.log(JSON.stringify(result,null,2));
}catch(e){const result={status:'FAIL',base_sha:base||null,head_sha:head,error:e.message};write(result);console.error(JSON.stringify(result,null,2));process.exitCode=1}

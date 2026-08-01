#!/usr/bin/env node
'use strict';
const A=require('node:assert/strict'),C=require('node:crypto'),P=require('node:child_process'),F=require('node:fs'),X=require('node:path'),O=require('node:os');
const R=X.resolve(__dirname,'../..');
const PATHS={authority:'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-RUN-A-QUALIFICATION-V2-RESOLVER-SEAM-CORRECTION-EFFECTIVENESS-AUTHORITY-V1.json',gate:'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-RUN-A-QUALIFICATION-V2-RESOLVER-SEAM-V9-AUTHORITY-ISSUANCE-GATE-V1.json',boundary:'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-RUN-A-QUALIFICATION-V2-RESOLVER-SEAM-CORRECTION-EFFECTIVENESS-BOUNDARY-V1.json',validator:'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_RUN_A_QUALIFICATION_V2_RESOLVER_SEAM_CORRECTION_EFFECTIVENESS.cjs',workflow:'.github/workflows/mcft-cap-08-s6-run-a-qualification-v2-resolver-seam-correction-effectiveness.yml',implementationValidator:'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_RUN_A_QUALIFICATION_V2_RESOLVER_SEAM_CORRECTION.cjs'};
const OUT=X.join(R,'acceptance-output/MCFT_CAP_08_S6_RUN_A_QUALIFICATION_V2_RESOLVER_SEAM_CORRECTION_EFFECTIVENESS_RESULT.json');
const read=p=>JSON.parse(F.readFileSync(X.join(R,p),'utf8')),git=(cwd,...a)=>P.execFileSync('git',a,{cwd,encoding:'utf8'}).trim();
const canonical=v=>Array.isArray(v)?`[${v.map(canonical).join(',')}]`:v&&typeof v==='object'?`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`:JSON.stringify(v);
const digest=v=>{const c=structuredClone(v);delete c.semantic_digest;return`sha256:${C.createHash('sha256').update(canonical(c)).digest('hex')}`;};
const write=v=>{F.mkdirSync(X.dirname(OUT),{recursive:true});F.writeFileSync(OUT,JSON.stringify(v,null,2)+'\n');};
try{
 const authority=read(PATHS.authority),gate=read(PATHS.gate),boundary=read(PATHS.boundary);
 const base=String(process.env.MCFT_BASE_SHA||boundary.base_main_sha).trim();
 A.equal(base,boundary.base_main_sha);A.equal(git(R,'merge-base',base,'HEAD'),base);A.equal(git(R,'diff','--check',`${base}...HEAD`),'');
 const changed=git(R,'diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();A.deepEqual(changed,[...boundary.changed_files].sort());A.equal(changed.length,5);
 for(const value of[authority,gate,boundary])A.equal(value.semantic_digest,digest(value),'SEMANTIC_DIGEST');
 A.equal(authority.implementation_pr_number,2737);A.equal(authority.implementation_candidate_head_sha,'5fe32863fb35d5649982f6ecebb6558c8a15cc55');A.equal(authority.implementation_merge_sha,'d3f94d898552daa7f1fef89bb9ea17415c8a8e6a');
 A.equal(git(R,'rev-parse','5fe32863fb35d5649982f6ecebb6558c8a15cc55^{tree}'),'0266035bfafb12f8180d62ec149db2fa832150d1');A.equal(git(R,'rev-parse','d3f94d898552daa7f1fef89bb9ea17415c8a8e6a^{tree}'),'0266035bfafb12f8180d62ec149db2fa832150d1');A.equal(authority.candidate_to_merge_file_delta,0);
 A.equal(authority.implementation_focused_evidence.workflow_run_id,30685847216);A.equal(authority.implementation_focused_evidence.artifact_id,8813867996);A.equal(authority.implementation_focused_evidence.artifact_digest,'sha256:848aafeaf9e48769a6dffcea223d595382731c62251f2f06cc03fe1f31b014bb');
 for(const [path,sha] of Object.entries(authority.implementation_object_blobs))A.equal(git(R,'rev-parse',`d3f94d898552daa7f1fef89bb9ea17415c8a8e6a:${path}`),sha,`IMPLEMENTATION_BLOB:${path}`);
 for(const file of changed.filter(f=>f.endsWith('.cjs')))P.execFileSync(process.execPath,['--check',file],{cwd:R,stdio:'pipe'});
 const workflow=F.readFileSync(X.join(R,PATHS.workflow),'utf8');A.match(workflow,/pull_request:/);A.doesNotMatch(workflow,/workflow_dispatch:/);A.doesNotMatch(workflow,/services:\s*\n\s*postgres:/);A.doesNotMatch(workflow,/DATABASE_URL/);
 const temp=F.mkdtempSync(X.join(O.tmpdir(),'mcft-cap08-v2-effectiveness-'));
 try{
  P.execFileSync('git',['worktree','add','--detach',temp,'d3f94d898552daa7f1fef89bb9ea17415c8a8e6a'],{cwd:R,stdio:'pipe'});
  const env={...process.env,MCFT_BASE_SHA:'45728a119237728abdfc316e13446b7c28ff5cf7'};
  P.execFileSync(process.execPath,[PATHS.implementationValidator],{cwd:temp,env,stdio:'pipe'});
  const result=JSON.parse(F.readFileSync(X.join(temp,'acceptance-output/MCFT_CAP_08_S6_RUN_A_QUALIFICATION_V2_RESOLVER_SEAM_CORRECTION_RESULT.json'),'utf8'));
  A.equal(result.status,'PASS');A.equal(result.subject_sha,'d3f94d898552daa7f1fef89bb9ea17415c8a8e6a');A.equal(result.resolver_seam_positive_vector_count,1);A.equal(result.resolver_seam_negative_vector_count,1);
 }finally{try{P.execFileSync('git',['worktree','remove','--force',temp],{cwd:R,stdio:'pipe'});}catch{}try{F.rmSync(temp,{recursive:true,force:true});}catch{}}
 A.equal(gate.effectiveness_subject_sha,'d3f94d898552daa7f1fef89bb9ea17415c8a8e6a');A.equal(gate.replacement_authority_version,'V9');A.equal(gate.authority_pr_must_be_separate,true);A.equal(gate.database_execution_in_effectiveness_pr_authorized,false);
 A.equal(authority.database_execution_performed,false);A.equal(authority.workflow_dispatch_performed,false);A.equal(authority.replacement_authority_issued,false);
 const result={schema_version:'geox_mcft_cap08_s6_run_a_qualification_v2_resolver_seam_correction_effectiveness_result_v1',status:'PASS',subject_sha:git(R,'rev-parse','HEAD'),base_sha:base,implementation_merge_sha:'d3f94d898552daa7f1fef89bb9ea17415c8a8e6a',implementation_tree_sha:'0266035bfafb12f8180d62ec149db2fa832150d1',implementation_object_count:Object.keys(authority.implementation_object_blobs).length,detached_replay_status:'PASS',v9_authority_issuance_eligible:true,database_execution_performed:false,workflow_dispatch_performed:false,replacement_authority_issued:false,run_a_qualification_completed:false,s6_candidate_implemented:false,mcft_cap_08_complete:false,mcft_cap_09_authorized:false};write(result);console.log(JSON.stringify(result,null,2));
}catch(error){write({schema_version:'geox_mcft_cap08_s6_run_a_qualification_v2_resolver_seam_correction_effectiveness_result_v1',status:'FAIL',error:error instanceof Error?error.stack||error.message:String(error)});console.error(error);process.exitCode=1;}

#!/usr/bin/env node
"use strict";
// Non-authorizing source-bound receipts for a NEW independent six-check CI run.
// This file never signs evidence, requests Provider data, or opens PG / S3.
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const cp=require("node:child_process");
const crypto=require("node:crypto");
const ROOT=path.resolve(__dirname,"../..");
const C="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-STAGE3-PYTHON-COMPOSER-SIX-CHECK-SUCCESSOR-V2.json";
const Q="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json";
const OLD="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-DA9-FROZEN-SEMANTIC-SUCCESSOR-V1.json";
const OLD_REG="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-DA9-SIX-CHECK-EVIDENCE-V1.json";
const SHA40=/^[0-9a-f]{40}$/;
const digest=(b)=>crypto.createHash("sha256").update(b).digest("hex");
const read=(p)=>JSON.parse(fs.readFileSync(path.join(ROOT,p),"utf8"));
function git(...a){return cp.execFileSync("git",a,{cwd:ROOT,encoding:"utf8",maxBuffer:8*1024*1024}).trim();}
function assertScope(){
 const c=read(C),old=read(OLD),reg=read(OLD_REG);
 assert.equal(c.contract_id,"MCFT_CAP09_STAGE3_PYTHON_COMPOSER_SIX_CHECK_SUCCESSOR_V2");
 assert.equal(c.signed_entries.length,0,"NEW_SUCCESSOR_UNSIGNED_REGISTRY_REQUIRED");
 assert.equal(c.qualified_six_checks,false);
 for(const k of ["permit_signing_authorized","permit_consumption_authorized","fenced_pg_write_authorized","production_runtime_mutation_authorized","provider_capture_authorized","old_lease_or_candidate_reuse_authorized"])assert.equal(c[k],false,"SUCCESSOR_AUTHORITY_FORBIDDEN:"+k);
 assert.equal(old.expected_unchanged_isolated_composer_git_blob_sha,c.original_immutable_composer_git_blob,"OLD_DA9_CONTRACT_DRIFT");
 assert.equal(old.historical_frozen_zero_delta_claim,false);
 assert.equal(reg.subject_source_sha,"ff0183347e783d9e2d35ebdee91c28d4d903aac2","OLD_SIGNED_REGISTRY_REPLACED");
 assert.equal(c.checks.length,6);
 const ids=old.exact_qualification_check_ids;
 assert.deepEqual(c.checks.map(x=>x.check_id),ids,"NEW_SIX_CHECK_SET_CHANGED");
 const current=git("rev-parse","HEAD");
 assert(SHA40.test(current));
 const composer="scripts/runtime_acceptance/MCFT_CAP_09_V13_ISOLATED_PRODUCER_COMPOSITION_V1.ts";
 assert.equal(git("rev-parse","HEAD:"+composer),c.new_pinned_python_composer_git_blob,"NEW_COMPOSER_GIT_BLOB_UNREVIEWED");
 assert.equal(git("hash-object","--",composer),c.new_pinned_python_composer_git_blob,"NEW_COMPOSER_WORKTREE_DRIFT");
 const currentBytes=fs.readFileSync(path.join(ROOT,composer));
 assert.equal(digest(currentBytes),digest(Buffer.from(cp.execFileSync("git",["show","HEAD:"+composer],{cwd:ROOT}))),"COMPOSER_DISK_NOT_HEAD");
 const q=read(Q);
 const planner=require("./PLAN_MCFT_CAP_09_CHECK_APPLICABILITY_V1.cjs");
 const resolved=planner.resolveDependencyResolvers(ROOT,q);
 assert.deepEqual(resolved.errors,[],"SUCCESSOR_DEPENDENCY_RESOLVERS_INVALID");
 return {c,q,planner,resolved,head:current};
}
function sourceForCheck(s,id){
 const row=s.q.checks.find(x=>x.check_id===id);
 assert(row&&row.resolver_ids?.length>0,"SUCCESSOR_MISSING_REGISTERED_QCP_CHECK:"+id);
 const paths=[...new Set(row.resolver_ids.flatMap(k=>s.resolved.resolved[k]?.paths||[]))].sort();
 assert(paths.length>0,"SUCCESSOR_EMPTY_DEPENDENCY_SCOPE:"+id);
 const blobs=paths.map(p=>[p,git("rev-parse","HEAD:"+p)]);
 const current=s.planner.dependencyDigestForPaths(ROOT,s.head,paths,false);
 assert.deepEqual(current.missing,[],"SUCCESSOR_MISSING_DEPENDENCY_FILE");
 const catalog={};
 for(const key of row.resolver_ids)catalog[key]={current:s.planner.dependencyDigestForPaths(ROOT,s.head,s.resolved.resolved[key].paths,false)};
 const aggregate=s.planner.aggregateCheckDependencyDigest(row.resolver_ids,catalog,"current");
 assert.deepEqual(aggregate.missing,[]);
 return {paths,source_blob_sha256:digest(Buffer.from(JSON.stringify(blobs))),dependency_digest:"sha256:"+aggregate.digest};
}
function runPhase3(){
 const s=assertScope();
 const id="PHASE3_EVIDENCE_RUNTIME_FOUNDATION";
 const row=sourceForCheck(s,id);
 const oldHistorical=s.c.historical_phase3_dependency_digest;
 const successorHadMismatch=row.dependency_digest!==oldHistorical;
 assert(successorHadMismatch,"OLD_PHASE3_DIGEST_SUDDENLY_EQUAL_DO_NOT_REINTERPRET");
 const base=s.c.historical_phase3_successor_subject;
 assert(SHA40.test(base),"PHASE3_HISTORICAL_SUBJECT_INVALID");
 const files=row.paths.map(p=>{
  let legacy=null;
  try{legacy=git("rev-parse",base+":"+p);}catch{}
  const current=git("rev-parse","HEAD:"+p);
  return {path:p,historical_blob:legacy,current_blob:current,changed:legacy!==current};
 });
 const d={schema_version:"geox_mcft_cap09_phase3_historical_digest_disposition_v2",
  status:"PASS_HISTORICAL_DIGEST_MISMATCH_CLASSIFIED_BUT_REQUALIFICATION_HOLD",
  reviewed_head:s.head,historical_subject:base,
  historical_predecessor_digest:oldHistorical,
  new_exact_source_dependency_digest:row.dependency_digest,
  source_graph_blob_sha256:row.source_blob_sha256,
  dependency_scope_path_count:row.paths.length,
  changed_paths:files.filter(x=>x.changed),
  missing_historical_paths:files.filter(x=>!x.historical_blob).map(x=>x.path),
  legacy_signed_run_qualifies_new_source:false,
  phase3_fresh_exact_source_run_signed:false,
  production_authorized:false,permit_authorized:false};
 assert(d.changed_paths.length>0||d.missing_historical_paths.length>0,"PHASE3_MISMATCH_WITHOUT_EXPLANATION");
 return d;
}
function collectArtifacts(){
 const root=path.join(ROOT,"acceptance-output");
 const files=[];
 if(fs.existsSync(root)){
  for(const file of fs.readdirSync(root).sort()){
   if(!file.endsWith(".json"))continue;
   const full=path.join(root,file),st=fs.lstatSync(full);
   if(!st.isFile()||st.isSymbolicLink()||st.size>10*1024*1024||st.size===0)continue;
   files.push({file:"acceptance-output/"+file,bytes:st.size,sha256:digest(fs.readFileSync(full))});
  }
 }
 return files;
}
function runCheck(id){
 const s=assertScope(),item=s.c.checks.find(x=>x.check_id===id);
 assert(item,"UNKNOWN_SIX_CHECK_ID");
 assert.equal(process.env.MCFT_CAP09_EXACT_HEAD,s.head,"NONEXACT_PR_SUBJECT");
 assert.equal(process.env.MCFT_CAP09_EXACT_BASE,s.c.main_at_contract_draft,"PR_BASE_CONTRACT_CHANGED");
 assert(/^[0-9]+$/.test(process.env.GITHUB_RUN_ID||""),"GITHUB_RUN_ID_REQUIRED");
 assert(/^[0-9]+$/.test(process.env.GITHUB_RUN_ATTEMPT||""),"GITHUB_RUN_ATTEMPT_REQUIRED");
 assert.equal(process.env.GITHUB_EVENT_NAME,"pull_request","MUST_RUN_IN_PR");
 assert.equal(process.env.MCFT_GOVERNED_RETRY_TICKET||"","","INHERITED_PERMIT_FORBIDDEN");
 assert.equal(process.env.MCFT_GOVERNED_RETRY_STAGE||"","","INHERITED_STAGE_FORBIDDEN");
 const scope=sourceForCheck(s,id),artifacts=collectArtifacts();
 assert(artifacts.length>0,"NATIVE_ACCEPTANCE_ARTIFACTS_REQUIRED");
 const wfBlob=git("rev-parse","HEAD:"+item.historical_workflow_path);
 const receipt={schema_version:"geox_mcft_cap09_stage3_composer_six_native_source_receipt_v2",
  status:"NATIVE_JOB_STEPS_COMPLETED_PENDING_GITHUB_RUN_COMPLETION_AND_EXTERNAL_SIGNER_REVIEW",
  qualification_check_id:id,source_subject_sha:s.head,base_sha:s.c.main_at_contract_draft,
  original_native_workflow_path:item.historical_workflow_path,original_native_workflow_blob:wfBlob,
  native_acceptance_script:item.acceptance_entry,
  github_run_id:Number(process.env.GITHUB_RUN_ID),github_run_attempt:Number(process.env.GITHUB_RUN_ATTEMPT),
  github_job:process.env.GITHUB_JOB||null,stage:"SUCCESSOR_SUBJECT_PRE_MERGE",
  composer_source_blob:s.c.new_pinned_python_composer_git_blob,
  old_signed_composer_blob:s.c.original_immutable_composer_git_blob,
  source_blob_sha256:scope.source_blob_sha256,dependency_digest:scope.dependency_digest,
  dependency_path_count:scope.paths.length,artifacts,
  prior_six_signed_evidence_reused:false,source_verification_only:false,
  verified_run_final_conclusion:false,external_reviewer_signature_present:false,
  old_frozen_v13_qualified:false,phase3_signed_successor_qualified:false,
  new_isolated_fenced_pg_qualified:false,permit_authorized:false,production_authorized:false};
 return receipt;
}
function persist(obj,out){
 if(!out)throw Error("EXPLICIT_OUTPUT_PATH_REQUIRED");
 const abs=path.resolve(out);
 assert(abs.startsWith(path.join(ROOT,"acceptance-output")+path.sep),"OUTPUT_OUTSIDE_ACCEPTANCE_ONLY");
 fs.mkdirSync(path.dirname(abs),{recursive:true});
 fs.writeFileSync(abs,JSON.stringify(obj,null,2)+"\n","utf8");
 process.stdout.write(JSON.stringify({status:obj.status,file:abs,check_id:obj.qualification_check_id||"PHASE3",artifact_count:obj.artifacts?.length??0})+"\n");
}
if(require.main===module){
 try{
  const argv=process.argv.slice(2);
  const arg=(s)=>argv.find(x=>x.startsWith(s+"="))?.slice(s.length+1);
  if(argv.includes("--selftest")){
   const s=assertScope(),old=s.c.checks[0],scope=sourceForCheck(s,old.check_id);
   assert(scope.paths.length>0);assert(!s.c.qualified_six_checks);
   process.stdout.write(JSON.stringify({status:"PASS_UNAUTHORIZED_SIX_SCOPE_SELFTEST",six_checks:s.c.checks.length,composer_blob:s.c.new_pinned_python_composer_git_blob,permit:false})+"\n");
  }else if(argv.includes("--phase3")){
   persist(runPhase3(),arg("--out"));
  }else{
   persist(runCheck(arg("--check-id")),arg("--out"));
  }
 }catch(e){console.error("HOLD_SIX_SUCCESSOR:"+String(e.stack||e));process.exitCode=1;}
}
module.exports={assertScope,sourceForCheck,runPhase3,runCheck};

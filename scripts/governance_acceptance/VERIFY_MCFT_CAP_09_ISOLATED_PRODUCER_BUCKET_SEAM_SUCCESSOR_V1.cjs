#!/usr/bin/env node
"use strict";
// Engineering-only: no Provider/S3/DB operations, no ARM or Runtime changes.
// Distinct isolated bucket seam, immutable failed receipt preserved by design.
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),os=require("node:os"),cp=require("node:child_process");
const ROOT=path.resolve(__dirname,"../..");
const BASE="2e4c3e7ac0b0e300b15b26b2f6111e7d39de328b";
const Q="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json";
const OLD_VERIFIER="scripts/governance_acceptance/VERIFY_MCFT_CAP_09_ISOLATED_QUALIFICATION_AUTHORIZATION_SUCCESSOR_V1.cjs";
const OLD_ARM="scripts/runtime_acceptance/MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_ARM_V1.json";
const ISO_ARM="scripts/runtime_acceptance/MCFT_CAP_09_CURRENT_BASELINE_ISOLATED_QUALIFICATION_ARM_20261010_V1.json";
const PROD="scripts/runtime_acceptance/RUN_MCFT_CAP_09_V13_PRODUCER_DRIVEN_LIVE_QUALIFICATION_V2.ts";
const ISOLATED="scripts/runtime_acceptance/MCFT_CAP_09_V13_ISOLATED_PRODUCER_COMPOSITION_V1.ts";
const PATHS=[
 Q,
 "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-ISOLATED-PRODUCER-BUCKET-SEAM-20261010-V1.md",
 "scripts/governance_acceptance/PREPARE_MCFT_CAP_09_CURRENT_BASELINE_V1.cjs",
 "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_CURRENT_BASELINE_PREPARATION_V1.cjs",
 OLD_VERIFIER,
 "scripts/governance_acceptance/VERIFY_MCFT_CAP_09_ISOLATED_PRODUCER_BUCKET_SEAM_SUCCESSOR_V1.cjs",
 "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_V1.cjs",
 PROD,ISOLATED,
].sort();
const NEW_PATHS=new Set([
 "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-ISOLATED-PRODUCER-BUCKET-SEAM-20261010-V1.md",
 "scripts/governance_acceptance/VERIFY_MCFT_CAP_09_ISOLATED_PRODUCER_BUCKET_SEAM_SUCCESSOR_V1.cjs",
 ISOLATED,
]);
const CHECK={
check_id:"ISOLATED_PRODUCER_BUCKET_SEAM_20261010_ENGINEERING_ONLY",
owner:"MCFT_CAP09_ISOLATED_QUALIFICATION_BUCKET_SEAM",
generation_scope:["V13"],
authority_refs:["docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-ISOLATED-PRODUCER-BUCKET-SEAM-20261010-V1.md"],
resolver_ids:["ISOLATED_PRODUCER_BUCKET_SEAM_20261010_V1"],
historical_evidence_policy:"IMMUTABLE_PR3687_AUTHORITY_AND_FAILED_FIRST_EXECUTE_PRESERVED",
execution_workflow:".github/workflows/mcft-cap-09-current-baseline-entry-engineering-v1.yml",
execution_workflow_status:"ENGINEERING_ONLY_NO_LIVE_EXECUTE",
fail_policy:"FAIL_CLOSED_EXACT_NINE_PATHS_CANONICAL_PRIMITIVES_DISTINCT_BUCKET_NO_PRODUCTION_WRAPPER_CLAIM",
carry_forward_policy:"NONE",
requalification_triggers:["ISOLATED_PRODUCER_BUCKET_SEAM_20261010_V1"],
applicable_stages:["SUCCESSOR_SUBJECT_PRE_MERGE","POST_MERGE_V13_QUALIFICATION"],
carry_forward_evidence_id:null,
diagnostic_command:"node scripts/governance_acceptance/VERIFY_MCFT_CAP_09_ISOLATED_PRODUCER_BUCKET_SEAM_SUCCESSOR_V1.cjs",
};
const git=(...a)=>cp.execFileSync("git",a,{cwd:ROOT,encoding:"utf8",timeout:120000,maxBuffer:16*1024*1024}).trim();
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),"utf8"));
function historicalReplay() {
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"mcft-cap09-bucket-first-execute-pr3687-"));
 const checkout=path.join(tmp,"old");
 const real=git("rev-parse","origin/main");
 try {
  cp.execFileSync("git",["clone","--shared","--no-checkout",ROOT,checkout],
    {cwd:ROOT,stdio:"ignore",timeout:240000});
  const local=(...a)=>cp.execFileSync("git",["-C",checkout,...a],
    {encoding:"utf8",timeout:120000}).trim();
  local("checkout","--detach",BASE);
  local("update-ref","refs/remotes/origin/main",BASE);
  assert.equal(local("rev-parse","origin/main"),BASE);
  const result=JSON.parse(cp.execFileSync(process.execPath,[OLD_VERIFIER],
    {cwd:checkout,encoding:"utf8",timeout:240000,maxBuffer:16*1024*1024}).trim());
  assert.equal(result.status,"PASS","PR3687_HISTORY_REPLAY_NOT_PASS");
  return "PASS";
 } finally {
  fs.rmSync(tmp,{recursive:true,force:true});
  assert.equal(git("rev-parse","origin/main"),real,"LIVE_MAIN_REF_CHANGED");
 }
}
function verifySuccessor(){
 const head=git("rev-parse","HEAD"), main=git("rev-parse","origin/main");
 assert.equal(cp.spawnSync("git",["merge-base","--is-ancestor",BASE,head],
   {cwd:ROOT,timeout:60000}).status,0,"BUCKET_BASE_NOT_ANCESTOR");
 let stage="SUCCESSOR_SUBJECT_PRE_MERGE";
 if(main===BASE) {
   assert.notEqual(head,BASE,"BUCKET_SUCCESSOR_CANDIDATE_REQUIRED");
 } else {
   assert.equal(head,main,"BUCKET_POST_MERGE_EXACT_MAIN_REQUIRED");
   const parents=git("show","-s","--format=%P",main).split(" ");
   assert.equal(parents.length,2,"BUCKET_TWO_PARENT_ADOPTION_REQUIRED");
   assert.equal(parents[0],BASE,"BUCKET_FIRST_PARENT_MOVED");
   assert.equal(git("rev-parse",main+"^{tree}"),git("rev-parse",parents[1]+"^{tree}"),
     "BUCKET_ZERO_DELTA_ADOPTION_REQUIRED");
   stage="POST_MERGE_V13_QUALIFICATION";
 }
 assert.deepEqual(git("status","--porcelain").split(/\r?\n/).filter(x=>x&&!x.startsWith("?? acceptance-output/")),[],
  "BUCKET_DIRTY_SOURCE");
 const changes=git("diff","--name-status",BASE,head).split(/\r?\n/).filter(Boolean).map(s=>{
  const [status,file]=s.split("\t");return{status,file};
 });
 assert.deepEqual(changes.map(x=>x.file).sort(),PATHS,"BUCKET_EXACT_NINE_CHANGED_PATHS_REQUIRED");
 for(const x of changes)assert.equal(x.status,NEW_PATHS.has(x.file)?"A":"M",
  "BUCKET_UNAUTHORIZED_FILE_CHANGE:"+x.file);
 for(const a of [OLD_ARM,ISO_ARM])assert.equal(
  fs.readFileSync(path.join(ROOT,a),"utf8"),git("show",BASE+":"+a)+"\n",
  "QUALIFICATION_ARM_WAS_MUTATED:"+a);
 const before=JSON.parse(git("show",BASE+":"+Q)),q=read(Q);
 assert.equal(before.checks.length,49,"PR3687_QCP_49_EXPECTED");
 assert.equal(q.checks.length,50,"BUCKET_QCP_CHECK_COUNT");
 assert.deepEqual(q.checks.slice(0,49),before.checks,"EXISTING_49_QCP_CHECKS_CHANGED");
 assert.deepEqual(q.checks.at(-1),CHECK,"BUCKET_QCP_CHECK_CHANGED");
 assert.deepEqual(q.dependency_resolvers.ISOLATED_PRODUCER_BUCKET_SEAM_20261010_V1,
  {kind:"EXACT_PATH_SET",paths:PATHS});
 const old=structuredClone(q);old.checks.pop();
 delete old.dependency_resolvers.ISOLATED_PRODUCER_BUCKET_SEAM_20261010_V1;
 assert.deepEqual(old,before,"HISTORICAL_QCP_RESOLVERS_CHANGED");
 const frozen=require("../runtime_acceptance/MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_V1.cjs")
   .frozenRuntimePaths(ROOT,q);
 assert.equal(frozen.length,108);
 assert.equal(git("diff","--name-only","3d5fd13c8f5babd2edc5107206f43a5e5d12eb4a",
   "HEAD","--",...frozen),"","FROZEN_RUNTIME_SOURCE_DRIFT");
 const script=fs.readFileSync(path.join(ROOT,PROD),"utf8");
 const helper=fs.readFileSync(path.join(ROOT,ISOLATED),"utf8");
 assert(script.includes("composeIsolatedMcftCap09V13ProducerCoreV1("));
 assert(script.includes("production_canonical_core_identical: false"));
 assert(script.includes("production_wrapper_composer_reused: false"));
 assert(!script.includes("composeMcftCap09V13ForcingProducerCoreV1({"));
 assert(helper.includes("mcft-cap09-requal-"));
 assert(helper.includes("S3CompatiblePrivateRawEvidenceRetentionAdapterV1"));
 assert(helper.includes("PostgresEvidenceRuntimeFencedExactBaseFactPromotionV1"));
 const history=historicalReplay();
 return {status:"PASS",adjudication:"ISOLATED_BUCKET_QUALIFICATION_SEAM_ENGINEERING_ONLY",
  stage,head,main,run_id:"72dc0304a21a",history_replay:history,
  qcp_check_count:50,frozen_runtime_unchanged:true,
  production_wrapper_reused:false,canonical_primitives_reused:true,
  existing_failed_execution_receipt_preserved:true,
  authorize_execute:false,qualification_pass:false,controlled_delay_executed:false,
  production_recovery:false,formal_v5:false,a0:false,o00:false};
}
module.exports={CHECK,PATHS,verifySuccessor};
if(require.main===module){
 try{console.log(JSON.stringify(verifySuccessor(),null,2));}
 catch(e){console.error(e.stack||String(e));process.exitCode=1;}
}

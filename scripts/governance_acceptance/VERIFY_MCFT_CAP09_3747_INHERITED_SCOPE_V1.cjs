#!/usr/bin/env node
"use strict";
/**
 * PR #3747: exact-base source preservation only.
 * This is NOT requalification of Frozen V13, the 13-path #3746 composite,
 * the seven-path Stage3 predecessor, the six signed operator facts, or Permit.
 * Old checks are NOT_APPLICABLE to this new, non-overlapping PR delta, never PASS.
 */
const assert=require("node:assert/strict"),fs=require("node:fs"),cp=require("node:child_process");
const BASE="e7a8f30ffb60cb4c2bc6bd83d7bbe487eb708cc9";
const REPO="liyongshang44-max/GEOX";
const BRANCH="qualification/cap09-attempt3-adoption-v2-admission-20261028";
const QCP="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json";
const SELF="scripts/governance_acceptance/VERIFY_MCFT_CAP09_3747_INHERITED_SCOPE_V1.cjs";
const PREFLIGHT="scripts/governance_acceptance/PREFLIGHT_MCFT_CAP_09_ALL_BLOCKERS_V1.cjs";
const SOURCE_COMPOSER="scripts/runtime_acceptance/MCFT_CAP_09_V13_ISOLATED_PRODUCER_COMPOSITION_V1.ts";
const CURRENT_COMPOSER_BLOB="2d1f72d92c05093537774285bda5b7200845344d";
const HISTORIC_FROZEN_COMPOSER_BLOB="7e74b1df502e159dd49ceb21889cbfff86408e50";
const OLD_COMPOSITE="scripts/governance_acceptance/VERIFY_MCFT_CAP09_3740_3744_OWNER_COMPOSITE_V1.cjs";
const OLD_DA9_SEMANTIC="scripts/governance_acceptance/VERIFY_MCFT_CAP09_DA9_FROZEN_SEMANTIC_SUCCESSOR_V1.cjs";
const CHECKS=new Set([
 "CAP09_3740_3744_OWNER_DIRECTED_SOURCE_REVIEW_TECHNICAL_V1",
 "FROZEN108_CURRENT_RUNTIME_SUCCESSOR_TEST_ONLY_QCP_ENROLLMENT_V1",
 "DA9_CURRENT_COMPOSER_PHASE3_SIGNATURE_SUCCESSOR_QCP_TEST_ONLY_V1",
 "STAGE3_20261026_DUAL_HEARTBEAT_ENGINEERING_ONLY"
]);
const ADOPTION_RESOLVER="CAP09_ADOPTION_V2_ATTEMPT3_EXACT_SOURCE_PATHS_V2";
// Exact current #3747 delta, not the old historical 13-path or Stage3 7-path delta.
const DELTA=Object.freeze([
 ".github/workflows/mcft-cap09-adoption-v2-attempt3-engineering-v1.yml",
 QCP,
 "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-ADOPTION-V2-ATTEMPT3-ENGINEERING-BOUNDARY-V1.md",
 "scripts/cap09_adoption_v1/MCFT_CAP09_ADOPTION_V2_EVIDENCE_CONSUMER.cjs",
 "scripts/cap09_adoption_v1/MCFT_CAP09_ADOPTION_V2_EVIDENCE_CONSUMER.test.cjs",
 "scripts/cap09_adoption_v1/SIGN_MCFT_CAP09_ADOPTION_V2_OFFLINE.cjs",
 "scripts/governance_acceptance/MCFT_CAP09_ADOPTION_V2_ATTEMPT3_ENGINEERING_GATE_V1.cjs",
 "scripts/governance_acceptance/MCFT_CAP09_ADOPTION_V2_ATTEMPT3_ENGINEERING_GATE_V1.test.cjs",
 "scripts/governance_acceptance/MCFT_CAP09_ATTEMPT3_RESOURCE_OWNER_V1.cjs",
 "scripts/governance_acceptance/MCFT_CAP09_ATTEMPT3_RESOURCE_OWNER_V1.test.cjs",
 "scripts/runtime_acceptance/MCFT_CAP09_ATTEMPT3_PERMIT_V2_ATOMIC.cjs",
 "scripts/runtime_acceptance/MCFT_CAP09_ATTEMPT3_PERMIT_V2_ATOMIC.test.cjs",
 "scripts/runtime_acceptance/MCFT_CAP09_ATTEMPT3_PERMIT_V2_READONLY.cjs",
 "scripts/runtime_acceptance/MCFT_CAP09_ATTEMPT3_PERMIT_V2_READONLY.test.cjs",
 PREFLIGHT,
 SELF
].sort());
const run=(...args)=>cp.execFileSync("git",args,{encoding:"utf8",timeout:45000,maxBuffer:8*1024*1024}).trim();
const read=p=>JSON.parse(fs.readFileSync(p,"utf8"));
function technical({head,base=BASE,check_id=null,event=null,native=false}={}){
 assert.equal(base,BASE,"HOLD_3747_EXACT_BASE_REQUIRED");
 assert.equal(head,run("rev-parse","HEAD"),"HOLD_3747_EXACT_HEAD_REQUIRED");
 assert.equal(run("merge-base",BASE,head),BASE,"HOLD_3747_ANCESTRY");
 const delta=run("diff","--name-only",BASE,head).split(/\r?\n/).filter(Boolean).sort();
 assert.deepEqual(delta,DELTA,"HOLD_3747_EXACT_16_PATH_BOUNDARY");
 const old=JSON.parse(run("show",BASE+":"+QCP)),current=read(QCP);
 assert.equal(old.checks.length,64,"HOLD_3747_BASE_QCP64_REQUIRED");
 assert.equal(current.checks.length,65,"HOLD_3747_NEW_QCP65_REQUIRED");
 assert.deepEqual(current.checks.slice(0,64),old.checks,"HOLD_3747_OLD_QCP64_CHANGED");
 assert.deepEqual(Object.keys(current.dependency_resolvers).sort(),
 [...Object.keys(old.dependency_resolvers),ADOPTION_RESOLVER].sort(),
 "HOLD_3747_OLD_RESOLVER_IDENTITY_CHANGED");
 for(const k of Object.keys(old.dependency_resolvers))
   assert.deepEqual(current.dependency_resolvers[k],old.dependency_resolvers[k],
    "HOLD_3747_HISTORICAL_RESOLVER_CHANGED:"+k);
 assert.deepEqual(current.dependency_resolvers[ADOPTION_RESOLVER]?.paths.slice().sort(),
 DELTA,"HOLD_3747_NEW_RESOLVER_PATHS_NOT_EXACT");
 assert.equal(current.checks[64].check_id,
   "CAP09_ADOPTION_V2_ATTEMPT3_ENGINEERING_GATE_TEST_ONLY",
   "HOLD_3747_QCP65_WRONG_CHECK");
 assert.equal(run("rev-parse",BASE+":"+SOURCE_COMPOSER),CURRENT_COMPOSER_BLOB);
 assert.equal(run("rev-parse",head+":"+SOURCE_COMPOSER),CURRENT_COMPOSER_BLOB);
 assert.notEqual(CURRENT_COMPOSER_BLOB,HISTORIC_FROZEN_COMPOSER_BLOB);
 // Do not replay historical 13-path and DA9-source checks on this new 16-path PR.
 // Assert both original checking implementations survived byte-for-byte.
 for(const oldVerifier of [OLD_COMPOSITE,OLD_DA9_SEMANTIC]){
   assert.equal(run("rev-parse",BASE+":"+oldVerifier),
     run("rev-parse",head+":"+oldVerifier),
     "HOLD_3747_HISTORICAL_VERIFIER_CHANGED:"+oldVerifier);
 }
 assert(run("show",BASE+":"+OLD_COMPOSITE).includes("HOLD_COMPOSITE_EXACT_13_PATHS"),
   "HOLD_3747_ORIGINAL_COMPOSITE_SCOPE_GUARD_ABSENT");
 // Old signed Composer (7e74...) does not become current successor (2d1f...).
 assert.notEqual(run("rev-parse",head+":"+SOURCE_COMPOSER),
   HISTORIC_FROZEN_COMPOSER_BLOB,"HOLD_3747_HISTORIC_COMPOSER_IDENTITY_TRANSFER");
 if(check_id!==null)assert(CHECKS.has(check_id),"HOLD_3747_UNSCOPED_CHECK");
 if(native){
   assert.equal(process.env.GITHUB_ACTIONS,"true","HOLD_3747_GITHUB_ACTIONS");
   assert.equal(process.env.GITHUB_EVENT_NAME,"pull_request","HOLD_3747_PR_EVENT");
   assert.equal(process.env.GITHUB_REPOSITORY,REPO,"HOLD_3747_REPO");
   assert(event&&event.repository?.full_name===REPO,"HOLD_3747_NATIVE_REPO");
   assert.equal(event.pull_request?.number,3747,"HOLD_3747_NATIVE_PR");
   assert.equal(event.pull_request?.head?.ref,BRANCH,"HOLD_3747_NATIVE_BRANCH");
   assert.equal(event.pull_request?.head?.sha,head,"HOLD_3747_NATIVE_HEAD");
   assert.equal(event.pull_request?.head?.repo?.full_name,REPO,"HOLD_3747_NATIVE_HEAD_REPO");
   assert.equal(event.pull_request?.base?.sha,BASE,"HOLD_3747_NATIVE_BASE");
 }
 return {status:"PASS",scope:"PR_3747_SOURCE_PRESERVATION_ONLY",
  check_id,base_sha:BASE,head_sha:head,exact_current_delta_paths:DELTA.length,
  frozen_qcp64_semantics_preserved:true,composer_current_blob_unchanged:true,
  historic_frozen_composer_blob_not_equal_current:true,
  historical_composite_exact_path_verifier_unchanged:true,
  historical_da9_semantic_verifier_unchanged:true,
  historical_composite_13_path_check_not_replayed:true,
  historical_composite_current_head_qualification_claimed:false,
  composer_successor_scope_changed:true,
  historic_composer_signature_transfer_authorized:false,
  historical_13_path_check_replayed:false,stage3_7_path_check_replayed:false,
  historical_frozen_v13_failure_preserved:true,
  new_composer_signature_claimed:false,old_signature_transferred:false,
  old_technical_check_requalified:false,
  original_six_stage_count:0,adoption_authorized:false,permit_authorized:false,
  production_authorized:false};
}
function verifyForPreflight({decision,stage,base,head}){
 if(!CHECKS.has(decision?.check_id)||base!==BASE||stage!=="SUCCESSOR_SUBJECT_PRE_MERGE")return null;
 try{
  assert(process.env.GITHUB_EVENT_PATH,"HOLD_3747_EVENT_REQUIRED");
  return technical({head,base,check_id:decision.check_id,
   event:read(process.env.GITHUB_EVENT_PATH),native:true});
 }catch(e){return {status:"FAIL",reason_code:"HOLD_3747_BOUNDARY:"+String(e.message||e).slice(0,260),
  check_id:decision.check_id,old_technical_check_requalified:false,
  historic_frozen_v13_failure_preserved:true,permit_authorized:false};}
}
module.exports={technical,verifyForPreflight,CHECKS,DELTA};
if(require.main===module){
 try{
  const native=process.argv.includes("--native");
  if(!native&&!process.argv.includes("--technical"))throw Error("HOLD_EXPLICIT_MODE_REQUIRED");
  const ev=native?read(process.env.GITHUB_EVENT_PATH):null;
  const result=technical({head:run("rev-parse","HEAD"),native,event:ev});
  console.log(JSON.stringify(result,null,2));
 }catch(e){console.error("HOLD_3747_INHERITED_BOUNDARY:"+String(e.stack||e));process.exitCode=1;}
}

"use strict";
// Only current #3737 TEST_ONLY successor; read-only historical signature inheritance.
// Does NOT requalify frozen 108-path V13 zero-delta, issue new Ed25519 evidence,
// create current-production approval, or provide Host/Permit authority.
const assert=require("node:assert/strict");
const cp=require("node:child_process"),fs=require("node:fs"),path=require("node:path");
const ROOT=path.resolve(__dirname,"../..");
// The original #3737/CE94 preserved base remains a distinct historic Git object.
// Exact current post-#3746 main is a NEW subject; old approvals do not transfer.
const ORIGINAL_3737_BASE="63dc3382f879781c604a852c7d1b28af9b0dd9f4";
const BASE="b0b7f05a36214ce65cb306a411d088fb8fa76c6b";
const INTEGRATION="876cdcff39fe9c252b591236afd3b9bcdf27a4f4";
const POSTMERGE="b2e846d4b10a5d124d6060998ef1c9a2895391e4";
const MAIN3735="f654fff21e5aa05bfa6c79e67ea34fb53b61cdfb";
const QCP="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json";
const COMPOSER="scripts/runtime_acceptance/MCFT_CAP_09_V13_ISOLATED_PRODUCER_COMPOSITION_V1.ts";
const BUNDLE="docs/digital_twin/mcft/cap_09/evidence/MCFT-CAP09-DA9-SIGNED-V2-SIX-OPERATOR-REVIEW-20261025.json";
const ALLOWED=[
 ".github/workflows/mcft-cap09-stage3-testonly-dual-heartbeat-v1.yml",
 QCP,
 "scripts/governance_acceptance/PREFLIGHT_MCFT_CAP_09_ALL_BLOCKERS_V1.cjs",
 "scripts/governance_acceptance/VERIFY_MCFT_CAP09_STAGE3_HEARTBEAT_POSTMERGE_SIGNED_PRESERVATION_V1.cjs",
 "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP09_STAGE3_TEST_ONLY_DUAL_HEARTBEAT_V1.test.cjs",
 "scripts/runtime_acceptance/MCFT_CAP09_STAGE3_TEST_ONLY_DUAL_HEARTBEAT_V1.cjs",
 "scripts/runtime_acceptance/MCFT_CAP09_WINDOWS_STAGE3_REAL_FULL_PROVIDER_ONE_BASE_DUAL_HEARTBEAT_TEST_ONLY_V1.ts"
].sort();
const git=(...args)=>cp.execFileSync("git",args,{cwd:ROOT,encoding:"utf8",timeout:30000,maxBuffer:32*1024*1024}).trim();
const digest=sha=>git("rev-parse",sha+":"+COMPOSER);
const original=require("./VERIFY_MCFT_CAP09_DA9_V2_QCP_SIGNED_SIX_EVIDENCE_V1.cjs");
const SIX=new Set(original.required);
const STAGE3_ID="STAGE3_20261026_DUAL_HEARTBEAT_ENGINEERING_ONLY";
// Source-governance carry-forward is purpose-limited, and only for checks
// ALREADY machine-qualified on merged main by native QCP #3746.
const MAIN_SOURCE_IDS=new Set([
 ...SIX,
 "DA9_SIGNED_V2_FORMAL_GOVERNANCE_ADMISSION_PENDING",
 "CAP09_3740_3744_OWNER_DIRECTED_SOURCE_REVIEW_TECHNICAL_V1",
 "FROZEN108_CURRENT_RUNTIME_SUCCESSOR_TEST_ONLY_QCP_ENROLLMENT_V1",
 "DA9_CURRENT_COMPOSER_PHASE3_SIGNATURE_SUCCESSOR_QCP_TEST_ONLY_V1",
 STAGE3_ID
]);
assert.equal(MAIN_SOURCE_IDS.size,11,"HOLD_STAGE3_SCOPE_EXACT_ELEVEN");
const QCP_RUN=40551639639,QCP_ARTIFACT=12756735392;
const QCP_ART_SHA="sha256:23137baa056c926458dadde08b56ac9c9d2fc4a8968609403f4df15608c05660";
const QCP_PR_HEAD="e42a7728833515b2327db9d7ed8718cf0714304c";
let nativeCache=null;
function readNativeMainQcp(head) {
  assert.equal(process.env.GITHUB_ACTIONS,"true","HOLD_NOT_GITHUB_NATIVE_ACTIONS");
  assert.equal(process.env.GITHUB_EVENT_NAME,"pull_request","HOLD_NOT_NATIVE_PR");
  assert(process.env.GH_TOKEN && process.env.GITHUB_EVENT_PATH,"HOLD_NATIVE_QCP_CREDENTIAL_OR_EVENT_MISSING");
  const ev=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,"utf8"));
  assert.equal(ev.pull_request?.number,3737,"HOLD_CURRENT_PR_NUMBER");
  assert.equal(ev.pull_request?.head?.sha,head,"HOLD_CURRENT_PR_EXACT_HEAD");
  assert.equal(ev.pull_request?.base?.sha,BASE,"HOLD_CURRENT_PR_EXACT_BASE");
  function api(route) {
    const body=cp.execFileSync("gh",["api",route],{
      cwd:ROOT,encoding:"utf8",timeout:30000,maxBuffer:2*1024*1024,
      env:process.env
    });
    return JSON.parse(body);
  }
  if(nativeCache && nativeCache.head===head) return nativeCache;
  const pr=api("/repos/liyongshang44-max/GEOX/pulls/3746");
  assert(pr.merged_at && pr.merge_commit_sha===BASE,"HOLD_PREDECESSOR_PR_NOT_MERGED_AT_BASE");
  assert.equal(pr.head?.sha,QCP_PR_HEAD,"HOLD_PREDECESSOR_PR_HEAD_CHANGED");
  const run=api("/repos/liyongshang44-max/GEOX/actions/runs/"+QCP_RUN);
  assert.equal(run.head_sha,QCP_PR_HEAD,"HOLD_PREDECESSOR_QCP_HEAD");
  assert.equal(run.event,"pull_request","HOLD_PREDECESSOR_QCP_EVENT");
  assert.equal(run.status,"completed","HOLD_PREDECESSOR_QCP_UNFINISHED");
  assert.equal(run.conclusion,"success","HOLD_PREDECESSOR_QCP_NOT_SUCCESS");
  assert.equal(run.path,".github/workflows/mcft-cap-09-qualification-control-plane-v1.yml","HOLD_PREDECESSOR_QCP_PATH");
  const artifact=api("/repos/liyongshang44-max/GEOX/actions/artifacts/"+QCP_ARTIFACT);
  assert.equal(artifact.workflow_run?.id,QCP_RUN,"HOLD_PREDECESSOR_ARTIFACT_RUN");
  assert.equal(artifact.workflow_run?.head_sha,QCP_PR_HEAD,"HOLD_PREDECESSOR_ARTIFACT_SUBJECT");
  assert.equal(artifact.digest,QCP_ART_SHA,"HOLD_PREDECESSOR_ARTIFACT_DIGEST");
  assert.equal(artifact.expired,false,"HOLD_PREDECESSOR_ARTIFACT_EXPIRED");
  const main=api("/repos/liyongshang44-max/GEOX/branches/main");
  assert.equal(main.commit?.sha,BASE,"HOLD_PROTECTED_MAIN_MOVED");
  nativeCache={status:"PASS",head,predecessor_main:BASE,
    predecessor_qcp_run_id:QCP_RUN,predecessor_qcp_artifact_id:QCP_ARTIFACT,
    predecessor_qcp_artifact_digest:QCP_ART_SHA,
    source_scope:"CURRENT_MAIN_63_CHECKS_ALREADY_NATIVE_QUALIFIED_NOT_CURRENT_HEAD_EXECUTION",
    production_authorized:false,permit_authorized:false,physical_admission_authorized:false};
  return nativeCache;
}

let cached=null;
function reviewScope({base,head}){
 assert.equal(base,BASE,"HOLD_HEARTBEAT_EXACT_PROTECTED_MAIN_BASE");
 assert(/^[a-f0-9]{40}$/.test(head),"HOLD_HEARTBEAT_HEAD_INVALID");
 assert.equal(git("rev-parse","HEAD"),head,"HOLD_HEARTBEAT_EXACT_CHECKOUT");
 assert.equal(cp.spawnSync("git",["merge-base","--is-ancestor",BASE,head],{cwd:ROOT}).status,0,"HOLD_HEARTBEAT_NOT_DESCENDANT");
 for(const ancestor of [INTEGRATION,POSTMERGE,MAIN3735]){
   assert.equal(cp.spawnSync("git",["merge-base","--is-ancestor",ancestor,BASE],{cwd:ROOT}).status,0,"HOLD_DA9_HISTORIC_ANCESTOR_MISSING");
 }
 assert.equal(git("rev-list","--parents","-n","1",INTEGRATION).split(/\s+/).length,3,"HOLD_INTEGRATION_NOT_TWO_PARENT");
 assert.equal(git("rev-list","--parents","-n","1",BASE).split(/\s+/).length,3,"HOLD_CE94_3736_MAIN_NOT_NATIVE_MERGE");
 const diff=git("diff","--name-only",BASE,head).split(/\r?\n/).filter(Boolean).sort();
 assert.deepEqual(diff,ALLOWED,"HOLD_UNREVIEWED_3737_PATH_DELTA");
 const q=JSON.parse(fs.readFileSync(QCP,"utf8"));
 const old=JSON.parse(git("show",BASE+":"+QCP));
 assert.equal(old.checks.length,63,"HOLD_CURRENT_3746_MAIN_QCP_63");
 assert.equal(q.checks.length,64,"HOLD_HEARTBEAT_SUCCESSOR_QCP_64");
 assert.deepEqual(q.checks.slice(0,63),old.checks,"HOLD_CURRENT_MAIN_CHECK_REWRITE");
 for(const [id,resolver] of Object.entries(old.dependency_resolvers))assert.deepEqual(q.dependency_resolvers[id],resolver,"HOLD_HISTORIC_RESOLVER_REWRITE:"+id);
 assert.deepEqual(
   q.checks.slice(63).map(x=>x.check_id),
   ["STAGE3_20261026_DUAL_HEARTBEAT_ENGINEERING_ONLY"],
   "HOLD_CURRENT_QCP_EXTRA_CHECKS");
 assert.equal(q.checks[63].carry_forward_policy,
   "NONE_NO_HISTORICAL_PERMIT_NO_RAW_RECLASSIFICATION",
   "HOLD_HEARTBEAT_CARRY_FORWARD_FORBIDDEN");
 assert.equal(q.fail_closed_rules.unknown_changed_path,"FAIL");
 assert.equal(digest(ORIGINAL_3737_BASE),"2d1f72d92c05093537774285bda5b7200845344d");
 assert.equal(digest(BASE),digest(ORIGINAL_3737_BASE),"HOLD_CURRENT_MAIN_COMPOSER_CHANGED");
 assert.equal(digest(head),digest(BASE),"HOLD_SIGNED_COMPOSER_BLOB_CHANGED");
 const r=require("./PLAN_MCFT_CAP_09_CHECK_APPLICABILITY_V1.cjs").resolveDependencyResolvers(ROOT,q);
 assert.deepEqual(r.errors,[],"HOLD_HEARTBEAT_RESOLVER_ERRORS");
 const signed=JSON.parse(fs.readFileSync(BUNDLE,"utf8"));
 assert.equal(signed.entries.length,6);
 const proofs={};
 for(const id of SIX){
  const check=q.checks.find(x=>x.check_id===id);
  assert(check,"HOLD_HISTORIC_CHECK_POLICY_MISSING:"+id);
  // Historical carry-forward fields are immutable (asserted against protected BASE),
  // not required to be null; no ancient check definition is changed here.
  const files=[...new Set(check.resolver_ids.flatMap(v=>r.resolved[v]?.paths||[]))];
  assert(files.length>0,"HOLD_CHECK_DEPS_EMPTY:"+id);
  assert.equal(git("diff","--name-only",BASE,head,"--",...files),"","HOLD_SIGNED_SCIENCE_DEPENDENCY_CHANGED:"+id);
  const entry=signed.entries.find(e=>e.payload.qualification_check_id===id);
  assert(entry,"HOLD_HISTORIC_SIGNER_ENTRY_MISSING:"+id);
  const proof=original.verifyRegisteredEvidence({
   decision:{check_id:id,dependency_digest:entry.payload.dependency_digest},
   stage:"SUCCESSOR_SUBJECT_PRE_MERGE",head,base:POSTMERGE
  });
  assert(proof&&proof.status==="PASS","HOLD_HISTORIC_ED25519_SIGNATURE_INVALID:"+id+":"+(proof?.reason_code||"NONE"));
  proofs[id]={digest:entry.payload.dependency_digest,evidence_id:proof.evidence_id};
 }
 return {status:"PASS_HISTORIC_SIX_SIGNATURES_EXACT_3737_NO_SCIENCE_DRIFT",base,head,
  scope:"ORIGINAL_SIX_HISTORICAL_REVIEW_ONLY_NOT_FROZEN_108_ZERO_DRIFT",
  verified_signatures:6,checked_paths:ALLOWED.length,proofs,
  permit_authorized:false,physical_admission_authorized:false,production_authorized:false};
}
function verifyCheck({decision,stage,base,head}){
 if(stage!=="SUCCESSOR_SUBJECT_PRE_MERGE"||base!==BASE||!MAIN_SOURCE_IDS.has(decision?.check_id))return null;
 try {
  if(!cached||cached.head!==head)cached=reviewScope({base,head});
  const native=readNativeMainQcp(head);
  assert.equal(native.status,"PASS","HOLD_NATIVE_SOURCE_QCP_NOT_QUALIFIED");
  const proof= SIX.has(decision.check_id)?cached.proofs[decision.check_id]:null;
  if(proof)assert.equal(decision.dependency_digest,proof.digest,"HOLD_CURRENT_DEPENDENCY_DIGEST_NOT_SIGNED");
  return {status:"PASS",reason_code:proof?"EXACT_3737_HISTORICAL_SIGNED_ORIGINAL_SCIENCE_UNCHANGED":"EXACT_3737_DA9_SIGNED_HISTORICAL_SOURCE_POSTMERGE_REVIEW_ONLY",
   evidence_id:proof?.evidence_id||"CAP09_3746_NATIVE_MAIN_63_QCP_PRESERVED_AND_3737_OPTIONAL_SCOPE",
   native_predecessor_qcp_run_id:native.predecessor_qcp_run_id,
   native_predecessor_qcp_artifact_id:native.predecessor_qcp_artifact_id,
   optional_stage3_test_only:decision.check_id===STAGE3_ID,
   inherited_main_source_unchanged:true,source_main_63_checks_preserved:true,
   prior_qualification_is_not_current_subject_qcp:true,
   original_six_signature_count:6,original_3734_event_replayed:false,original_3735_event_replayed:false,
   old_frozen_v13_zero_delta_claim:false,original_v13_six_stage_executed:false,
   permit_authorized:false,production_authorized:false,host_authorized:false};
 }catch(error){return {status:"FAIL",reason_code:"HOLD_3737_SIGNED_SUCCESSOR:"+String(error.message||error).slice(0,150),
   permit_authorized:false,production_authorized:false};}
}
if(require.main===module){
 const head=git("rev-parse","HEAD");
 const proof=reviewScope({base:BASE,head});
 assert.equal(proof.verified_signatures,6);
 let negative=0;
 for(const bad of [{base:"0".repeat(40),head},{base:BASE,head:"0".repeat(40)}]){
  assert.throws(()=>reviewScope(bad));negative++;
 }
 console.log(JSON.stringify({...proof,negative_tests_pass:negative},null,2));
}
module.exports={reviewScope,verifyCheck,MAIN_SOURCE_IDS};

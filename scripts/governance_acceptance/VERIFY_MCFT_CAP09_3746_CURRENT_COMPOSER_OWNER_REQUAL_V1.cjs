#!/usr/bin/env node
"use strict";
// Exact current Composer: four isolated runtime proofs + real Phase7 candidate
// qualification. Original Frozen108 failed zero-drift is never reclassified.
const assert=require("node:assert/strict"),fs=require("node:fs"),cp=require("node:child_process");
const BASE="63dc3382f879781c604a852c7d1b28af9b0dd9f4";
const REPO="liyongshang44-max/GEOX",OWNER="liyongshang44-max",BRANCH="qualification/cap09-owner-frozen108-da9-composite-20261027";
const SRC="ef3649e40f0d3ab542fe9f365275708b23c53cab";
const CI=40516250068,QUAL=40516250234;
const ART=[{id:12739696790,digest:"sha256:2b2ed72d9f0ba4f63a237c6df18edc5ae2b25c1d65bb448e82dff38b42e8900a"},
{id:12738798554,digest:"sha256:8936f407a94b95c86c61c1f04c7c229f547e07516c3b1b47173d99f8774ed67e"}];
const CHECKS=["V13_AUTONOMOUS_FORCING_FOUNDATION","V13_HOLISTIC_SCHEMA",
"V13_NEXT_TICK_VIABILITY","EA5C1_DURABLE_RAW_RESTRICTED_INGRESS",
"PHASE7_PRIVATE_CANDIDATE_PROMOTION_COMPOSITION"];
const COMPOSER="scripts/runtime_acceptance/MCFT_CAP_09_V13_ISOLATED_PRODUCER_COMPOSITION_V1.ts";
const BLOB="2d1f72d92c05093537774285bda5b7200845344d";
const FROZEN="7e74b1df502e159dd49ceb21889cbfff86408e50";
const CATALOG="sha256:6458abd6c365c4e7c0d0e805d7d77910afdce74bc711d5f399e455d2c9f996e1";
const MANIFEST="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-DA9-CURRENT-SOURCE-SUCCESSOR-QCP-TECHNICAL-EVIDENCE-V1.json";
const POLICY="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-3740-3744-OWNER-DIRECTED-POLICY-V1.json";
const CONTRACT="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-FROZEN108-RUNTIME-SUCCESSOR-INVENTORY-V1.json";
const QCP="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json";
const git=(...a)=>cp.execFileSync("git",a,{encoding:"utf8",timeout:45000,maxBuffer:32*1024*1024}).trim();
const read=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const repoGet=p=>JSON.parse(git("show",BASE+":"+p));
function precheck({decision,stage,head,base},event,env){
 assert(CHECKS.includes(decision?.check_id),"HOLD_NON_COMPOSER_CHECK");
 assert.equal(stage,"SUCCESSOR_SUBJECT_PRE_MERGE","HOLD_STAGE");
 assert.equal(base,BASE,"HOLD_SOURCE_BASE");
 assert.equal(git("rev-parse","HEAD"),head,"HOLD_CURRENT_HEAD");
 assert.equal(git("merge-base",BASE,head),BASE,"HOLD_PREDECESSOR_LINEAGE");
 assert.equal(git("rev-parse",head+":"+COMPOSER),BLOB,"HOLD_CURRENT_COMPOSER_BLOB");
 assert.notEqual(BLOB,FROZEN,"HOLD_NOT_REAL_SUCCESSOR");
 assert.equal(env.GITHUB_ACTIONS,"true","HOLD_NOT_GITHUB_ACTIONS");
 assert.equal(env.GITHUB_EVENT_NAME,"pull_request","HOLD_NOT_PR");
 assert.equal(env.GITHUB_REPOSITORY,REPO);
 assert.equal(event.repository?.full_name,REPO);
 assert.equal(event.pull_request?.head?.ref,BRANCH);
 assert.equal(event.pull_request?.head?.sha,head);
 assert.equal(event.pull_request?.base?.sha,BASE);
 assert.equal(event.pull_request?.user?.login,OWNER);
 assert.equal(event.pull_request?.head?.repo?.full_name,REPO);
 const policy=read(POLICY),manifest=read(MANIFEST),frozen=read(CONTRACT);
 assert.equal(policy.owner,OWNER);assert.equal(policy.source_qualification_only,true);
 assert.equal(policy.decision_mode,"REPOSITORY_OWNER_DIRECTED_SOURCE_QUALIFICATION");
 assert.equal(policy.independent_ed25519_signature_claimed,false);
 assert.equal(policy.physical_execution_approved,false);assert.equal(policy.permit_approved,false);
 assert.equal(policy.old_run_reuse_allowed,false);
 assert.equal(frozen.entries.length,108);assert.equal(frozen.changed_path_count,2);
 assert.equal(frozen.historical_frozen_requalified,false);
 assert.equal(frozen.entries_sha256,CATALOG);
 assert.equal(manifest.frozen108_catalog_sha256,CATALOG);
 assert.equal(manifest.source_evidence[0].pr,3741);
 assert.equal(manifest.source_evidence[0].head,SRC);
 assert.equal(manifest.source_evidence[0].ci_run,CI);
 assert.equal(manifest.source_evidence[0].qualification_run,QUAL);
 assert.deepEqual(manifest.source_evidence[0].jobs,
 ["current-composer-exact-readonly","phase7-real-isolated-candidate-promotion"]);
 assert.deepEqual(manifest.source_evidence[0].artifacts.map(x=>({id:x.id,digest:x.digest})),ART);
 const oldQ=repoGet(QCP),current=read(QCP);
 assert.deepEqual(current.checks.filter(x=>CHECKS.includes(x.check_id)),
 oldQ.checks.filter(x=>CHECKS.includes(x.check_id)),"HOLD_OLD_FIVE_QCP_CHANGED");
 for(const k of [".github/workflows/mcft-cap-09-v13-autonomous-forcing-foundation.yml",
  ".github/workflows/mcft-cap-09-v13-holistic-schema.yml"]){
   // If source path exists, its original qualification authority stays bound by Git identity.
   try {assert.equal(git("rev-parse",BASE+":"+k),git("rev-parse",head+":"+k));}
   catch(e){if(!String(e.message).includes("unknown revision"))throw e;}
 }
 return true;
}
function api(p){
 const token=process.env.GH_TOKEN;
 assert(token,"HOLD_GITHUB_READ_TOKEN");
 const data=cp.execFileSync("curl",["--fail","--silent","--show-error","--max-time","30",
  "-H","Accept: application/vnd.github+json","-H","Authorization: Bearer "+token,
  "https://api.github.com/repos/"+REPO+p],{encoding:"utf8",timeout:35000,maxBuffer:6*1024*1024});
 return JSON.parse(data);
}
function native(head){
 const self=api("/pulls/3746");
 assert.equal(self.head.sha,head);assert.equal(self.base.sha,BASE);assert.equal(self.user.login,OWNER);
 const pr=api("/pulls/3741");
 assert.equal(pr.head.sha,SRC);assert.equal(pr.base.sha,BASE);
 assert.equal(pr.state,"open");assert.equal(pr.draft,true);
 const ci=api("/actions/runs/"+CI);
 assert.equal(ci.head_sha,SRC);assert.equal(ci.conclusion,"success");
 const ciJobs=api("/actions/runs/"+CI+"/jobs?per_page=100");
 for(const name of ["build-test","acceptance"])assert(ciJobs.jobs.some(x=>x.name===name&&x.conclusion==="success"),"HOLD_CI:"+name);
 const qualification=api("/actions/runs/"+QUAL);
 assert.equal(qualification.head_sha,SRC);assert.equal(qualification.conclusion,"success");
 const jobs=api("/actions/runs/"+QUAL+"/jobs?per_page=100");
 for(const name of ["current-composer-exact-readonly","phase7-real-isolated-candidate-promotion"])
 assert(jobs.jobs.some(x=>x.name===name&&x.conclusion==="success"),"HOLD_REAL_SOURCE_JOB:"+name);
 const artifacts=api("/actions/runs/"+QUAL+"/artifacts?per_page=100");
 for(const x of ART){const a=artifacts.artifacts.find(z=>z.id===x.id);
 assert(a&&!a.expired&&a.digest===x.digest,"HOLD_ARTIFACT_DIGEST");
 assert.equal(a.workflow_run?.head_sha,SRC);assert.equal(a.workflow_run?.id,QUAL);}
 const owner=api("/actions/runs/40527803393");
 assert.equal(owner.conclusion,"success");
 assert.equal(owner.head_sha,"368cb5518562794314bf4ba61140308894f85214");
 const scoped=api("/actions/runs/40519871969/jobs?per_page=100");
 assert(scoped.jobs.some(x=>x.name==="da9-current-sources-scoped-qcp-evidence"&&x.conclusion==="success"));
 return {source:SRC,ci:CI,qualification_run:QUAL,artifacts:ART.map(x=>x.id)};
}
let cached=null;
function verifyCurrentComposer({decision,stage,head,base}){
 if(!CHECKS.includes(decision?.check_id)||stage!=="SUCCESSOR_SUBJECT_PRE_MERGE"||base!==BASE)return null;
 try {
  assert(process.env.GITHUB_EVENT_PATH,"HOLD_PR_EVENT_REQUIRED");
  precheck({decision,stage,head,base},read(process.env.GITHUB_EVENT_PATH),process.env);
  if(!cached||cached.head!==head)cached={head,proof:native(head)};
  return {status:"PASS",reason_code:"CURRENT_COMPOSER_FIVE_NEW_SOURCE_OWNER_DIRECTED_QUALIFIED",
    evidence_id:"CAP09_3741_CURRENT_COMPOSER_FIVE_NATIVE_OWNER_SOURCE_V1",
    source_subject_sha:SRC,current_subject_sha:head,check_id:decision.check_id,
    native:cached.proof,
    original_frozen_v13_zero_drift_pass:false,
    historical_composer_blob:FROZEN,current_composer_blob:BLOB,
    current_source_scope_only:true,new_ed25519_signature_claimed:false,
    original_six_stages:0,windows_physical_admission:false,permit_authorized:false};
 }catch(e){return {status:"FAIL",reason_code:"HOLD_CURRENT_COMPOSER_SOURCE:"+String(e.message||e).slice(0,250),
 historical_frozen_v13_zero_drift_pass:false,permit_authorized:false};}
}
function selftest(){
 const head=git("rev-parse","HEAD");
 const event=read(process.env.GITHUB_EVENT_PATH);
 let count=0;
 const input={decision:{check_id:CHECKS[0]},stage:"SUCCESSOR_SUBJECT_PRE_MERGE",head,base:BASE};
 precheck(input,event,process.env);
 assert.equal(verifyCurrentComposer(input).status,"PASS");
 for(const name of CHECKS){const i={...input,decision:{check_id:name}};
 assert.equal(verifyCurrentComposer(i).status,"PASS");}
 const reject=mutate=>{const i=structuredClone(input),ev=structuredClone(event),env={...process.env};
 mutate(i,ev,env);assert.throws(()=>precheck(i,ev,env));count++};
 reject(i=>i.decision.check_id="PHASE3_EVIDENCE_RUNTIME_FOUNDATION");
 reject(i=>i.base="0".repeat(40));
 reject(i=>i.head="0".repeat(40));
 reject((i,e)=>e.pull_request.user.login="impostor");
 reject((i,e)=>e.pull_request.head.sha="0".repeat(40));
 reject((i,e,v)=>v.GITHUB_ACTIONS="false");
 reject((i,e,v)=>v.GITHUB_EVENT_NAME="push");
 assert.equal(count,7);
 console.log(JSON.stringify({status:"PASS_CURRENT_COMPOSER_FIVE_SCOPE_NATIVE",head,checks:CHECKS,
 negative_cases_pass:count,current_owner_source_only:true,historical_frozen_v13_pass:false,permit:false}));
}
// The ORIGINAL six Ed25519 operator signatures are verified strictly
// against their historical subject. A new owner-source-policy is then checked
// independently; this does not create a new Ed25519 signature or replay #3734.
function verifyCurrentOwnerSignedHistory({decision,stage,head,base}){
 if(decision?.check_id!=="DA9_SIGNED_V2_FORMAL_GOVERNANCE_ADMISSION_PENDING"||
    stage!=="SUCCESSOR_SUBJECT_PRE_MERGE"||base!==BASE)return null;
 try{
  const ev=read(process.env.GITHUB_EVENT_PATH||"/dev/null");
  const validated=precheck({decision:{check_id:CHECKS[0]},stage,head,base},ev,process.env);
  assert(validated);
  const oldVerifier="scripts/governance_acceptance/VERIFY_MCFT_CAP09_DA9_V2_QCP_SIGNED_SIX_EVIDENCE_V1.cjs";
  const signedPath="docs/digital_twin/mcft/cap_09/evidence/MCFT-CAP09-DA9-SIGNED-V2-SIX-OPERATOR-REVIEW-20261025.json";
  assert.equal(git("rev-parse",BASE+":"+oldVerifier),git("rev-parse",head+":"+oldVerifier),"HOLD_HISTORICAL_CRYPTO_VERIFIER_CHANGED");
  assert.equal(git("rev-parse",BASE+":"+signedPath),git("rev-parse",head+":"+signedPath),"HOLD_HISTORIC_SIGNED_BUNDLE_CHANGED");
  const crypto=require("node:crypto");
  assert.equal(crypto.createHash("sha256").update(fs.readFileSync(signedPath)).digest("hex"),
    "a98f40c3ed017b017a8459d02655b9f206f6716d1402abcc0e579487c63901df",
    "HOLD_ORIGINAL_SIGNED_BUNDLE_HASH");
  const oldCheck=repoGet(QCP).checks.find(x=>x.check_id===decision.check_id);
  assert.deepEqual(read(QCP).checks.find(x=>x.check_id===decision.check_id),oldCheck,
   "HOLD_HISTORICAL_SIGNATURE_CHECK_REWRITTEN");
  const result=cp.execFileSync(process.execPath,[oldVerifier,"--selftest"],{
    encoding:"utf8",timeout:60000,maxBuffer:2*1024*1024});
  const evidence=JSON.parse(result.trim().split(/\\r?\\n/).pop());
  assert.equal(evidence.status,"PASS_SIX_ORIGINAL_ED25519_SIGNATURES_AND_EXACT_SOURCE_ARTIFACT_BINDING");
  assert.equal(evidence.verified_checks,6);
  assert.equal(evidence.negative_tests_pass,8);
  assert.equal(evidence.permit,false);
  // Fresh, repository-owner-scope provenance is separate from old signatures.
  if(!cached||cached.head!==head)cached={head,proof:native(head)};
  const history=api("/pulls/3742");
  assert.equal(history.head.sha,"96ae42a7aeb3be83933faadafb65f1b72379b2cf");
  assert.equal(history.base.sha,BASE);
  const workflow=api("/actions/runs/40516836986");
  assert.equal(workflow.head_sha,history.head.sha);assert.equal(workflow.conclusion,"success");
  const specialized=api("/actions/runs/40516836986/jobs?per_page=100");
  assert(specialized.jobs.some(x=>x.name==="historic-signature-scope-not-current-admission"&&x.conclusion==="success"),
    "HOLD_HISTORIC_SIGNATURE_SPECIFIC_JOB");
  const previousCi=api("/actions/runs/40516837352");
  assert.equal(previousCi.conclusion,"success");assert.equal(previousCi.head_sha,history.head.sha);
  return {status:"PASS",
    reason_code:"CURRENT_OWNER_DIRECTED_SOURCE_GOVERNANCE_HISTORICAL_SIX_SIGNATURES_VERIFIED",
    evidence_id:"CAP09_3746_OWNER_SOURCE_REVIEW_AND_SIX_HISTORIC_SIGNATURE_VALIDITY_V1",
    original_signed_subject_sha:"6d8fb108655d9ada4b44cc7e4709a1c2ac5832b0",
    original_six_signatures_verified:6,
    original_event_3734_replayed:false,
    old_operator_six_resigned:false,
    new_independent_signature_claimed:false,
    source_qualification_only:true,
    historic_frozen_v13_zero_drift_pass:false,
    original_formal_six_stages:0,
    windows_physical_admission:false,permit_authorized:false,
    native_current_owner:cached.proof};
 }catch(e){return {status:"FAIL",reason_code:"HOLD_OWNER_SOURCE_HISTORIC_SIGNATURE:"+String(e.message||e).slice(0,260),
 original_event_3734_replayed:false,permit_authorized:false};}
}

module.exports={verifyCurrentComposer,verifyCurrentOwnerSignedHistory};
if(require.main===module){try{if(!process.argv.includes("--selftest"))throw Error("SELFTEST_ONLY");
selftest();}catch(e){console.error("HOLD_COMPOSER_FIVE_SOURCE:"+String(e.stack||e));process.exitCode=1;}}

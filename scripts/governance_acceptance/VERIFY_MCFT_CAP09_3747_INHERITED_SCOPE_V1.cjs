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

// Distinct current-HEAD PHASE3 qualification on #3747. The 94 exact
// source dependencies are byte-identical to native #3743's qualified
// PostgreSQL source; a stale 24cd4b59 historic dependency digest is
// NOT admissible. This reviewer never signs or provides execution authority.
const PHASE3_SOURCE="cd18701600346840b7e4cc3611a7108f2e713490";
const PHASE3_DIGEST="sha256:8af6025cd4be03227ed06a39f8f5f7fc51cdc862f3e12319fcb318e00864f145";
const PHASE3_OLD_DIGEST="sha256:d5d1cf09c4cde3b0fe82e658d9af2b25fe5beccee1a582d40ba00349fab8534b";
const PHASE3_ARTIFACT="sha256:0a05c94f21df6f8164b4cc3e37f09fbddf6663dfabee605443ec833e58177502";
const PHASE3_SOURCE_MANIFEST="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-DA9-CURRENT-SOURCE-SUCCESSOR-QCP-TECHNICAL-EVIDENCE-V1.json";
const PHASE3_OWNER_POLICY="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-3740-3744-OWNER-DIRECTED-POLICY-V1.json";
function phase3Local({decision,stage,head,base,event}){
  assert.equal(decision?.check_id,"PHASE3_EVIDENCE_RUNTIME_FOUNDATION","HOLD_3747_PHASE3_CHECK");
  assert.equal(decision.dependency_digest,PHASE3_DIGEST,"HOLD_3747_PHASE3_CURRENT_DIGEST");
  assert.notEqual(decision.dependency_digest,PHASE3_OLD_DIGEST,"HOLD_3747_PHASE3_STALE_DIGEST");
  assert.deepEqual(decision.changed_dependencies||[],[],"HOLD_3747_PHASE3_CHANGED_DEPENDENCY");
  assert.equal(stage,"SUCCESSOR_SUBJECT_PRE_MERGE","HOLD_3747_PHASE3_STAGE");
  assert.equal(base,BASE,"HOLD_3747_PHASE3_BASE");
  const scoped=technical({head,base,native:true,event});
  assert.equal(scoped.status,"PASS");
  const q=read(QCP);
  const graph=q.dependency_resolvers?.PHASE3_EVIDENCE_RUNTIME_FOUNDATION;
  assert.equal(graph?.kind,"EXACT_PATH_SET","HOLD_3747_PHASE3_RESOLVER");
  const deps=graph.paths;
  assert.equal(deps.length,94,"HOLD_3747_PHASE3_94_DEPENDENCIES");
  assert.equal(new Set(deps).size,94,"HOLD_3747_PHASE3_DUPLICATES");
  assert.equal(run("rev-parse",BASE+":"+PHASE3_SOURCE_MANIFEST),
    run("rev-parse",head+":"+PHASE3_SOURCE_MANIFEST),
    "HOLD_3747_PHASE3_MANIFEST_CHANGED");
  assert.equal(run("rev-parse",BASE+":"+PHASE3_OWNER_POLICY),
    run("rev-parse",head+":"+PHASE3_OWNER_POLICY),
    "HOLD_3747_PHASE3_OWNER_POLICY_CHANGED");
  const srcManifest=read(PHASE3_SOURCE_MANIFEST);
  assert.equal(srcManifest.current_phase3_dependency_digest,PHASE3_DIGEST,
    "HOLD_3747_PHASE3_SOURCE_MANIFEST_DIGEST");
  assert.equal(srcManifest.source_evidence[2].head,PHASE3_SOURCE,
    "HOLD_3747_PHASE3_SOURCE_IDENTITY");
  assert.equal(srcManifest.source_evidence[2].ci_run,40517266880);
  assert.equal(srcManifest.source_evidence[2].qualification_run,40517266887);
  assert.equal(srcManifest.source_evidence[2].artifacts[0].id,12738863652);
  assert.equal(srcManifest.source_evidence[2].artifacts[0].digest,PHASE3_ARTIFACT);
  const policy=read(PHASE3_OWNER_POLICY);
  assert.equal(policy.owner,"liyongshang44-max");
  assert.equal(policy.source_qualification_only,true);
  assert.equal(policy.requires_native_exact_head_verification,true);
  assert.equal(policy.physical_execution_approved,false);
  assert.equal(policy.permit_approved,false);
  // Exact source blob comparison; never equate an unrelated or modified
  // current HEAD solely because a former GitHub workflow returned green.
  for(const file of deps){
    assert.equal(run("rev-parse",PHASE3_SOURCE+":"+file),
      run("rev-parse",head+":"+file),
      "HOLD_3747_PHASE3_SOURCE_DRIFT:"+file);
  }
  return {status:"PASS_SOURCE_BLOBS_ONLY_NOT_NATIVE_ADOPTION",
    current_head:head,qualified_source:PHASE3_SOURCE,
    exact_dependency_count:deps.length,current_digest:PHASE3_DIGEST,
    original_historical_digest_still_invalid:true,
    previously_signed_evidence_transferred:false,
    old_run_reused_for_current_adoption:false,
    permit_authorized:false,adoption_authorized:false,production_authorized:false};
}
function nativePhase3Get(endpoint){
  const token=process.env.GH_TOKEN;
  assert(token,"HOLD_3747_PHASE3_NATIVE_TOKEN_REQUIRED");
  const uri="https://api.github.com/repos/"+REPO+endpoint;
  const raw=cp.execFileSync("curl",["--fail","--silent","--show-error","--max-time","30",
    "-H","Accept: application/vnd.github+json","-H","Authorization: Bearer "+token,uri],
    {encoding:"utf8",timeout:35000,maxBuffer:8*1024*1024});
  return JSON.parse(raw);
}
function verifyPhase3Successor({decision,stage,head,base}){
  if(decision?.check_id!=="PHASE3_EVIDENCE_RUNTIME_FOUNDATION"||
    stage!=="SUCCESSOR_SUBJECT_PRE_MERGE"||base!==BASE)return null;
  try{
    assert(process.env.GITHUB_EVENT_PATH,"HOLD_3747_PHASE3_EVENT_REQUIRED");
    const event=read(process.env.GITHUB_EVENT_PATH);
    const local=phase3Local({decision,stage,head,base,event});
    const source=nativePhase3Get("/pulls/3743");
    assert.equal(source.head.sha,PHASE3_SOURCE,"HOLD_3747_PHASE3_PR_HEAD");
    assert.equal(source.base.sha,"63dc3382f879781c604a852c7d1b28af9b0dd9f4");
    assert.equal(source.user.login,"liyongshang44-max");
    const ci=nativePhase3Get("/actions/runs/40517266880");
    assert.equal(ci.head_sha,PHASE3_SOURCE);
    assert.equal(ci.conclusion,"success","HOLD_3747_PHASE3_NATIVE_CI");
    const ciJobs=nativePhase3Get("/actions/runs/40517266880/jobs?per_page=100");
    for(const n of ["build-test","acceptance"])
      assert(ciJobs.jobs.some(j=>j.name===n&&j.conclusion==="success"),
        "HOLD_3747_PHASE3_CI_JOB:"+n);
    const runtime=nativePhase3Get("/actions/runs/40517266887");
    assert.equal(runtime.head_sha,PHASE3_SOURCE);
    assert.equal(runtime.conclusion,"success","HOLD_3747_PHASE3_NATIVE_RUNTIME");
    const jobs=nativePhase3Get("/actions/runs/40517266887/jobs?per_page=100");
    assert(jobs.jobs.some(j=>j.name==="phase3-current-source-real-postgres"&&
      j.conclusion==="success"),"HOLD_3747_PHASE3_REAL_POSTGRES");
    const artifacts=nativePhase3Get("/actions/runs/40517266887/artifacts?per_page=100");
    const a=artifacts.artifacts.find(x=>x.id===12738863652);
    assert(a&&!a.expired&&a.digest===PHASE3_ARTIFACT,
      "HOLD_3747_PHASE3_NATIVE_ARTIFACT");
    assert.equal(a.workflow_run?.head_sha,PHASE3_SOURCE);
    assert.equal(a.workflow_run?.id,40517266887);
    const owner=nativePhase3Get("/pulls/3745");
    assert.equal(owner.head.sha,"368cb5518562794314bf4ba61140308894f85214");
    assert.equal(owner.user.login,"liyongshang44-max");
    for(const id of [40527803393,40527803833]){
      const wr=nativePhase3Get("/actions/runs/"+id);
      assert.equal(wr.head_sha,owner.head.sha,"HOLD_3747_PHASE3_OWNER_NATIVE_HEAD");
      assert.equal(wr.conclusion,"success","HOLD_3747_PHASE3_OWNER_NATIVE_RUN");
    }
    return {...local,status:"PASS",
      reason_code:"CURRENT_PHASE3_94_IDENTICAL_BLOBS_AND_NATIVE_REAL_PG_3743_PROVEN",
      evidence_id:"CAP09_3747_PHASE3_SOURCE_IDENTICAL_NATIVE_3743_V1",
      native_ci_run_id:40517266880,native_pg_run_id:40517266887,
      native_artifact_id:12738863652,source_qualification_only:true};
  }catch(e){
    return {status:"FAIL",reason_code:"HOLD_3747_PHASE3:"+String(e.message||e).slice(0,280),
      historical_digest_still_invalid:true,permit_authorized:false,
      physical_execution_authorized:false,adoption_authorized:false};
  }
}


const COMPOSER_CHECKS=Object.freeze([
 "V13_AUTONOMOUS_FORCING_FOUNDATION",
 "V13_HOLISTIC_SCHEMA",
 "V13_NEXT_TICK_VIABILITY",
 "EA5C1_DURABLE_RAW_RESTRICTED_INGRESS",
 "PHASE7_PRIVATE_CANDIDATE_PROMOTION_COMPOSITION"
]);
const COMPOSER_SOURCE="ef3649e40f0d3ab542fe9f365275708b23c53cab";
const COMPOSER_QUALIFIED_MAIN="e42a7728833515b2327db9d7ed8718cf0714304c";
const COMPOSER_INVENTORY="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-FROZEN108-RUNTIME-SUCCESSOR-INVENTORY-V1.json";
const COMPOSER_SOURCE_MANIFEST=PHASE3_SOURCE_MANIFEST;
const COMPOSER_CATALOG_DIGEST="sha256:6458abd6c365c4e7c0d0e805d7d77910afdce74bc711d5f399e455d2c9f996e1";
const COMPOSER_NATIVE_ARTIFACTS=[
 {id:12739696790,digest:"sha256:2b2ed72d9f0ba4f63a237c6df18edc5ae2b25c1d65bb448e82dff38b42e8900a"},
 {id:12738798554,digest:"sha256:8936f407a94b95c86c61c1f04c7c229f547e07516c3b1b47173d99f8774ed67e"}
];
function composerLocal({decision,stage,head,base,event}){
 assert(COMPOSER_CHECKS.includes(decision?.check_id),"HOLD_3747_COMPOSER_CHECK");
 assert.equal(stage,"SUCCESSOR_SUBJECT_PRE_MERGE","HOLD_3747_COMPOSER_STAGE");
 assert.equal(base,BASE,"HOLD_3747_COMPOSER_BASE");
 assert.deepEqual(decision.changed_dependencies||[],[],"HOLD_3747_COMPOSER_DEPENDENCIES_CHANGED");
 const q=read(QCP);
 const original=JSON.parse(run("show",BASE+":"+QCP));
 const actual=q.checks.find(x=>x.check_id===decision.check_id);
 const previous=original.checks.find(x=>x.check_id===decision.check_id);
 assert.deepEqual(actual,previous,"HOLD_3747_COMPOSER_QCP_DEFINITION_DRIFT");
 const scoped=technical({head,base,native:true,event});
 assert.equal(scoped.status,"PASS");
 const inventory=read(COMPOSER_INVENTORY);
 assert.equal(inventory.entries.length,108,"HOLD_3747_COMPOSER_CATALOG_COUNT");
 assert.equal(inventory.entries_sha256,COMPOSER_CATALOG_DIGEST,"HOLD_3747_COMPOSER_CATALOG_DIGEST");
 assert.equal(inventory.historical_frozen_requalified,false,"HOLD_3747_HISTORIC_FROZEN_WAIVER");
 assert.equal(inventory.changed_path_count,2,"HOLD_3747_HISTORIC_TWO_BLOBS");
 assert.equal(run("rev-parse",BASE+":"+COMPOSER_INVENTORY),
   run("rev-parse",head+":"+COMPOSER_INVENTORY),
   "HOLD_3747_COMPOSER_INVENTORY_CHANGED");
 const manifest=read(COMPOSER_SOURCE_MANIFEST);
 assert.equal(manifest.frozen108_catalog_sha256,COMPOSER_CATALOG_DIGEST);
 const evidence=manifest.source_evidence[0];
 assert.equal(evidence.pr,3741);assert.equal(evidence.head,COMPOSER_SOURCE);
 assert.equal(evidence.ci_run,40516250068);
 assert.equal(evidence.qualification_run,40516250234);
 assert.deepEqual(evidence.jobs,[
   "current-composer-exact-readonly","phase7-real-isolated-candidate-promotion"]);
 assert.deepEqual(evidence.artifacts.map(x=>({id:x.id,digest:x.digest})),
   COMPOSER_NATIVE_ARTIFACTS,"HOLD_3747_COMPOSER_NATIVE_ARTIFACT_MANIFEST");
 const owner=read(PHASE3_OWNER_POLICY);
 assert.equal(owner.source_qualification_only,true);
 assert.equal(owner.owner,"liyongshang44-max");
 assert.equal(owner.physical_execution_approved,false);
 assert.equal(owner.permit_approved,false);
 const paths=inventory.entries.map(x=>x.path);
 assert.equal(new Set(paths).size,108,"HOLD_3747_COMPOSER_CATALOG_DUPLICATE");
 for(const entry of inventory.entries){
   assert.equal(entry.current_git_blob,run("rev-parse",COMPOSER_SOURCE+":"+entry.path),
     "HOLD_3747_COMPOSER_3741_SOURCE_MISMATCH:"+entry.path);
   assert.equal(entry.current_git_blob,run("rev-parse",COMPOSER_QUALIFIED_MAIN+":"+entry.path),
     "HOLD_3747_COMPOSER_3746_QCP_SOURCE_MISMATCH:"+entry.path);
   assert.equal(entry.current_git_blob,run("rev-parse",head+":"+entry.path),
     "HOLD_3747_COMPOSER_CURRENT_SOURCE_DRIFT:"+entry.path);
 }
 assert.equal(run("rev-parse",head+":"+SOURCE_COMPOSER),CURRENT_COMPOSER_BLOB);
 return {status:"PASS_BLOBS_ONLY_NOT_FORMAL_ADOPTION",
   check_id:decision.check_id,source_sha:COMPOSER_SOURCE,
   previously_native_qcp_qualified_head:COMPOSER_QUALIFIED_MAIN,
   exact_current_head:head,exact_catalog_paths:108,
   catalog_sha256:COMPOSER_CATALOG_DIGEST,
   current_composer_blob:CURRENT_COMPOSER_BLOB,
   historical_frozen_composer_blob:HISTORIC_FROZEN_COMPOSER_BLOB,
   historical_frozen_requalified:false,
   source_identity_not_six_signature_new_subject:true,
   original_six_stages:0,permit_authorized:false,adoption_authorized:false,
   production_authorized:false};
}
let composerNativeCache=null;
function verifyComposerSuccessor({decision,stage,head,base}){
 if(!COMPOSER_CHECKS.includes(decision?.check_id)||
   stage!=="SUCCESSOR_SUBJECT_PRE_MERGE"||base!==BASE)return null;
 try{
   assert(process.env.GITHUB_EVENT_PATH,"HOLD_3747_COMPOSER_EVENT_REQUIRED");
   const event=read(process.env.GITHUB_EVENT_PATH);
   const local=composerLocal({decision,stage,head,base,event});
   if(!composerNativeCache || composerNativeCache.head!==head){
     const source=nativePhase3Get("/pulls/3741");
     assert.equal(source.head.sha,COMPOSER_SOURCE,"HOLD_3747_COMPOSER_NATIVE_SOURCE_HEAD");
     assert.equal(source.base.sha,"63dc3382f879781c604a852c7d1b28af9b0dd9f4");
     assert.equal(source.user.login,"liyongshang44-max");
     const ci=nativePhase3Get("/actions/runs/40516250068");
     assert.equal(ci.head_sha,COMPOSER_SOURCE);
     assert.equal(ci.conclusion,"success");
     const ciJobs=nativePhase3Get("/actions/runs/40516250068/jobs?per_page=100");
     for(const name of ["build-test","acceptance"])
       assert(ciJobs.jobs.some(j=>j.name===name&&j.conclusion==="success"),
         "HOLD_3747_COMPOSER_CI_JOB:"+name);
     const sourceRun=nativePhase3Get("/actions/runs/40516250234");
     assert.equal(sourceRun.head_sha,COMPOSER_SOURCE);
     assert.equal(sourceRun.conclusion,"success");
     const sourceJobs=nativePhase3Get("/actions/runs/40516250234/jobs?per_page=100");
     for(const name of ["current-composer-exact-readonly","phase7-real-isolated-candidate-promotion"])
       assert(sourceJobs.jobs.some(j=>j.name===name&&j.conclusion==="success"),
         "HOLD_3747_COMPOSER_QUAL_JOB:"+name);
     const arts=nativePhase3Get("/actions/runs/40516250234/artifacts?per_page=100");
     for(const expected of COMPOSER_NATIVE_ARTIFACTS){
       const a=arts.artifacts.find(x=>x.id===expected.id);
       assert(a&&!a.expired&&a.digest===expected.digest,"HOLD_3747_COMPOSER_ARTIFACT");
       assert.equal(a.workflow_run?.head_sha,COMPOSER_SOURCE);
       assert.equal(a.workflow_run?.id,40516250234);
     }
     const merged=nativePhase3Get("/pulls/3746");
     assert.equal(merged.head.sha,COMPOSER_QUALIFIED_MAIN);
     assert.equal(merged.merged,true,"HOLD_3747_COMPOSER_SOURCE_MERGE");
     const qcp=nativePhase3Get("/actions/runs/40551639639");
     assert.equal(qcp.head_sha,COMPOSER_QUALIFIED_MAIN);
     assert.equal(qcp.conclusion,"success","HOLD_3747_COMPOSER_PRIOR_NATIVE_QCP");
     const qjobs=nativePhase3Get("/actions/runs/40551639639/jobs?per_page=100");
     for(const name of ["applicability-and-blocker-inventory",
       "owner-frozen-da9-composite-exact-native"])
       assert(qjobs.jobs.some(j=>j.name===name&&j.conclusion==="success"),
         "HOLD_3747_COMPOSER_3746_QCP_JOB:"+name);
     const qarts=nativePhase3Get("/actions/runs/40551639639/artifacts?per_page=100");
     const qa=qarts.artifacts.find(x=>x.id===12756735392);
     assert(qa&&!qa.expired&&qa.digest===
       "sha256:23137baa056c926458dadde08b56ac9c9d2fc4a8968609403f4df15608c05660",
       "HOLD_3747_COMPOSER_3746_QCP_ARTIFACT");
     assert.equal(qa.workflow_run?.head_sha,COMPOSER_QUALIFIED_MAIN);
     const owner=nativePhase3Get("/actions/runs/40527803393");
     assert.equal(owner.head_sha,"368cb5518562794314bf4ba61140308894f85214");
     assert.equal(owner.conclusion,"success","HOLD_3747_COMPOSER_OWNER_REVIEW");
     composerNativeCache={head,original_qualification_run:40516250234,
       original_qualification_artifact_ids:COMPOSER_NATIVE_ARTIFACTS.map(x=>x.id),
       accepted_3746_qcp_run:40551639639,
       accepted_3746_qcp_artifact_id:12756735392};
   }
   return {...local,status:"PASS",
     reason_code:"CURRENT_108_IDENTICAL_BLOBS_AND_3746_NATIVE_QCP_COMPOSER_SOURCE_QUALIFIED",
     evidence_id:"CAP09_3747_CURRENT_COMPOSER_SOURCE_NATIVE_3741_3746_V1",
     native:composerNativeCache,source_qualification_only:true};
 }catch(e){return {status:"FAIL",
   reason_code:"HOLD_3747_COMPOSER_CURRENT_SOURCE:"+String(e.message||e).slice(0,280),
   historical_frozen_unchanged:true,permit_authorized:false,
   adoption_authorized:false,production_authorized:false};}
}

module.exports={technical,verifyForPreflight,CHECKS,DELTA,phase3Local,verifyPhase3Successor,COMPOSER_CHECKS,composerLocal,verifyComposerSuccessor};
if(require.main===module){
 try{
  const native=process.argv.includes("--native");
  if(!native&&!process.argv.includes("--technical"))throw Error("HOLD_EXPLICIT_MODE_REQUIRED");
  const ev=native?read(process.env.GITHUB_EVENT_PATH):null;
  const result=technical({head:run("rev-parse","HEAD"),native,event:ev});
  console.log(JSON.stringify(result,null,2));
 }catch(e){console.error("HOLD_3747_INHERITED_BOUNDARY:"+String(e.stack||e));process.exitCode=1;}
}

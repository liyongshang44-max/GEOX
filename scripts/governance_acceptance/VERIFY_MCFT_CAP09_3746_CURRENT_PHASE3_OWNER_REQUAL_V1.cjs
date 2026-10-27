#!/usr/bin/env node
"use strict";
// Current-source Phase3 qualification only. Historic digest remains FAILED.
// GitHub-native exact-source/owner proof, no re-use of old formal Run/Permit.
const assert=require("node:assert/strict");
const fs=require("node:fs"),cp=require("node:child_process"),crypto=require("node:crypto");
const BASE="63dc3382f879781c604a852c7d1b28af9b0dd9f4";
const REPO="liyongshang44-max/GEOX",OWNER="liyongshang44-max",BRANCH="qualification/cap09-owner-frozen108-da9-composite-20261027";
const CHECK="PHASE3_EVIDENCE_RUNTIME_FOUNDATION";
const NEW="sha256:8af6025cd4be03227ed06a39f8f5f7fc51cdc862f3e12319fcb318e00864f145";
const OLD="sha256:d5d1cf09c4cde3b0fe82e658d9af2b25fe5beccee1a582d40ba00349fab8534b";
const GRAPH="sha256:eb54bf64d15a01659d8ab5df4c23efc76b0a4aeb898e415536ef98581a10caaf";
const MANIFEST="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-DA9-CURRENT-SOURCE-SUCCESSOR-QCP-TECHNICAL-EVIDENCE-V1.json";
const POLICY="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-3740-3744-OWNER-DIRECTED-POLICY-V1.json";
const QCP="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json";
const SIGNED="docs/digital_twin/mcft/cap_09/evidence/MCFT-CAP09-DA9-SIGNED-V2-SIX-OPERATOR-REVIEW-20261025.json";
const SUBJECT="cd18701600346840b7e4cc3611a7108f2e713490";
const SRC_CI=40517266880,SRC_RUN=40517266887,SRC_ART=12738863652;
const ART_DIGEST="sha256:0a05c94f21df6f8164b4cc3e37f09fbddf6663dfabee605443ec833e58177502";
const git=(...args)=>cp.execFileSync("git",args,{encoding:"utf8",timeout:30000,maxBuffer:32*1024*1024}).trim();
const read=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const original=p=>JSON.parse(git("show",BASE+":"+p));
function precheck({decision,stage,head,base},event,env){
 assert.equal(base,BASE,"HOLD_CURRENT_BASE");
 assert.equal(stage,"SUCCESSOR_SUBJECT_PRE_MERGE","HOLD_STAGE");
 assert.equal(decision.check_id,CHECK,"HOLD_OTHER_CHECK");
 assert.equal(decision.dependency_digest,NEW,"HOLD_CURRENT_PHASE3_DIGEST");
 assert.notEqual(decision.dependency_digest,OLD,"HOLD_OLD_PHASE3_DIGEST_REUSE");
 assert.equal(git("rev-parse","HEAD"),head,"HOLD_CURRENT_HEAD");
 assert.equal(git("merge-base",BASE,head),BASE,"HOLD_CURRENT_ANCESTRY");
 assert.equal(env.GITHUB_ACTIONS,"true","HOLD_GITHUB_ACTIONS");
 assert.equal(env.GITHUB_EVENT_NAME,"pull_request","HOLD_PR_EVENT");
 assert.equal(env.GITHUB_REPOSITORY,REPO,"HOLD_GITHUB_REPO");
 assert.equal(event.repository?.full_name,REPO,"HOLD_EVENT_REPO");
 assert.equal(event.pull_request?.user?.login,OWNER,"HOLD_OWNER_GITHUB_IDENTITY");
 assert.equal(event.pull_request?.head?.ref,BRANCH,"HOLD_COMPOSITE_BRANCH");
 assert.equal(event.pull_request?.head?.sha,head,"HOLD_UNREVIEWED_HEAD");
 assert.equal(event.pull_request?.head?.repo?.full_name,REPO,"HOLD_HEAD_REPO");
 assert.equal(event.pull_request?.base?.repo?.full_name,REPO,"HOLD_BASE_REPO");
 assert.equal(event.pull_request?.base?.sha,BASE,"HOLD_BASE_HEAD");
 const policy=read(POLICY),source=read(MANIFEST);
 assert.equal(policy.owner,OWNER);
 assert.equal(policy.decision_mode,"REPOSITORY_OWNER_DIRECTED_SOURCE_QUALIFICATION");
 assert.equal(policy.authority_basis,"explicit_repository_owner_instruction_2026_10_27_no_independent_signature");
 assert.equal(policy.source_qualification_only,true);
 assert.equal(policy.requires_native_exact_head_verification,true);
 assert.equal(policy.independent_ed25519_signature_claimed,false);
 assert.equal(policy.historical_frozen_v13_zero_drift_pass,false);
 assert.equal(policy.physical_execution_approved,false);
 assert.equal(policy.permit_approved,false);
 assert.equal(policy.old_run_reuse_allowed,false);
 assert.deepEqual(policy.sources.map(x=>x.pr),[3740,3744]);
 assert.equal(source.current_phase3_dependency_digest,NEW);
 assert.equal(source.historical_phase3_dependency_digest,OLD);
 assert.equal(source.source_graph_sha256,GRAPH);
 assert.equal(source.source_evidence[2].pr,3743);
 assert.equal(source.source_evidence[2].head,SUBJECT);
 assert.equal(source.source_evidence[2].ci_run,SRC_CI);
 assert.equal(source.source_evidence[2].qualification_run,SRC_RUN);
 assert.deepEqual(source.source_evidence[2].jobs,["phase3-current-source-real-postgres"]);
 assert.equal(source.source_evidence[2].artifacts[0].id,SRC_ART);
 assert.equal(source.source_evidence[2].artifacts[0].digest,ART_DIGEST);
 const q=read(QCP),oldQ=original(QCP);
 assert.deepEqual(q.checks.find(x=>x.check_id===CHECK),
 oldQ.checks.find(x=>x.check_id===CHECK),"HOLD_ORIGINAL_PHASE3_QCP_CHECK_CHANGED");
 assert.equal(git("rev-parse",BASE+":"+SIGNED),git("rev-parse",head+":"+SIGNED),"HOLD_HISTORIC_SIGNED_BYTES_MUTATED");
 return {policy,source};
}
function nativeGet(url){
 const token=process.env.GH_TOKEN;
 assert(token,"HOLD_READONLY_GITHUB_TOKEN_MISSING");
 const raw=cp.execFileSync("curl",["--fail","--silent","--show-error","--max-time","30",
 "-H","Accept: application/vnd.github+json","-H","Authorization: Bearer "+token,
 "https://api.github.com/repos/"+REPO+url],{encoding:"utf8",timeout:35000,maxBuffer:6*1024*1024});
 return JSON.parse(raw);
}
function nativeChecks(head){
 const now=nativeGet("/pulls/3746");
 assert.equal(now.head.sha,head,"HOLD_LIVE_REVIEW_PR_HEAD_DRIFT");
 assert.equal(now.base.sha,BASE);assert.equal(now.user.login,OWNER);
 const src=nativeGet("/pulls/3743");
 assert.equal(src.head.sha,SUBJECT,"HOLD_PHASE3_SOURCE_HEAD_DRIFT");
 assert.equal(src.base.sha,BASE);assert.equal(src.user.login,OWNER);
 assert.equal(src.state,"open");assert.equal(src.draft,true);
 const ci=nativeGet("/actions/runs/"+SRC_CI);
 assert.equal(ci.head_sha,SUBJECT);assert.equal(ci.conclusion,"success","HOLD_PHASE3_SOURCE_CI");
 const jobs=nativeGet("/actions/runs/"+SRC_CI+"/jobs?per_page=100");
 for(const name of ["build-test","acceptance"])assert(jobs.jobs.some(x=>x.name===name&&x.conclusion==="success"),"HOLD_PHASE3_CI_JOB:"+name);
 const run=nativeGet("/actions/runs/"+SRC_RUN);
 assert.equal(run.head_sha,SUBJECT);assert.equal(run.conclusion,"success","HOLD_PHASE3_NATIVE_RUN");
 const qualification=nativeGet("/actions/runs/"+SRC_RUN+"/jobs?per_page=100");
 assert(qualification.jobs.some(x=>x.name==="phase3-current-source-real-postgres"&&x.conclusion==="success"),"HOLD_PHASE3_REAL_PG_JOB");
 const zip=nativeGet("/actions/runs/"+SRC_RUN+"/artifacts?per_page=100");
 const art=zip.artifacts.find(x=>x.id===SRC_ART);
 assert(art&&!art.expired&&art.digest===ART_DIGEST,"HOLD_PHASE3_ARTIFACT_DIGEST");
 assert.equal(art.workflow_run?.head_sha,SUBJECT);
 assert.equal(art.workflow_run?.id,SRC_RUN);
 const owner=nativeGet("/pulls/3745");
 assert.equal(owner.user.login,OWNER);
 assert.equal(owner.head.sha,"368cb5518562794314bf4ba61140308894f85214");
 const auth=nativeGet("/actions/runs/40527803393");
 assert.equal(auth.head_sha,owner.head.sha);assert.equal(auth.conclusion,"success");
 const ownCi=nativeGet("/actions/runs/40527803833");
 assert.equal(ownCi.head_sha,owner.head.sha);assert.equal(ownCi.conclusion,"success");
 const tech=nativeGet("/pulls/3744");
 assert.equal(tech.head.sha,"c99c6ce846cf1d17d6193930956a30d3b05199cb");
 const scoped=nativeGet("/actions/runs/40519871969/jobs?per_page=100");
 assert(scoped.jobs.some(x=>x.name==="da9-current-sources-scoped-qcp-evidence"&&x.conclusion==="success"));
 return {subject:SUBJECT,ci:SRC_CI,qualification_run:SRC_RUN,artifact_id:SRC_ART};
}
function validate(input,event,env,doNative=true){
 precheck(input,event,env);
 const proof=doNative?nativeChecks(input.head):null;
 return {status:"PASS",reason_code:"CURRENT_PHASE3_EXACT_94_PATH_OWNER_DIRECTED_SOURCE_REQUALIFIED",
 evidence_id:"CAP09_PHASE3_CURRENT_SOURCE_3743_PG_FRESH_OWNER_BOUND_V1",
 source_subject_sha:SUBJECT,current_subject_sha:input.head,
 dependency_digest:NEW,historical_dependency_digest:OLD,
 historical_old_run_still_invalid:true,historical_digest_rewritten:false,
 independent_new_signature_claimed:false,new_source_approval_scope:"SOURCE_ONLY",
 native:proof,physical_execution_authorized:false,permit_authorized:false,
 original_formal_six_stages:0};
}
let cached=null;
function verifyCurrentPhase3(input){
 if(input?.decision?.check_id!==CHECK||input.stage!=="SUCCESSOR_SUBJECT_PRE_MERGE"||input.base!==BASE)return null;
 if(cached&&cached.head===input.head)return cached.result;
 try {
  assert(process.env.GITHUB_EVENT_PATH,"HOLD_ORIGINAL_GITHUB_EVENT_REQUIRED");
  const result=validate(input,read(process.env.GITHUB_EVENT_PATH),process.env,true);
  cached={head:input.head,result};
  return result;
 }catch(e){return {status:"FAIL",reason_code:"HOLD_CURRENT_PHASE3_SOURCE:"+String(e.message||e).slice(0,250),
  historical_old_run_still_invalid:true,permit_authorized:false};}
}
function selftest(){
 const head=git("rev-parse","HEAD");
 assert(process.env.GITHUB_EVENT_PATH);
 const event=read(process.env.GITHUB_EVENT_PATH);
 const inp={decision:{check_id:CHECK,dependency_digest:NEW},head,base:BASE,stage:"SUCCESSOR_SUBJECT_PRE_MERGE"};
 const valid=validate(inp,event,process.env,true);
 let neg=0;
 const reject=fn=>{const i=structuredClone(inp),e=structuredClone(event),env={...process.env};fn(i,e,env);
 assert.throws(()=>precheck(i,e,env));neg++;};
 reject(i=>i.decision.dependency_digest=OLD);
 reject(i=>i.decision.check_id="V13_HOLISTIC_SCHEMA");
 reject(i=>i.head="0".repeat(40));
 reject(i=>i.base="0".repeat(40));
 reject((i,e)=>e.pull_request.user.login="other");
 reject((i,e)=>e.pull_request.head.sha="0".repeat(40));
 reject((i,e,env)=>env.GITHUB_ACTIONS="false");
 reject((i,e,env)=>env.GITHUB_EVENT_NAME="push");
 assert.equal(neg,8);
 console.log(JSON.stringify({...valid,negative_cases_pass:neg}));
}
module.exports={verifyCurrentPhase3};
if(require.main===module){try{if(!process.argv.includes("--selftest"))throw Error("SELFTEST_ONLY");
selftest();}catch(e){console.error("HOLD_PHASE3_CURRENT_SOURCE:"+String(e.stack||e));process.exitCode=1;}}

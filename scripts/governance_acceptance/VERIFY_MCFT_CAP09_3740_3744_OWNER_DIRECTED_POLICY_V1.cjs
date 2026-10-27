#!/usr/bin/env node
"use strict";
// Owner-directed source-qualification evidence only; never signs governance or grants execution.
const assert=require("node:assert/strict");
const fs=require("node:fs"),crypto=require("node:crypto"),cp=require("node:child_process");
const REPO="liyongshang44-max/GEOX",OWNER="liyongshang44-max";
const BASE="63dc3382f879781c604a852c7d1b28af9b0dd9f4";
const BRANCH="qualification/cap09-owner-directed-exact-3740-3744-20261027";
const POLICY="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-3740-3744-OWNER-DIRECTED-POLICY-V1.json";
const OLD="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-DA9-SIGNED-V2-OWNER-DIRECTED-SOURCE-ADMISSION-V1.json";
const QCP="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json";
const sha=b=>crypto.createHash("sha256").update(b).digest("hex");
const git=(...a)=>cp.execFileSync("git",a,{encoding:"utf8",timeout:45000,maxBuffer:32*1024*1024}).trim();
const d=JSON.parse(fs.readFileSync(POLICY));
function invariant(p,ev,env,head){
 assert.equal(p.status,"PROPOSED_PENDING_EXACT_HEAD_CI_AND_QCP");
 assert.equal(p.decision_mode,"REPOSITORY_OWNER_DIRECTED_SOURCE_QUALIFICATION");
 assert.equal(p.owner,OWNER);assert.equal(p.protected_main_base,BASE);
 assert.equal(p.previous_policy_not_inherited,true);
 assert.equal(p.sources.length,2);
 assert.deepEqual(p.sources.map(x=>x.pr),[3740,3744]);
 assert.deepEqual(p.sources.map(x=>x.head),[
 "cd8d5909fb600535445298b48c2ca25a1e9032a7",
 "c99c6ce846cf1d17d6193930956a30d3b05199cb"]);
 assert.deepEqual(p.sources.map(x=>x.ci_run),[40446287281,40519872857]);
 assert.deepEqual(p.sources.map(x=>x.qcp_workflow_run),[40446287200,40519871969]);
 assert.deepEqual(p.sources.map(x=>x.scoped_artifact_id),[12708053283,12741276233]);
 assert.deepEqual(p.sources.map(x=>x.scoped_artifact_sha256),[
 "3e847de5b05fef9d13f739ef02410de1a62699d081c3a0a7e81d807f4fd6def8",
 "1e39c12ac51d5db0219aef1bf5ff603a5aa74f7ad19c0654adc2b1abfc8a6950"]);
 assert.equal(p.manifest_sha256,"3d19be32ffc48a92df749be763c6e00fb41ce4be8cb5c126fef77ac52bb12cd3");
 assert.equal(p.review_request_sha256,"dcda9ddc9a1f5acc5b08d398e5432dad677aa96092fa1e2c2c7fd717d541da45");
 assert.equal(p.historical_checks_preserved,60);assert.equal(p.new_scoped_checks_expected,2);
 for(const k of ["source_qualification_only","requires_authenticated_owner_event",
 "requires_native_exact_head_verification"])assert.equal(p[k],true,k);
 for(const k of ["independent_ed25519_signature_required","independent_ed25519_signature_claimed",
 "historical_frozen_v13_zero_drift_pass","historic_six_operator_signatures_resigned",
 "full_central_qcp_pass","physical_execution_approved","permit_approved","old_run_reuse_allowed"])
 assert.equal(p[k],false,k);
 assert.equal(p.global_qcp_blockers_open,7);
 assert.equal(p.old_failed_run_id,"df091a71aafc");
 assert.equal(p.original_formal_six_stages,0);
 assert.equal(env.GITHUB_ACTIONS,"true");assert.equal(env.GITHUB_EVENT_NAME,"pull_request");
 assert.equal(env.GITHUB_REPOSITORY,REPO);
 assert.equal(ev.repository?.full_name,REPO);
 assert.equal(ev.pull_request?.user?.login,OWNER);
 assert.equal(ev.pull_request?.head?.repo?.full_name,REPO);
 assert.equal(ev.pull_request?.base?.repo?.full_name,REPO);
 assert.equal(ev.pull_request?.head?.ref,BRANCH);
 assert.equal(ev.pull_request?.head?.sha,head);
 assert.equal(ev.pull_request?.base?.sha,BASE);
}
function negative(ev,env,head){
 let n=0;
 const test=mutate=>{const p=structuredClone(d),e=structuredClone(ev),z={...env};mutate(p,e,z);assert.throws(()=>invariant(p,e,z,head));n++};
 test(p=>p.sources[0].head="0".repeat(40));
 test(p=>p.sources[1].scoped_artifact_sha256="0".repeat(64));
 test(p=>p.manifest_sha256="0".repeat(64));
 test(p=>p.previous_policy_not_inherited=false);
 test(p=>p.full_central_qcp_pass=true);
 test(p=>p.historical_frozen_v13_zero_drift_pass=true);
 test(p=>p.independent_ed25519_signature_claimed=true);
 test(p=>p.permit_approved=true);
 test(p=>p.physical_execution_approved=true);
 test(p=>p.old_run_reuse_allowed=true);
 test((p,e)=>e.pull_request.user.login="another-account");
 test((p,e)=>e.pull_request.head.sha="0".repeat(40));
 test((p,e)=>e.pull_request.base.sha="0".repeat(40));
 test((p,e)=>e.pull_request.head.ref="another-branch");
 test((p,e,z)=>z.GITHUB_ACTIONS="false");
 test((p,e,z)=>z.GITHUB_EVENT_NAME="push");
 assert.equal(n,16);return n;
}
async function nativeRead(){
 const headers={Authorization:"Bearer "+process.env.GH_TOKEN,Accept:"application/vnd.github+json"};
 assert(process.env.GH_TOKEN,"HOLD_MISSING_READONLY_GITHUB_TOKEN");
 const root="https://api.github.com/repos/"+REPO;
 async function get(s){const r=await fetch(root+s,{headers});assert(r.ok,"GITHUB_NATIVE_READ:"+s+":"+r.status);return r.json();}
 const checks=[
 ["FROZEN108_CURRENT_RUNTIME_SUCCESSOR_TEST_ONLY_QCP_ENROLLMENT_V1",
  "frozen108-successor-scoped-technical-registration"],
 ["DA9_CURRENT_COMPOSER_PHASE3_SIGNATURE_SUCCESSOR_QCP_TEST_ONLY_V1",
  "da9-current-sources-scoped-qcp-evidence"]];
 const output=[];
 for(let i=0;i<2;i++){
  const x=d.sources[i];
  const pr=await get("/pulls/"+x.pr);
  assert.equal(pr.head.sha,x.head);assert.equal(pr.base.sha,BASE);
  assert.equal(pr.state,"open");assert.equal(pr.draft,true);
  const ci=await get("/actions/runs/"+x.ci_run);
  assert.equal(ci.head_sha,x.head);assert.equal(ci.conclusion,"success");
  const ciJobs=await get("/actions/runs/"+x.ci_run+"/jobs?per_page=100");
  for(const name of ["build-test","acceptance"])
   assert(ciJobs.jobs.some(j=>j.name===name&&j.conclusion==="success"));
  const q=await get("/actions/runs/"+x.qcp_workflow_run);
  assert.equal(q.head_sha,x.head);assert.equal(q.conclusion,"failure");
  const jobs=await get("/actions/runs/"+x.qcp_workflow_run+"/jobs?per_page=100");
  assert(jobs.jobs.some(j=>j.name===checks[i][1]&&j.conclusion==="success"));
  assert(jobs.jobs.some(j=>j.name==="applicability-and-blocker-inventory"&&j.conclusion==="failure"));
  const artifacts=await get("/actions/runs/"+x.qcp_workflow_run+"/artifacts?per_page=100");
  const a=artifacts.artifacts.find(v=>v.id===x.scoped_artifact_id);
  assert(a&&!a.expired&&a.digest==="sha256:"+x.scoped_artifact_sha256);
  assert.equal(a.workflow_run?.head_sha,x.head);assert.equal(a.workflow_run?.id,x.qcp_workflow_run);
  const qpath=await get("/contents/"+QCP+"?ref="+x.head);
  const qcp=JSON.parse(Buffer.from(qpath.content,"base64").toString("utf8"));
  assert.equal(qcp.checks.length,61);
  assert.equal(qcp.checks[60].check_id,checks[i][0]);
  assert.deepEqual(qcp.checks.slice(0,60),JSON.parse(git("show",BASE+":"+QCP)).checks);
  output.push({pr:x.pr,head:x.head,scoped_check:checks[i][0],scoped_qcp:"SUCCESS",global_qcp:"FAILURE"});
 }
 const m=await get("/contents/docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-DA9-CURRENT-SOURCE-SUCCESSOR-QCP-TECHNICAL-EVIDENCE-V1.json?ref="+d.sources[1].head);
 const r=await get("/contents/docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-DA9-CURRENT-SOURCE-SUCCESSOR-FORMAL-REVIEW-REQUEST-V1.json?ref="+d.sources[1].head);
 assert.equal(sha(Buffer.from(m.content,"base64")),d.manifest_sha256);
 assert.equal(sha(Buffer.from(r.content,"base64")),d.review_request_sha256);
 assert.equal(JSON.parse(Buffer.from(r.content,"base64").toString("utf8")).approved,false);
 return output;
}
async function main(){
 const head=git("rev-parse","HEAD");
 assert.equal(git("merge-base",BASE,head),BASE);
 assert.equal(git("rev-parse",BASE+":"+OLD),git("rev-parse",head+":"+OLD));
 assert.equal(git("rev-parse",BASE+":"+QCP),git("rev-parse",head+":"+QCP));
 const evpath=process.env.GITHUB_EVENT_PATH;
 assert(evpath,"HOLD_GITHUB_EVENT_PATH_REQUIRED");
 const ev=JSON.parse(fs.readFileSync(evpath,"utf8"));
 invariant(d,ev,process.env,head);
 const negatives=negative(ev,process.env,head);
 const receipts=await nativeRead();
 const result={status:"PASS_OWNER_DIRECTED_EXACT_SOURCE_REVIEW_ONLY",
  head,negative_tests:negatives,receipts,independent_signature_claimed:false,
  global_qcp_pass:false,original_six_stage_count:0,permit:"HOLD",
  new_windows_physical_authorized:false};
 fs.mkdirSync("acceptance-output",{recursive:true});
 fs.writeFileSync("acceptance-output/MCFT_CAP09_3740_3744_OWNER_SOURCE_REVIEW_V1.json",
 JSON.stringify(result,null,2)+"\n");
 console.log(JSON.stringify(result));
}
main().catch(e=>{console.error("HOLD_OWNER_SOURCE_REVIEW:"+String(e.stack||e));process.exitCode=1});

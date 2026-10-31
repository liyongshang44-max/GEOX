"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const crypto=require("node:crypto"),fs=require("node:fs"),path=require("node:path"),cp=require("node:child_process");
const adoption=require("./MCFT_CAP09_ADOPTION_V2_EVIDENCE_CONSUMER.cjs");
const a3=require("../governance_acceptance/MCFT_CAP09_ADOPTION_V2_ATTEMPT3_ENGINEERING_GATE_V1.cjs");

const HIST=Array.from(adoption.HISTORICAL_NA);
function inherited(id,head){return {status:"PASS",scope:"PR_3747_SOURCE_PRESERVATION_ONLY",
 check_id:id,base_sha:a3.BASELINE,head_sha:head,exact_current_delta_paths:20,
 frozen_qcp64_semantics_preserved:true,composer_current_blob_unchanged:true,
 historical_composite_exact_path_verifier_unchanged:true,historical_da9_semantic_verifier_unchanged:true,
 historical_frozen_v13_failure_preserved:true,old_technical_check_requalified:false,
 old_signature_transferred:false,new_composer_signature_claimed:false,
 adoption_authorized:false,permit_authorized:false,production_authorized:false,original_six_stage_count:0};}

function fixture(){
 const root=path.resolve(__dirname,"../..");
 const currentQcp=JSON.parse(fs.readFileSync(path.join(root,"docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json"),"utf8"));
 // QCP66 adds a separate nonauthorizing R4285 source check. Historic
 // Adoption V2 QCP65 is a signed fixed-size contract and MUST continue
 // to operate only on its original 65 definitions, in their original order.
 // Read the 66-check exact frozen *source*, without accepting an extra
 // check as historical Adoption V2 authority. The new QCP67 is qualified
 // separately and must preserve every old check definition and resolver.
 const oldRaw=cp.execFileSync("git",["show","16205320c30365ff81b305fb7490029912e09a18:docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json"],{cwd:root,encoding:"utf8"});
 const oldQcp=JSON.parse(oldRaw);
 assert.equal(oldQcp.checks.length,66,"PINNED_HISTORICAL_QCP66_REQUIRED");
 // The adopted #3752 QCP67 remains exact; QCP68 is an additive, test-only
 // R4285 Producer check. Never rewrite historical QCP65/66/67 evidence.
 const adoptedQcp=JSON.parse(cp.execFileSync("git",["show",
  "96861b78674571adf4414b88c3a2894b61de2eb5:docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json"],
  {cwd:root,encoding:"utf8"}));
 assert.equal(adoptedQcp.checks.length,67,"PINNED_ADOPTED_QCP67_REQUIRED");
 const adopted68=JSON.parse(cp.execFileSync("git",["show",
  "c26362fe4c27baec7764b074cad2d86a0632f0f7:docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json"],
  {cwd:root,encoding:"utf8"}));
 assert.equal(adopted68.checks.length,68,"PINNED_ADOPTED_QCP68_REQUIRED");
 const adopted69=JSON.parse(cp.execFileSync("git",["show",
  "e9eeacc292204d519cb5e86d3d3ded93573e1b38:docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json"],
  {cwd:root,encoding:"utf8"}));
 assert.equal(adopted69.checks.length,69,"PINNED_ADOPTED_QCP69");
 assert.equal(currentQcp.checks.length,70,"CURRENT_QCP70_REQUIRED");
 assert.deepEqual(currentQcp.checks.slice(0,69),adopted69.checks,"HISTORICAL_QCP69_DEFINITIONS_CHANGED");
 const r69=Object.fromEntries(Object.entries(currentQcp.dependency_resolvers)
  .filter(([id])=>id!=="CAP09_R4285_PRE_SIGN_CONSUMER_CONTRACT_EXACT_NINE_PATHS_V1"));
 assert.deepEqual(r69,adopted69.dependency_resolvers,"HISTORICAL_QCP69_RESOLVERS_CHANGED");
 assert.equal(currentQcp.checks[69].check_id,"CAP09_R4285_PRE_SIGN_CONSUMER_CONTRACT_EXACT_V1");
 assert.deepEqual(currentQcp.checks.slice(0,68),adopted68.checks,"HISTORICAL_QCP68_DEFINITIONS_CHANGED");
 const predecessorResolvers=Object.fromEntries(Object.entries(currentQcp.dependency_resolvers).filter(([id])=>
  id!=="CAP09_R4285_DA9_HISTORIC_NONPERMIT_LEDGER_EXACT_SEVEN_PATHS_V1"&&
  id!=="CAP09_R4285_PRE_SIGN_CONSUMER_CONTRACT_EXACT_NINE_PATHS_V1"));
 assert.deepEqual(predecessorResolvers,adopted68.dependency_resolvers,"HISTORICAL_QCP68_RESOLVERS_CHANGED");
 assert.deepEqual(currentQcp.checks.slice(0,67),adoptedQcp.checks,"HISTORICAL_QCP67_DEFINITIONS_CHANGED");
 const historicalResolvers=Object.fromEntries(Object.entries(currentQcp.dependency_resolvers).filter(([id])=>
  id!=="CAP09_R4285_REGISTERED_SOURCE_READONLY_EXACT_THREE_PATHS_V1"&&
  id!=="CAP09_R4285_DA9_HISTORIC_NONPERMIT_LEDGER_EXACT_SEVEN_PATHS_V1"&&
  id!=="CAP09_R4285_PRE_SIGN_CONSUMER_CONTRACT_EXACT_NINE_PATHS_V1"));
 assert.deepEqual(historicalResolvers,adoptedQcp.dependency_resolvers,"HISTORICAL_QCP67_RESOLVERS_CHANGED");
 assert.deepEqual(currentQcp.checks.slice(0,66),oldQcp.checks,"HISTORIC_QCP66_DEFINITIONS_CHANGED");
 const inheritedResolvers=Object.fromEntries(Object.entries(currentQcp.dependency_resolvers).filter(([id])=>
  id!=="CAP09_R4285_NATIVE_ADOPTION_EXACT_FOUR_PATHS_V1"&&
  id!=="CAP09_R4285_REGISTERED_SOURCE_READONLY_EXACT_THREE_PATHS_V1"&&
  id!=="CAP09_R4285_DA9_HISTORIC_NONPERMIT_LEDGER_EXACT_SEVEN_PATHS_V1"&&
  id!=="CAP09_R4285_PRE_SIGN_CONSUMER_CONTRACT_EXACT_NINE_PATHS_V1"));
 assert.deepEqual(inheritedResolvers,oldQcp.dependency_resolvers,"HISTORIC_QCP66_RESOLVERS_CHANGED");
 assert.equal(currentQcp.checks[66].check_id,"CAP09_R4285_NATIVE_ADOPTION_CONSUMER_SOURCE_ONLY_V1");
 assert.equal(currentQcp.checks[67].check_id,"CAP09_R4285_REGISTERED_SOURCE_NATIVE_READBACK_TEST_ONLY_V1");
 assert.equal(currentQcp.checks[68].check_id,"CAP09_R4285_DA9_NONPERMIT_LEDGER_CORRECTION_TEST_ONLY_V1");
 const extra=currentQcp.checks[65];
 assert.equal(extra.check_id,"CAP09_R4285_PURPOSE_SPECIFIC_SIGNED_EVIDENCE_HOST_READONLY_V1");
 assert.equal(extra.carry_forward_policy,
  "NONE_HISTORICAL_FULLCHAIN_ONLY_NATIVE_CRYPTO_PRESERVED_NO_EXECUTION_AUTHORITY");
 assert.equal(extra.carry_forward_evidence_id,null);
 assert.equal(currentQcp.dependency_resolvers.CAP09_R4285_SIGNED_HOST_READONLY_EXACT_FIVE_PATHS_V1.paths.length,8);
 const qcp={...currentQcp,checks:currentQcp.checks.slice(0,65)};
 const policy=JSON.parse(fs.readFileSync(path.join(root,"scripts/cap09_adoption_v1/offline-trust.json"),"utf8"));
 const na=new Set(policy.allowed_not_applicable_ids);
 const results=qcp.checks.map(x=>({check_id:x.check_id,
  status:na.has(x.check_id)||adoption.HISTORICAL_NA.has(x.check_id)?"NOT_APPLICABLE":"PASS",
  reason_code:na.has(x.check_id)?"STAGE_NOT_APPLICABLE":adoption.HISTORICAL_NA.has(x.check_id)?"HISTORICAL_SOURCE_ENROLLMENT_UNCHANGED_NOT_THIS_20_PATH_DELTA":null,
  ...(adoption.HISTORICAL_NA.has(x.check_id)?{applicability:"REQUALIFY",execution:"EXACT_3747_CURRENT_DELTA_PRESERVATION_NOT_HISTORICAL_REPLAY",inherited_scope_evidence:inherited(x.check_id,"d".repeat(40))}:{})}));
 const machine={status:"PASS",head_sha:"d".repeat(40),base_sha:a3.BASELINE,stage:"SUCCESSOR_SUBJECT_PRE_MERGE",
  counts:{total_checks:qcp.checks.length,pass:qcp.checks.length-na.size-HIST.length,not_applicable:na.size+HIST.length,
   fail:0,unknown:0,forbidden:0,authority_errors:0,unknown_changed_paths:0,blocker_count:0},
  blockers:[],results};
 return {qcp,policy,machine};
}
test("real source QCP65 has all Formal54 plus exactly eleven technical-only",()=>{
 const {qcp,policy,machine}=fixture();assert.equal(qcp.checks.length,65);
 const r=adoption.checkQcp65(machine,qcp,policy,machine.head_sha);
 assert.equal(r.formalCount,54);assert.equal(r.technicalCount,11);
 assert.equal(r.notApplicable.length,9);assert.equal(r.qcp_results_digest.length,64);
});
test("no unsigned PASS can replace QCP65 exact machine evidence",()=>{
 const {qcp,policy,machine}=fixture();
 for(const tamper of [
 x=>x.head_sha="e".repeat(40),
 x=>x.status="FAIL",
 x=>x.counts.blocker_count=1,
 x=>x.counts.total_checks=64,
 x=>x.counts.unknown_changed_paths=1,
 x=>x.counts.pass=59,
 x=>x.blockers.push({reason:"not closed"}),
 x=>x.results[0].status="FAILED",
 x=>x.results[0].check_id=x.results[1].check_id,
 x=>x.results.pop(),
 x=>x.results.find(r=>r.check_id===HIST[0]).status="PASS",
 x=>x.results.find(r=>r.check_id===HIST[0]).inherited_scope_evidence.head_sha="0".repeat(40),
 x=>x.results.find(r=>r.check_id===HIST[0]).inherited_scope_evidence.old_signature_transferred=true,
 x=>x.results[x.results.length-1].status="NOT_APPLICABLE",
 x=>x.results.find(r=>r.status==="NOT_APPLICABLE").reason_code="UNKNOWN"
 ]){
  const m=structuredClone(machine);tamper(m);
  assert.throws(()=>adoption.checkQcp65(m,qcp,policy,machine.head_sha));
 }
});
test("V1 historical 55-check proof is not silently treated as V2",()=>{
 const {qcp,policy,machine}=fixture();
 machine.counts.total_checks=55;machine.results=machine.results.slice(0,55);
 assert.throws(()=>adoption.checkQcp65(machine,qcp,policy,machine.head_sha));
});
test("missing actual evidence file cannot be bypassed by signed-looking JSON",()=>{
 const policy=JSON.parse(fs.readFileSync(path.resolve(__dirname,"offline-trust.json"),"utf8"));
 assert(policy.checks.length===54);
 const fake={schema_version:"MCFT_CAP09_SIGNED_ADOPTION_V2_REQUEST_V1",
  qualification:{payload:{schema:"MCFT_CAP09_ADOPTION_QUALIFICATION_V2"},signature_base64:Buffer.alloc(64).toString("base64")},
  evidence_root:"/missing",material:{}};
 assert.throws(()=>adoption.verify(fake,path.resolve(__dirname,"../..")));
});
test("Adoption V2 context never inherits V1 signed-stage authority",()=>{
 assert.equal(adoption.isVerified({status:"SIGNED_QCP65_ADOPTION_V2_EVIDENCE_VERIFIED_NOT_PERMIT"}),false);
 assert.equal(typeof adoption.DOMAIN,"string");
 assert.notEqual(adoption.DOMAIN,"GEOX_MCFT_CAP09_ADOPTION_QUALIFICATION_V1\n");
});


test("actual QCP65 56 PASS + 9 N/A permits only four proven historical technical N/A",()=>{
 const {qcp,policy,machine}=fixture();
 assert.equal(machine.counts.pass,56);assert.equal(machine.counts.not_applicable,9);
 assert.equal(adoption.checkQcp65(machine,qcp,policy,machine.head_sha).notApplicable.length,9);
 for(const bad of [m=>m.stage="POST_MERGE",m=>m.base_sha="0".repeat(40),
  m=>m.results.find(x=>x.check_id===HIST[0]).reason_code="STAGE_NOT_APPLICABLE",
  m=>m.results.find(x=>x.check_id===HIST[0]).inherited_scope_evidence.frozen_qcp64_semantics_preserved=false]){
  const m=structuredClone(machine);bad(m);assert.throws(()=>adoption.checkQcp65(m,qcp,policy,machine.head_sha));
 }
});
test("native run/attempt/PR/artifact source binds exact historical snapshot and rejects forged metadata",()=>{
 const head="d".repeat(40),p={subject_sha:head,qcp_run_id:40692854627,qcp_run_attempt:2,
  qcp_job_id:122849681347,qcp_artifact_id:12821810020,qcp_artifact_sha256:"a".repeat(64)};
 const pr={number:3747,head:{sha:head,repo:{full_name:"liyongshang44-max/GEOX"}},base:{sha:a3.BASELINE}};
 const run={id:p.qcp_run_id,head_sha:head,name:"mcft-cap-09-qualification-control-plane-v1",
  path:".github/workflows/mcft-cap-09-qualification-control-plane-v1.yml",
  event:"pull_request",status:"completed",conclusion:"success",run_attempt:2,
  pull_requests:[{number:3747,head:{sha:head},base:{sha:a3.BASELINE}}]};
 const arts={artifacts:[{id:p.qcp_artifact_id,expired:false,name:"mcft-cap09-qualification-control-plane-"+head,
  digest:"sha256:"+p.qcp_artifact_sha256,workflow_run:{id:p.qcp_run_id,head_sha:head},
  created_at:"2026-10-28T13:47:48Z"}]};
 const jobs={jobs:[{id:p.qcp_job_id,name:"applicability-and-blocker-inventory",conclusion:"success",
  started_at:"2026-10-28T13:36:20Z",completed_at:"2026-10-28T13:47:51Z"}]};
 assert.equal(adoption.checkNative(p,run,arts,jobs,pr).status,"GITHUB_NATIVE_RUN_AND_ARTIFACT_VERIFIED");
 for(const changed of [
  a=>a[0].qcp_run_attempt=1,a=>a[0].qcp_artifact_id=0,a=>a[0].qcp_job_id=0,
  a=>a[0].qcp_artifact_sha256="b".repeat(64),
  a=>a[1].head_sha="0".repeat(40),a=>a[1].conclusion="failure",
  a=>a[1].pull_requests=[],a=>a[1].run_attempt=3,
  a=>a[2].artifacts[0].expired=true,
  a=>a[2].artifacts[0].workflow_run.head_sha="0".repeat(40),
  a=>a[3].jobs[0].completed_at="2026-10-28T13:47:40Z",
  a=>a[4].head.sha="0".repeat(40)
 ]){const a=structuredClone([p,run,arts,jobs,pr]);changed(a);assert.throws(()=>adoption.checkNative(...a));}
});
function storedZip(name,data){
 const nm=Buffer.from(name),a=Buffer.alloc(30),b=Buffer.alloc(46),e=Buffer.alloc(22);
 a.writeUInt32LE(0x04034b50,0);a.writeUInt32LE(data.length,18);a.writeUInt32LE(data.length,22);a.writeUInt16LE(nm.length,26);
 b.writeUInt32LE(0x02014b50,0);b.writeUInt32LE(data.length,20);b.writeUInt32LE(data.length,24);b.writeUInt16LE(nm.length,28);
 const offset=a.length+nm.length+data.length;
 e.writeUInt32LE(0x06054b50,0);e.writeUInt16LE(1,8);e.writeUInt16LE(1,10);e.writeUInt32LE(b.length+nm.length,12);e.writeUInt32LE(offset,16);
 return Buffer.concat([a,nm,data,b,nm,e]);
}
test("raw source bytes extracted from native ZIP, not candidate self-declaration",()=>{
 const raw=Buffer.from('{"status":"PASS"}\n'),name="MCFT_CAP_09_ALL_BLOCKERS_PREFLIGHT_V1_RESULT.json";
 assert(adoption.zipRaw(storedZip(name,raw)).equals(raw));
 assert.throws(()=>adoption.zipRaw(storedZip("other.json",raw)));
 assert.throws(()=>adoption.zipRaw(storedZip("../"+name,raw)));
 const bad=storedZip(name,raw);bad.writeUInt32LE(1,0);
 assert.throws(()=>adoption.zipRaw(bad));
});


const postmerge=require("./MCFT_CAP09_ADOPTION_V2_POSTMERGE_SOURCE_V1.cjs");
function mergedFixture(){
 const tree="26c7fb2b9aba39cf96718c550352e1b86fe7af09";
 const p={run_id:"6ff9b41f6f7f",subject_sha:postmerge.MERGE,qcp_source_subject_sha:postmerge.SOURCE,
  qcp_run_id:40709390062,qcp_run_attempt:1,qcp_job_id:122890190873,
  qcp_artifact_id:12826495755,qcp_artifact_sha256:"6803cdc407ed4e3d7dc70941f21d53f75b0c79046a1b8f676bdfc8aa124708f4",
  qcp_results_digest:"a".repeat(64),material_digest:"b".repeat(64),
  host_id:"LAPTOP-STN2A2P1",operator_id:"mcft_cap09_operator_mylr1",
  issuer_id:"mcft_cap09_operator_mylr1",key_id:"mcft_cap09_ed25519_223c806e",
  adoption_owner_approval_comment_id:7000000000};
 const derivation={schema_version:"MCFT_CAP09_3747_POSTMERGE_QCP65_SOURCE_DERIVATION_V1",
  repository:postmerge.REPO,pr_number:3747,base_sha:postmerge.BASE,
  source_subject_sha:postmerge.SOURCE,subject_sha:postmerge.MERGE,
  source_tree_sha:tree,merge_tree_sha:tree,merge_parents:[postmerge.BASE,postmerge.SOURCE],
  source_qcp_run_id:p.qcp_run_id,source_qcp_attempt:p.qcp_run_attempt,
  source_qcp_artifact_id:p.qcp_artifact_id,source_qcp_artifact_sha256:p.qcp_artifact_sha256,
  source_qcp_results_digest:p.qcp_results_digest,source_qcp_owner_comment_id:postmerge.OWNER_SOURCE_COMMENT,
  qcp_executed_at_merge_subject:false,source_tree_equivalent:true,
  adoption_authorized:false,host_authorized:false,permit_authorized:false,
  production_authorized:false,original_six_stage_count:0};
 const sourceOwner={id:postmerge.OWNER_SOURCE_COMMENT,
  user:{login:"liyongshang44-max",type:"User"},author_association:"OWNER",
  created_at:"2026-10-28T14:48:20Z",updated_at:"2026-10-28T14:48:20Z",
  issue_url:"https://api.github.com/repos/"+postmerge.REPO+"/issues/3747",
  html_url:"https://github.com/"+postmerge.REPO+"/pull/3747#issuecomment-"+postmerge.OWNER_SOURCE_COMMENT,
  body:[
   "GEOX_MCFT_CAP09_3747_OWNER_QCP_SOURCE_ADMISSION_V1",
   "REPOSITORY="+postmerge.REPO,"PR=3747","BASE="+postmerge.BASE,"HEAD="+postmerge.SOURCE,
   "CHECK=DA9_SIGNED_V2_FORMAL_GOVERNANCE_ADMISSION_PENDING",
   "POLICY_VERSION=OWNER_DIRECTED_QCP_SOURCE_ADMISSION_V1",
   "DECISION=APPROVE_PURPOSE_SPECIFIC_CURRENT_HEAD_FORMAL_QCP_SOURCE_ADMISSION",
   "AUTHORITY=GITHUB_REPOSITORY_OWNER_NATIVE_COMMENT",
   "INDEPENDENT_ED25519_REVIEW_REQUIRED_FOR_THIS_SOURCE_QCP_SCOPE=false",
   "ORIGINAL_3734_SIGNATURES_VERIFIED_FOR_ORIGINAL_SUBJECT_ONLY=true",
   "CURRENT_QCP65_SOURCE_ADMISSION_APPROVED=true",
   "ADOPTION_V2_SIGNED_ACCEPTANCE_AUTHORIZED=false","HOST_V2_AUTHORIZED=false",
   "PERMIT_V2_ISSUE_OR_CONSUME_AUTHORIZED=false","PRODUCTION_AUTHORIZED=false",
   "ORIGINAL_FORMAL_SIX_STAGES=0",
   "HISTORICAL_FROZEN_V13_FAILURE_UNCHANGED=true",
   "HISTORICAL_STAGE3_FAILURE_UNCHANGED=true",
   "NO_PROVIDER_REFETCH_NO_OLD_RUN_REPLAY=true",
   "THIS_APPROVAL_EXPIRES_ON_ANY_HEAD_OR_POLICY_CHANGE=true"].join("\n")};
 const pr={number:3747,state:"closed",merged:true,
  head:{sha:postmerge.SOURCE,repo:{full_name:postmerge.REPO}},
  base:{sha:postmerge.BASE},merge_commit_sha:postmerge.MERGE,
  merged_at:"2026-10-28T15:03:07Z"};
 const sourceCommit={sha:postmerge.SOURCE,tree:{sha:tree},author:{date:"2026-10-28T14:45:20Z"}};
 const mergeCommit={sha:postmerge.MERGE,tree:{sha:tree},
  parents:[{sha:postmerge.BASE},{sha:postmerge.SOURCE}]};
 const main={object:{sha:postmerge.MERGE}};
 return {p,derivation,n:{pr,sourceCommit,mergeCommit,main,sourceOwner}};
}
test("historic QCP65 source proof remains valid without pretending it ran on new protected main",()=>{
 const {p,derivation,n}=mergedFixture();
 n.main.object.sha="e".repeat(40);
 assert.throws(()=>postmerge.verify(derivation,p,n),/POSTMERGE_LIVE_MAIN_MOVED/);
 const historical=postmerge.verifyHistoricalSource(derivation,p,n);
 assert.equal(historical.qcp_executed_at_merge_subject,false);
 assert.equal(historical.permit_authorized,false);
});
test("postmerge exact Git source tree lineage proves source only, never merge QCP/adoption",()=>{
 const {p,derivation,n}=mergedFixture();
 const v=postmerge.verify(derivation,p,n);
 assert.equal(v.status,"POSTMERGE_QCP65_SOURCE_EQUIVALENCE_VERIFIED_NOT_ADOPTION");
 assert.equal(v.qcp_executed_at_merge_subject,false);
 assert.equal(v.adoption_authorized,false);assert.equal(v.permit_authorized,false);
});
test("postmerge source proof rejects 24 scoped and authority escalation attacks",()=>{
 const {p,derivation,n}=mergedFixture();
 const attacks=[
 a=>a[0].subject_sha="0".repeat(40),a=>a[0].qcp_source_subject_sha=postmerge.MERGE,
 a=>a[0].qcp_artifact_id=5,a=>a[0].qcp_results_digest="0".repeat(64),
 a=>a[1].source_subject_sha=postmerge.MERGE,a=>a[1].source_tree_equivalent=false,
 a=>a[1].source_qcp_owner_comment_id=0,a=>a[1].qcp_executed_at_merge_subject=true,
 a=>a[1].adoption_authorized=true,a=>a[1].host_authorized=true,
 a=>a[1].permit_authorized=true,a=>a[1].production_authorized=true,
 a=>a[1].original_six_stage_count=1,
 a=>a[2].pr.number=3746,a=>a[2].pr.merged=false,
 a=>a[2].pr.head.sha=postmerge.MERGE,a=>a[2].pr.merge_commit_sha=postmerge.SOURCE,
 a=>a[2].sourceCommit.tree.sha="0".repeat(40),
 a=>a[2].mergeCommit.parents.reverse(),
 a=>a[2].main.object.sha=postmerge.SOURCE,
 a=>a[2].sourceOwner.author_association="CONTRIBUTOR",
 a=>a[2].sourceOwner.issue_url="https://api.github.com/repos/"+postmerge.REPO+"/issues/3748",
 a=>a[2].sourceOwner.body=a[2].sourceOwner.body.replace("ADOPTION_V2_SIGNED_ACCEPTANCE_AUTHORIZED=false","ADOPTION_V2_SIGNED_ACCEPTANCE_AUTHORIZED=true"),
 a=>a[2].sourceOwner.updated_at="2026-10-29T00:00:00Z",
 a=>a[2].sourceOwner.created_at="2026-10-28T14:40:00Z"];
 for(const attack of attacks){
  const a=structuredClone([p,derivation,n]);attack(a);
  assert.throws(()=>postmerge.verify(a[1],a[0],a[2]));
 }
 assert.equal(attacks.length,25);
});
test("postmerge GitHub-native empty run PR association is allowed ONLY with separate verified merge",()=>{
 const {p,n}=mergedFixture();
 const run={id:p.qcp_run_id,head_sha:postmerge.SOURCE,
  name:"mcft-cap-09-qualification-control-plane-v1",
  path:".github/workflows/mcft-cap-09-qualification-control-plane-v1.yml",
  event:"pull_request",status:"completed",conclusion:"success",run_attempt:1,
  pull_requests:[]};
 const artifacts={artifacts:[{id:p.qcp_artifact_id,
  name:"mcft-cap09-qualification-control-plane-"+postmerge.SOURCE,expired:false,
  digest:"sha256:"+p.qcp_artifact_sha256,
  workflow_run:{id:p.qcp_run_id,head_sha:postmerge.SOURCE},
  created_at:"2026-10-28T14:57:06Z"}]};
 const jobs={jobs:[{id:p.qcp_job_id,name:"applicability-and-blocker-inventory",conclusion:"success",
  started_at:"2026-10-28T14:47:42Z",completed_at:"2026-10-28T14:57:09Z"}]};
 assert.throws(()=>adoption.checkNative(p,run,artifacts,jobs,n.pr));
 assert.equal(adoption.checkNative(p,run,artifacts,jobs,n.pr,true).status,
  "GITHUB_NATIVE_RUN_AND_ARTIFACT_VERIFIED");
 const notSource=structuredClone(run);notSource.head_sha=postmerge.MERGE;
 assert.throws(()=>adoption.checkNative(p,notSource,artifacts,jobs,n.pr,true));
 const falsePR=structuredClone(n.pr);falsePR.merged=false;
 assert.throws(()=>adoption.checkNative(p,run,artifacts,jobs,falsePR,true));
 const wrongLink=structuredClone(run);wrongLink.pull_requests=[{number:3746}];
 assert.throws(()=>adoption.checkNative(p,wrongLink,artifacts,jobs,n.pr,true));
});
test("formal Adoption-specific Owner approval cannot be replaced by QCP-only owner comment",()=>{
 const {p,n}=mergedFixture();
 const t="2026-10-28T15:16:00Z",approval={id:p.adoption_owner_approval_comment_id,
  user:{login:"liyongshang44-max",type:"User"},author_association:"OWNER",
  created_at:t,updated_at:t,body:postmerge.ownerApprovalText(p),
  issue_url:"https://api.github.com/repos/"+postmerge.REPO+"/issues/3748",
  html_url:"https://github.com/"+postmerge.REPO+"/pull/3748#issuecomment-"+p.adoption_owner_approval_comment_id};
 assert.equal(postmerge.verifyOwnerApproval(p,approval,n.sourceOwner).status,
  "ADOPTION_V2_OWNER_PURPOSE_APPROVAL_VERIFIED_NOT_SIGNED");
 const bad=[
 a=>a[0].adoption_owner_approval_comment_id=postmerge.OWNER_SOURCE_COMMENT,
 a=>a[1].body=n.sourceOwner.body,
 a=>a[1].body=a[1].body.replace("SIGNATURE_STILL_REQUIRED=true","SIGNATURE_STILL_REQUIRED=false"),
 a=>a[1].body=a[1].body.replace("PRODUCTION_AUTHORIZED=false","PRODUCTION_AUTHORIZED=true"),
 a=>a[1].author_association="NONE",
 a=>a[1].updated_at="2026-10-28T15:17:00Z",
 a=>a[1].created_at="2026-10-28T14:47:00Z",
 a=>a[1].user.login="someone-else",
 a=>a[1].issue_url="https://api.github.com/repos/"+postmerge.REPO+"/issues/3747",
 a=>a[1].html_url="https://github.com/"+postmerge.REPO+"/issues/3748#issuecomment-"+a[1].id,
 a=>a[0].material_digest="0".repeat(64),
 a=>a[0].host_id="ANOTHER_WINDOWS_HOST",
 a=>a[0].issuer_id="unknown"
 ];
 for(const attack of bad){
  const a=structuredClone([p,approval]);attack(a);
  assert.throws(()=>postmerge.verifyOwnerApproval(a[0],a[1],n.sourceOwner));
 }
});

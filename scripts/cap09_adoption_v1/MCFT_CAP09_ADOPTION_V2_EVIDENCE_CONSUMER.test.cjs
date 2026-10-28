"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const crypto=require("node:crypto"),fs=require("node:fs"),path=require("node:path");
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
 const qcp=JSON.parse(fs.readFileSync(path.join(root,"docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json"),"utf8"));
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

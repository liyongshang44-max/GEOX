"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const crypto=require("node:crypto"),fs=require("node:fs"),path=require("node:path");
const adoption=require("./MCFT_CAP09_ADOPTION_V2_EVIDENCE_CONSUMER.cjs");
const a3=require("../governance_acceptance/MCFT_CAP09_ADOPTION_V2_ATTEMPT3_ENGINEERING_GATE_V1.cjs");
function fixture(){
 const root=path.resolve(__dirname,"../..");
 const qcp=JSON.parse(fs.readFileSync(path.join(root,"docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json"),"utf8"));
 const policy=JSON.parse(fs.readFileSync(path.join(root,"scripts/cap09_adoption_v1/offline-trust.json"),"utf8"));
 const na=new Set(policy.allowed_not_applicable_ids);
 const results=qcp.checks.map(x=>({check_id:x.check_id,status:na.has(x.check_id)?"NOT_APPLICABLE":"PASS",reason_code:na.has(x.check_id)?"STAGE_NOT_APPLICABLE":null}));
 const machine={status:"PASS",head_sha:"d".repeat(40),
  counts:{total_checks:qcp.checks.length,pass:qcp.checks.length-na.size,not_applicable:na.size,
   fail:0,unknown:0,forbidden:0,authority_errors:0,unknown_changed_paths:0,blocker_count:0},
  blockers:[],results};
 return {qcp,policy,machine};
}
test("real source QCP65 has all Formal54 plus exactly eleven technical-only",()=>{
 const {qcp,policy,machine}=fixture();assert.equal(qcp.checks.length,65);
 const r=adoption.checkQcp65(machine,qcp,policy,machine.head_sha);
 assert.equal(r.formalCount,54);assert.equal(r.technicalCount,11);
 assert.equal(r.notApplicable.length,5);assert.equal(r.qcp_results_digest.length,64);
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

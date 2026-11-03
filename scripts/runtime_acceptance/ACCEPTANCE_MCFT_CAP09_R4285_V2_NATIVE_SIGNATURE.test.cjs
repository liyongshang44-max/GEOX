"use strict";
/* No genuine Authority, QCP artifact, owner or Permit is minted in this test. */
const test=require("node:test"),assert=require("node:assert/strict"),crypto=require("node:crypto");
const v4=require("../cap09_adoption_v1/MCFT_CAP09_R4285_ADOPTION_V4_V2.cjs");
const native=require("../cap09_adoption_v1/MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V2.cjs");
const old=require("../cap09_adoption_v1/MCFT_CAP09_R4285_CURRENT_SUBJECT_ADOPTION_V1.cjs");
const sha=b=>crypto.createHash("sha256").update(b).digest("hex");
function fixture(){
 const now=Date.now(),pair=crypto.generateKeyPairSync("ed25519");
 const issuer={issuer_id:"LOCAL_TEST_ONLY",key_id:"TEST_KEY",role:"ACCOUNTABLE_SINGLE_OPERATOR",
  revoked:false,not_before:new Date(now-60000).toISOString(),
  not_after:new Date(now+600000).toISOString(),
  public_key_pem:pair.publicKey.export({format:"pem",type:"spki"}),
  spki_sha256:sha(pair.publicKey.export({format:"der",type:"spki"}))};
 const trust={schema_version:"geox_mcft_cap09_retry_trust_v1",host_id:old.HOST,
  operator_id:issuer.issuer_id,issuers:[issuer]};
 const ctx={subject_sha:"a".repeat(40)};
 for(const name of ["inventory_sha256","owner_decision_sha256","authority_registry_sha256",
  "lineage_envelope_sha256","native_qcp72_result_sha256","installed_material_digest",
  "release_binding_sha256"])ctx[name]="b".repeat(64);
 const p={schema_version:"MCFT_CAP09_R4285_CURRENT_SUBJECT_ADOPTION_V4",
  issuer_id:issuer.issuer_id,key_id:issuer.key_id,run_id:old.RUN,
  subject_sha:ctx.subject_sha,host_id:old.HOST,attempt_ordinal:4,
  scope:"ISOLATED_QUALIFICATION_TEST_ONLY",...Object.fromEntries(
   Object.entries(ctx).filter(([k])=>k!=="subject_sha")),
  issued_at:new Date(now-1000).toISOString(),expires_at:new Date(now+600000).toISOString(),
  decision:"APPROVE_R4285_CURRENT_SUBJECT_ADOPTION_NOT_PERMIT",
  production_authorized:false,permit_authorized:false};
 const sign=(payload)=>({payload,signature_base64:crypto.sign(null,
  Buffer.from(v4.DOMAIN+old.canonical(payload)),pair.privateKey).toString("base64")});
 return {now,ctx,trust,p,sign};
}
test("versioned V4 QCP72 Adoption signature is cryptographically exact and non-authorizing",()=>{
 const f=fixture(),signed=f.sign(f.p);
 const x=v4.verifySignedAdoptionV4({envelope:signed,trust:f.trust,context:f.ctx,now:f.now});
 assert.equal(x.status,"R4285_V4_ADOPTION_VERIFIED_NOT_PERMIT");
 assert.equal(x.permit_authorized,false);
 assert.throws(()=>v4.verifySignedAdoptionV4({envelope:signed,trust:f.trust,
  context:{...f.ctx,native_qcp72_result_sha256:"f".repeat(64)},now:f.now}),/V4_ADOPTION_BINDING/);
 assert.throws(()=>v4.verifySignedAdoptionV4({envelope:signed,trust:{...f.trust,
  issuers:[{...f.trust.issuers[0],revoked:true}]},context:f.ctx,now:f.now}));
});
test("old V3 QCP71 signature never impersonates QCP72 V4",()=>{
 const f=fixture(),signed=f.sign(f.p);
 assert.throws(()=>old.verifySignedAdoptionV3({envelope:signed,trust:f.trust,
  context:{...f.ctx,native_qcp71_result_sha256:f.ctx.native_qcp72_result_sha256},
  now:f.now}),/R4285_SIGNED_PAYLOAD_FIELDS/);
});
test("QCP72 result requires exactly 72 defined checks and the new successor PASS",()=>{
 const definitions={checks:Array.from({length:71},(_,i)=>({check_id:"OLD_"+i})).concat([
  {check_id:"CAP09_R4285_HOST_ADMISSION_V2_EXACT_SOURCE_REVIEW_V1"}])};
 const statuses=definitions.checks.map((c,i)=>({check_id:c.check_id,
  status:i===71?"PASS":"NOT_APPLICABLE",...(i===71?{}:{reason_code:"FROZEN_PREDECESSOR"})}));
 const counts={total_checks:72,pass:1,not_applicable:71,fail:0,unknown:0,forbidden:0,
  authority_errors:0,unknown_changed_paths:0,blocker_count:0};
 const machine={status:"PASS",head_sha:"a".repeat(40),base_sha:"b".repeat(40),
  stage:"SUCCESSOR_SUBJECT_PRE_MERGE",counts,blockers:[],results:statuses};
 assert.equal(native.checkQcp72(machine,definitions,machine.head_sha,machine.base_sha).checks,72);
 assert.throws(()=>native.checkQcp72({...machine,results:statuses.map((x,i)=>
  i===71?{...x,status:"NOT_APPLICABLE",reason_code:"WRONG"}:x)},definitions,
  machine.head_sha,machine.base_sha),/V2_QCP72_NEW_CHECK_REQUIRED/);
 assert.throws(()=>native.checkQcp72({...machine,counts:{...counts,total_checks:71}},
  definitions,machine.head_sha,machine.base_sha),/V2_QCP72_COUNT/);
});

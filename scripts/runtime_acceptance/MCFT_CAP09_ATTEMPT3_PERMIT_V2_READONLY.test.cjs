"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),crypto=require("node:crypto");
const v2=require("./MCFT_CAP09_ATTEMPT3_PERMIT_V2_READONLY.cjs");
const a3=require("../governance_acceptance/MCFT_CAP09_ADOPTION_V2_ATTEMPT3_ENGINEERING_GATE_V1.cjs");
const sha=x=>crypto.createHash("sha256").update(x).digest("hex");
function fixture(){
 const {publicKey,privateKey}=crypto.generateKeyPairSync("ed25519");
 const trust={schema_version:"geox_mcft_cap09_retry_trust_v1",adopted:false,execution_enabled:false,
  host_id:"LAPTOP-STN2A2P1",operator_id:"fixture_operator",
  issuers:[{issuer_id:"fixture_operator",key_id:"ephemeral_test_only",role:"ACCOUNTABLE_SINGLE_OPERATOR",
   revoked:false,not_before:"2026-10-28T00:00:00.000Z",not_after:"2026-10-29T00:00:00.000Z",
   public_key_pem:publicKey.export({type:"spki",format:"pem"}),
   spki_sha256:sha(publicKey.export({type:"spki",format:"der"}))}]};
 const payload={schema_version:"geox_mcft_cap09_signed_retry_permit_attempt3_v2",
  issuer_id:"fixture_operator",key_id:"ephemeral_test_only",
  nonce:"a".repeat(64),run_id:a3.RUN,parent_run_id:a3.PARENT,attempt_ordinal:3,
  baseline_main_sha:a3.BASELINE,subject_sha:"d".repeat(40),host_id:"LAPTOP-STN2A2P1",
  issued_at:"2026-10-28T11:00:00.000Z",expires_at:"2026-10-28T13:00:00.000Z",
  arm_sha256:"1".repeat(64),observations_sha256:"2".repeat(64),plan_sha256:"3".repeat(64),
  adoption_v2_proof_sha256:"4".repeat(64),lineage_review_sha256:"5".repeat(64),
  resources_sha256:"6".repeat(64),scope:"ISOLATED_QUALIFICATION_SINGLE_ATTEMPT_TEST_ONLY",production_authorized:false};
 const sign=(p,domain=v2.DOMAIN)=>({payload:p,signature_base64:crypto.sign(null,Buffer.from(domain+a3.canonical(p)),privateKey).toString("base64")});
 const ctx={subject_sha:payload.subject_sha,protected_main_sha:payload.subject_sha,
  source_clean:true,host_id:payload.host_id,authorized_at:payload.issued_at,
  expires_at:payload.expires_at,now:"2026-10-28T12:00:00.000Z"};
 for(const k of ["arm_sha256","observations_sha256","plan_sha256","adoption_v2_proof_sha256","lineage_review_sha256","resources_sha256"])ctx[k]=payload[k];
 return {payload,sign,ctx,trust};
}
test("new V2 Ed25519 domain verifies but remains non-authorizing",()=>{
 const f=fixture(),r=v2.verifyReadOnly(f.sign(f.payload),f.trust,f.ctx);
 assert.equal(r.status,"ATTEMPT3_V2_PERMIT_SIGNATURE_VERIFIED_NOT_ADOPTED_OR_CONSUMED");
 for(const field of ["execute_authorized","adoption_authorized","permit_consumed","production_authorized"])assert.equal(r[field],false);
 assert.equal(f.trust.adopted,false);
});
test("historical V1 Ed25519 domain cannot validate Attempt 3 V2",()=>{
 const f=fixture();
 assert.throws(()=>v2.verifyReadOnly(f.sign(f.payload,"GEOX_MCFT_CAP09_ISOLATED_RETRY_PERMIT_V1\n"),f.trust,f.ctx));
});
test("reject all identity, version, scope and resource digest tampering",()=>{
 const f=fixture();
 const pairs=[["run_id",a3.SECOND],["parent_run_id","f".repeat(12)],["attempt_ordinal",2],
  ["baseline_main_sha","e".repeat(40)],["subject_sha","e".repeat(40)],
  ["host_id","other"],["scope","PRODUCTION"],["production_authorized",true],
  ["adoption_v2_proof_sha256","e".repeat(64)],["lineage_review_sha256","e".repeat(64)],
  ["resources_sha256","e".repeat(64)],["arm_sha256","e".repeat(64)],
  ["observations_sha256","e".repeat(64)],["plan_sha256","e".repeat(64)],
  ["schema_version","geox_mcft_cap09_signed_retry_permit_v1"]];
 for(const [k,value] of pairs)assert.throws(()=>v2.verifyReadOnly(f.sign({...f.payload,[k]:value}),f.trust,f.ctx),k);
});
test("changed live context, old subject, dirty tree, expired permit all reject",()=>{
 const f=fixture(),s=f.sign(f.payload);
 for(const update of [{source_clean:false},{subject_sha:a3.BASELINE},{protected_main_sha:"0".repeat(40)},
  {host_id:"other"},{now:"2026-10-28T14:00:00.000Z"},
  {adoption_v2_proof_sha256:"0".repeat(64)}])
  assert.throws(()=>v2.verifyReadOnly(s,f.trust,{...f.ctx,...update}));
});
test("wrong signer, revocation, key fingerprint and unexpected fields fail",()=>{
 const f=fixture(),s=f.sign(f.payload);
 assert.throws(()=>v2.verifyReadOnly({...s,extra:true},f.trust,f.ctx));
 assert.throws(()=>v2.verifyReadOnly({...s,payload:{...f.payload,extra:true}},f.trust,f.ctx));
 const revoked=structuredClone(f.trust);revoked.issuers[0].revoked=true;
 assert.throws(()=>v2.verifyReadOnly(s,revoked,f.ctx));
 const changed=structuredClone(f.trust);changed.issuers[0].spki_sha256="0".repeat(64);
 assert.throws(()=>v2.verifyReadOnly(s,changed,f.ctx));
 const unknown=structuredClone(f.trust);unknown.issuers=[];
 assert.throws(()=>v2.verifyReadOnly(s,unknown,f.ctx));
});

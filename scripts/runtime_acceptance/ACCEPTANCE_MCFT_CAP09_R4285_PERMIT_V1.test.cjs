"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),crypto=require("node:crypto");
const permit=require("./MCFT_CAP09_R4285_PERMIT_V1.cjs");
const lineage=require("../governance_acceptance/MCFT_CAP09_R4285_SIGNED_EVIDENCE_GATE_V1.cjs");
const sha=b=>crypto.createHash("sha256").update(b).digest("hex");
function fixture(){
 const kp=crypto.generateKeyPairSync("ed25519"),now=Date.now();
 const issued_at=new Date(now-1000).toISOString(),expires_at=new Date(now+600000).toISOString();
 const issuer={issuer_id:"TEST_OPERATOR",key_id:"TEST_ONLY_ED25519",role:"ACCOUNTABLE_SINGLE_OPERATOR",
  revoked:false,not_before:new Date(now-60000).toISOString(),
  not_after:new Date(now+3600000).toISOString(),
  public_key_pem:kp.publicKey.export({type:"spki",format:"pem"}),
  spki_sha256:sha(kp.publicKey.export({type:"spki",format:"der"}))};
 const trust={schema_version:"geox_mcft_cap09_retry_trust_v1",host_id:permit.HOST,
  operator_id:issuer.issuer_id,issuers:[issuer]};
 const subject_sha="a".repeat(40),ctx={subject_sha,protected_main_sha:subject_sha,
  source_clean:true,host_id:permit.HOST,
  adoption_expires_at:new Date(now+900000).toISOString(),
  resource_owner_expires_at:new Date(now+900000).toISOString(),
  total_stage_budget_ms:30000};
 permit.BINDINGS.forEach((f,i)=>ctx[f]=(i+1).toString(16).padStart(64,"0"));
 const p={schema_version:"MCFT_CAP09_R4285_SIGNED_ISOLATED_TEST_PERMIT_V1",
  issuer_id:issuer.issuer_id,key_id:issuer.key_id,run_id:permit.RUN,
  nonce:"e".repeat(64),parent_run_id:permit.PARENT,
  failed_predecessor_run_id:permit.FAILED_PREDECESSOR,
  attempt_ordinal:4,subject_sha,host_id:permit.HOST,
  scope:"ISOLATED_QUALIFICATION_TEST_ONLY",
  purpose:"ORIGINAL_SIX_STAGE_SINGLE_ATTEMPT",
  decision:"APPROVE_R4285_TEST_ONLY_PERMIT_NOT_PRODUCTION",
  issued_at,expires_at,production_authorized:false};
 for(const f of permit.BINDINGS)p[f]=ctx[f];
 function sign(v=p,domain=permit.DOMAIN){return {payload:v,signature_base64:crypto.sign(
  null,Buffer.from(domain+lineage.canonical(v)),kp.privateKey).toString("base64")};}
 return {p,ctx,trust,sign,now};
}
test("R4285 distinct Permit V1 domain verifies but grants no execution",()=>{
 const f=fixture(),proof=permit.verifyReadOnly(f.sign(),f.trust,f.ctx,{now:f.now});
 assert(permit.isVerified(proof));assert.equal(proof.permit_consumed,false);
 assert.equal(proof.execute_authorized,false);assert.equal(proof.production_authorized,false);
 assert(!permit.isVerified({...proof}));
});
test("wrong original parent, failed predecessor, ordinal, run and host are rejected",()=>{
 const f=fixture();
 for(const change of [
  {parent_run_id:permit.FAILED_PREDECESSOR},
  {failed_predecessor_run_id:permit.PARENT},
  {attempt_ordinal:3},{attempt_ordinal:5},{run_id:"6ff9b41f6f7f"},
  {host_id:"OTHER_HOST"}
 ]) assert.throws(()=>permit.verifyReadOnly(f.sign({...f.p,...change}),f.trust,f.ctx,{now:f.now}));
});
test("existing historical nonces or missing nonce cannot be replayed",()=>{
 const f=fixture();
 for(const nonce of ["b3a312063716dce0f59b145c7d89fc1e3fb1aa53dc23d17e59934ba873ff6d93",
  "c8f4bd197ef422f3694f39adc6fcb8a3b67af06a897fe75c219728e40fb13bc0",
  "bad",null])assert.throws(()=>permit.verifyReadOnly(f.sign({...f.p,nonce}),f.trust,f.ctx,{now:f.now}));
});
test("wrong Permit domain and tampered signature fail closed",()=>{
 const f=fixture();
 assert.throws(()=>permit.verifyReadOnly(f.sign(f.p,
  "GEOX_MCFT_CAP09_ISOLATED_RETRY_PERMIT_ATTEMPT3_V2\n"),f.trust,f.ctx,{now:f.now}),/SIGNATURE_INVALID/);
 const env=f.sign();env.signature_base64=Buffer.alloc(64).toString("base64");
 assert.throws(()=>permit.verifyReadOnly(env,f.trust,f.ctx,{now:f.now}),/SIGNATURE_INVALID/);
});
test("each bound digest is mandatory and tied to external verified evidence",()=>{
 const f=fixture();
 for(const k of permit.BINDINGS){
  const c={...f.ctx,[k]:"f".repeat(64)};
  assert.throws(()=>permit.verifyReadOnly(f.sign(),f.trust,c,{now:f.now}),/BINDING_MISMATCH/);
 }
});
test("changed source identity, unclean tree and wrong scope reject",()=>{
 const f=fixture();
 assert.throws(()=>permit.verifyReadOnly(f.sign(),f.trust,{...f.ctx,subject_sha:"b".repeat(40)},{now:f.now}));
 assert.throws(()=>permit.verifyReadOnly(f.sign(),f.trust,{...f.ctx,protected_main_sha:"b".repeat(40)},{now:f.now}));
 assert.throws(()=>permit.verifyReadOnly(f.sign(),f.trust,{...f.ctx,source_clean:false},{now:f.now}));
 assert.throws(()=>permit.verifyReadOnly(f.sign({...f.p,scope:"PRODUCTION"}),f.trust,f.ctx,{now:f.now}));
 assert.throws(()=>permit.verifyReadOnly(f.sign({...f.p,production_authorized:true}),f.trust,f.ctx,{now:f.now}));
});
test("expired, insufficient budget or exceeding adoption/resource expiry reject",()=>{
 const f=fixture();
 assert.throws(()=>permit.verifyReadOnly(f.sign(),f.trust,f.ctx,{now:f.now+700000}));
 assert.throws(()=>permit.verifyReadOnly(f.sign(),f.trust,{...f.ctx,total_stage_budget_ms:900000},{now:f.now}),/BUDGET/);
 assert.throws(()=>permit.verifyReadOnly(f.sign(),f.trust,{...f.ctx,resource_owner_expires_at:new Date(f.now+200000).toISOString()},{now:f.now}));
 assert.throws(()=>permit.verifyReadOnly(f.sign(),f.trust,{...f.ctx,adoption_expires_at:new Date(f.now+200000).toISOString()},{now:f.now}));
});
test("revocation, false issuer, wrong role and altered fingerprint reject",()=>{
 const f=fixture();
 for(const changes of [{revoked:true},{role:"INDEPENDENT_RETRY_GOVERNANCE"},
  {spki_sha256:"f".repeat(64)},{issuer_id:"OTHER"}]){
  const trust=structuredClone(f.trust);Object.assign(trust.issuers[0],changes);
  assert.throws(()=>permit.verifyReadOnly(f.sign(),trust,f.ctx,{now:f.now}));
 }
});
test("no Permit signer or ledger/dispatch functions are exposed",()=>{
 assert(!Object.keys(permit).some(k=>/^(sign|issue|consume|execute|dispatch)$/i.test(k)));
 assert.equal(permit.PARENT,"72dc0304a21a");
 assert.equal(permit.FAILED_PREDECESSOR,"6ff9b41f6f7f");
});

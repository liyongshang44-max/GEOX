"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),crypto=require("node:crypto");
const fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const atomic=require("./MCFT_CAP09_R4285_PERMIT_ATOMIC_V1.cjs");
const execution=require("./MCFT_CAP09_R4285_EXECUTION_APPROVAL_V1.cjs");
const lineage=require("../governance_acceptance/MCFT_CAP09_R4285_SIGNED_EVIDENCE_GATE_V1.cjs");
const sha=b=>crypto.createHash("sha256").update(b).digest("hex");
function execFixture(){
 const kp=crypto.generateKeyPairSync("ed25519");
 const now=Date.now(),subject_sha="a".repeat(40),nonce="d".repeat(64);
 const trust={schema_version:"geox_mcft_cap09_retry_trust_v1",host_id:lineage.HOST,
  operator_id:"TESTONLY",issuers:[{issuer_id:"TESTONLY",key_id:"ED25519_TEST",
   role:"ACCOUNTABLE_SINGLE_OPERATOR",revoked:false,
   not_before:new Date(now-10000).toISOString(),not_after:new Date(now+300000).toISOString(),
   public_key_pem:kp.publicKey.export({type:"spki",format:"pem"}),
   spki_sha256:sha(kp.publicKey.export({type:"spki",format:"der"}))}]};
 const context={subject_sha,host_id:lineage.HOST,nonce,
  permit_envelope_sha256:"a".repeat(64),adoption_envelope_sha256:"b".repeat(64),
  cto_decision_sha256:"c".repeat(64)};
 const p={schema_version:"MCFT_CAP09_R4285_PHYSICAL_EXECUTION_APPROVAL_V1",
  issuer_id:"TESTONLY",key_id:"ED25519_TEST",run_id:lineage.RUN,
  parent_run_id:lineage.ORIGINAL_PARENT,failed_predecessor_run_id:lineage.PREV,
  attempt_ordinal:4,...context,scope:"ISOLATED_QUALIFICATION_TEST_ONLY",
  decision:"APPROVE_R4285_SINGLE_PHYSICAL_SIX_STAGE_EXECUTION",
  issued_at:new Date(now-1000).toISOString(),expires_at:new Date(now+240000).toISOString(),
  production_authorized:false};
 const sign=(payload=p,domain=execution.DOMAIN)=>({payload,signature_base64:crypto.sign(
  null,Buffer.from(domain+lineage.canonical(payload)),kp.privateKey).toString("base64")});
 return {trust,context,p,sign,now};
}
test("R4285 physical execution uses an independent Ed25519 domain",()=>{
 const f=execFixture();
 const result=execution.verify(f.sign(),f.trust,f.context,{now:f.now});
 assert.equal(result.production_authorized,false);
 assert.equal(execution.assertVerified(result,{...f.context,run_id:lineage.RUN,
  adoption_digest:f.context.adoption_envelope_sha256}),true);
});
test("execution approval refuses fake token, source/parent/predecessor/Permit mismatch",()=>{
 const f=execFixture(),proof=execution.verify(f.sign(),f.trust,f.context,{now:f.now});
 assert.throws(()=>execution.assertVerified({...proof},{...f.context,run_id:lineage.RUN,adoption_digest:f.context.adoption_envelope_sha256}),/VERIFIED_CAPABILITY/);
 for(const change of [{parent_run_id:lineage.PREV},{failed_predecessor_run_id:lineage.ORIGINAL_PARENT},
  {attempt_ordinal:5},{subject_sha:"f".repeat(40)},{permit_envelope_sha256:"f".repeat(64)},
  {scope:"PRODUCTION"},{production_authorized:true}]){
  assert.throws(()=>execution.verify(f.sign({...f.p,...change}),f.trust,f.context,{now:f.now}));
 }
});
test("separate execute decision, revoked signer, expired window and signature reject",()=>{
 const f=execFixture();
 assert.throws(()=>execution.verify(f.sign({...f.p,decision:"NOT_APPROVED"}),f.trust,f.context,{now:f.now}));
 assert.throws(()=>execution.verify(f.sign(),f.trust,f.context,{now:f.now+500000}));
 assert.throws(()=>execution.verify(f.sign(f.p,"GEOX_MCFT_CAP09_R4285_ISOLATED_TEST_PERMIT_V1\n"),
  f.trust,f.context,{now:f.now}),/BAD_SIGNATURE/);
 f.trust.issuers[0].revoked=true;
 assert.throws(()=>execution.verify(f.sign(),f.trust,f.context,{now:f.now}));
});
test("fresh run and nonce slots exist independently, old V2 run slot is not a reusable success",()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"r4285-once-"));
 try{
  const nonce="e".repeat(64),locations=atomic.assertUnreserved(root,nonce);
  assert.equal(path.basename(locations.run),"run-"+lineage.RUN);
  assert.equal(path.basename(locations.nonce),"nonce-"+nonce);
  fs.mkdirSync(locations.nonce);
  assert.throws(()=>atomic.assertUnreserved(root,nonce),/ALREADY_RESERVED/);
  assert.throws(()=>atomic.prepare({nativeAdoption:{status:"FAKE"},permitProof:{status:"FAKE"},
   trust:{ledger_root:root},sourceRoot:root}),/NATIVE_ADOPTION_REQUIRED/);
  assert.throws(()=>atomic.consumeForQualifiedHost({status:"FAKE"},{}),/PREPARED_CAPABILITY_REQUIRED/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test("no issuer, signer, retry, reset, restore, deletion or stage launch is exported",()=>{
 for(const name of Object.keys(atomic))assert(!/sign|issue|reset|restore|delete|retry|dispatch/i.test(name));
 assert.equal(atomic.RUN,lineage.RUN);
});

"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const g=require("./MCFT_CAP09_ADOPTION_V2_ATTEMPT3_ENGINEERING_GATE_V1.cjs");
const h=x=>crypto.createHash("sha256").update(x).digest("hex");
const now=Date.parse("2026-10-28T12:00:00.000Z");
const scopeSha="f".repeat(40),sealedSha="a".repeat(64),inventorySha="b".repeat(64);
function policies(){
 const formal=Array.from({length:54},(_,i)=>({check_id:"FORMAL_"+i,check_revision:"LOCAL_QCP_DEFINITION_SHA256",allow_not_applicable:false}));
 return {qcp:{checks:[...formal.map(x=>({check_id:x.check_id,owner:"fixture"})),...g.ENGINEERING_IDS.map(x=>({check_id:x,owner:"fixture"}))]},
  policy:{schema:"CAP09_OFFLINE_ADOPTION_TRUST_V1",checks:formal,allowed_not_applicable_ids:[
  "V13_PRODUCER_DRIVEN_QUALIFICATION","END_TO_END_EVIDENCE_SUPPLY_DEADLINE",
  "EXACT_ONE_PRODUCTION_OWNER","FORMAL_V5_ACTIVATION","V13_RUNTIME_HARNESS_RESOLVER_MIGRATION"]}};
}
function signedReview(){
 const {publicKey,privateKey}=crypto.generateKeyPairSync("ed25519");
 const pem=publicKey.export({format:"pem",type:"spki"});
 const trust={schema_version:"geox_mcft_cap09_retry_trust_v1",host_id:"LAPTOP-STN2A2P1",operator_id:"test_operator",issuers:[{
  issuer_id:"test_operator",key_id:"fixture_ed25519",role:"ACCOUNTABLE_SINGLE_OPERATOR",revoked:false,
  not_before:"2026-10-28T00:00:00.000Z",not_after:"2026-10-29T00:00:00.000Z",
  public_key_pem:pem,spki_sha256:h(publicKey.export({format:"der",type:"spki"}))
 }]};
 const payload={schema_version:"MCFT_CAP09_ATTEMPT3_LINEAGE_REVIEW_V1",issuer_id:"test_operator",key_id:"fixture_ed25519",
  run_id:g.RUN,parent_run_id:g.PARENT,attempt_ordinal:3,baseline_main_sha:g.BASELINE,
  subject_sha:scopeSha,host_id:"LAPTOP-STN2A2P1",scope:"TEST_ONLY",production_authorized:false,
  historical_consumed_receipt_sha256:g.HISTORIC_CONSUMED_SHA,sealed_failure_sha256:sealedSha,
  all_attempts_inventory_sha256:inventorySha,all_attempts_reviewed:true,
  issued_at:"2026-10-28T11:00:00.000Z",expires_at:"2026-10-28T13:00:00.000Z",
  decision:"APPROVED_TEST_ONLY_LINEAGE_NOT_PERMIT"};
 const sign=p=>({payload:p,signature_base64:crypto.sign(null,Buffer.from(g.DOMAIN+g.canonical(p)),privateKey).toString("base64")});
 return {trust,payload,sign,envelope:sign(payload)};
}
function context(){return {subjectSha:scopeSha,hostId:"LAPTOP-STN2A2P1",now,sealedFailureSha:sealedSha,attemptsInventorySha:inventorySha};}
test("QCP64 / Formal54 / exactly ten technical-only IDs map without granting Adoption",()=>{
 const {qcp,policy}=policies();const m=g.mapAdoptionV2(qcp,policy);
 assert.equal(m.total_checks,64);assert.equal(m.formal_checks,54);assert.equal(m.technical_only_checks,10);
 assert.equal(m.status,"DEFINITIONS_ONLY_NOT_ADOPTION");assert.equal(m.adoption_authorized,false);
});
test("reject altered, missing or duplicated QCP definitions and changed NA semantics",()=>{
 const {qcp,policy}=policies();
 for(const edit of [
  q=>q.checks.pop(),
  q=>q.checks[63].check_id="INVENTED_TECHNICAL_CHECK",
  q=>q.checks[63].check_id=q.checks[62].check_id,
  q=>q.checks[0].check_id="INVENTED_FORMAL_CHECK"
 ]){const changed=structuredClone(qcp);edit(changed);assert.throws(()=>g.mapAdoptionV2(changed,policy));}
 const altered=structuredClone(policy);altered.allowed_not_applicable_ids.pop();
 assert.throws(()=>g.mapAdoptionV2(qcp,altered));
});
test("purpose-specific Ed25519 lineage review is verifiable but never a Permit",()=>{
 const r=signedReview(),v=g.verifyLineageReview(r.envelope,r.trust,context());
 assert.equal(v.status,"SIGNED_ATTEMPT3_LINEAGE_VERIFIED_NOT_ADOPTION_OR_PERMIT");
 assert.equal(v.production_authorized,false);
});
test("lineage signature cannot be carried to changed subject, parent, ordinal, host or baseline",()=>{
 const r=signedReview();
 for(const [k,v] of [["subject_sha","e".repeat(40)],["parent_run_id",g.SECOND],["attempt_ordinal",2],
  ["host_id","other_host"],["baseline_main_sha","1".repeat(40)],["run_id",g.SECOND],
  ["scope","PRODUCTION"],["production_authorized",true]]){
  assert.throws(()=>g.verifyLineageReview({...r.envelope,payload:{...r.payload,[k]:v}},r.trust,context()),k);
 }
});
test("lineage signing payload requires sealed failure plus all attempts; rejects fake approvals",()=>{
 const r=signedReview();
 for(const [k,v] of [["sealed_failure_sha256","c".repeat(64)],["all_attempts_inventory_sha256","d".repeat(64)],
  ["all_attempts_reviewed",false],["decision","APPROVED"],["historical_consumed_receipt_sha256","e".repeat(64)]]){
  assert.throws(()=>g.verifyLineageReview(r.sign({...r.payload,[k]:v}),r.trust,context()),k);
 }
});
test("reject invalid signature, wrong domain, revoked issuer, missing reviewer and wrong key",()=>{
 const r=signedReview();
 assert.throws(()=>g.verifyLineageReview({...r.envelope,signature_base64:Buffer.alloc(64).toString("base64")},r.trust,context()));
 const altered=structuredClone(r.trust);altered.issuers[0].revoked=true;
 assert.throws(()=>g.verifyLineageReview(r.envelope,altered,context()));
 altered.issuers[0].revoked=false;altered.issuers[0].spki_sha256="0".repeat(64);
 assert.throws(()=>g.verifyLineageReview(r.envelope,altered,context()));
 const altered2=structuredClone(r.trust);altered2.issuers=[];
 assert.throws(()=>g.verifyLineageReview(r.envelope,altered2,context()));
});
test("reject expired review, cross-user operator key, and current subject equal to original baseline",()=>{
 const r=signedReview();
 assert.throws(()=>g.verifyLineageReview(r.envelope,r.trust,{...context(),now:Date.parse("2026-10-28T14:00:00.000Z")}));
 assert.throws(()=>g.verifyLineageReview(r.envelope,{...r.trust,operator_id:"other"},context()));
 assert.throws(()=>g.verifyLineageReview(r.envelope,r.trust,{...context(),subjectSha:g.BASELINE}));
});
test("consumed receipt must be byte-identical and correctly bound to run/nonce, time, subject",()=>{
 const d=fs.mkdtempSync(path.join(os.tmpdir(),"cap09-attempt3-"));
 try{
  const nonce="c".repeat(64),rn=path.join(d,"run-"+g.SECOND),nn=path.join(d,"nonce-"+nonce);
  fs.mkdirSync(rn);fs.mkdirSync(nn);
  const receipt={schema_version:"geox_mcft_cap09_consumed_permit_v1",
   status:"CONSUMED_NO_AUTOMATIC_RETRY",execute_authorized:false,
   payload:{run_id:g.SECOND,parent_run_id:g.PARENT,attempt_ordinal:2,
    subject_sha:"2b63652297bb285f21c4d4c63c37d247d009142c",host_id:"LAPTOP-STN2A2P1",
    nonce,issued_at:"2026-10-23T18:57:09.731Z",expires_at:"2026-10-24T11:32:31.410Z"},
   consumed_at:"2026-10-24T03:47:53.269Z",
   envelope_sha256:"a".repeat(64),trust_sha256:"b".repeat(64)};
  const bytes=Buffer.from(JSON.stringify(receipt)+"\n"),sum=h(bytes);
  const rp=path.join(rn,"CONSUMED.json"),np=path.join(nn,"CONSUMED.json");
  fs.writeFileSync(rp,bytes);fs.writeFileSync(np,bytes);
  const v=g.verifyConsumedTwins(rp,np,sum);assert.equal(v.cryptographic_signature_reverified,false);
  assert.throws(()=>g.verifyConsumedTwins(rp,np)); // fixture is NOT the immutable historic receipt
  fs.appendFileSync(np," ");assert.throws(()=>g.verifyConsumedTwins(rp,np,sum));
  fs.writeFileSync(np,bytes);
  receipt.consumed_at="2026-10-25T03:47:53.269Z";
  const changed=Buffer.from(JSON.stringify(receipt)+"\n");
  fs.writeFileSync(rp,changed);fs.writeFileSync(np,changed);
  assert.throws(()=>g.verifyConsumedTwins(rp,np,h(changed)));
 }finally{fs.rmSync(d,{recursive:true,force:true});}
});
test("synthetic signed fixture cannot claim engineering gate readiness without real host ledger",()=>{
 const {qcp,policy}=policies(),r=signedReview();
 assert.throws(()=>g.assessEngineeringGate({qcp,policy,review:r.envelope,trust:r.trust,
  runReceiptFile:"/this-file-does-not-exist",nonceReceiptFile:"/this-file-does-not-exist",
  ...context()}));
});
test("actual checked-out QCP65 maps only 54 Formal and 11 technical-only definitions",()=>{
 const root=path.resolve(__dirname,"../..");
 const current=JSON.parse(fs.readFileSync(path.join(root,"docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json"),"utf8"));
 const policy=JSON.parse(fs.readFileSync(path.join(root,"scripts/cap09_adoption_v1/offline-trust.json"),"utf8"));
 const mapped=g.mapAdoptionV2(current,policy);
 assert.equal(mapped.total_checks,65);assert.equal(mapped.formal_checks,54);
 assert.equal(mapped.technical_only_checks,11);assert.equal(mapped.adoption_authorized,false);
 const mutant=structuredClone(current);
 mutant.checks[mutant.checks.length-1].check_id="UNKNOWN";
 assert.throws(()=>g.mapAdoptionV2(mutant,policy));
});

test("historic 13-path composite is not current 16-path source qualification; Composer signatures cannot transfer",()=>{
 const cp=require("node:child_process");
 const scoped=require("./VERIFY_MCFT_CAP09_3747_INHERITED_SCOPE_V1.cjs");
 const head=cp.execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim();
 const v=scoped.technical({head,base:g.BASELINE,
   check_id:"DA9_CURRENT_COMPOSER_PHASE3_SIGNATURE_SUCCESSOR_QCP_TEST_ONLY_V1"});
 assert.equal(v.status,"PASS");
 assert.equal(v.scope,"PR_3747_SOURCE_PRESERVATION_ONLY");
 assert.equal(v.exact_current_delta_paths,16);
 assert.equal(v.historical_composite_exact_path_verifier_unchanged,true);
 assert.equal(v.historical_da9_semantic_verifier_unchanged,true);
 assert.equal(v.historical_composite_13_path_check_not_replayed,true);
 assert.equal(v.historical_composite_current_head_qualification_claimed,false);
 assert.equal(v.composer_successor_scope_changed,true);
 assert.equal(v.historic_composer_signature_transfer_authorized,false);
 assert.equal(v.historical_frozen_v13_failure_preserved,true);
 assert.equal(v.permit_authorized,false);
 assert.equal(v.adoption_authorized,false);
 assert.throws(()=>scoped.technical({head,base:"63dc3382f879781c604a852c7d1b28af9b0dd9f4"}),
   /HOLD_3747_EXACT_BASE_REQUIRED/);
 assert.throws(()=>scoped.technical({head:"f".repeat(40),base:g.BASELINE}),
   /HOLD_3747_EXACT_HEAD_REQUIRED/);
 assert.throws(()=>scoped.technical({head,base:g.BASELINE,check_id:"CAP09_ADOPTION_V2_ATTEMPT3_ENGINEERING_GATE_TEST_ONLY"}),
   /HOLD_3747_UNSCOPED_CHECK/);
});

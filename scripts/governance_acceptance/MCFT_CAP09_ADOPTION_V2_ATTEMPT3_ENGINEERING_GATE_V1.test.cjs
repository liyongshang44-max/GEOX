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

test("current Phase3 94-blob native qualification cannot inherit a stale Run or modified dependency",()=>{
 const cp=require("node:child_process");
 const scoped=require("./VERIFY_MCFT_CAP09_3747_INHERITED_SCOPE_V1.cjs");
 const root=path.resolve(__dirname,"../..");
 const head=cp.execFileSync("git",["rev-parse","HEAD"],{cwd:root,encoding:"utf8"}).trim();
 const q=JSON.parse(fs.readFileSync(path.join(root,
   "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json"),"utf8"));
 const graph=q.dependency_resolvers.PHASE3_EVIDENCE_RUNTIME_FOUNDATION;
 assert.equal(graph.kind,"EXACT_PATH_SET");
 assert.equal(graph.paths.length,94);
 // Native positive proof is exercised against GitHub event and pinned
 // 94-blob qualified #3743 source; no custom synthetic positive event.
 if(process.env.GITHUB_ACTIONS!=="true"||
    process.env.GITHUB_EVENT_NAME!=="pull_request") return;
 const event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,"utf8"));
 const decision={check_id:"PHASE3_EVIDENCE_RUNTIME_FOUNDATION",
   dependency_digest:"sha256:8af6025cd4be03227ed06a39f8f5f7fc51cdc862f3e12319fcb318e00864f145",
   changed_dependencies:[]};
 const input={decision,stage:"SUCCESSOR_SUBJECT_PRE_MERGE",head,base:g.BASELINE,event};
 const local=scoped.phase3Local(input);
 assert.equal(local.exact_dependency_count,94);
 assert.equal(local.original_historical_digest_still_invalid,true);
 assert.equal(local.adoption_authorized,false);
 assert.equal(local.permit_authorized,false);
 assert.equal(local.status,"PASS_SOURCE_BLOBS_ONLY_NOT_NATIVE_ADOPTION");
 const badDigest=structuredClone(input);
 badDigest.decision.dependency_digest=
   "sha256:d5d1cf09c4cde3b0fe82e658d9af2b25fe5beccee1a582d40ba00349fab8534b";
 assert.throws(()=>scoped.phase3Local(badDigest),/HOLD_3747_PHASE3_CURRENT_DIGEST/);
 const changed=structuredClone(input);
 changed.decision.changed_dependencies=["apps/server/src/external_evidence/modified.ts"];
 assert.throws(()=>scoped.phase3Local(changed),/HOLD_3747_PHASE3_CHANGED_DEPENDENCY/);
 const changedHead=structuredClone(input); changedHead.head="a".repeat(40);
 assert.throws(()=>scoped.phase3Local(changedHead),/HOLD_3747_EXACT_HEAD_REQUIRED/);
 const wrongBase=structuredClone(input);
 wrongBase.base="63dc3382f879781c604a852c7d1b28af9b0dd9f4";
 assert.throws(()=>scoped.phase3Local(wrongBase),/HOLD_3747_PHASE3_BASE/);
});

test("current composer 108-blob evidence stays source-only and rejects drift",()=>{
 const cp=require("node:child_process");
 const scoped=require("./VERIFY_MCFT_CAP09_3747_INHERITED_SCOPE_V1.cjs");
 const root=path.resolve(__dirname,"../..");
 const head=cp.execFileSync("git",["rev-parse","HEAD"],{cwd:root,encoding:"utf8"}).trim();
 if(process.env.GITHUB_ACTIONS!=="true"||
    process.env.GITHUB_EVENT_NAME!=="pull_request")return;
 const event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,"utf8"));
 for(const id of scoped.COMPOSER_CHECKS){
   const input={decision:{check_id:id,changed_dependencies:[]},
     stage:"SUCCESSOR_SUBJECT_PRE_MERGE",head,base:g.BASELINE,event};
   const verified=scoped.composerLocal(input);
   assert.equal(verified.status,"PASS_BLOBS_ONLY_NOT_FORMAL_ADOPTION");
   assert.equal(verified.exact_catalog_paths,108);
   assert.equal(verified.historical_frozen_requalified,false);
   assert.equal(verified.adoption_authorized,false);
   assert.equal(verified.permit_authorized,false);
 }
 const input={decision:{check_id:scoped.COMPOSER_CHECKS[0],changed_dependencies:[]},
   stage:"SUCCESSOR_SUBJECT_PRE_MERGE",head,base:g.BASELINE,event};
 for(const fn of [
   x=>{x.base="63dc3382f879781c604a852c7d1b28af9b0dd9f4";},
   x=>{x.head="a".repeat(40);},
   x=>{x.decision.changed_dependencies=["apps/server/unknown.ts"];},
   x=>{x.decision.check_id="PHASE3_EVIDENCE_RUNTIME_FOUNDATION";}
 ]){
   const bad=structuredClone(input);fn(bad);
   assert.throws(()=>scoped.composerLocal(bad));
 }
});

test("DA9 six original Ed25519 signatures survive but do not authorize current #3747 Adoption",()=>{
 const cp=require("node:child_process");
 const scoped=require("./VERIFY_MCFT_CAP09_3747_INHERITED_SCOPE_V1.cjs");
 const root=path.resolve(__dirname,"../..");
 const head=cp.execFileSync("git",["rev-parse","HEAD"],{cwd:root,encoding:"utf8"}).trim();
 const input={decision:{check_id:scoped.DA9_FORMAL_ID},
   stage:"SUCCESSOR_SUBJECT_PRE_MERGE",head,base:g.BASELINE};
 const historic=scoped.da9HistoricalLocal(input);
 assert.equal(historic.status,"HISTORICAL_SIX_ED25519_VERIFIED_NOT_CURRENT_FORMAL_ADOPTION");
 assert.equal(historic.original_operator_signature_count,6);
 assert.equal(historic.original_signed_composer_blob,
   "2d1f72d92c05093537774285bda5b7200845344d");
 assert.equal(historic.current_new_purpose_signature_present,false);
 assert.equal(historic.adoption_authorized,false);
 assert.equal(historic.permit_authorized,false);
 for(const fn of [
   x=>{x.decision.check_id="PHASE7_PRIVATE_CANDIDATE_PROMOTION_COMPOSITION";},
   x=>{x.base="2162f368899e9a9b5c497d332859e4196f389660";},
   x=>{x.head="f".repeat(40);}
 ]){
   const bad=structuredClone(input);fn(bad);
   assert.throws(()=>scoped.da9HistoricalLocal(bad));
 }
});

test("owner-directed purpose-specific QCP approval rejects forged identity, edits, head drift and authority expansion",()=>{
 const cp=require("node:child_process");
 const scoped=require("./VERIFY_MCFT_CAP09_3747_INHERITED_SCOPE_V1.cjs");
 const head=cp.execFileSync("git",["rev-parse","HEAD"],
   {cwd:path.resolve(__dirname,"../.."),encoding:"utf8"}).trim();
 const policy=scoped.ownerQcpApprovalText(head);
 assert(policy.startsWith(scoped.OWNER_QCP_APPROVAL_V1+"\n"));
 assert(policy.includes("CURRENT_QCP65_SOURCE_ADMISSION_APPROVED=true"));
 for(const field of [
   "ADOPTION_V2_SIGNED_ACCEPTANCE_AUTHORIZED=false",
   "PERMIT_V2_ISSUE_OR_CONSUME_AUTHORIZED=false",
   "PRODUCTION_AUTHORIZED=false",
   "INDEPENDENT_ED25519_REVIEW_REQUIRED_FOR_THIS_SOURCE_QCP_SCOPE=false",
   "ORIGINAL_FORMAL_SIX_STAGES=0"
 ])assert(policy.includes(field));
 const comment={id:123456,user:{login:"liyongshang44-max",type:"User"},
   author_association:"OWNER",body:policy,
   html_url:"https://github.com/liyongshang44-max/GEOX/pull/3747#issuecomment-123456",
   created_at:"2026-10-28T10:20:00Z",updated_at:"2026-10-28T10:20:00Z"};
 const commitDate="2026-10-28T10:15:00Z";
 const verified=scoped.ownerQcpApprovalValidate(comment,head,commitDate);
 assert.equal(verified.status,"OWNER_DIRECTED_CURRENT_HEAD_SOURCE_QCP_APPROVAL_VALID");
 assert.equal(verified.adoption_v2_authorized,false);
 assert.equal(verified.permit_v2_authorized,false);
 const negatives=[
   c=>c.user.login="other",
   c=>c.user.type="Bot",
   c=>c.author_association="COLLABORATOR",
   c=>c.body=c.body.replace("CURRENT_QCP65_SOURCE_ADMISSION_APPROVED=true",
      "CURRENT_QCP65_SOURCE_ADMISSION_APPROVED=false"),
   c=>c.body=c.body.replace("PERMIT_V2_ISSUE_OR_CONSUME_AUTHORIZED=false",
      "PERMIT_V2_ISSUE_OR_CONSUME_AUTHORIZED=true"),
   c=>c.body=c.body.replace(head,"f".repeat(40)),
   c=>c.updated_at="2026-10-28T10:21:00Z",
   c=>c.created_at="2026-10-28T10:10:00Z",
   c=>c.html_url="https://github.com/example/other/pull/3747#issuecomment-123456",
   c=>c.id=123457,
 ];
 for(const mutate of negatives){const altered=structuredClone(comment);mutate(altered);
   assert.throws(()=>scoped.ownerQcpApprovalValidate(altered,head,commitDate));}
 assert.throws(()=>scoped.ownerQcpApprovalText("f"),/HOLD_OWNER_QCP_HEAD_FORMAT/);
});

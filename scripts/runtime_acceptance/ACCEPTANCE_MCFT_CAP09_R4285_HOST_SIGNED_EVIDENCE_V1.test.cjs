"use strict";
/* No signed operational inputs, fake Provider or authority are used here. */
const test=require("node:test"),assert=require("node:assert/strict"),crypto=require("node:crypto");
const fs=require("node:fs"),path=require("node:path"),os=require("node:os"),cp=require("node:child_process");
const gate=require("../governance_acceptance/MCFT_CAP09_R4285_SIGNED_EVIDENCE_GATE_V1.cjs");
const host=require("./MCFT_CAP09_R4285_HOST_SIGNED_EVIDENCE_PREFLIGHT_V1.cjs");
const sha=b=>crypto.createHash("sha256").update(b).digest("hex");
function fakeSigner(){
 const kp=crypto.generateKeyPairSync("ed25519");
 const start=new Date(Date.now()-2000).toISOString(),end=new Date(Date.now()+120000).toISOString();
 const trust={schema_version:"geox_mcft_cap09_retry_trust_v1",host_id:gate.HOST,operator_id:"TEST_ONLY_OPERATOR",
  issuers:[{issuer_id:"TEST_ONLY_OPERATOR",key_id:"TEST_ONLY_KEY",role:"ACCOUNTABLE_SINGLE_OPERATOR",
   revoked:false,not_before:new Date(Date.now()-60000).toISOString(),
   not_after:new Date(Date.now()+180000).toISOString(),
   public_key_pem:kp.publicKey.export({format:"pem",type:"spki"}),
   spki_sha256:sha(kp.publicKey.export({format:"der",type:"spki"}))}]};
 const ctx={subject_sha:gate.HISTORIC_SUBJECT,host_id:gate.HOST,
  predecessor_sha256:"1".repeat(64),sealed_failure_sha256:"2".repeat(64),
  attempts_inventory_sha256:"3".repeat(64),fullchain_attestation_sha256:"4".repeat(64),
  now:Date.now()};
 const p={schema_version:"MCFT_CAP09_R4285_PURPOSE_SPECIFIC_LINEAGE_V1",
  issuer_id:"TEST_ONLY_OPERATOR",key_id:"TEST_ONLY_KEY",run_id:gate.RUN,
  failed_predecessor_run_id:gate.PREV,parent_run_id:"72dc0304a21a",
  attempt_ordinal:4,subject_sha:ctx.subject_sha,host_id:gate.HOST,
  scope:"ISOLATED_QUALIFICATION_TEST_ONLY",production_authorized:false,
  decision:"APPROVE_R4285_LINEAGE_NOT_ADOPTION_OR_PERMIT",
  prior_consumed_sha256:ctx.predecessor_sha256,prior_failure_sha256:ctx.sealed_failure_sha256,
  all_attempts_inventory_sha256:ctx.attempts_inventory_sha256,all_attempts_reviewed:true,
  receipt_ingress_sha256:gate.RCP.ingress[1],
  receipt_s3_io_sha256:gate.RCP.s3_io[1],receipt_pg_s3_sha256:gate.RCP.pg_s3[1],
  historical_fullchain_attestation_sha256:ctx.fullchain_attestation_sha256,
  issued_at:start,expires_at:end};
 const sign=v=>({payload:v,signature_base64:crypto.sign(null,
  Buffer.from(gate.DOMAIN+gate.canonical(v)),kp.privateKey).toString("base64")});
 return {p,ctx,trust,sign};
}
test("R4285 only accepts a true matching Ed25519 lineage envelope in its own domain",()=>{
 const {p,ctx,trust,sign}=fakeSigner();
 const v=gate.verifySignedLineage(sign(p),trust,ctx);
 assert.equal(v.status,"R4285_LINEAGE_SIGNED_VERIFIED_NOT_ADOPTION_NOT_PERMIT");
 assert.equal(v.permit_consumed,false);
 assert.equal(v.execute_authorized,false);
});
test("incorrect Ed25519 signature or old Attempt-3 run fails closed",()=>{
 const {p,ctx,trust,sign}=fakeSigner();
 const invalid=sign(p);invalid.signature_base64=Buffer.alloc(64).toString("base64");
 assert.throws(()=>gate.verifySignedLineage(invalid,trust,ctx),/SIGNATURE_INVALID/);
 assert.throws(()=>gate.verifySignedLineage(sign({...p,run_id:gate.PREV}),trust,ctx));
});
test("wrong or missing attempt ordinal never defaults to Attempt-4",()=>{
 const {p,ctx,trust,sign}=fakeSigner();
 for(const attempt_ordinal of [null,3,0,3.5,"4"])
  assert.throws(()=>gate.verifySignedLineage(sign({...p,attempt_ordinal}),trust,ctx));
});
test("expired, revoked, unapproved and production scope fails closed",()=>{
 const {p,ctx,trust,sign}=fakeSigner();
 assert.throws(()=>gate.verifySignedLineage(sign({...p,expires_at:new Date(ctx.now-1).toISOString()}),trust,ctx));
 assert.throws(()=>gate.verifySignedLineage(sign({...p,scope:"PRODUCTION"}),trust,ctx));
 assert.throws(()=>gate.verifySignedLineage(sign({...p,production_authorized:true}),trust,ctx));
 trust.issuers[0].revoked=true;
 assert.throws(()=>gate.verifySignedLineage(sign(p),trust,ctx));
});
test("changed signed R4285 resource digest or changed attempted inventory fails",()=>{
 const {p,ctx,trust,sign}=fakeSigner();
 assert.throws(()=>gate.verifySignedLineage(sign({...p,receipt_pg_s3_sha256:"f".repeat(64)}),trust,ctx));
 assert.throws(()=>gate.verifySignedLineage(sign(p),trust,{...ctx,attempts_inventory_sha256:"e".repeat(64)}));
});
test("old Attempt-3 dual ledger must agree byte-exact, and cannot be reopened",()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"r4285-ledger-"));
 try{
  const nonce="a".repeat(64),one=path.join(root,"run-"+gate.PREV),two=path.join(root,"nonce-"+nonce);
  fs.mkdirSync(one);fs.mkdirSync(two);
  const obj={schema_version:"geox_mcft_cap09_consumed_permit_attempt3_v2",
   run_id:gate.PREV,subject_sha:gate.HISTORIC_SUBJECT,status:"CONSUMED_NO_AUTOMATIC_RETRY",
   production_authorized:false,nonce,envelope_sha256:"b".repeat(64)};
  const bytes=Buffer.from(JSON.stringify(obj)+"\n");
  const a=path.join(one,"CONSUMED.json"),b=path.join(two,"CONSUMED.json");
  fs.writeFileSync(a,bytes);fs.writeFileSync(b,bytes);
  assert.equal(gate.verifyPredecessor(a,b,sha(bytes)).run_id,gate.PREV);
  fs.writeFileSync(b,Buffer.from("tampered"));
  assert.throws(()=>gate.verifyPredecessor(a,b,sha(bytes)),/NONCE_BYTES_CHANGED/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test("Host accepts only --preflight-only plus exact absolute input; never --execute",()=>{
 const abs=path.resolve("/tmp/review.json");
 assert.deepEqual(host.parse(["--preflight-only","--input",abs]),{input:abs});
 for(const argv of [[],["--execute","--input",abs],["--preflight-only","--input","relative.json"],
   ["--preflight-only","--input",abs,"--execute"]])
   assert.throws(()=>host.parse(argv));
});
test("Host forbids CI, Linux, injected Node runtime, and unsigned evidence",()=>{
 assert.throws(()=>host.reviewSignedHostPrerequisite({}, {platform:"linux",environment:{}}),/WINDOWS_HOST_ONLY/);
 assert.throws(()=>host.reviewSignedHostPrerequisite({}, {platform:"win32",environment:{CI:"1"}}),/HOST_NOT_CI/);
 assert.throws(()=>host.reviewSignedHostPrerequisite({}, {platform:"win32",environment:{NODE_PATH:"malicious"}}),/INJECTED_RUNTIME/);
 assert.throws(()=>host.reviewSignedHostPrerequisite(null, {platform:"win32",environment:{}}),/EVIDENCE_REQUIRED/);
});
test("Host does not accept extra permit, stage or authority input",()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"r4285-input-"));
 try{
  const input=path.join(root,"review.json");
  fs.writeFileSync(input,JSON.stringify({signed_evidence:{},execute:true}));
  assert.throws(()=>host.readInput(input),/INPUT_FIELDS/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test("only original native Full-chain verifier with 23 exact source files can be reused",()=>{
 const src=fs.readFileSync(path.resolve(__dirname,"../governance_acceptance/MCFT_CAP09_R4285_SIGNED_EVIDENCE_GATE_V1.cjs"),"utf8");
 assert(src.includes("MCFT_CAP09_NONAUTHORIZED_FULL_CHAIN_PROOF_GATE_V1.cjs"));
 assert(src.includes("subjectSha:HISTORIC_SUBJECT"));
 assert(src.includes("native.SOURCE_PATHS.length===23"));
 assert(!src.includes("DROP SCHEMA"));
});
test("no module exposes signing, Permit consumption, stage launch or physical mutation",()=>{
 for(const x of [gate,host])for(const k of Object.keys(x))
  assert(!/(^sign$|^issue$|consumeForQualifiedHost|dispatchConsumedStage|^execute$|provision|delete)/i.test(k),k);
 assert(host.HOLD.includes("ADOPTION_OWNER_PERMIT_LEDGER_AND_CHILD_CAPABILITY_NOT_IMPLEMENTED"));
 assert.equal(host.RUN,gate.RUN);
});
test("command line refuses execution; immutable HOLD cannot fabricate six stage PASS",()=>{
 const script=path.resolve(__dirname,"MCFT_CAP09_R4285_HOST_SIGNED_EVIDENCE_PREFLIGHT_V1.cjs");
 const r=cp.spawnSync(process.execPath,[script,"--execute","--input",path.resolve("none.json")],
  {encoding:"utf8"});
 assert.notEqual(r.status,0);
 const data=JSON.parse(r.stderr.trim());
 assert.equal(data.status,"HOLD_R4285_HOST_SIGNED_EVIDENCE_NOT_ADMITTED");
 assert.equal(data.stage_count,0);
 assert.equal(data.permit_consumed,false);
});

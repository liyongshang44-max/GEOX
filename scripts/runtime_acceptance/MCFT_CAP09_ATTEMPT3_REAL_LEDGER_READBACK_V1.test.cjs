"use strict";
// No real execution here. Test verifier fail-closed against absent and corrupted
// evidence, without producing artificial "physical-stage PASS" claims.
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),os=require("node:os");
const audit=require("./MCFT_CAP09_ATTEMPT3_REAL_LEDGER_READBACK_V1.cjs");
const sha="a".repeat(40),runId="6ff9b41f6f7f";
test("exact six real stage artifact filenames and no authorized verifier exports",()=>{
 assert.equal(audit.EXPECTED.length,6);
 assert.equal(new Set(audit.EXPECTED).size,6);
 assert.equal(audit.sign,undefined);
 assert.equal(audit.dispatch,undefined);
 assert.equal(audit.consumePermit,undefined);
});
test("read-only receipt audit requires all four exact and absolute CLI fields",()=>{
 const argv=["--ledger-root",path.resolve("/tmp/cap09-audit-ledger"),
 "--output-root",path.resolve("/tmp/cap09-audit-artifacts"),
 "--run-id",runId,"--subject-sha",sha];
 const v=audit.cli(argv);assert.equal(v.runId,runId);
 for(const a of [argv.slice(0,-2),argv.concat(["--run-id",runId]),
  ["--unknown","x",...argv.slice(2)]])assert.throws(()=>audit.cli(a));
});
test("physical PASS cannot be inferred from empty synthetic ledger",()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"cap09-audit-test-"));
 try{
  const ledgerRoot=path.join(dir,"ledger"),outputRoot=path.join(dir,"output");
  fs.mkdirSync(ledgerRoot);fs.mkdirSync(outputRoot);
  assert.throws(()=>audit.verify({ledgerRoot,outputRoot,runId,subjectSha:sha}));
  fs.mkdirSync(path.join(ledgerRoot,"run-"+runId));
  assert.throws(()=>audit.verify({ledgerRoot,outputRoot,runId,subjectSha:sha}));
  fs.writeFileSync(path.join(ledgerRoot,"run-"+runId,"CONSUMED.json"),JSON.stringify({
   schema_version:"geox_mcft_cap09_consumed_permit_attempt3_v2",
   status:"CONSUMED_NO_AUTOMATIC_RETRY",run_id:runId,subject_sha:sha,
   nonce:"b".repeat(64),envelope_sha256:"c".repeat(64),
   execute_authorized:false,production_authorized:false}));
  assert.throws(()=>audit.verify({ledgerRoot,outputRoot,runId,subjectSha:sha}));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test("six-stage synthetic fixture verifies receipt-integrity algorithm only, rejects tampering",()=>{
 const crypto=require("node:crypto");
 const canonical=require("../governance_acceptance/MCFT_CAP09_ADOPTION_V2_ATTEMPT3_ENGINEERING_GATE_V1.cjs").canonical;
 const scheduler=require("./MCFT_CAP09_SIX_STAGE_SCHEDULER_V1.cjs");
 const digest=b=>crypto.createHash("sha256").update(b).digest("hex");
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"cap09-audit-SYNTHETIC-"));
 const ledgerRoot=path.join(dir,"ledger"),outputRoot=path.join(dir,"output");
 const r=path.join(ledgerRoot,"run-"+runId),nonce="c".repeat(64);
 try{
  fs.mkdirSync(ledgerRoot);fs.mkdirSync(outputRoot);fs.mkdirSync(r);
  fs.mkdirSync(path.join(ledgerRoot,"nonce-"+nonce));
  const consumed={schema_version:"geox_mcft_cap09_consumed_permit_attempt3_v2",
   run_id:runId,subject_sha:sha,nonce,envelope_sha256:"b".repeat(64),
   status:"CONSUMED_NO_AUTOMATIC_RETRY",execute_authorized:false,production_authorized:false};
  const consumedBytes=Buffer.from(JSON.stringify(consumed)+"\n");
  fs.writeFileSync(path.join(r,"CONSUMED.json"),consumedBytes);
  fs.writeFileSync(path.join(ledgerRoot,"nonce-"+nonce,"CONSUMED.json"),consumedBytes);
  const key=crypto.generateKeyPairSync("ed25519");
  fs.writeFileSync(path.join(r,"STAGE_V2_PUBLIC_KEY.pem"),
   key.publicKey.export({type:"spki",format:"pem"}));
  const receipts=[];let prev=digest(consumedBytes);
  for(let i=0;i<6;i++){
   const id=scheduler.STAGES[i],stageRoot=path.join(r,id);
   fs.mkdirSync(stageRoot);fs.mkdirSync(path.join(r,"SPENT_V2_"+id));
   const script=path.join(dir,"synthetic-"+id+".js");
   fs.writeFileSync(script,"// SYNTHETIC TEST ONLY\n");
   const ticketPath=path.join(r,"STAGE_TICKET_V2_"+id+".json");
   const p={schema_version:"geox_mcft_cap09_host_stage_capability_attempt3_v2",
    id,ordinal:i,run_id:runId,nonce,subject_sha:sha,envelope_sha256:consumed.envelope_sha256,
    previous_sha256:prev,script_sha256:digest(fs.readFileSync(script)),parent_pid:42};
   const sig=crypto.sign(null,Buffer.from("GEOX_MCFT_CAP09_HOST_STAGE_ATTEMPT3_V2\n"+canonical(p)),
    key.privateKey).toString("base64");
   fs.writeFileSync(ticketPath,JSON.stringify({payload:p,signature_base64:sig}));
   const claimPath=path.join(r,"SPENT_V2_"+id,"CLAIMED.json");
   fs.writeFileSync(claimPath,JSON.stringify({schema_version:"geox_mcft_cap09_child_stage_claim_attempt3_v2",
    id,run_id:runId,nonce,parent_pid:42,ticket_sha256:digest(fs.readFileSync(ticketPath))}));
   const artifactPath=path.join(outputRoot,audit.EXPECTED[i]);
   fs.writeFileSync(artifactPath,JSON.stringify({status:"SYNTHETIC_FIXTURE_NOT_PHYSICAL"}));
   const started={schema_version:"geox_mcft_cap09_stage_started_v1",id,
    previous_sha256:prev,command:{args:[script]},started_at:"2026-10-28T12:00:00.000Z"};
   const startBytes=Buffer.from(JSON.stringify(started));
   fs.writeFileSync(path.join(stageRoot,"STARTED.json"),startBytes);
   fs.writeFileSync(path.join(stageRoot,"stdout.log"),"SYNTHETIC FIXTURE\n");
   fs.writeFileSync(path.join(stageRoot,"stderr.log"),"");
   const ended={schema_version:"geox_mcft_cap09_stage_completed_v1",id,status:"PASS",
    qualification_pass:false,claim_valid:true,claim_present:true,artifact_present:true,
    started_sha256:digest(startBytes),previous_sha256:prev,
    expected_child_claim:claimPath,claim_sha256:digest(fs.readFileSync(claimPath)),
    stdout_sha256:digest(fs.readFileSync(path.join(stageRoot,"stdout.log"))),
    stderr_sha256:digest(fs.readFileSync(path.join(stageRoot,"stderr.log"))),
    expected_artifact:artifactPath,artifact_sha256:digest(fs.readFileSync(artifactPath)),
    completed_at:"2026-10-28T12:00:01.000Z",elapsed_ms:1000,exit_code:0,timed_out:false};
   const endBytes=Buffer.from(JSON.stringify(ended));
   fs.writeFileSync(path.join(stageRoot,"COMPLETED.json"),endBytes);
   prev=digest(endBytes);
   receipts.push({id,receipt_sha256:prev,artifact_sha256:ended.artifact_sha256});
  }
  fs.writeFileSync(path.join(r,"SIX_STAGE_AUDIT.json"),JSON.stringify({
   schema_version:"geox_mcft_cap09_six_stage_audit_v1",stage_count:6,
   status:"SIX_STAGE_EVIDENCE_SEALED_NOT_AUTHORITY",qualified:false,formal_v5_arm:false,
   final_receipt_sha256:prev,stages:receipts}));
  const v=audit.verify({ledgerRoot,outputRoot,runId,subjectSha:sha});
  assert.equal(v.stage_count,6);
  assert.equal(v.permit_signature_rechecked,false);
  assert.equal(v.provider_science_qualified,false);
  assert.equal(v.production_authorized,false);
  fs.appendFileSync(path.join(outputRoot,audit.EXPECTED[4]),"\nTAMPER");
  assert.throws(()=>audit.verify({ledgerRoot,outputRoot,runId,subjectSha:sha}),
   /AUDIT_ARTIFACT_HASH_CHANGED/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

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

"use strict";
/* No Windows resources, signatures or physical stages are activated here. */
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const host=require("./MCFT_CAP09_R4285_WINDOWS_HOST_V2.cjs");
const atomic=require("./MCFT_CAP09_R4285_PERMIT_ATOMIC_V2.cjs");
const stage=require("./MCFT_CAP09_R4285_STAGE_CAPABILITY_V2.cjs");
const parent=require("./MCFT_CAP09_R4285_PARENT_STAGE_DISPATCH_V2.cjs");
const v1host=require("./MCFT_CAP09_R4285_WINDOWS_HOST_V1.cjs");
const builder=require("./MCFT_CAP09_R4285_BUILD_ADMISSION_V2.cjs");
const native=require("../cap09_adoption_v1/MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V2.cjs");
const newPermit=require("./MCFT_CAP09_R4285_PERMIT_V2.cjs");
const child=require("./MCFT_CAP09_R4285_CHILD_STAGE_V1.cjs");
const scheduler=require("./MCFT_CAP09_SIX_STAGE_SCHEDULER_V1.cjs");
test("V2 has genuine three-mode runnable Host entrypoint and original six-stage dispatcher",()=>{
 assert.deepEqual(host.parse(["--readiness-only","--input","/tmp/readiness.json"]).mode,"--readiness-only");
 assert.deepEqual(host.parse(["--preflight-only","--input","/tmp/preflight.json"]).mode,"--preflight-only");
 assert.deepEqual(host.parse(["--execute","--input","/tmp/execute.json"]).mode,"--execute");
 assert.equal(typeof host.execute,"function");
 assert.equal(typeof builder.buildAdmissionV2,"function");
 assert.equal(typeof native.checkQcp72,"function");
 assert(newPermit.BINDINGS.includes("qcp72_raw_sha256"));
 assert(!newPermit.BINDINGS.includes("qcp71_raw_sha256"));
 assert.equal(typeof host.preflight,"function");
 assert.equal(typeof host.readiness,"function");
 assert.equal(typeof parent.dispatchConsumedStageR4285,"function");
 assert.deepEqual(stage.STAGES,scheduler.STAGES);
 assert.deepEqual(stage.STAGES,Object.keys(child.SCRIPT));
 assert.equal(typeof scheduler.executeSixStages,"function");
});
test("V2 readiness is never the signed Preflight, and extra flags fail closed",()=>{
 assert.throws(()=>host.parse(["--ready","--input","/tmp/x"]),/V2_CLI_MODE_INPUT_REQUIRED/);
 assert.throws(()=>host.parse(["--execute"]),/V2_CLI_MODE_INPUT_REQUIRED/);
 assert.throws(()=>host.parse(["--execute","--input","relative"]),/V2_CLI_MODE_INPUT_REQUIRED/);
 assert.throws(()=>host.checkInputs({schema_version:"PASS"},"--readiness-only"),/V2_CLI_INPUT_FIELDS/);
 assert.throws(()=>host.checkInputs({schema_version:"PASS"},"--preflight-only"),/V2_CLI_INPUT_FIELDS/);
});
test("V2 atomic backend shares the original V1 run/nonce slot and rejects fake Permit",()=>{
 const nonce="9".repeat(64),root="/tmp/nonexistent-r4285-ledger";
 assert.deepEqual(atomic.slotPaths(root,nonce),require("./MCFT_CAP09_R4285_PERMIT_ATOMIC_V1.cjs").slotPaths(root,nonce));
 assert.throws(()=>atomic.prepare({
  nativeAdoption:{status:"PASS"},permitProof:{status:"PASS"},trust:{},sourceRoot:root
 }),/R4285_ATOMIC_NATIVE_ADOPTION_REQUIRED/);
 assert.throws(()=>atomic.consumeForQualifiedHost({status:"PASS"},{status:"PASS"}),
  /R4285_ATOMIC_PREPARED_CAPABILITY_REQUIRED/);
 assert.throws(()=>stage.initializeStageAuthority({status:"CONSUMED"},{run_id:atomic.RUN},{},
 ),/R4285_ATOMIC_IN_PROCESS_CONSUMED_CAPABILITY_REQUIRED/);
});
test("historical V1 exports remain unchanged; V2 never adds a signer or Permit issuer",()=>{
 for(const name of ["preflight","execute","run"])assert.equal(typeof v1host[name],"function");
 assert(!Object.keys(host).some(k=>/^(issuePermit|signOwner|signPermit|reissueCredential|repairLedger)$/i.test(k)));
});

test("single-process session modes preserve precise schema and old direct execute is not a route",()=>{
 assert.equal(host.parse(["--session-preflight-only","--input","/tmp/preflight.json"]).mode,
  "--session-preflight-only");
 assert.equal(host.parse(["--session-execute","--input","/tmp/execution.json"]).mode,
  "--session-execute");
 assert.deepEqual(host.PENDING_FILES,["resource_readback_file","resource_envelope_file",
  "permit_envelope_file","final_execution_approval_file"]);
 assert.equal(host.SESSION_KEYS.length,host.FULL_KEYS.length+2);
 assert.equal(typeof host.prepareSameProcessSession,"function");
 assert.equal(typeof host.waitForRealOwnerAndSignatures,"function");
 assert(!native.isNativeVerified({status:"NATIVE_R4285_QCP72_ADOPTION_V4_VERIFIED_NOT_PERMIT"}),
  "deserialized Native PASS cannot retain a process-local capability");
});
test("session requires exact predeclared Owner and final paths and rejects old file reuse",()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"r4285-session-negative-"));
 try{
  const data=Object.fromEntries(host.FULL_KEYS.map(k=>[k,path.join(root,k)]));
  Object.assign(data,{first_base:"2026-12-01T00:00:00.000Z",
   cto_intent_comment_id:3757,nonce:"a".repeat(64),resource_scope_sha256:"b".repeat(64)});
  assert.equal(host.checkInputs(data,"--session-preflight-only"),data);
  assert.equal(host.checkInputs(data,"--session-execute"),data);
  host.assertUncollected(data);
  fs.writeFileSync(data.resource_readback_file,"stale");
  assert.throws(()=>host.assertUncollected(data),/V2_SESSION_PREEXISTING_SIGNED_OR_OWNER_FILE/);
  const bad={...data,resource_scope_sha256:"FAKE_PASS"};
  assert.throws(()=>host.checkInputs(bad,"--session-execute"),/V2_CLI_CONTEXT_DIGEST/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test("unsigned raw Owner placeholder does not bypass real observed-at chronology or expiry",()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"r4285-owner-gate-"));
 const file=path.join(root,"readback.json"),now=Date.now(),subject="a".repeat(40);
 const value=(observed)=>({schema_version:"MCFT_CAP09_R4285_RESOURCE_READBACK_V1",
  run_id:"4285c3ce342c",status:"PASS",
  probe_type:"WINDOWS_READ_ONLY_PG_S3_INDEPENDENT_HOST",
  probe_source_sha256:"f".repeat(64),production_authorized:false,
  subject_sha:subject,host_id:"LAPTOP-STN2A2P1",observed_at:new Date(observed).toISOString()});
 try{
  fs.writeFileSync(file,JSON.stringify(value(now-121000)));
  assert.throws(()=>host.rawOwnerGate(file,subject,now-200000,{now}),
   /V2_SESSION_OWNER_120S_EXPIRED/);
  fs.writeFileSync(file,JSON.stringify(value(now-1000)));
  assert.throws(()=>host.rawOwnerGate(file,subject,now,{now}),
   /V2_SESSION_OWNER_PREEXISTS_OR_CLOCK_INVALID/);
  const raw=host.rawOwnerGate(file,subject,now-2000,{now});
  assert.equal(raw.readback.status,"RAW_READBACK_BYTES_MATCH_NOT_AUTHORITY");
  assert.equal(raw.observed_at_ms,now-1000);
  assert.throws(()=>host.rawOwnerGate(file,"b".repeat(40),now-2000,{now}),
   /V2_SESSION_READBACK_SUBJECT/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

"use strict";
/* No Windows resources, signatures or physical stages are activated here. */
const test=require("node:test"),assert=require("node:assert/strict");
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

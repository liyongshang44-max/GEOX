"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const host=require("./MCFT_CAP09_ATTEMPT3_PERMIT_V2_ATOMIC.cjs");
test("V2 stage route is registered but cannot burn a Permit without genuine signed prepare",()=>{
 assert.equal(host.HOST_V2_STAGE_DISPATCH_ADOPTED,true);
 assert.throws(()=>host.consumeForQualifiedHost({}),/A3_V2_SIGNED_PREPARE_REQUIRED/);
 assert.throws(()=>host.assertConsumed({}),/A3_V2_ATOMIC_CONSUMPTION_REQUIRED/);
});
test("unsigned or incomplete host requests cannot reach a filesystem mutation",()=>{
 assert.throws(()=>host.prepare(null),/A3_V2_HOST_ADMISSION_INPUT_REQUIRED/);
 assert.throws(()=>host.prepare({}),/A3_V2_HOST_CONTEXT_REQUIRED/);
});
test("V2 ledger entrypoint is not a CLI and has no signature writer or runtime activation",()=>{
 assert.equal(typeof host.prepare,"function");
 assert.equal(typeof host.consumeForQualifiedHost,"function");
 assert.equal(host.sign,undefined);
 assert.equal(host.executeSixStages,undefined);
 assert.equal(host.runProducer,undefined);
});

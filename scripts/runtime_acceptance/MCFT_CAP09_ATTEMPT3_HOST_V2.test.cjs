"use strict";
/* V2 signed-run bridge boundary tests are non-authorizing and NO-EFFECT.
 * Positive physical stages require a separate Windows host and real signed
 * Permit; CI may not emulate one or forge physical PASS.
 */
const test=require("node:test"),assert=require("node:assert/strict");
const bridge=require("./MCFT_CAP09_ATTEMPT3_HOST_V2.cjs");
const scheduler=require("./MCFT_CAP09_SIX_STAGE_SCHEDULER_V1.cjs");
const atomic=require("./MCFT_CAP09_ATTEMPT3_PERMIT_V2_ATOMIC.cjs");
const c=require("../cap09_adoption_v1/contract.cjs");
test("Attempt-3 Host V2 binds exactly the original six stage identities and names",()=>{
 assert.deepEqual(bridge.STAGES.map(x=>x[0]),scheduler.STAGES);
 assert.equal(new Set(bridge.STAGES.map(x=>x[1])).size,6);
 assert.equal(typeof bridge.execute,"function");
 assert.equal(typeof bridge.checkPreconsume,"function");
 assert.equal(typeof bridge.boundStages,"function");
 assert.equal(bridge.signPermit,undefined);
 assert.equal(bridge.createAdoption,undefined);
 assert.equal(bridge.enableProduction,undefined);
});
test("Attempt-3 signed plan + observed proof must precede ANY side effects",()=>{
 const plan={schema_version:"geox_mcft_cap09_retry_stage_plan_v2",
  stages:scheduler.STAGES.map(id=>({id,timeout_ms:250000}))};
 const observed={real_provider_response_delay_plan:{mode:"real"},real_pipeline_delay_plan:{mode:"real"}};
 const permitEnvelope={payload:{scope:"ISOLATED_QUALIFICATION_SINGLE_ATTEMPT_TEST_ONLY",
  production_authorized:false,run_id:"6ff9b41f6f7f",nonce:"a".repeat(64),
  plan_sha256:c.digest(plan),observations_sha256:c.digest(observed),expires_at:"2030-10-28T20:00:00.000Z"}};
 const admission={adoptionRequest:{material:{}},permitEnvelope,context:{
  plan_sha256:permitEnvelope.payload.plan_sha256,
  observations_sha256:permitEnvelope.payload.observations_sha256
 },trust:{ledger_root:"/nonexistent-cap09-ledger"}};
 const fake={admission,plan,observed,outputRoot:"/nonexistent-cap09-artifact",firstBase:"2030-10-28T20:00:00.000Z",environment:{}};
 assert.throws(()=>bridge.checkPreconsume(fake));
 for(const bad of [
 a=>a.admission.permitEnvelope.payload.scope="PRODUCTION",
 a=>a.admission.permitEnvelope.payload.production_authorized=true,
 a=>a.admission.context.plan_sha256="f".repeat(64),
 a=>a.admission.context.observations_sha256="f".repeat(64),
 a=>a.observed.real_provider_response_delay_plan.mode="mutated",
 a=>a.plan.stages[2].timeout_ms=-1,
 a=>a.plan.stages[0].id="TIMING_1",
 a=>a.admission.permitEnvelope.payload.plan_sha256="a".repeat(64),
 a=>a.admission.permitEnvelope.payload.observations_sha256="a".repeat(64)
 ]){const a=structuredClone(fake);bad(a);assert.throws(()=>bridge.checkPreconsume(a));}
});
test("CI and Linux can never consume Attempt-3 Permit or launch a child",async()=>{
 await assert.rejects(()=>bridge.execute({}),/V2_HOST_WINDOWS_ONLY/);
 assert.throws(()=>atomic.consumeForQualifiedHost({}),/A3_V2_SIGNED_PREPARE_REQUIRED/);
 assert.throws(()=>atomic.assertConsumed({}),/A3_V2_ATOMIC_CONSUMPTION_REQUIRED/);
});

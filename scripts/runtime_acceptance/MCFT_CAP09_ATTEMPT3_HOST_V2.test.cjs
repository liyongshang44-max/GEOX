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

test("current #3748 byte-delta is fully classified; frozen QCP and EA5E2 graph stay unchanged",()=>{
 // Diff classification is a technical review artifact; NEVER Adoption or Permit.
 const cp=require("node:child_process"),path=require("node:path");
 const root=path.resolve(__dirname,"../..");
 const base="d38a5b07a92a63c67fbe2fcc3982ff9b9491e5ac";
 const git=(...args)=>cp.execFileSync("git",["-C",root,...args],{encoding:"utf8",timeout:20000}).trim();
 const head=git("rev-parse","HEAD");
 const lines=git("diff","--name-status",base+".."+head).split(/\r?\n/).filter(Boolean);
 const rows=lines.map(x=>{const [status,file]=x.split("\t");return {status,file};});
 const executionNew=[
  "MCFT_CAP09_ATTEMPT3_CHILD_STAGE_V2.cjs",
  "MCFT_CAP09_ATTEMPT3_CHILD_STAGE_V2.test.cjs",
  "MCFT_CAP09_ATTEMPT3_HOST_V2.cjs",
  "MCFT_CAP09_ATTEMPT3_HOST_V2.test.cjs",
  "MCFT_CAP09_ATTEMPT3_REAL_LEDGER_READBACK_V1.cjs",
  "MCFT_CAP09_ATTEMPT3_REAL_LEDGER_READBACK_V1.test.cjs",
  "MCFT_CAP09_ATTEMPT3_WINDOWS_READONLY_INSPECTION_V1.ps1",
  "MCFT_CAP09_PARENT_STAGE_DISPATCH_V2.cjs",
  "MCFT_CAP09_STAGE_CAPABILITY_V2.cjs",
  "MCFT_CAP09_STAGE_CAPABILITY_V2.test.cjs",
  "RUN_MCFT_CAP09_ATTEMPT3_HOST_V2_WINDOWS.cjs",
  "RUN_MCFT_CAP09_ATTEMPT3_HOST_V2_WINDOWS.test.cjs"
 ].map(x=>"scripts/runtime_acceptance/"+x);
 const inheritedProvenanceNew=[
  "scripts/cap09_adoption_v1/MCFT_CAP09_ADOPTION_V2_POSTMERGE_SOURCE_V1.cjs"
 ];
 const changedExisting=[
  ".github/workflows/mcft-cap09-adoption-v2-attempt3-engineering-v1.yml",
  "scripts/cap09_adoption_v1/MCFT_CAP09_ADOPTION_V2_EVIDENCE_CONSUMER.cjs",
  "scripts/cap09_adoption_v1/MCFT_CAP09_ADOPTION_V2_EVIDENCE_CONSUMER.test.cjs",
  "scripts/cap09_adoption_v1/installed-material.cjs",
  "scripts/cap09_adoption_v1/test-offline-context.cjs",
  "scripts/runtime_acceptance/AGGREGATE_MCFT_CAP_09_V13_EXACT_HEAD_TIMING_MEASUREMENT_V2.ts",
  "scripts/runtime_acceptance/MCFT_CAP09_ATTEMPT3_PERMIT_V2_ATOMIC.cjs",
  "scripts/runtime_acceptance/MCFT_CAP09_ATTEMPT3_PERMIT_V2_ATOMIC.test.cjs",
  "scripts/runtime_acceptance/MCFT_CAP09_REAL_CONTROLLED_DELAY_V1.cjs",
  "scripts/runtime_acceptance/MCFT_CAP09_STAGE_RECEIPTS_V1.cjs",
  "scripts/runtime_acceptance/MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_V1.cjs",
  "scripts/runtime_acceptance/RUN_MCFT_CAP_09_V13_PRODUCER_DRIVEN_LIVE_QUALIFICATION_V2.ts"
 ];
 const wanted=[...executionNew,...inheritedProvenanceNew].map(file=>({status:"A",file}))
  .concat(changedExisting.map(file=>({status:"M",file})))
  .sort((a,b)=>a.file.localeCompare(b.file,"en"));
 assert.deepEqual(rows.sort((a,b)=>a.file.localeCompare(b.file,"en")),wanted,
  "PR3748_UNKNOWN_OR_UNCLASSIFIED_CHANGED_EXECUTION_PATH");
 const frozen=[
  ".github/workflows/mcft-cap-09-ea5e2-runtime-dependency-graph.yml",
  ".github/workflows/mcft-cap-09-qualification-control-plane-v1.yml",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-EVIDENCE-REGISTRY-V1.json",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5E2_RUNTIME_DEPENDENCY_GRAPH_V4.cjs",
  "scripts/governance_acceptance/PLAN_MCFT_CAP_09_CHECK_APPLICABILITY_V1.cjs"
 ];
 const frozenDiff=cp.spawnSync("git",["-C",root,"diff","--exit-code",base+".."+head,"--",...frozen],
  {encoding:"utf8",timeout:20000});
 assert.equal(frozenDiff.status,0,"PR3748_FROZEN_VERIFIER_OR_REGISTRY_BYTES_CHANGED");
 console.log(JSON.stringify({status:"PR3748_EXECUTION_BYTE_DELTA_CLASSIFIED_TEST_ONLY",
  base_sha:base,head_sha:head,changed_paths_count:rows.length,
  added_execution_or_source_provenance:executionNew.length+inheritedProvenanceNew.length,
  modified_existing_sources:changedExisting.length,unchanged_frozen_authority_paths:frozen.length,
  inherited_execution_authority:false,adoption_authorized:false,
  host_authorized:false,permit_authorized:false,original_six_stage_count:0}));
});

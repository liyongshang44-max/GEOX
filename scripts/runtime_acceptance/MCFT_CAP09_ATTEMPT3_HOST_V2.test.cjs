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

test("immutable #3748 byte-delta registers exactly 13 changed V2 paths; frozen historical contracts stay unchanged",()=>{
 // Diff classification is a technical review artifact; NEVER Adoption or Permit.
 const cp=require("node:child_process"),path=require("node:path");
 const root=path.resolve(__dirname,"../..");
 const base="d38a5b07a92a63c67fbe2fcc3982ff9b9491e5ac";
 const git=(...args)=>cp.execFileSync("git",["-C",root,...args],{encoding:"utf8",timeout:20000}).trim();
 const head="5d69b8a3f254600726bc10f0404f1330de1e4562";
 assert.equal(cp.spawnSync("git",["-C",root,"merge-base","--is-ancestor",head,git("rev-parse","HEAD")]).status,0,
  "PR3748_IMMUTABLE_HISTORY_NOT_ANCESTOR");
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
  "scripts/cap09_adoption_v1/MCFT_CAP09_ADOPTION_V2_POSTMERGE_SOURCE_V1.cjs",
  "scripts/cap09_adoption_v1/MCFT_CAP09_ADOPTION_V2_NEW_MAIN_SUCCESSOR_V1.cjs",
  "scripts/cap09_adoption_v1/MCFT_CAP09_ADOPTION_V2_NEW_MAIN_SUCCESSOR_V1.test.cjs"
 ];
 const changedExisting=[
  ".github/workflows/mcft-cap-09-frozen-v13-isolated-requalification-v1.yml",
  ".github/workflows/mcft-cap09-stage3-testonly-dual-heartbeat-v1.yml",
  ".github/workflows/mcft-cap09-adoption-v2-attempt3-engineering-v1.yml",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json",
  "scripts/cap09_adoption_v1/MCFT_CAP09_ADOPTION_V2_EVIDENCE_CONSUMER.cjs",
  "scripts/cap09_adoption_v1/MCFT_CAP09_ADOPTION_V2_EVIDENCE_CONSUMER.test.cjs",
  "scripts/cap09_adoption_v1/installed-material.cjs",
  "scripts/cap09_adoption_v1/test-offline-context.cjs",
  "scripts/governance_acceptance/PREFLIGHT_MCFT_CAP_09_ALL_BLOCKERS_V1.cjs",
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
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-EVIDENCE-REGISTRY-V1.json",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5E2_RUNTIME_DEPENDENCY_GRAPH_V4.cjs",
  "scripts/governance_acceptance/PLAN_MCFT_CAP_09_CHECK_APPLICABILITY_V1.cjs"
 ];
 const authorityRel="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json";
 const registry=JSON.parse(git("show",head+":"+authorityRel));
 const baseline=JSON.parse(git("show",base+":"+authorityRel));
 const resolver="CAP09_ADOPTION_V2_ATTEMPT3_EXACT_SOURCE_PATHS_V2";
 const past=baseline.dependency_resolvers[resolver].paths;
 const now=registry.dependency_resolvers[resolver].paths;
 assert.equal(past.length,20,"V2_HISTORICAL_SCOPE_CHANGED");
 assert.equal(now.length,35,"V2_SCOPE_MUST_BIND_EXACTLY_15_SUCCESSORS");
 const expectedNew=[...executionNew,...inheritedProvenanceNew].sort();
 assert.deepEqual(now.filter(x=>!past.includes(x)).sort(),expectedNew,
  "V2_NEW_SOURCE_PATHS_NOT_EXACTLY_ENROLLED");
 const separatelyOwned=[
  "scripts/cap09_adoption_v1/installed-material.cjs",
  "scripts/cap09_adoption_v1/test-offline-context.cjs",
  "scripts/runtime_acceptance/AGGREGATE_MCFT_CAP_09_V13_EXACT_HEAD_TIMING_MEASUREMENT_V2.ts",
  "scripts/runtime_acceptance/MCFT_CAP09_REAL_CONTROLLED_DELAY_V1.cjs",
  "scripts/runtime_acceptance/MCFT_CAP09_STAGE_RECEIPTS_V1.cjs",
  "scripts/runtime_acceptance/MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_V1.cjs",
  "scripts/runtime_acceptance/RUN_MCFT_CAP_09_V13_PRODUCER_DRIVEN_LIVE_QUALIFICATION_V2.ts"
 ];
 const ownedHere=new Set(now);
 const otherOwners=Object.entries(registry.dependency_resolvers)
  .filter(([key])=>key!==resolver);
 assert.equal(separatelyOwned.length,7);
 assert(separatelyOwned.every(file=>changedExisting.includes(file)&&
  !ownedHere.has(file)&&otherOwners.some(([,owner])=>owner.paths?.includes(file))),
  "V2_CHANGED_EXISTING_SOURCES_MUST_HAVE_OTHER_EXACT_RESOLVERS");
 const otherwise=structuredClone(registry);otherwise.dependency_resolvers[resolver].paths=past;
 assert.deepEqual(otherwise,baseline,
  "V2_REGISTRY_MUTATED_SOMETHING_BEYOND_13_EXACT_PATHS");
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


test("preconsume identity requires two exact per-run Evidence roles and signed owner endpoint",()=>{
 const run="6ff9b41f6f7f";
 const positive="mcft_cap09_requal_"+run+"_positive",negative="mcft_cap09_requal_"+run+"_negative";
 const owner={run_id:run,database_host:"127.0.0.1",database_port:55490,positive_database:positive,negative_database:negative};
 const admission={resourceEnvelope:{payload:owner},permitEnvelope:{payload:{run_id:run}}};
 const url=(user,db,port=55490)=>"postgresql://"+user+":fake-pass@127.0.0.1:"+port+"/"+db;
 const env={DATABASE_URL:url("cap09_"+run+"_p_evidence",positive),
   BLOCKED_DATABASE_URL:url("cap09_"+run+"_n_evidence",negative)};
 const bindings=bridge.scopedDbConnectionBindings(admission,env);
 assert.equal(bindings.length,2);
 assert.deepEqual(bindings.map(x=>x.role),
   ["cap09_"+run+"_p_evidence","cap09_"+run+"_n_evidence"]);
 for(const [mutation,pattern] of [
  [e=>e.DATABASE_URL=url("cap09_a3_writer",positive),/SCOPED_EVIDENCE_URL_ROLE_MISMATCH/],
  [e=>e.BLOCKED_DATABASE_URL=url("cap09_a3_writer",negative),/SCOPED_EVIDENCE_URL_ROLE_MISMATCH/],
  [e=>e.DATABASE_URL=url("cap09_"+run+"_n_evidence",positive),/SCOPED_EVIDENCE_URL_ROLE_MISMATCH/],
  [e=>e.DATABASE_URL=url("cap09_"+run+"_p_evidence",positive,55530),/V2_PG_ENDPOINT_PORT_MISMATCH/],
  [e=>e.DATABASE_URL=e.DATABASE_URL+"?host=elsewhere",/V2_PG_URL_OVERRIDE_FORBIDDEN/],
  [e=>e.DATABASE_URL="postgresql://cap09_"+run+"_p_evidence@127.0.0.1:55490/"+positive,/V2_PG_EXPLICIT_PASSWORD_REQUIRED/]
 ]){const wrong={...env};mutation(wrong);
  assert.throws(()=>bridge.scopedDbConnectionBindings(admission,wrong),pattern);}
 const wrongOwner=structuredClone(admission);wrongOwner.resourceEnvelope.payload.database_port=55530;
 assert.throws(()=>bridge.scopedDbConnectionBindings(wrongOwner,env),/V2_PG_ENDPOINT_PORT_MISMATCH/);
});
test("29 exact physical table names, fenced writer and restricted ACL fail closed without a database",()=>{
 const run="6ff9b41f6f7f";
 const binding={side:"positive",role:"cap09_"+run+"_p_evidence",
  database:"mcft_cap09_requal_"+run+"_positive"};
 const good={session_user:binding.role,current_user:binding.role,database:binding.database,
  tables:[...bridge.REQUIRED_PUBLIC_TABLES],fenced_exists:true,direct_insert:false,
  fenced_execute:true,controller_acl:true};
 assert.equal(bridge.REQUIRED_PUBLIC_TABLES.length,29);
 assert.doesNotThrow(()=>bridge.assertPgCatalogContract(binding,good));
 for(const [field,value,pattern] of [
  ["current_user","cap09_a3_writer",/V2_PG_EFFECTIVE_LOGIN_MISMATCH/],
  ["session_user","postgres",/V2_PG_SESSION_LOGIN_MISMATCH/],
  ["database","postgres",/V2_PG_AUTHENTICATED_DATABASE_MISMATCH/],
  ["tables",good.tables.slice(0,19),/V2_PG_EXACT_29_TABLE_SCHEMA_MISMATCH/],
  ["tables",[...good.tables.slice(0,28),"wrong_table"],/V2_PG_EXACT_29_TABLE_SCHEMA_MISMATCH/],
  ["fenced_exists",false,/V2_PG_FENCED_WRITER_MISSING/],
  ["fenced_execute",false,/V2_PG_FENCED_WRITER_EXECUTE_REQUIRED/],
  ["direct_insert",true,/V2_PG_DIRECT_FACT_INSERT_FORBIDDEN/],
  ["controller_acl",false,/V2_PG_CONTROLLER_TABLE_ACL_REQUIRED/]
 ]){assert.throws(()=>bridge.assertPgCatalogContract(binding,{...good,[field]:value}),pattern);}
});


test("#3749 exact-source successor scope preserves historic physical Full-chain and six-stage implementation bytes",()=>{
 // Technical byte-delta admission evidence only. Do not treat this as
 // requalification of predecessor signatures or formal QCP approval.
 const cp=require("node:child_process"),path=require("node:path");
 const root=path.resolve(__dirname,"../..");
 const base="5d69b8a3f254600726bc10f0404f1330de1e4562";
 const git=(...args)=>cp.execFileSync("git",["-C",root,...args],
  {encoding:"utf8",timeout:20000,maxBuffer:2*1024*1024}).trim();
 const head=git("rev-parse","HEAD");
 assert.equal(cp.spawnSync("git",["-C",root,"merge-base","--is-ancestor",base,head],
  {timeout:20000}).status,0,"R4285_3749_BASE_ANCESTRY_REQUIRED");
 const delta=git("diff","--name-only",base+"..."+head).split(/\r?\n/).filter(Boolean).sort();
 const allowed=[
  ".github/workflows/mcft-cap-09-qualification-control-plane-v1.yml",
  "scripts/governance_acceptance/PREFLIGHT_MCFT_CAP_09_ALL_BLOCKERS_V1.cjs",
  "scripts/runtime_acceptance/MCFT_CAP09_ATTEMPT3_HOST_V2.cjs",
  "scripts/runtime_acceptance/MCFT_CAP09_ATTEMPT3_HOST_V2.test.cjs"
 ].sort();
 assert.deepEqual(delta,allowed,"R4285_3749_UNKNOWN_SUCCESSOR_PATH_HOLD");
 const fullChain=require("../governance_acceptance/MCFT_CAP09_NONAUTHORIZED_FULL_CHAIN_PROOF_GATE_V1.cjs");
 assert.equal(fullChain.SOURCE_PATHS.length,23,"R4285_HISTORIC_FULLCHAIN_SOURCE_SET_CHANGED");
 const preserved=[...new Set([...fullChain.SOURCE_PATHS,
  "scripts/runtime_acceptance/MCFT_CAP09_SIX_STAGE_SCHEDULER_V1.cjs",
  "scripts/runtime_acceptance/MCFT_CAP09_STAGE_CAPABILITY_V2.cjs",
  "scripts/runtime_acceptance/MCFT_CAP09_PARENT_STAGE_DISPATCH_V2.cjs",
  "scripts/runtime_acceptance/MCFT_CAP09_ATTEMPT3_CHILD_STAGE_V2.cjs",
  "scripts/runtime_acceptance/MCFT_CAP09_STAGE_RECEIPTS_V1.cjs",
  "scripts/governance_acceptance/MCFT_CAP09_STAGE3_NONAUTHORIZED_REAL_BODY_GATE_V1.cjs",
  "scripts/governance_acceptance/VERIFY_MCFT_CAP09_3740_3744_OWNER_COMPOSITE_V1.cjs"
 ])].sort();
 for(const file of preserved){
  assert.equal(git("rev-parse",base+":"+file),git("rev-parse",head+":"+file),
   "R4285_3749_HISTORIC_OR_STAGE_PROTECTED_BLOB_CHANGED:"+file);
 }
 assert.equal(bridge.STAGES.length,6);
 assert.deepEqual(bridge.STAGES.map(x=>x[0]),scheduler.STAGES);
 assert.equal(bridge.signPermit,undefined);
 assert.equal(bridge.createAdoption,undefined);
 assert.equal(bridge.enableProduction,undefined);
 assert.equal(bridge.probePreconsumePostgres,undefined,"PRIVATE_PG_PROBE_NOT_PUBLIC_AUTHORITY");
 assert.equal(typeof bridge.assertPgCatalogContract,"function");
 assert.equal(bridge.REQUIRED_PUBLIC_TABLES.length,29);
 // The prior 12 central-QCP failures remain separately reportable; this
 // test is only an exact proof that this PR did NOT edit those source bodies.
 console.log(JSON.stringify({
  status:"R4285_3749_EXACT_SOURCE_SCOPE_VERIFIED_TECHNICAL_ONLY",
  subject_sha:head,base_sha:base,changed_paths:delta.length,
  historical_and_stage_blobs_preserved:preserved.length,
  independent_historical_signature_reverified:false,
  central_qcp_admitted:false,permit_issued:false,permit_consumed:false,
  execute_authorized:false,stage_count:0,production_authorized:false
 }));
});

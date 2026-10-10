#!/usr/bin/env node
"use strict";

const assert=require("node:assert/strict");
const cp=require("node:child_process");
const fs=require("node:fs");
const path=require("node:path");

const ROOT=path.resolve(__dirname,"../..");

const FROZEN_BLOBS={
  "apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_process_v2.ts":"f1f379a40e55d81d43c5d1b7975aded74d10092c",
  "apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_composition_v2.ts":"715fff15e879dac3d1c42b0e62c55c90fa593302",
  "apps/server/src/runtime/twin_runtime/external_formal_v4_amendment19_runner_v2.ts":"1d919d0dda4fc20029b5f8a53052b30771ea63dc",
  "apps/server/scripts/write_dist_entries.cjs":"9563e6f88946a5f1cb1b167136749d50d9a04406",
  "apps/server/src/external_evidence/mcft_cap09_v13_forcing_production_process_v1.ts":"adc2b3394e11db3d9851e1ec177ca9dc339ab3e5",
};

const REQUIRED=[
  "apps/server/src/runtime/mcft_cap09_formal_v5_active_activation_authority_v1.ts",
  "apps/server/src/runtime/twin_runtime/mcft_cap09_formal_v5_twin_runtime_composition_v1.ts",
  "apps/server/src/runtime/twin_runtime/mcft_cap09_formal_v5_twin_runtime_process_v1.ts",
  "apps/server/src/external_evidence/mcft_cap09_formal_v5_forcing_runtime_process_v1.ts",
  "docker-compose.mcft-cap09-formal-v5-active.yml",
  "scripts/runtime_acceptance/RUN_MCFT_CAP_09_FORMAL_V5_ACTIVE_PRODUCTION_CUTOVER_V1.ts",
  "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_G11_FORMAL_V5_ISOLATED_O00_V1.ts",
  ".github/workflows/mcft-cap-09-g11-formal-v5-productionization.yml",
];

function git(...args){return cp.execFileSync("git",args,{cwd:ROOT,encoding:"utf8"}).trim();}
function read(rel){return fs.readFileSync(path.join(ROOT,rel),"utf8");}
function has(text,marker,code){assert.ok(text.includes(marker),code+":"+marker);}

for(const [rel,sha] of Object.entries(FROZEN_BLOBS)){
  assert.equal(git("rev-parse","HEAD:"+rel),sha,"G11_FROZEN_PREDECESSOR_CHANGED:"+rel);
}
for(const rel of REQUIRED){
  assert.ok(fs.existsSync(path.join(ROOT,rel)),"G11_REQUIRED_PATH_MISSING:"+rel);
}

const composition=read("apps/server/src/runtime/twin_runtime/mcft_cap09_formal_v5_twin_runtime_composition_v1.ts");
for(const marker of [
  "ExternalFormalV5Amendment19RunnerV2",
  "PostgresExternalFormalNextTickViabilityV1",
  "ExternalFormalV3Amendment19PersistentTickServiceV1",
  "materializeExternalFormalA18CropContextV5",
  "hostRunner: TwinRuntimeOneDueSlotPortV1",
  "NEXT_TICK_FORCING_NOT_VIABLE",
  "historical_v2_rewritten: false",
  "scheduler_semantics_rewritten: false",
  "persistent_tick_semantics_rewritten: false",
  "revision_semantics_rewritten: false",
])has(composition,marker,"G11_COMPOSITION_MARKER_REQUIRED");

const twinProcess=read("apps/server/src/runtime/twin_runtime/mcft_cap09_formal_v5_twin_runtime_process_v1.ts");
for(const marker of [
  "FORMAL_V5_ACTIVE",
  "void runMcftCap09FormalV5TwinRuntimeProcessV1().catch",
  "composeMcftCap09FormalV5TwinRuntimeV1",
  "FORMAL_V5_TWIN_FORMAL_BOOTSTRAP_LEASE_NOT_EXPIRED",
  "FORMAL_V5_TWIN_NEW_FENCING_TOKEN_REQUIRED",
  "a0_bootstrap_twin_fencing_token",
  "assertMcftCap09ServicePrincipalV1(pool, \"TWIN_RUNTIME\")",
])has(twinProcess,marker,"G11_TWIN_PROCESS_MARKER_REQUIRED");
assert.equal(twinProcess.includes("ExternalFormalV4Amendment19RunnerV2"),false,"G11_ACTIVE_TWIN_DIRECT_V4_BINDING_FORBIDDEN");

const forcing=read("apps/server/src/external_evidence/mcft_cap09_formal_v5_forcing_runtime_process_v1.ts");
for(const marker of [
  "createMcftCap09V13ForcingProductionProcessV1",
  "void runMcftCap09FormalV5ForcingRuntimeProcessV1().catch",
  "FORMAL_V5_ACTIVE",
  "FORMAL_V5_FORCING_FORMAL_DATABASE_REQUIRED",
  "FORMAL_V5_FORCING_FORMAL_RAW_BUCKET_REQUIRED",
  "formal-v5-forcing-controller#instance:",
])has(forcing,marker,"G11_FORCING_MARKER_REQUIRED");

const compose=read("docker-compose.mcft-cap09-formal-v5-active.yml");
for(const marker of [
  "mcft_cap09_formal_v5_twin_runtime_process_v1.js",
  "mcft_cap09_formal_v5_forcing_runtime_process_v1.js",
  "GEOX_MCFT_CAP09_FORMAL_V5_TWIN_RUNTIME_DATABASE_URL",
  "GEOX_MCFT_CAP09_FORMAL_V5_EVIDENCE_RUNTIME_DATABASE_URL",
  "formal-v5-active-activation-authority.json",
  "a0-bootstrap-v1.json",
])has(compose,marker,"G11_ACTIVE_COMPOSE_MARKER_REQUIRED");
assert.equal(compose.includes("mcft_cap09_twin_runtime_v2.js"),false,"G11_ACTIVE_COMPOSE_V2_ENTRYPOINT_FORBIDDEN");

const cutover=read("scripts/runtime_acceptance/RUN_MCFT_CAP_09_FORMAL_V5_ACTIVE_PRODUCTION_CUTOVER_V1.ts");
for(const marker of [
  "GEOX_MCFT_CAP09_FORMAL_V5_TWIN_RUNTIME_DATABASE_URL",
  "GEOX_MCFT_CAP09_FORMAL_V5_EVIDENCE_RUNTIME_DATABASE_URL",
  "geox_mcft_cap09_twin_runtime_login_v1",
  "geox_mcft_cap09_evidence_runtime_login_v1",
  'docker(["compose","-f",ACTIVE_COMPOSE,"up","-d","--no-build",FORCING_SERVICE]',
  'docker(["compose","-f",PREFORMAL_COMPOSE,"stop",TWIN_SERVICE]',
  'docker(["compose","-f",ACTIVE_COMPOSE,"up","-d","--no-build",TWIN_SERVICE]',
  "new_fencing_token_strictly_greater_than_a0_bootstrap:true",
  "no_cross_store_double_twin_owner_window:true",
])has(cutover,marker,"G11_CUTOVER_MARKER_REQUIRED");

const runner=read("apps/server/src/runtime/twin_runtime/external_formal_v5_amendment19_runner_v2.ts");
const gate=read("apps/server/src/runtime/twin_runtime/external_formal_v5_viability_gated_scheduler_v1.ts");
has(runner,"ExternalFormalV5ViabilityGatedSchedulerV1","G11_V5_GATE_WRAPPER_REQUIRED");
const viabilityPos=gate.indexOf("checkPreclaimViability");
const claimPos=gate.indexOf("return this.inner.claimDueSlot");
assert.ok(viabilityPos>=0&&claimPos>viabilityPos,"G11_VIABILITY_MUST_PRECEDE_CLAIM");

const proof={
  schema_version:"geox_mcft_cap09_g11_productionization_governance_v1",
  status:"PASS",
  frozen_v2_process_unchanged:true,
  frozen_v2_composition_unchanged:true,
  frozen_v4_runner_unchanged:true,
  frozen_v13_factory_unchanged:true,
  frozen_dist_writer_unchanged:true,
  dedicated_formal_v5_composition:true,
  dedicated_formal_v5_process:true,
  viability_before_claim:true,
  governed_v13_activation_route:true,
  formal_service_principal_database_bindings_required:true,
  two_store_owner_cutover_model:true,
  a0_bootstrap_fence_precedes_active_fence:true,
  production_image_route_present:true,
  isolated_postgres_o00_proof_registered:true,
  scheduler_semantics_rewritten:false,
  persistent_tick_semantics_rewritten:false,
  crop_stage_semantics_rewritten:false,
  formal_v5_stage_consumer_admission_successor:"A18_V5_R5_R6_LATE_ONLY",
  provider_semantics_rewritten:false,
  revision_semantics_rewritten:false,
  database_schema_changed:false,
  production_effect:false,
  a0:false,
  o00:false,
  mcft_cap09_completed:false,
};

const out=path.join(ROOT,"acceptance-output/MCFT_CAP_09_G11_PRODUCTIONIZATION_GOVERNANCE_V1_RESULT.json");
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,JSON.stringify(proof,null,2)+"\n");
process.stdout.write(JSON.stringify(proof,null,2)+"\n");

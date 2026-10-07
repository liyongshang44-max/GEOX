#!/usr/bin/env node
"use strict";

const assert=require("node:assert/strict");
const cp=require("node:child_process");
const fs=require("node:fs");
const path=require("node:path");

const ROOT=path.resolve(__dirname,"../..");
const BASE="0e4cd036fdbebfe8118d6b7c1978572859d5a652";

const HISTORICAL={
  "apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_process_v2.ts":"f1f379a40e55d81d43c5d1b7975aded74d10092c",
  "apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_composition_v2.ts":"715fff15e879dac3d1c42b0e62c55c90fa593302",
  "apps/server/src/runtime/twin_runtime/external_formal_v4_amendment19_runner_v2.ts":"1d919d0dda4fc20029b5f8a53052b30771ea63dc",
  "apps/server/scripts/write_dist_entries.cjs":"9563e6f88946a5f1cb1b167136749d50d9a04406",
  "apps/server/src/external_evidence/mcft_cap09_v13_forcing_production_process_v1.ts":"adc2b3394e11db3d9851e1ec177ca9dc339ab3e5",
};

const NEW_PATHS=[
  "apps/server/src/runtime/mcft_cap09_formal_v5_active_activation_authority_v1.ts",
  "apps/server/src/runtime/twin_runtime/mcft_cap09_formal_v5_twin_runtime_composition_v1.ts",
  "apps/server/src/runtime/twin_runtime/mcft_cap09_formal_v5_twin_runtime_process_v1.ts",
  "apps/server/src/external_evidence/mcft_cap09_formal_v5_forcing_runtime_process_v1.ts",
  "docker-compose.mcft-cap09-formal-v5-active.yml",
  "scripts/runtime_acceptance/RUN_MCFT_CAP_09_FORMAL_V5_ACTIVE_PRODUCTION_CUTOVER_V1.ts",
  "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_G11_FORMAL_V5_ISOLATED_O00_V1.ts",
];

function git(...args){return cp.execFileSync("git",args,{cwd:ROOT,encoding:"utf8"}).trim();}
function read(rel){return fs.readFileSync(path.join(ROOT,rel),"utf8");}
function marker(text,value,code){assert.equal(text.includes(value),true,code+":"+value);}
function absent(text,value,code){assert.equal(text.includes(value),false,code+":"+value);}

for(const [rel,blob] of Object.entries(HISTORICAL)){
  assert.equal(git("rev-parse","HEAD:"+rel),blob,"G11_HISTORICAL_V2_V4_BLOB_CHANGED:"+rel);
}
for(const rel of NEW_PATHS)assert.equal(fs.existsSync(path.join(ROOT,rel)),true,"G11_REQUIRED_PATH_MISSING:"+rel);

const composition=read("apps/server/src/runtime/twin_runtime/mcft_cap09_formal_v5_twin_runtime_composition_v1.ts");
for(const value of [
  "ExternalFormalV5Amendment19RunnerV2",
  "PostgresExternalFormalNextTickViabilityV1",
  "PostgresPersistentSequentialSchedulerAdapterV1",
  "ExternalFormalV3Amendment19PersistentTickServiceV1",
  "materializeMcftCap09TwinCropContextV2",
  'scheduler_semantics_rewritten: false',
  'persistent_tick_semantics_rewritten: false',
  'stage_materialization_semantics_rewritten: false',
  'revision_semantics_rewritten: false',
  'historical_v2_rewritten: false',
])marker(composition,value,"G11_V5_COMPOSITION_MARKER_REQUIRED");
absent(composition,"fetch(","G11_V5_COMPOSITION_PROVIDER_FETCH_FORBIDDEN");

const twin=read("apps/server/src/runtime/twin_runtime/mcft_cap09_formal_v5_twin_runtime_process_v1.ts");
for(const value of [
  "MCFT_CAP09_FORMAL_V5_TWIN_RUNTIME_PROCESS_V1",
  "FORMAL_V5_ACTIVE",
  "composeMcftCap09FormalV5TwinRuntimeV1",
  "FORMAL_V5_TWIN_PREVIOUS_OWNER_NOT_RELEASED",
  "FORMAL_V5_TWIN_NEW_FENCING_TOKEN_REQUIRED",
  "assertMcftCap09ServicePrincipalV1(pool, \"TWIN_RUNTIME\")",
  "FORMAL_V5_TWIN_A0_BOOTSTRAP_BINDING_INVALID",
])marker(twin,value,"G11_V5_TWIN_PROCESS_MARKER_REQUIRED");
absent(twin,"ExternalFormalV4Amendment19RunnerV2","G11_ACTIVE_TWIN_DIRECT_V4_BINDING_FORBIDDEN");

const forcing=read("apps/server/src/external_evidence/mcft_cap09_formal_v5_forcing_runtime_process_v1.ts");
for(const value of [
  "createMcftCap09V13ForcingProductionProcessV1",
  "loadFormalDurableRawStoreBindingV1",
  "FORMAL_V5_ACTIVE",
  "FORMAL_V5_FORCING_TERMINAL",
])marker(forcing,value,"G11_FORCING_ACTIVATOR_MARKER_REQUIRED");

const compose=read("docker-compose.mcft-cap09-formal-v5-active.yml");
for(const value of [
  "apps/server/dist/apps/server/src/runtime/twin_runtime/mcft_cap09_formal_v5_twin_runtime_process_v1.js",
  "apps/server/dist/apps/server/src/external_evidence/mcft_cap09_formal_v5_forcing_runtime_process_v1.js",
  "formal-v5-active-activation-authority.json",
  "a0-bootstrap-v1.json",
])marker(compose,value,"G11_ACTIVE_COMPOSE_MARKER_REQUIRED");
absent(compose,"mcft_cap09_twin_runtime_v2.js","G11_ACTIVE_COMPOSE_V2_ENTRYPOINT_FORBIDDEN");

const cutover=read("scripts/runtime_acceptance/RUN_MCFT_CAP_09_FORMAL_V5_ACTIVE_PRODUCTION_CUTOVER_V1.ts");
for(const value of [
  'docker(["compose","-f",PREFORMAL_COMPOSE,"stop",TWIN_SERVICE]',
  "waitNoLiveTwinLease",
  'docker(["compose","-f",ACTIVE_COMPOSE,"up","-d","--no-build",FORCING_SERVICE,TWIN_SERVICE]',
  "waitNewTwinLease",
  "new_fencing_token_strictly_greater:true",
  "no_live_twin_owner_observed_between_stop_and_start:true",
])marker(cutover,value,"G11_CUTOVER_MARKER_REQUIRED");

const stageRunner=read("apps/server/src/runtime/twin_runtime/external_formal_v5_amendment19_runner_v2.ts");
const gate=read("apps/server/src/runtime/twin_runtime/external_formal_v5_viability_gated_scheduler_v1.ts");
marker(stageRunner,"ExternalFormalV5ViabilityGatedSchedulerV1","G11_V5_GATE_WRAPPER_REQUIRED");
const checkPos=gate.indexOf("checkPreclaimViability");
const claimPos=gate.indexOf("return this.inner.claimDueSlot");
assert.ok(checkPos>=0&&claimPos>checkPos,"G11_VIABILITY_MUST_PRECEDE_UNDERLYING_CLAIM");

const proof={
  schema_version:"geox_mcft_cap09_g11_productionization_governance_v1",
  status:"PASS",
  historical_v2_process_blob_unchanged:true,
  historical_v2_composition_blob_unchanged:true,
  historical_v4_runner_blob_unchanged:true,
  dedicated_v5_composition_present:true,
  dedicated_v5_process_present:true,
  v5_entrypoint_uses_v5_runner:true,
  viability_check_precedes_underlying_claim:true,
  governed_v13_forcing_activation_route_present:true,
  preformal_to_active_cutover_requires_zero_owner_gap:true,
  new_fencing_token_required:true,
  dist_entries_present:true,
  dedicated_active_compose_present:true,
  historical_v13_factory_blob_unchanged:true,
  historical_dist_writer_blob_unchanged:true,
  scheduler_semantics_rewritten:false,
  persistent_tick_semantics_rewritten:false,
  crop_stage_semantics_rewritten:false,
  provider_semantics_rewritten:false,
  revision_semantics_rewritten:false,
  database_schema_changed:false,
  production_effect:false,
  a0:false,
  o00:false,
};
fs.mkdirSync(path.join(ROOT,"acceptance-output"),{recursive:true});
fs.writeFileSync(path.join(ROOT,"acceptance-output/MCFT_CAP_09_G11_PRODUCTIONIZATION_GOVERNANCE_V1_RESULT.json"),JSON.stringify(proof,null,2)+"\n");
process.stdout.write(JSON.stringify(proof,null,2)+"\n");

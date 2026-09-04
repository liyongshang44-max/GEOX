#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const cp=require("node:child_process");

const EXPECTED_BASE="f605f7e22ad7a4b7605be885ef1328f2b8283b55";
const PREVIOUS_SUCCESSOR_BASE="d67a2b3cce037c1eaad4d7d051d1f6a11eb09fc3";
const ADOPTION_BASE="5050f1c08d2528048c56d56add4cbb068b956925";
const BASE=process.env.MCFT_CAP09_PRODUCTION_TWIN_V2_ROUTING_BASE_SHA;
const expected=[
  ".github/workflows/mcft-cap-09-phase5-production-equivalent-containers.yml",
  ".github/workflows/mcft-cap-09-production-twin-process-v2-routing.yml",
  "apps/server/scripts/write_dist_entries.cjs",
  "apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_process_v2.ts",
  "docker-compose.mcft-cap09-production.yml",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_PRODUCTION_TWIN_PROCESS_V2_ROUTING_V1.cjs",
  "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_PHASE5_PROCESS_BOUNDARY_V1.ts",
  "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_PRODUCTION_LOCAL_TWO_SERVICE_LAUNCHER_V1.ts"
].sort();
const adoptionExpected=[
  ".github/workflows/mcft-cap-09-twin-v2-rolling-stage-authority-resolver-seam-v1.yml",
  "apps/server/src/runtime/twin_runtime/mcft_cap09_current_crop_authority_resolver_v1.test.ts",
  "apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_process_v2.ts",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_PRODUCTION_TWIN_PROCESS_V2_ROUTING_V1.cjs",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_TWIN_V2_ROLLING_STAGE_AUTHORITY_RESOLVER_SEAM_V1.cjs"
].sort();

function fail(code,detail){throw new Error(detail?code+":"+detail:code)}
function eq(a,b,code){if(a!==b)fail(code,"expected="+JSON.stringify(b)+" actual="+JSON.stringify(a))}
function git(){return cp.execFileSync("git",Array.from(arguments),{encoding:"utf8"}).trim()}

const adoption=BASE===ADOPTION_BASE;
const successor=BASE===PREVIOUS_SUCCESSOR_BASE;
if(adoption){
  eq(git("merge-base",ADOPTION_BASE,"HEAD"),ADOPTION_BASE,"PRODUCTION_TWIN_V2_ROUTING_ADOPTION_BASE_NOT_ANCESTOR");
}else if(successor){
  eq(git("merge-base",PREVIOUS_SUCCESSOR_BASE,"HEAD"),PREVIOUS_SUCCESSOR_BASE,"PRODUCTION_TWIN_V2_ROUTING_SUCCESSOR_BASE_NOT_ANCESTOR");
}else{
  eq(BASE,EXPECTED_BASE,"PRODUCTION_TWIN_V2_ROUTING_EXACT_BASE_REQUIRED");
  eq(git("merge-base",EXPECTED_BASE,"HEAD"),EXPECTED_BASE,"PRODUCTION_TWIN_V2_ROUTING_BASE_NOT_ANCESTOR");
}
const diffBase=adoption?ADOPTION_BASE:(successor?PREVIOUS_SUCCESSOR_BASE:EXPECTED_BASE);
const changed=git("diff","--name-only",diffBase+"...HEAD").split(/\r?\n/).filter(Boolean).sort();
if(adoption){
  eq(JSON.stringify(changed),JSON.stringify(adoptionExpected),"PRODUCTION_TWIN_V2_ROUTING_ADOPTION_EXACT_FIVE_FILE_BOUNDARY_REQUIRED");
  for(const frozen of [
    ".github/workflows/mcft-cap-09-phase5-production-equivalent-containers.yml",
    "apps/server/scripts/write_dist_entries.cjs",
    "apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_composition_v2.ts",
    "apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_process_v1.ts",
    "docker-compose.mcft-cap09-production.yml",
    "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_PHASE5_PROCESS_BOUNDARY_V1.ts",
    "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_PRODUCTION_LOCAL_TWO_SERVICE_LAUNCHER_V1.ts",
    "scripts/runtime_acceptance/MCFT_CAP_09_PRODUCTION_RUNTIME_START_ARM_V1.json",
    ".github/workflows/mcft-cap-09-production-runtime-owner-cutover.yml",
    ".github/workflows/mcft-cap-09-production-owner-graduation-gate.yml"
  ]) eq(git("rev-parse","HEAD:"+frozen),git("rev-parse",ADOPTION_BASE+":"+frozen),"PRODUCTION_TWIN_V2_ROUTING_ADOPTION_FROZEN_SURFACE_DRIFT:"+frozen);
}else if(!successor){
  eq(JSON.stringify(changed),JSON.stringify(expected),"PRODUCTION_TWIN_V2_ROUTING_EXACT_EIGHT_FILE_BOUNDARY_REQUIRED");
}else{
  if(!changed.includes("apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_composition_v2.ts")) fail("PRODUCTION_TWIN_V2_ROUTING_SUCCESSOR_COMPOSITION_DELTA_REQUIRED");
  for(const frozen of [
    ".github/workflows/mcft-cap-09-phase5-production-equivalent-containers.yml",
    "apps/server/scripts/write_dist_entries.cjs",
    "apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_process_v2.ts",
    "docker-compose.mcft-cap09-production.yml",
    "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_PHASE5_PROCESS_BOUNDARY_V1.ts",
    "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_PRODUCTION_LOCAL_TWO_SERVICE_LAUNCHER_V1.ts",
    "scripts/runtime_acceptance/MCFT_CAP_09_PRODUCTION_RUNTIME_START_ARM_V1.json"
  ]) eq(git("rev-parse","HEAD:"+frozen),git("rev-parse",PREVIOUS_SUCCESSOR_BASE+":"+frozen),"PRODUCTION_TWIN_V2_ROUTING_SUCCESSOR_DIRECT_ROUTE_DRIFT:"+frozen);
}

const processV2=fs.readFileSync(
  "apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_process_v2.ts","utf8"
);
for(const marker of [
  "MCFT_CAP09_TWIN_RUNTIME_PROCESS_V2",
  "composeMcftCap09TwinRuntimeV2",
  "ExternalFormalV4Am19WindowManifestV2",
  "loadMcftCap09ProductionStageAuthorityMountsV1",
  "MCFT_CAP09_TWIN_RUNTIME_COMPOSITION_V2",
  "materializeExternalFormalA18CropContextV4",
]) if(!processV2.includes(marker)) fail("PRODUCTION_TWIN_V2_ROUTING_PROCESS_MARKER_MISSING",marker);

for(const forbidden of [
  "scripts/runtime_acceptance",
  "GITHUB_RUN_ID",
  "github.event",
  "qualification_lease_owner",
]) if(processV2.includes(forbidden)) fail("PRODUCTION_TWIN_V2_ROUTING_PRODUCT_TEST_SEAM_FORBIDDEN",forbidden);

if(adoption){
  for(const marker of [
    "selectMcftCap09TwinRuntimeCurrentCropAuthorityResolverV2",
    "createStaticMcftCap09CurrentCropAuthorityResolverV1",
    "explicit_resolver?: McftCap09CurrentCropAuthorityResolverPortV1",
    "input?.current_crop_authority_resolver",
    "current_crop_authority_resolver: currentCropAuthorityResolver",
    "STATIC_EXACT_BOUND_SNAPSHOT_DEFAULT_WITH_EXPLICIT_DEPENDENCY_INJECTION_ONLY",
    "production_rolling_authority_env_switch: false",
    "production_registry_path_discovery: false",
  ]) if(!processV2.includes(marker)) fail("PRODUCTION_TWIN_V2_ROUTING_ADOPTION_MARKER_MISSING",marker);
  if(/GEOX_[A-Z0-9_]*(?:REGISTRY|ROLLING)[A-Z0-9_]*/.test(processV2)){
    fail("PRODUCTION_TWIN_V2_ROUTING_ADOPTION_ENV_SWITCH_FORBIDDEN");
  }
  if(processV2.includes("EFFECTIVE_CURRENT_CROP_AUTHORITY_REGISTRY_V1.json")){
    fail("PRODUCTION_TWIN_V2_ROUTING_ADOPTION_REGISTRY_DISCOVERY_FORBIDDEN");
  }
}

const dist=fs.readFileSync("apps/server/scripts/write_dist_entries.cjs","utf8");
for(const marker of [
  'path.join("runtime", "mcft_cap09_twin_runtime.js")',
  "runMcftCap09TwinRuntimeProcessV1",
  'path.join("runtime", "mcft_cap09_twin_runtime_v2.js")',
  "runMcftCap09TwinRuntimeProcessV2",
]) if(!dist.includes(marker)) fail("PRODUCTION_TWIN_V2_ROUTING_DIST_MARKER_MISSING",marker);
if(adoption){
  if(!dist.includes("runMcftCap09TwinRuntimeProcessV2().catch")) fail("PRODUCTION_TWIN_V2_ROUTING_ADOPTION_ZERO_ARGUMENT_ENTRY_REQUIRED");
  if(dist.includes("runMcftCap09TwinRuntimeProcessV2({")) fail("PRODUCTION_TWIN_V2_ROUTING_ADOPTION_PRODUCTION_INJECTION_FORBIDDEN");
}

const compose=fs.readFileSync("docker-compose.mcft-cap09-production.yml","utf8");
if(!compose.includes("apps/server/dist/runtime/mcft_cap09_twin_runtime_v2.js")){
  fail("PRODUCTION_TWIN_V2_ROUTING_COMPOSE_V2_ENTRY_REQUIRED");
}
if(compose.includes("exec node apps/server/dist/runtime/mcft_cap09_twin_runtime.js")){
  fail("PRODUCTION_TWIN_V2_ROUTING_OLD_PRODUCTION_ENTRY_FORBIDDEN");
}
for(const marker of [
  "current-crop-authority.json",
  "biological-stage-architecture-effectiveness.json",
  "read_only: true",
]) if(!compose.includes(marker)) fail("PRODUCTION_TWIN_V2_ROUTING_MOUNT_MARKER_MISSING",marker);

const workflow=fs.readFileSync(
  ".github/workflows/mcft-cap-09-phase5-production-equivalent-containers.yml","utf8"
);
for(const marker of [
  "mcft_cap09_twin_runtime_process_v2.ts",
  "mcft_cap09_twin_runtime_v2.js",
  "runMcftCap09TwinRuntimeProcessV2",
  "composeMcftCap09TwinRuntimeV2",
]) if(!workflow.includes(marker)) fail("PRODUCTION_TWIN_V2_ROUTING_PHASE5_PROOF_MISSING",marker);

for(const historical of [
  "apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_process_v1.ts",
  "apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_composition_v1.ts",
  "apps/server/src/runtime/twin_runtime/external_formal_a18_crop_context_v3.ts",
  "scripts/runtime_acceptance/MCFT_CAP_09_PRODUCTION_RUNTIME_START_ARM_V1.json",
]) if(changed.includes(historical)) fail("PRODUCTION_TWIN_V2_ROUTING_HISTORICAL_OR_ARM_REWRITE_FORBIDDEN",historical);

console.log(JSON.stringify({
  status:"PASS",
  exact_base_sha:diffBase,
  successor_requalification:successor || adoption,
  adoption_qualification:adoption,
  subject_head_sha:git("rev-parse","HEAD"),
  exact_changed_file_count:changed.length,
  production_route:"MCFT_CAP09_TWIN_RUNTIME_PROCESS_V2",
  current_crop_resolver_selection:adoption?"STATIC_DEFAULT_EXPLICIT_INJECTION_ONLY":"PREVIOUS_ROUTE",
  historical_process_v1_preserved:true,
  historical_crop_context_v3_preserved:true,
  production_rolling_authority_activated:false,
  real_runtime_arm_mutated:false,
  runtime_started:false
}));

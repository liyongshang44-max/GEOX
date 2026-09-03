#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const cp=require("node:child_process");

const EXPECTED_BASE="f605f7e22ad7a4b7605be885ef1328f2b8283b55";
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

function fail(code,detail){throw new Error(detail?code+":"+detail:code)}
function eq(a,b,code){if(a!==b)fail(code,"expected="+JSON.stringify(b)+" actual="+JSON.stringify(a))}
function git(){return cp.execFileSync("git",Array.from(arguments),{encoding:"utf8"}).trim()}

eq(BASE,EXPECTED_BASE,"PRODUCTION_TWIN_V2_ROUTING_EXACT_BASE_REQUIRED");
eq(git("merge-base",EXPECTED_BASE,"HEAD"),EXPECTED_BASE,"PRODUCTION_TWIN_V2_ROUTING_BASE_NOT_ANCESTOR");
const changed=git("diff","--name-only",EXPECTED_BASE+"...HEAD").split(/\r?\n/).filter(Boolean).sort();
eq(JSON.stringify(changed),JSON.stringify(expected),"PRODUCTION_TWIN_V2_ROUTING_EXACT_EIGHT_FILE_BOUNDARY_REQUIRED");

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

const dist=fs.readFileSync("apps/server/scripts/write_dist_entries.cjs","utf8");
for(const marker of [
  'path.join("runtime", "mcft_cap09_twin_runtime.js")',
  "runMcftCap09TwinRuntimeProcessV1",
  'path.join("runtime", "mcft_cap09_twin_runtime_v2.js")',
  "runMcftCap09TwinRuntimeProcessV2",
]) if(!dist.includes(marker)) fail("PRODUCTION_TWIN_V2_ROUTING_DIST_MARKER_MISSING",marker);

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
  exact_base_sha:EXPECTED_BASE,
  subject_head_sha:git("rev-parse","HEAD"),
  exact_changed_file_count:changed.length,
  production_route:"MCFT_CAP09_TWIN_RUNTIME_PROCESS_V2",
  historical_process_v1_preserved:true,
  historical_crop_context_v3_preserved:true,
  real_runtime_arm_mutated:false,
  runtime_started:false
}));

#!/usr/bin/env node
"use strict";
const fs=require("node:fs");
const cp=require("node:child_process");

const EXPECTED_BASE="9ed9ffc153b2a616a78a648ad8aa58c5ccf77244";
const BASE=process.env.MCFT_CAP09_TWIN_PROCESS_V2_BASE_SHA;
const expected=[
  ".github/workflows/mcft-cap-09-twin-process-v2-stage-routing.yml",
  "apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_process_v1.ts",
  "apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_stage_authority_preflight_v1.test.ts",
  "apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_stage_authority_preflight_v1.ts",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_TWIN_PROCESS_V2_STAGE_ROUTING_V1.cjs",
  "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_PHASE5_PROCESS_BOUNDARY_V1.ts"
].sort();
function fail(code,detail){throw new Error(detail?code+":"+detail:code)}
function eq(a,b,code){if(a!==b)fail(code,"expected="+JSON.stringify(b)+" actual="+JSON.stringify(a))}
function git(){return cp.execFileSync("git",Array.from(arguments),{encoding:"utf8"}).trim()}

eq(BASE,EXPECTED_BASE,"TWIN_PROCESS_V2_EXACT_BASE_REQUIRED");
eq(git("merge-base",EXPECTED_BASE,"HEAD"),EXPECTED_BASE,"TWIN_PROCESS_V2_BASE_NOT_ANCESTOR");
const changed=git("diff","--name-only",EXPECTED_BASE+"...HEAD").split(/\r?\n/).filter(Boolean).sort();
eq(JSON.stringify(changed),JSON.stringify(expected),"TWIN_PROCESS_V2_EXACT_SIX_FILE_BOUNDARY_REQUIRED");

const processText=fs.readFileSync("apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_process_v1.ts","utf8");
for(const marker of [
  "composeMcftCap09TwinRuntimeV1",
  "composeMcftCap09TwinRuntimeV2",
  "preflightMcftCap09TwinStageAuthorityManifestV1",
  "const host = qualificationLeaseOwner",
  "production_composition: \"MCFT_CAP09_TWIN_RUNTIME_COMPOSITION_V2\"",
]) if(!processText.includes(marker)) fail("TWIN_PROCESS_V2_ROUTING_MARKER_MISSING",marker);

if(
  processText.indexOf("preflightMcftCap09TwinStageAuthorityManifestV1({")
  > processText.indexOf("createDatabasePool(config.database_url)")
) fail("TWIN_PROCESS_V2_PREFLIGHT_AFTER_DATABASE_OPEN_FORBIDDEN");

const preflight=fs.readFileSync("apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_stage_authority_preflight_v1.ts","utf8");
for(const marker of [
  "MCFT_CAP09_TWIN_V4_MANIFEST_DEPLOYMENT_SUBJECT_MISMATCH",
  "MCFT_CAP09_TWIN_V4_MANIFEST_EXACT_24_SLOTS_REQUIRED",
  "MCFT_CAP09_TWIN_V4_MANIFEST_CROP_CONTEXT_MATERIALIZATION_MISMATCH",
  'activation_mode: "PRODUCTION_EFFECTIVE"',
]) if(!preflight.includes(marker)) fail("TWIN_PROCESS_V2_PREFLIGHT_SEMANTIC_MISSING",marker);

console.log(JSON.stringify({
  status:"PASS",
  exact_base_sha:EXPECTED_BASE,
  subject_head_sha:git("rev-parse","HEAD"),
  exact_changed_file_count:changed.length,
  qualification_composition_v1_preserved:true,
  production_composition_v2_bound:true,
  production_preflight_before_database_open:true,
  runtime_started:false
}));

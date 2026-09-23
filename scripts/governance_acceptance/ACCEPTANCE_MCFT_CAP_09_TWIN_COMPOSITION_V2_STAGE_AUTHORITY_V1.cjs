#!/usr/bin/env node
"use strict";
const fs=require("node:fs");
const cp=require("node:child_process");

const EXPECTED_BASE="373e33c54109540a2bdbf1c3a31626b731d5cfc6";
const SUCCESSOR_BASE="d67a2b3cce037c1eaad4d7d051d1f6a11eb09fc3";
const BASE=process.env.MCFT_CAP09_TWIN_V2_STAGE_BASE_SHA;
const expected=[
  ".github/workflows/mcft-cap-09-twin-composition-v2-stage-authority.yml",
  "apps/server/src/domain/twin_runtime/external_formal_prewindow_authority_bundle_v4.test.ts",
  "apps/server/src/domain/twin_runtime/external_formal_prewindow_authority_bundle_v4.ts",
  "apps/server/src/runtime/twin_runtime/external_formal_a18_crop_context_v4.test.ts",
  "apps/server/src/runtime/twin_runtime/external_formal_a18_crop_context_v4.ts",
  "apps/server/src/runtime/twin_runtime/external_formal_v4_amendment19_runner_v2.ts",
  "apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_host_v1.ts",
  "apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_composition_v2.ts",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_TWIN_COMPOSITION_V2_STAGE_AUTHORITY_V1.cjs",
  "scripts/runtime_acceptance/COMPOSE_MCFT_CAP_09_T4R1_CURRENT_CROP_AUTHORITY_V1.cjs",
  "scripts/runtime_acceptance/mcft_cap09_amendment19_formal_manifest_from_stage_authority_v2.test.ts",
  "scripts/runtime_acceptance/mcft_cap09_amendment19_formal_manifest_from_stage_authority_v2.ts"
].sort();

function fail(code,detail){throw new Error(detail?code+":"+detail:code)}
function eq(a,b,code){if(a!==b)fail(code,"expected="+JSON.stringify(b)+" actual="+JSON.stringify(a))}
function git(){return cp.execFileSync("git",Array.from(arguments),{encoding:"utf8"}).trim()}

const successor=BASE===SUCCESSOR_BASE;
if(successor){
  eq(git("merge-base",SUCCESSOR_BASE,"HEAD"),SUCCESSOR_BASE,"TWIN_V2_STAGE_SUCCESSOR_BASE_NOT_ANCESTOR");
}else{
  eq(BASE,EXPECTED_BASE,"TWIN_V2_STAGE_EXACT_BASE_REQUIRED");
  eq(git("merge-base",EXPECTED_BASE,"HEAD"),EXPECTED_BASE,"TWIN_V2_STAGE_BASE_NOT_ANCESTOR");
}
const diffBase=successor?SUCCESSOR_BASE:EXPECTED_BASE;
const changed=git("diff","--name-only",diffBase+"...HEAD").split(/\r?\n/).filter(Boolean).sort();
if(!successor){
  eq(JSON.stringify(changed),JSON.stringify(expected),"TWIN_V2_STAGE_EXACT_TWELVE_FILE_BOUNDARY_REQUIRED");
}else{
  if(!changed.includes("apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_composition_v2.ts")) fail("TWIN_V2_STAGE_SUCCESSOR_COMPOSITION_DELTA_REQUIRED");
  for(const frozen of [
    "apps/server/src/domain/twin_runtime/external_formal_prewindow_authority_bundle_v4.test.ts",
    "apps/server/src/domain/twin_runtime/external_formal_prewindow_authority_bundle_v4.ts",
    "apps/server/src/runtime/twin_runtime/external_formal_a18_crop_context_v4.test.ts",
    "apps/server/src/runtime/twin_runtime/external_formal_a18_crop_context_v4.ts",
    "apps/server/src/runtime/twin_runtime/external_formal_v4_amendment19_runner_v2.ts",
    "apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_host_v1.ts",
    "scripts/runtime_acceptance/COMPOSE_MCFT_CAP_09_T4R1_CURRENT_CROP_AUTHORITY_V1.cjs",
    "scripts/runtime_acceptance/mcft_cap09_amendment19_formal_manifest_from_stage_authority_v2.test.ts",
    "scripts/runtime_acceptance/mcft_cap09_amendment19_formal_manifest_from_stage_authority_v2.ts"
  ]) eq(git("rev-parse","HEAD:"+frozen),git("rev-parse",SUCCESSOR_BASE+":"+frozen),"TWIN_V2_STAGE_SUCCESSOR_FROZEN_AUTHORITY_DRIFT:"+frozen);
}

const v4=fs.readFileSync("apps/server/src/runtime/twin_runtime/external_formal_a18_crop_context_v4.ts","utf8");
for(const marker of [
  "PRODUCTION_EFFECTIVE",
  "EXTERNAL_FORMAL_A18_V4_ARCHITECTURE_EFFECTIVENESS_REQUIRED",
  "EXTERNAL_FORMAL_A18_V4_STAGE_AUTHORITY_FORWARD_WINDOW_EXCEEDED",
  "current_crop_authority_evidence_digest",
]) if(!v4.includes(marker)) fail("TWIN_V2_STAGE_V4_SEMANTIC_MISSING",marker);

const bundle=fs.readFileSync("apps/server/src/domain/twin_runtime/external_formal_prewindow_authority_bundle_v4.ts","utf8");
for(const marker of [
  "buildExternalFormalPrewindowAuthorityBundleV4",
  "EXTERNAL_FORMAL_V4_FUTURE_STAGE_EVIDENCE_FORBIDDEN",
  "EXTERNAL_FORMAL_V4_STAGE_AUTHORITY_FORWARD_WINDOW_EXCEEDED",
]) if(!bundle.includes(marker)) fail("TWIN_V2_STAGE_BUNDLE_SEMANTIC_MISSING",marker);

const composition=fs.readFileSync("apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_composition_v2.ts","utf8");
for(const marker of [
  "MCFT_CAP09_TWIN_RUNTIME_COMPOSITION_V2",
  "materializeExternalFormalA18CropContextV4",
  'activation_mode: "PRODUCTION_EFFECTIVE"',
]) if(!composition.includes(marker)) fail("TWIN_V2_STAGE_COMPOSITION_SEMANTIC_MISSING",marker);

for(const forbidden of [
  "apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_composition_v1.ts",
  "apps/server/src/runtime/twin_runtime/external_formal_a18_crop_context_v3.ts",
]) if(changed.includes(forbidden)) fail("TWIN_V2_STAGE_HISTORICAL_RUNTIME_REWRITE_FORBIDDEN",forbidden);

console.log(JSON.stringify({
  status:"PASS",
  exact_base_sha:successor?SUCCESSOR_BASE:EXPECTED_BASE,
  successor_requalification:successor,
  subject_head_sha:git("rev-parse","HEAD"),
  exact_changed_file_count:changed.length,
  historical_v1_v3_rewritten:false,
  production_process_routing_changed:false,
  runtime_started:false
}));

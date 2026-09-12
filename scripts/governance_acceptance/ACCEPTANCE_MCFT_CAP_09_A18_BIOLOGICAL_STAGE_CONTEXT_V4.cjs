#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),cp=require("node:child_process");
const EXPECTED_BASE="f55dfb2d928d4846f45e808ac2ff3040543a3151", BASE=process.env.MCFT_CAP09_A18_V4_BASE_SHA;
const expected=[
  ".github/workflows/mcft-cap-09-a18-biological-stage-context-v4.yml",
  "apps/server/src/runtime/twin_runtime/external_formal_a18_crop_context_v4.test.ts",
  "apps/server/src/runtime/twin_runtime/external_formal_a18_crop_context_v4.ts",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_A18_BIOLOGICAL_STAGE_CONTEXT_V4.cjs",
  "scripts/runtime_acceptance/PROBE_MCFT_CAP_09_A18_BIOLOGICAL_STAGE_CONTEXT_V4.ts"
].sort();
function fail(c,d){throw new Error(d?c+":"+d:c)};function eq(a,b,c){if(a!==b)fail(c,"expected="+JSON.stringify(b)+" actual="+JSON.stringify(a))}
function git(){return cp.execFileSync("git",Array.from(arguments),{encoding:"utf8"}).trim()}
eq(BASE,EXPECTED_BASE,"A18_V4_EXACT_BASE_REQUIRED");
eq(git("merge-base",EXPECTED_BASE,"HEAD"),EXPECTED_BASE,"A18_V4_BASE_NOT_ANCESTOR");
const changed=git("diff","--name-only",EXPECTED_BASE+"...HEAD").split(/\r?\n/).filter(Boolean).sort();
eq(JSON.stringify(changed),JSON.stringify(expected),"A18_V4_EXACT_FIVE_FILE_BOUNDARY_REQUIRED");
const moduleText=fs.readFileSync("apps/server/src/runtime/twin_runtime/external_formal_a18_crop_context_v4.ts","utf8");
for(const marker of [
 "FORMAL_BIOLOGICAL_STAGE_AUTHORITY_DERIVED_CROP_WATER_USE_CONTEXT_V4",
 "EXTERNAL_FORMAL_A18_V4_PRODUCTION_ACTIVATION_NOT_AUTHORIZED",
 "R5_DENT_OR_LATER_PRE_R6_MODEL_ESTIMATE",
 "WATER_USE_STAGE_LATE_STABLE_FOR_R5_TO_R6_THERMAL_PROGRESSION",
 "LIFECYCLE_ACTIVE_REQUIRES_SEPARATE_VALIDATION",
 "EXTERNAL_FORMAL_A18_V4_CURRENT_KC_MATRIX_MISMATCH"
]) if(!moduleText.includes(marker))fail("A18_V4_REQUIRED_SEMANTIC_MISSING",marker);
if(/stage_code:\s*"MID"/.test(module))fail("A18_V4_HARDCODED_MID_FORBIDDEN");
const workflow=fs.readFileSync(".github/workflows/mcft-cap-09-a18-biological-stage-context-v4.yml","utf8");
for(const forbidden of ["workflow_dispatch:","schedule:","pull_request_target","docker compose up","FORMAL_DATABASE_URL","GEOX_MCFT_CAP09_S6_DATABASE_URL"]){
 if(workflow.includes(forbidden))fail("A18_V4_WORKFLOW_CAPABILITY_FORBIDDEN",forbidden);
}
console.log(JSON.stringify({status:"PASS",exact_base_sha:EXPECTED_BASE,subject_head_sha:git("rev-parse","HEAD"),exact_changed_file_count:changed.length,historical_v3_rewritten:false,production_effect:false}));

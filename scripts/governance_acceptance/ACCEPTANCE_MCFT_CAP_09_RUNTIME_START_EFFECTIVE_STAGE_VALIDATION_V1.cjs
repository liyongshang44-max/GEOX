#!/usr/bin/env node
"use strict";
const fs=require("node:fs");
const cp=require("node:child_process");

const EXPECTED_BASE="571d209e4ce40ce4f94e4acb5331761220513498";
const BASE=process.env.MCFT_CAP09_RUNTIME_START_EFFECTIVE_STAGE_BASE_SHA;
const expected=[
  ".github/workflows/mcft-cap-09-runtime-start-effective-stage-validation-v1.yml",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_RUNTIME_START_EFFECTIVE_STAGE_VALIDATION_V1.cjs",
  "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_PRODUCTION_RUNTIME_START_AUTHORITY_BUILDER_V1.cjs",
  "scripts/runtime_acceptance/BUILD_MCFT_CAP_09_PRODUCTION_RUNTIME_START_AUTHORITY_V1.cjs"
].sort();

function fail(c,d){throw new Error(d?c+":"+d:c)}
function eq(a,b,c){if(a!==b)fail(c,"expected="+JSON.stringify(b)+" actual="+JSON.stringify(a))}
function git(){return cp.execFileSync("git",Array.from(arguments),{encoding:"utf8"}).trim()}

eq(BASE,EXPECTED_BASE,"RUNTIME_START_EFFECTIVE_STAGE_EXACT_BASE_REQUIRED");
eq(git("merge-base",EXPECTED_BASE,"HEAD"),EXPECTED_BASE,"RUNTIME_START_EFFECTIVE_STAGE_BASE_NOT_ANCESTOR");
const changed=git("diff","--name-only",EXPECTED_BASE+"...HEAD").split(/\r?\n/).filter(Boolean).sort();
eq(JSON.stringify(changed),JSON.stringify(expected),"RUNTIME_START_EFFECTIVE_STAGE_EXACT_FOUR_FILE_BOUNDARY_REQUIRED");

const builder=fs.readFileSync("scripts/runtime_acceptance/BUILD_MCFT_CAP_09_PRODUCTION_RUNTIME_START_AUTHORITY_V1.cjs","utf8");
for(const marker of [
  "validateEffectiveStageAuthorities",
  "RUNTIME_START_CURRENT_CROP_AUTHORITY_NOT_EFFECTIVE",
  "RUNTIME_START_CURRENT_CROP_STAGE_AUTHORITY_STALE_AT_A0",
  "RUNTIME_START_CURRENT_CROP_ARCHITECTURE_CERTIFICATE_DIGEST_MISMATCH",
  "RUNTIME_START_BIOLOGICAL_STAGE_ARCHITECTURE_NOT_EFFECTIVE",
  "RUNTIME_START_CURRENT_CROP_LIFECYCLE_HORIZON_EXPIRED"
]) if(!builder.includes(marker))fail("RUNTIME_START_EFFECTIVE_STAGE_BUILDER_MARKER_MISSING",marker);

const acceptance=fs.readFileSync("scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_PRODUCTION_RUNTIME_START_AUTHORITY_BUILDER_V1.cjs","utf8");
for(const marker of [
  "candidate_only_current_crop_rejected",
  "stale_stage_current_crop_rejected",
  "mismatched_architecture_certificate_rejected",
  "current_crop_effectiveness_semantics_required",
  "current_crop_stage_fresh_at_formal_a0_required"
]) if(!acceptance.includes(marker))fail("RUNTIME_START_EFFECTIVE_STAGE_ACCEPTANCE_MARKER_MISSING",marker);

for(const forbidden of [
  "scripts/runtime_acceptance/MCFT_CAP_09_PRODUCTION_RUNTIME_START_ARM_V1.json",
  "docker-compose.mcft-cap09-production.yml"
]) if(changed.includes(forbidden))fail("RUNTIME_START_EFFECTIVE_STAGE_REAL_ACTIVATION_SURFACE_FORBIDDEN",forbidden);

const wf=fs.readFileSync(".github/workflows/mcft-cap-09-runtime-start-effective-stage-validation-v1.yml","utf8");
for(const forbidden of ["workflow_dispatch:","schedule:","pull_request_target","docker compose up","FORMAL_DATABASE_URL"]){
  if(wf.includes(forbidden))fail("RUNTIME_START_EFFECTIVE_STAGE_WORKFLOW_CAPABILITY_FORBIDDEN",forbidden);
}

console.log(JSON.stringify({
  status:"PASS",
  exact_base_sha:EXPECTED_BASE,
  subject_head_sha:git("rev-parse","HEAD"),
  exact_changed_file_count:changed.length,
  real_arm_mutated:false,
  runtime_started:false,
  database_connection_attempted:false,
  production_owner_activation:false,
  formal_v5_arm:false,
  a0_started:false,
  o00_started:false
}));

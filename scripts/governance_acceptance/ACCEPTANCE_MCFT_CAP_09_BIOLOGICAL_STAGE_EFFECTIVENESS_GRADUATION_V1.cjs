#!/usr/bin/env node
"use strict";
const fs=require("node:fs");
const cp=require("node:child_process");

const EXPECTED_BASE="8d20fe6510377544422fb271c59b8b70e9501884";
const SUCCESSOR_BASE="d67a2b3cce037c1eaad4d7d051d1f6a11eb09fc3";
const BASE=process.env.MCFT_CAP09_BIO_STAGE_EFFECT_BASE_SHA;
const paths=[
  ".github/workflows/mcft-cap-09-biological-stage-effectiveness-graduation-v1.yml",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-BIOLOGICAL-STAGE-EFFECTIVENESS-GRADUATION-V1.json",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_BIOLOGICAL_STAGE_EFFECTIVENESS_GRADUATION_V1.cjs",
  "scripts/runtime_acceptance/BUILD_MCFT_CAP_09_BIOLOGICAL_STAGE_ARCHITECTURE_EFFECTIVENESS_V1.cjs",
  "scripts/runtime_acceptance/BUILD_MCFT_CAP_09_EFFECTIVE_CURRENT_CROP_AUTHORITY_V1.cjs"
].sort();
function fail(c,d){throw new Error(d?c+":"+d:c)}
function eq(a,b,c){if(a!==b)fail(c,"expected="+JSON.stringify(b)+" actual="+JSON.stringify(a))}
function git(){return cp.execFileSync("git",Array.from(arguments),{encoding:"utf8"}).trim()}

const successor=BASE===SUCCESSOR_BASE;
if(successor){
  eq(git("merge-base",SUCCESSOR_BASE,"HEAD"),SUCCESSOR_BASE,"BIO_STAGE_EFFECT_SUCCESSOR_BASE_NOT_ANCESTOR");
}else{
  eq(BASE,EXPECTED_BASE,"BIO_STAGE_EFFECT_EXACT_BASE_REQUIRED");
  eq(git("merge-base",EXPECTED_BASE,"HEAD"),EXPECTED_BASE,"BIO_STAGE_EFFECT_BASE_NOT_ANCESTOR");
}
const diffBase=successor?SUCCESSOR_BASE:EXPECTED_BASE;
const changed=git("diff","--name-only",diffBase+"...HEAD").split(/\r?\n/).filter(Boolean).sort();
if(!successor){
  eq(JSON.stringify(changed),JSON.stringify(paths),"BIO_STAGE_EFFECT_EXACT_FIVE_FILE_BOUNDARY_REQUIRED");
}else{
  if(!changed.includes("apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_composition_v2.ts")) fail("BIO_STAGE_EFFECT_SUCCESSOR_COMPOSITION_DELTA_REQUIRED");
  for(const frozen of [paths[1],paths[3],paths[4]]) eq(git("rev-parse","HEAD:"+frozen),git("rev-parse",SUCCESSOR_BASE+":"+frozen),"BIO_STAGE_EFFECT_SUCCESSOR_AUTHORITY_DRIFT:"+frozen);
}

const a=JSON.parse(fs.readFileSync(paths[1],"utf8"));
eq(a.record_status,"CANDIDATE_NOT_EFFECTIVE_UNTIL_EXACT_HEAD_PROOF_AND_PROTECTED_MAIN_MERGE","BIO_STAGE_EFFECT_STATUS");
eq(a.architecture_candidate.amendment_id,"DT02-AMENDMENT-03","BIO_STAGE_EFFECT_AMENDMENT");
eq(a.architecture_candidate.amendment_blob_sha,"0383f89ee9aa3d57b0c870ac5d0b1197bd4a4ccb","BIO_STAGE_EFFECT_AMENDMENT_BLOB");
eq(a.architecture_candidate.decision_register_blob_sha,"b9a5184f1557d1d5e1bb2baa977429aa57dbe7ad","BIO_STAGE_EFFECT_REGISTER_BLOB");
eq(a.effect_if_exact_head_proof_passes_and_candidate_merges_to_protected_main.runtime_start_authorized,false,"BIO_STAGE_EFFECT_RUNTIME_PREMATURE");
eq(a.effect_if_exact_head_proof_passes_and_candidate_merges_to_protected_main.production_owner_activation_authorized,false,"BIO_STAGE_EFFECT_OWNER_PREMATURE");

const arch=fs.readFileSync(paths[3],"utf8");
for(const marker of [
  "BIO_STAGE_EFFECT_GRADUATION_AUTHORITY_NOT_PRESENT_ON_PROTECTED_MAIN",
  "BIO_STAGE_EFFECT_AMENDMENT03_BLOB_MISMATCH",
  "BIO_STAGE_EFFECT_DECISION_REGISTER_BLOB_MISMATCH",
  "geox_dt02_biological_stage_authority_effectiveness_v1",
  "runtime_start_authorized:false"
]) if(!arch.includes(marker))fail("BIO_STAGE_EFFECT_ARCH_BUILDER_MARKER",marker);

const crop=fs.readFileSync(paths[4],"utf8");
for(const marker of [
  "EFFECTIVE_CURRENT_CROP_INPUT_MUST_BE_UNGRADUATED",
  "EFFECTIVE_CURRENT_CROP_STAGE_AUTHORITY_STALE_AT_GRADUATION",
  "architecture_effective=true",
  "runtime_consumption_authorized=true",
  "crop_model_parameter.production_effective!==false"
]) if(!crop.includes(marker))fail("BIO_STAGE_EFFECT_CROP_BUILDER_MARKER",marker);

const wf=fs.readFileSync(paths[0],"utf8");
for(const forbidden of [
  "workflow_dispatch:","schedule:","pull_request_target","docker compose up",
  "FORMAL_DATABASE_URL","GEOX_MCFT_CAP09_S6_DATABASE_URL"
]) if(wf.includes(forbidden))fail("BIO_STAGE_EFFECT_WORKFLOW_FORBIDDEN",forbidden);

console.log(JSON.stringify({
  status:"PASS",exact_base_sha:successor?SUCCESSOR_BASE:EXPECTED_BASE,subject_head_sha:git("rev-parse","HEAD"),
  successor_requalification:successor,
  exact_changed_file_count:changed.length,real_effectiveness_issued:false,
  runtime_start_authorized:false,formal_v5_authorized:false
}));

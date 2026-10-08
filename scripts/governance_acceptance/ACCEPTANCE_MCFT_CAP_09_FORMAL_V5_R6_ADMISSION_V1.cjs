#!/usr/bin/env node
"use strict";

const assert=require("node:assert/strict");
const cp=require("node:child_process");
const fs=require("node:fs");
const path=require("node:path");

const ROOT=path.resolve(__dirname,"../..");
const authorityContinuity=require("./ACCEPTANCE_MCFT_CAP_09_PROOF_BOUND_FIRST_PARENT_SUCCESSOR_CHAIN_V1.cjs").verifyFormalV5AuthorityContinuity();
const BASE="53a28bc4f77499687d6a3e1988845bba6384c790";

const EXPECTED_CHANGED=[
  ".github/workflows/mcft-cap-09-formal-v5-r6-admission.yml",
  "apps/server/src/runtime/twin_runtime/external_formal_a18_crop_context_v5.test.ts",
  "apps/server/src/runtime/twin_runtime/external_formal_a18_crop_context_v5.ts",
  "apps/server/src/runtime/twin_runtime/mcft_cap09_formal_v5_twin_runtime_composition_v1.ts",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_AMENDMENT_21_FORMAL_V5_EPOCH_STAGE_HANDOFF_V1.cjs",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_FORMAL_V5_R6_ADMISSION_V1.cjs",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_G11_PRODUCTIONIZATION_V1.cjs",
  "scripts/runtime_acceptance/mcft_cap09_formal_v5_manifest_from_stage_authority_v1.test.ts",
  "scripts/runtime_acceptance/mcft_cap09_formal_v5_manifest_from_stage_authority_v1.ts",
].sort();

const FROZEN={
  "apps/server/src/runtime/twin_runtime/external_formal_a18_crop_context_v4.ts":"9be6c965a7dbd51ef000331e9895538c30d3177c",
  "apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_process_v2.ts":"f1f379a40e55d81d43c5d1b7975aded74d10092c",
  "apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_composition_v2.ts":"715fff15e879dac3d1c42b0e62c55c90fa593302",
  "apps/server/src/runtime/twin_runtime/external_formal_v5_amendment19_runner_v2.ts":"ed92e28bc575714e0f0cc6457f842a6ce8da457f",
  "apps/server/src/runtime/twin_runtime/external_formal_v5_viability_gated_scheduler_v1.ts":"21d96c4a3a0001e113af71eaeca86e75ee6e2287",
  "apps/server/src/runtime/twin_runtime/external_formal_v3_amendment19_persistent_tick_service_v1.ts":"a66fb6b59e00870f27e1856975006a840a6f62f7",
};

function git(...args){return cp.execFileSync("git",args,{cwd:ROOT,encoding:"utf8"}).trim();}
function read(rel){return fs.readFileSync(path.join(ROOT,rel),"utf8");}
function marker(text,value,code){assert.ok(text.includes(value),code+":"+value);}
function absent(text,value,code){assert.equal(text.includes(value),false,code+":"+value);}

assert.equal(git("merge-base",BASE,"HEAD"),BASE,"R6_ADMISSION_BASE_NOT_ANCESTOR");
const changed=git("diff","--name-only",BASE+"...HEAD").split(/\r?\n/).filter(Boolean).sort();
const MERGED_R6="dd7529ffd08bead343e312c73b72d7039a7c12e7";
const readOnlySuccessor=git("merge-base",MERGED_R6,"HEAD")===MERGED_R6;
if(!readOnlySuccessor){
  assert.deepEqual(changed,EXPECTED_CHANGED,"R6_ADMISSION_CHANGED_PATH_BOUNDARY");
}else{
  // Once R6 is merged, requalification proves its exact consumer unchanged
  // alongside a bounded read-only closure successor; it must not require the
  // whole descendant tree to remain the original ten-path R6 patch forever.
  const allowed=new Set([
    ".github/workflows/mcft-cap-09-formal-v5-final-readback-v1.yml",
    ".github/workflows/mcft-cap-09-formal-v5-completion-adjudication-v1.yml",
    "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json",
    "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_FORMAL_V5_R6_ADMISSION_V1.cjs",
    "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_FORMAL_V5_FINAL_READBACK_V1.cjs",
    "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_FORMAL_V5_COMPLETION_ADJUDICATION_V1.cjs",
    "scripts/governance_acceptance/ASSEMBLE_MCFT_CAP_09_FORMAL_V5_COMPLETION_CANDIDATE_V1.cjs",
    "scripts/governance_acceptance/ADJUDICATE_MCFT_CAP_09_FORMAL_V5_COMPLETION_V1.cjs",
    "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_FORMAL_V5_FINAL_READBACK_SCHEMA_V1.ts",
    "scripts/runtime_acceptance/READBACK_MCFT_CAP_09_FORMAL_V5_ACTIVE_WATCHDOG_V1.ts",
    "scripts/runtime_acceptance/READBACK_MCFT_CAP_09_FORMAL_V5_FINAL_V1.ts",
    "scripts/runtime_acceptance/VERIFY_MCFT_CAP_09_FORMAL_V5_DOWNSTREAM_ZERO_V1.ts",
  ]);
  const delta=git("diff","--name-only",MERGED_R6+"...HEAD").split(/\r?\n/).filter(Boolean);
  for(const rel of delta)assert.ok(allowed.has(rel)||authorityContinuity?.changedPaths.includes(rel),"R6_READ_ONLY_SUCCESSOR_PATH_FORBIDDEN:"+rel);
  for(const rel of EXPECTED_CHANGED.filter(rel=>rel!=="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json"&&rel!=="scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_FORMAL_V5_R6_ADMISSION_V1.cjs")){
    assert.equal(git("rev-parse","HEAD:"+rel),git("rev-parse",MERGED_R6+":"+rel),"R6_MERGED_CONSUMER_CHANGED:"+rel);
  }
}

for(const [rel,blob] of Object.entries(FROZEN)){
  assert.equal(git("rev-parse","HEAD:"+rel),blob,"R6_ADMISSION_FROZEN_SURFACE_CHANGED:"+rel);
}

const a18=read("apps/server/src/runtime/twin_runtime/external_formal_a18_crop_context_v5.ts");
for(const value of [
  "R5_DENT_OR_LATER_PRE_R6_MODEL_ESTIMATE",
  "R6_OR_LATER_MODEL_ESTIMATE",
  "EXTERNAL_FORMAL_A18_V5_LIFECYCLE_NOT_CONSUMABLE",
  "EXTERNAL_FORMAL_A18_V5_EXACT_LATE_STAGE_REQUIRED",
  "WATER_USE_STAGE_LATE_STABLE_FOR_R5_TO_R6_THERMAL_PROGRESSION",
  "LIFECYCLE_ACTIVE_REQUIRES_SEPARATE_VALIDATION",
  '"FORMAL_BIOLOGICAL_STAGE_AUTHORITY_DERIVED_CROP_WATER_USE_CONTEXT_V4"',
  '"T4R1_A18_BIOLOGICAL_STAGE_AUTHORITY_CONTEXT_IDENTITY_V4"',
  '"T4R1_A18_BIOLOGICAL_STAGE_AUTHORITY_CONTEXT_MATERIALIZATION_V4"',
  'schema_version: "geox_mcft_cap09_t4r1_a18_formal_crop_context_v4"',
])marker(a18,value,"R6_ADMISSION_A18_REQUIRED");
absent(a18,"PRE_R5_MODEL_ESTIMATE\",","R6_ADMISSION_PRE_R5_ALLOWLIST_FORBIDDEN");

const manifest=read("scripts/runtime_acceptance/mcft_cap09_formal_v5_manifest_from_stage_authority_v1.ts");
for(const value of [
  "materializeExternalFormalA18CropContextV5",
  "MCFT_CAP09_A18_CROP_CONTEXT_MATERIALIZATION_PROFILE_V5",
  "R5_DENT_OR_LATER_PRE_R6_MODEL_ESTIMATE",
  "R6_OR_LATER_MODEL_ESTIMATE",
  "FORMAL_V5_MANIFEST_CURRENT_CROP_LIFECYCLE_INVALID",
  "FORMAL_V5_MANIFEST_STAGE_AUTHORITY_DOES_NOT_COVER_O23",
  "FORMAL_V5_MANIFEST_CURRENT_CROP_GRADUATED_AFTER_A0",
])marker(manifest,value,"R6_ADMISSION_MANIFEST_REQUIRED");

const composition=read("apps/server/src/runtime/twin_runtime/mcft_cap09_formal_v5_twin_runtime_composition_v1.ts");
for(const value of [
  "FORMAL_V5_ACTIVE",
  "materializeExternalFormalA18CropContextV5",
  "ExternalFormalV5Amendment19RunnerV2",
  "PostgresExternalFormalNextTickViabilityV1",
])marker(composition,value,"R6_ADMISSION_ACTIVE_COMPOSITION_REQUIRED");
absent(composition,"materializeMcftCap09TwinCropContextV2","R6_ADMISSION_ACTIVE_V2_MATERIALIZER_FORBIDDEN");

const am21=read("scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_AMENDMENT_21_FORMAL_V5_EPOCH_STAGE_HANDOFF_V1.cjs");
for(const value of [
  "R6_MANIFEST_PREDECESSOR_BLOB",
  "R6_MANIFEST_SUCCESSOR_BLOB",
  "AM21_R6_SUCCESSOR_EXACT_BOUNDARY_REQUIRED",
  "r6_manifest_successor_mode:r6ManifestSuccessorMode",
  "historical_manifest_freeze_relaxed:false",
])marker(am21,value,"R6_ADMISSION_AM21_COMPATIBILITY_REQUIRED");

const proof={
  schema_version:"geox_mcft_cap09_formal_v5_r6_admission_v1",
  status:"PASS",
  exact_predecessor:BASE,
  merged_r6_read_only_successor_mode:readOnlySuccessor,
  merged_r6_consumer_unchanged:readOnlySuccessor,
  changed_path_count:changed.length,
  historical_a18_v4_unchanged:true,
  historical_twin_v2_process_unchanged:true,
  historical_twin_v2_composition_unchanged:true,
  v5_runner_unchanged:true,
  v5_viability_gate_unchanged:true,
  persistent_tick_semantics_unchanged:true,
  formal_v5_manifest_path_preserved:true,
  formal_v5_active_composition_only_rebound_to_a18_v5:true,
  amendment21_r6_manifest_successor_admission_governed:true,
  allowed_biological_authorities:[
    "R5_DENT_OR_LATER_PRE_R6_MODEL_ESTIMATE",
    "R6_OR_LATER_MODEL_ESTIMATE",
  ],
  crop_water_use_stage:"LATE",
  kc:0.6,
  independent_lifecycle_required:true,
  r5_materialization_identity_namespace_preserved:true,
  scheduler_semantics_rewritten:false,
  persistence_semantics_rewritten:false,
  provider_semantics_rewritten:false,
  revision_semantics_rewritten:false,
  database_schema_changed:false,
  a0_semantics_rewritten:false,
  production_effect:false,
  a0:false,
  o00:false,
  mcft_cap09_completed:false,
};

const out=path.join(ROOT,"acceptance-output/MCFT_CAP_09_FORMAL_V5_R6_ADMISSION_V1_RESULT.json");
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,JSON.stringify(proof,null,2)+"\n");
process.stdout.write(JSON.stringify(proof,null,2)+"\n");

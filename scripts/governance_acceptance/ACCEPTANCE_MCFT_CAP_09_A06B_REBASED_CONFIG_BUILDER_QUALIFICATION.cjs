#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const {execFileSync}=require("node:child_process");
const fail=(m)=>{throw new Error(m);};
const eq=(a,e,c)=>{if(a!==e)fail(`${c}: expected=${JSON.stringify(e)} actual=${JSON.stringify(a)}`);};
const yes=(v,c)=>eq(v,true,c); const no=(v,c)=>eq(v,false,c);
const git=(...a)=>execFileSync("git",a,{encoding:"utf8"}).trim();
const blob=(ref,p)=>git("rev-parse",`${ref}:${p}`);
const json=(p)=>JSON.parse(fs.readFileSync(p,"utf8"));

const base=process.env.MCFT_BASE_SHA;
eq(base,"fb9b5eec6e8544ed11b65634060e7f7a076a1526","A06B_EXACT_BASE_REQUIRED");
const builderPath="apps/server/src/domain/twin_runtime/external_formal_window_epoch_rebase_bundle_v1.ts";
const acceptancePath="scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_A06B_REBASED_CONFIG_BUILDER.ts";
const authorityPath="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-A06B-REBASED-CONFIG-BUILDER-QUALIFICATION-V1.json";
const workflowPath=".github/workflows/mcft-cap-09-a06b-rebased-config-builder-qualification.yml";
const gatePath="scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_A06B_REBASED_CONFIG_BUILDER_QUALIFICATION.cjs";
const changed=git("diff","--name-only",`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
eq(JSON.stringify(changed),JSON.stringify([builderPath,acceptancePath,authorityPath,workflowPath,gatePath].sort()),"A06B_EXACT_FIVE_FILE_BOUNDARY_REQUIRED");

const predecessorPins={
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md":"39f6a09273c30088a7ea264cfa94ff930ea5518e",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-05-EXTERNAL-FORMAL-RUNTIME-AUTHORITY-PROFILE.md":"7a92c17f7ba32aae52667de9c21db62bfd2ba70b",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V1.json":"b5de9d29189cb654444b3f57d00df290eefe16d3",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-06-FORMAL-WINDOW-EPOCH-REBASE-AUTHORITY.md":"e59e11e909bfd0a38c7298c5a6f909a6cd7afa49",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-A06A-FUTURE-FORMAL-WINDOW-EPOCH-SELECTION-V1.json":"c7788d525c56ab83117afbeeec85f2b9f990534f",
  "apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.ts":"f7ea03a7f8387ce4de135dac61f0b063e91f0f25",
  "apps/server/src/domain/twin_runtime/external_formal_bootstrap_authority_bundle_v1.ts":"1671b13df81cba53f966a6f06765198d160601d7"
};
for(const [p,s] of Object.entries(predecessorPins)){eq(blob(base,p),s,`A06B_BASE_PIN:${p}`);eq(blob("HEAD",p),s,`A06B_PREDECESSOR_MUTATED:${p}`);}
eq(blob("HEAD",builderPath),"43773178a6220f6d92c48a51da20f7d946bb84a4","A06B_BUILDER_BLOB_REQUIRED");
eq(blob("HEAD",acceptancePath),"bd9730d279aacac32151a94f11ed538005ccd933","A06B_ACCEPTANCE_BLOB_REQUIRED");
eq(blob("HEAD",authorityPath),"89ca957829e632a21f6a4d42a9ff571d572f7302","A06B_AUTHORITY_BLOB_REQUIRED");
eq(blob("HEAD",workflowPath),"883b7f88f65c6cbf66b008492ccbeffc645c12f5","A06B_WORKFLOW_BLOB_REQUIRED");

const a06a=json("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-A06A-FUTURE-FORMAL-WINDOW-EPOCH-SELECTION-V1.json");
yes(a06a.effect_if_exact_head_proof_passes_and_candidate_merges_to_protected_main.a06a_future_formal_window_epoch_selection_effective,"A06B_A06A_EFFECT_REQUIRED");
yes(a06a.effect_if_exact_head_proof_passes_and_candidate_merges_to_protected_main.a06b_rebased_config_builder_qualification_authorized,"A06B_AUTHORIZATION_REQUIRED");
no(a06a.effect_if_exact_head_proof_passes_and_candidate_merges_to_protected_main.formal_o00_start_authorized,"A06B_O00_MUST_REMAIN_UNAUTHORIZED");
eq(a06a.next_legal_successor_if_effective,"S6-A06B-REBASED-CONFIG-BUILDER-QUALIFICATION","A06B_FRONTIER_REQUIRED");

const a=json(authorityPath);
eq(a.base_main_sha,base,"A06B_AUTHORITY_BASE_REQUIRED");
eq(a.frontier_id,"S6-A06B-REBASED-CONFIG-BUILDER-QUALIFICATION","A06B_AUTHORITY_FRONTIER_REQUIRED");
eq(a.record_status,"A06B_BUILDER_QUALIFICATION_CANDIDATE_NOT_EFFECTIVE","A06B_RECORD_STATUS_REQUIRED");
eq(a.a06a_effectiveness.pr_number,3029,"A06B_A06A_PR_REQUIRED");
eq(a.a06a_effectiveness.merged_head_sha,"8d42580074b5a5506833c2342f50444560a04998","A06B_A06A_HEAD_REQUIRED");
eq(a.a06a_effectiveness.merge_commit_sha,base,"A06B_A06A_MERGE_REQUIRED");
eq(a.a06a_effectiveness.merged_at_utc,"2026-08-10T05:07:38.000Z","A06B_A06A_TIME_REQUIRED");
eq(a.a06a_effectiveness.focused_workflow_run_id,31357144660,"A06B_A06A_RUN_REQUIRED");
eq(a.a06a_effectiveness.focused_artifact_id,9051032042,"A06B_A06A_ARTIFACT_REQUIRED");
eq(a.a06a_effectiveness.selected_o00,"2026-08-11T17:00:00.000Z","A06B_O00_REQUIRED");
eq(a.a06a_effectiveness.selected_o23,"2026-08-12T16:00:00.000Z","A06B_O23_REQUIRED");
eq(a.a06a_effectiveness.ea5e_v3_readiness_deadline,"2026-08-11T05:00:00.000Z","A06B_DEADLINE_REQUIRED");

const c=a.builder_contract;
yes(c.pure_domain_builder,"A06B_PURE_BUILDER_REQUIRED");
for(const key of ["filesystem_access","database_access","provider_network_access","scheduler_access","wall_clock_access","environment_access","persistence_access","stale_a0_crop_context_reuse_for_rebased_slots_allowed","expired_epoch_ref_hash_collision_allowed"]) no(c[key],`A06B_FALSE_REQUIRED:${key}`);
eq(c.exact_input_slot_context_count,24,"A06B_24_INPUTS_REQUIRED");
eq(c.exact_output_runtime_config_count,24,"A06B_24_OUTPUTS_REQUIRED");
eq(c.existing_a0_parent_ref,"external_formal_runtime_config_7284202e3b0bdae6d32f4814","A06B_A0_REF_REQUIRED");
eq(c.existing_a0_parent_hash,"sha256:d6b721b0eb74b1fbd4168d0bc1d551c0c95bf60fef67c8fe4cd9b77ad60930f8","A06B_A0_HASH_REQUIRED");
yes(c.o00_parent_must_equal_existing_a0,"A06B_O00_PARENT_REQUIRED");
yes(c.o01_o23_parent_must_equal_immediately_preceding_rebased_config,"A06B_CHAIN_REQUIRED");
yes(c.slot_logical_time_must_equal_effective_logical_time,"A06B_TIME_PIN_REQUIRED");
yes(c.slot_crop_context_hash_must_equal_a06a,"A06B_CROP_HASH_PIN_REQUIRED");
eq(c.runtime_mode,"SHADOW_ONLINE_FORMAL_QUALIFICATION_ONLY","A06B_RUNTIME_MODE_REQUIRED");
eq(c.config_selection_mode,"EXPLICIT_REF_HASH_PIN_ONLY","A06B_SELECTION_MODE_REQUIRED");
yes(c.deterministic_double_build_required,"A06B_DETERMINISM_REQUIRED");

const e=a.effect_if_exact_head_proof_passes_and_candidate_merges_to_protected_main;
yes(e.a06b_rebased_config_builder_qualified,"A06B_EFFECT_REQUIRED");
yes(e.a06c_append_only_rebased_config_persistence_authorized,"A06B_A06C_AUTH_REQUIRED");
no(e.a06c_complete,"A06B_A06C_COMPLETE_PREMATURE");
no(e.rebased_runtime_configs_persisted,"A06B_PERSISTENCE_PREMATURE");
yes(e.ea5d_complete_remains_true,"A06B_EA5D_REQUIRED");
yes(e.ea5e_authorized_remains_true,"A06B_EA5E_AUTH_REQUIRED");
for(const key of ["ea5e_complete","external_package_formal_eligible","formal_o00_start_authorized","formal_window_started","mcft_cap09_completed"]) no(e[key],`A06B_PREMATURE:${key}`);
eq(e.formal_execution_count,"0/24","A06B_EXECUTION_COUNT_REQUIRED");
eq(a.next_legal_successor_if_effective,"S6-A06C-APPEND-ONLY-REBASED-CONFIG-PERSISTENCE","A06B_NEXT_FRONTIER_REQUIRED");

const b=fs.readFileSync(builderPath,"utf8");
for(const marker of ["buildExternalFormalWindowEpochRebaseBundleV1","MCFT_CAP09_A06A_SELECTED_O00_V1","MCFT_CAP09_EXISTING_EXTERNAL_A0_RUNTIME_CONFIG_REF_V1","compileExternalFormalRuntimeConfigV1","context_hash: slot.crop_stage_context_hash","parent_runtime_config_ref: parent.object_id","runtime_config_count: 24","database_write_count: 0","formal_window_started: false"]) if(!b.includes(marker)) fail(`A06B_BUILDER_MARKER_MISSING:${marker}`);
for(const forbidden of ["process.env","fetch(","node:fs","node:http","node:https","INSERT INTO","DELETE FROM","CONTROLLED_SYNTHETIC_REPLAY_PROXY","field_c8_demo","POINT_200MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1"]) if(b.includes(forbidden)) fail(`A06B_BUILDER_FORBIDDEN:${forbidden}`);

const w=fs.readFileSync(workflowPath,"utf8");
if(w.includes("pull_request_target")) fail("A06B_PULL_REQUEST_TARGET_FORBIDDEN");
for(const marker of ["A06B_SELECTED_EPOCH_READINESS_DEADLINE_ALREADY_PASSED","31357144660","9051032042","pnpm --filter @geox/server typecheck","ACCEPTANCE_MCFT_CAP_09_A06B_REBASED_CONFIG_BUILDER.ts","exact_rebased_runtime_config_count!==24","builder_database_write_count!==0","formal_window_started!==false"]) if(!w.includes(marker)) fail(`A06B_WORKFLOW_MARKER_MISSING:${marker}`);
if(w.includes("GEOX_MCFT_CAP09_S6_DATABASE_URL")||w.includes("GEOX_MCFT_CAP09_FORMAL_RAW_S3_SECRET_ACCESS_KEY")) fail("A06B_FORMAL_CREDENTIAL_BINDING_FORBIDDEN");

const out={schema_version:"geox_mcft_cap09_a06b_governance_result_v1",status:"PASS",base_main_sha:base,subject_head_sha:git("rev-parse","HEAD"),exact_changed_file_count:changed.length,predecessor_blobs_verified_unchanged:true,pure_builder_boundary_verified:true,selected_epoch_id:a.a06a_effectiveness.selected_epoch_id,exact_rebased_runtime_config_count:24,a06b_effective_after_merge:true,a06c_authorized_after_merge:true,rebased_runtime_configs_persisted:false,ea5e_complete:false,formal_o00_start_authorized:false,formal_window_started:false,formal_execution_count:"0/24",mcft_cap09_completed:false};
fs.mkdirSync("acceptance-output",{recursive:true});
fs.writeFileSync("acceptance-output/MCFT_CAP_09_A06B_GOVERNANCE_RESULT.json",JSON.stringify(out,null,2)+"\n");
console.log(JSON.stringify(out,null,2));

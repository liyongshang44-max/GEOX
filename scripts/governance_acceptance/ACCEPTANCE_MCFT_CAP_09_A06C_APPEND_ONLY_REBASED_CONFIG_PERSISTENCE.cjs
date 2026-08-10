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
eq(base,"bf4bf2e27fe51e71ace04b0b1c4fe00d6a45b900","A06C_EXACT_BASE_REQUIRED");
const servicePath="apps/server/src/runtime/twin_runtime/external_formal_window_epoch_rebase_persistence_service_v1.ts";
const executorPath="scripts/runtime_acceptance/EXECUTE_MCFT_CAP_09_A06C_APPEND_ONLY_REBASED_CONFIG_PERSISTENCE.ts";
const authorityPath="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-A06C-APPEND-ONLY-REBASED-CONFIG-PERSISTENCE-V1.json";
const workflowPath=".github/workflows/mcft-cap-09-a06c-append-only-rebased-config-persistence.yml";
const gatePath="scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_A06C_APPEND_ONLY_REBASED_CONFIG_PERSISTENCE.cjs";
const changed=git("diff","--name-only",`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
eq(JSON.stringify(changed),JSON.stringify([servicePath,executorPath,authorityPath,workflowPath,gatePath].sort()),"A06C_EXACT_FIVE_FILE_BOUNDARY_REQUIRED");

const predecessorPins={
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md":"39f6a09273c30088a7ea264cfa94ff930ea5518e",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-05-EXTERNAL-FORMAL-RUNTIME-AUTHORITY-PROFILE.md":"7a92c17f7ba32aae52667de9c21db62bfd2ba70b",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-06-FORMAL-WINDOW-EPOCH-REBASE-AUTHORITY.md":"e59e11e909bfd0a38c7298c5a6f909a6cd7afa49",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-A06A-FUTURE-FORMAL-WINDOW-EPOCH-SELECTION-V1.json":"c7788d525c56ab83117afbeeec85f2b9f990534f",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-A06B-REBASED-CONFIG-BUILDER-QUALIFICATION-V1.json":"89ca957829e632a21f6a4d42a9ff571d572f7302",
  "apps/server/src/domain/twin_runtime/external_formal_window_epoch_rebase_bundle_v1.ts":"43773178a6220f6d92c48a51da20f7d946bb84a4",
  "apps/server/src/persistence/twin_runtime/postgres_runtime_repository_v1.ts":"9650d2875c6737714d22de7cc2b1d9229aea33a5"
};
for(const [p,s] of Object.entries(predecessorPins)){eq(blob(base,p),s,`A06C_BASE_PIN:${p}`);eq(blob("HEAD",p),s,`A06C_PREDECESSOR_MUTATED:${p}`);}
eq(blob("HEAD",servicePath),"a420ef34e4c0a58ba5507e46d623fcc12980b946","A06C_SERVICE_BLOB_REQUIRED");
eq(blob("HEAD",executorPath),"b96593a85d6c032e632ed36e0c191e7b4ea782c9","A06C_EXECUTOR_BLOB_REQUIRED");
eq(blob("HEAD",authorityPath),"60bdbb0bda35c582ec50e2e2b9b9c2925c34daa2","A06C_AUTHORITY_BLOB_REQUIRED");
eq(blob("HEAD",workflowPath),"75ba8d2db107f4b1a0fcdad480a9cd3a4dc02c9b","A06C_WORKFLOW_BLOB_REQUIRED");

const a06b=json("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-A06B-REBASED-CONFIG-BUILDER-QUALIFICATION-V1.json");
yes(a06b.effect_if_exact_head_proof_passes_and_candidate_merges_to_protected_main.a06b_rebased_config_builder_qualified,"A06C_A06B_QUALIFICATION_REQUIRED");
yes(a06b.effect_if_exact_head_proof_passes_and_candidate_merges_to_protected_main.a06c_append_only_rebased_config_persistence_authorized,"A06C_AUTHORIZATION_REQUIRED");
no(a06b.effect_if_exact_head_proof_passes_and_candidate_merges_to_protected_main.rebased_runtime_configs_persisted,"A06C_PREDECESSOR_MUST_NOT_CLAIM_PERSISTENCE");
eq(a06b.next_legal_successor_if_effective,"S6-A06C-APPEND-ONLY-REBASED-CONFIG-PERSISTENCE","A06C_FRONTIER_REQUIRED");

const a=json(authorityPath);
eq(a.base_main_sha,base,"A06C_AUTHORITY_BASE_REQUIRED");
eq(a.frontier_id,"S6-A06C-APPEND-ONLY-REBASED-CONFIG-PERSISTENCE","A06C_AUTHORITY_FRONTIER_REQUIRED");
eq(a.record_status,"A06C_LIVE_PERSISTENCE_CANDIDATE_NOT_EFFECTIVE","A06C_RECORD_STATUS_REQUIRED");
eq(a.a06b_effectiveness.pr_number,3030,"A06C_A06B_PR_REQUIRED");
eq(a.a06b_effectiveness.merged_head_sha,"e64ffc6d49913188678d846b61a1f45dd5fcd35f","A06C_A06B_HEAD_REQUIRED");
eq(a.a06b_effectiveness.merge_commit_sha,base,"A06C_A06B_MERGE_REQUIRED");
eq(a.a06b_effectiveness.merged_at_utc,"2026-08-10T05:25:18.000Z","A06C_A06B_MERGE_TIME_REQUIRED");
eq(a.a06b_effectiveness.focused_workflow_run_id,31357970152,"A06C_A06B_RUN_REQUIRED");
eq(a.a06b_effectiveness.focused_artifact_id,9051315518,"A06C_A06B_ARTIFACT_REQUIRED");
eq(a.a06b_effectiveness.focused_artifact_digest,"sha256:4e86bb7a92f5afb9d2ae6cc81b67112e41f2fa75e8317d9725a79e4621377583","A06C_A06B_ARTIFACT_DIGEST_REQUIRED");

const epoch=a.selected_epoch;
eq(epoch.epoch_id,"mcft_cap09_external_formal_window_epoch_20260811t170000z_v1","A06C_EPOCH_REQUIRED");
eq(epoch.o00,"2026-08-11T17:00:00.000Z","A06C_O00_REQUIRED");
eq(epoch.o23,"2026-08-12T16:00:00.000Z","A06C_O23_REQUIRED");
eq(epoch.ea5e_v3_readiness_deadline,"2026-08-11T05:00:00.000Z","A06C_DEADLINE_REQUIRED");
eq(epoch.existing_a0_parent_ref,"external_formal_runtime_config_7284202e3b0bdae6d32f4814","A06C_A0_REF_REQUIRED");
eq(epoch.existing_a0_parent_hash,"sha256:d6b721b0eb74b1fbd4168d0bc1d551c0c95bf60fef67c8fe4cd9b77ad60930f8","A06C_A0_HASH_REQUIRED");

const pre=a.prestate_authority;
eq(pre.formal_database,"geox_mcft_cap09_s6_formal_24h","A06C_DATABASE_REQUIRED");
eq(pre.pristine_total_fact_count,36,"A06C_PRISTINE_FACTS_REQUIRED");
eq(pre.pristine_runtime_config_count,25,"A06C_PRISTINE_CONFIGS_REQUIRED");
eq(pre.pristine_external_soil_evidence_count,2,"A06C_PRISTINE_SOIL_REQUIRED");
eq(pre.pristine_canonical_twin_fact_count,34,"A06C_PRISTINE_CANONICAL_REQUIRED");
eq(pre.pristine_state_count,1,"A06C_PRISTINE_STATE_REQUIRED");
yes(pre.strict_crash_recovery_allowed,"A06C_PREFIX_RECOVERY_REQUIRED");
eq(pre.crash_recovery_shape,"CONTIGUOUS_PREFIX_OF_EXACT_A06B_24_CONFIG_CHAIN_ONLY","A06C_RECOVERY_SHAPE_REQUIRED");
no(pre.foreign_selected_epoch_config_allowed,"A06C_FOREIGN_SELECTED_EPOCH_CONFIG_FORBIDDEN");
no(pre.foreign_scope_relevant_fact_allowed,"A06C_FOREIGN_SCOPE_FORBIDDEN");
no(pre.c8_replay_200mm_marker_allowed,"A06C_FORBIDDEN_MARKERS_FORBIDDEN");

const writes=a.write_authority;
eq(writes.first_successful_pristine_write_runtime_config_count,24,"A06C_EXACT_24_FIRST_WRITE_REQUIRED");
eq(writes.strict_prefix_recovery_write_count,"24_MINUS_EXISTING_VERIFIED_PREFIX","A06C_PREFIX_WRITE_RULE_REQUIRED");
eq(writes.immediate_second_pass_runtime_config_write_count,0,"A06C_SECOND_PASS_ZERO_REQUIRED");
for(const key of ["evidence_write_count","a0_member_write_count","state_lineage_checkpoint_forecast_write_count","scheduler_slot_write_count","scheduler_cursor_write_count","provider_request_count","raw_object_write_count","recommendation_write_count","approval_write_count","ao_act_write_count","dispatch_count","model_activation_count"]) eq(writes[key],0,`A06C_FORBIDDEN_WRITE_ZERO_REQUIRED:${key}`);

const finalState=a.required_final_formal_state;
eq(finalState.total_fact_count,60,"A06C_FINAL_FACTS_REQUIRED");
eq(finalState.exact_scope_fact_count,60,"A06C_FINAL_SCOPE_FACTS_REQUIRED");
eq(finalState.external_soil_evidence_count,2,"A06C_FINAL_SOIL_REQUIRED");
eq(finalState.canonical_twin_fact_count,58,"A06C_FINAL_CANONICAL_REQUIRED");
eq(finalState.runtime_config_count,49,"A06C_FINAL_CONFIGS_REQUIRED");
eq(finalState.existing_a0_runtime_config_count,1,"A06C_FINAL_A0_CONFIG_REQUIRED");
eq(finalState.expired_historical_hourly_runtime_config_count,24,"A06C_FINAL_EXPIRED_CONFIGS_REQUIRED");
eq(finalState.rebased_future_hourly_runtime_config_count,24,"A06C_FINAL_REBASED_CONFIGS_REQUIRED");
eq(finalState.state_count,1,"A06C_FINAL_STATE_REQUIRED");
yes(finalState.existing_a0_state_anchor_preserved,"A06C_FINAL_A0_STATE_ANCHOR_REQUIRED");
eq(finalState.scheduler_slot_count,0,"A06C_FINAL_ZERO_SLOTS_REQUIRED");
eq(finalState.scheduler_cursor_count,0,"A06C_FINAL_ZERO_CURSORS_REQUIRED");
no(finalState.formal_window_started,"A06C_FINAL_WINDOW_UNSTARTED_REQUIRED");

const effect=a.effect_if_exact_head_proof_passes_and_candidate_merges_to_protected_main;
yes(effect.a06c_append_only_rebased_config_persistence_effective,"A06C_EFFECT_REQUIRED");
yes(effect.rebased_runtime_configs_persisted,"A06C_PERSISTED_EFFECT_REQUIRED");
eq(effect.exact_rebased_runtime_config_count,24,"A06C_EFFECT_24_REQUIRED");
yes(effect.ea5e1_post_rebase_preflight_and_manifest_authorized,"A06C_EA5E1_AUTH_REQUIRED");
yes(effect.ea5d_complete_remains_true,"A06C_EA5D_REQUIRED");
yes(effect.ea5e_authorized_remains_true,"A06C_EA5E_AUTH_REQUIRED");
for(const key of ["ea5e_complete","external_package_formal_eligible","formal_o00_start_authorized","formal_window_started","mcft_cap09_completed"]) no(effect[key],`A06C_PREMATURE_EFFECT:${key}`);
eq(effect.formal_execution_count,"0/24","A06C_EXECUTION_COUNT_REQUIRED");
eq(a.next_legal_successor_if_effective,"S6-EA5E1-POST-REBASE-FORMAL-DB-PREFLIGHT-AND-WINDOW-INPUT-MANIFEST","A06C_NEXT_FRONTIER_REQUIRED");

const service=fs.readFileSync(servicePath,"utf8");
for(const marker of ["ExternalFormalWindowEpochRebasePersistenceServiceV1","input.runtime_configs.length !== 24","A06C_CRASH_RECOVERY_MUST_BE_CONTIGUOUS_PREFIX","A06C_EXISTING_REBASED_CONFIG_MISMATCH","A06C_FIRST_PASS_WRITE_COUNT_MISMATCH","A06C_SECOND_PASS_MUST_BE_ZERO_WRITE_IDEMPOTENT","first_pass_runtime_config_write_count","second_pass_runtime_config_write_count: 0","formal_window_started: false"]) if(!service.includes(marker)) fail(`A06C_SERVICE_MARKER_MISSING:${marker}`);
for(const forbidden of ["fetch(","node:fs","node:http","node:https","process.env","twin_shadow_online_scheduler_slot_v1","CONTROLLED_SYNTHETIC_REPLAY_PROXY","field_c8_demo"]) if(service.includes(forbidden)) fail(`A06C_SERVICE_FORBIDDEN:${forbidden}`);

const executor=fs.readFileSync(executorPath,"utf8");
for(const marker of ["GEOX_MCFT_CAP09_S6_DATABASE_URL","GEOX_MCFT_CAP09_S6_FORMAL_WINDOW_ENABLED","A06B_PROOF_RESULT_PATH","A06C_SELECTED_EPOCH_READINESS_DEADLINE_ALREADY_PASSED","PostgresRuntimeRepositoryV1","ExternalFormalWindowEpochRebasePersistenceServiceV1","A06C_BUILDER_OUTPUT_DOES_NOT_MATCH_FROZEN_A06B_PROOF","formal_o00_start_authorized: false","ea5e_complete: false"]) if(!executor.includes(marker)) fail(`A06C_EXECUTOR_MARKER_MISSING:${marker}`);
for(const forbidden of ["fetch(","FORMAL_RAW_S3_ACCESS_KEY_ID","FORMAL_RAW_S3_SECRET_ACCESS_KEY","CONTROLLED_SYNTHETIC_REPLAY_PROXY","field_c8_demo","POINT_200MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1"]) if(executor.includes(forbidden)) fail(`A06C_EXECUTOR_FORBIDDEN:${forbidden}`);

const workflow=fs.readFileSync(workflowPath,"utf8");
if(workflow.includes("pull_request_target")) fail("A06C_PULL_REQUEST_TARGET_FORBIDDEN");
for(const marker of ["GEOX_MCFT_CAP09_S6_DATABASE_URL: ${{ secrets.GEOX_MCFT_CAP09_S6_DATABASE_URL }}","A06C_FORMAL_WINDOW_MUST_REMAIN_DISABLED","31357970152","9051315518","BEGIN TRANSACTION READ ONLY","A06C_PREFLIGHT_NONCONTIGUOUS_PREFIX_FORBIDDEN","Execute exact A06C append-only Formal persistence","A06C_POSTFLIGHT_EXACT_24_REBASED_CONFIGS_REQUIRED","expired_historical_hourly_runtime_config_count:24","first_pass_runtime_config_write_count!==pre.expected_first_pass_runtime_config_write_count","second_pass_runtime_config_write_count!==0","formal_execution_count:'0/24'"]) if(!workflow.includes(marker)) fail(`A06C_WORKFLOW_MARKER_MISSING:${marker}`);
if(/\b(INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|TRUNCATE\s+|CREATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE)\b/i.test(workflow)) fail("A06C_WORKFLOW_DIRECT_DATABASE_WRITE_SQL_FORBIDDEN");
if(workflow.includes("GEOX_MCFT_CAP09_FORMAL_RAW_S3_ACCESS_KEY_ID")||workflow.includes("GEOX_MCFT_CAP09_FORMAL_RAW_S3_SECRET_ACCESS_KEY")) fail("A06C_RAW_STORE_CREDENTIALS_FORBIDDEN");

const out={schema_version:"geox_mcft_cap09_a06c_governance_result_v1",status:"PASS",base_main_sha:base,subject_head_sha:git("rev-parse","HEAD"),exact_changed_file_count:changed.length,predecessor_blobs_verified_unchanged:true,a06b_exact_proof_pinned:true,strict_contiguous_prefix_recovery_required:true,pristine_runtime_config_write_count:24,immediate_second_pass_write_count:0,required_final_runtime_config_count:49,required_final_total_fact_count:60,a06c_effective_after_merge:true,ea5e1_authorized_after_merge:true,ea5e_complete:false,formal_o00_start_authorized:false,formal_window_started:false,formal_execution_count:"0/24",mcft_cap09_completed:false};
fs.mkdirSync("acceptance-output",{recursive:true});
fs.writeFileSync("acceptance-output/MCFT_CAP_09_A06C_GOVERNANCE_RESULT.json",JSON.stringify(out,null,2)+"\n");
console.log(JSON.stringify(out,null,2));

#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const BASE = "775c5e6f1f43666c9d4fe46e14b07abcb8cfc6d0";
const P = {
  executor: "scripts/runtime_acceptance/EXECUTE_MCFT_CAP_09_T3R1_SUCCESSOR_RUNTIME_CONFIG_PERSISTENCE_V2.ts",
  authority: "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-SUCCESSOR-RUNTIME-CONFIG-PERSISTENCE-V2.json",
  workflow: ".github/workflows/mcft-cap-09-t3r1-successor-runtime-config-persistence-v2.yml",
  gate: "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_T3R1_SUCCESSOR_RUNTIME_CONFIG_PERSISTENCE_V2.cjs",
};
const OUT = "acceptance-output/MCFT_CAP_09_T3R1_SUCCESSOR_RUNTIME_CONFIG_PERSISTENCE_V2_GOVERNANCE_RESULT.json";
const git=(...args)=>execFileSync("git",args,{encoding:"utf8"}).trim();
const blob=(ref,file)=>git("rev-parse",`${ref}:${file}`);
const json=(file)=>JSON.parse(fs.readFileSync(file,"utf8"));
const eq=(a,b,c)=>{if(a!==b)throw new Error(`${c}: expected=${JSON.stringify(b)} actual=${JSON.stringify(a)}`);};
const yes=(v,c)=>eq(v,true,c); const no=(v,c)=>eq(v,false,c);

function main(){
  const base=process.env.MCFT_BASE_SHA;
  eq(base,BASE,"T3R1_SUCCESSOR_PERSISTENCE_EXACT_BASE_REQUIRED");
  const changed=git("diff","--name-only",`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
  eq(JSON.stringify(changed),JSON.stringify(Object.values(P).sort()),"T3R1_SUCCESSOR_PERSISTENCE_EXACT_FOUR_FILE_BOUNDARY_REQUIRED");

  const pins={
    "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-SUCCESSOR-EPOCH-SELECTION-V2.json":"9c12e31b0a9a3d33e027f0677ad1cf2d92a5097f",
    "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-SUCCESSOR-RUNTIME-CONFIG-BUILDER-QUALIFICATION-V2.json":"6a9fba30a0b8ad82305f70a43b604d76572daeee",
    "apps/server/src/domain/twin_runtime/external_formal_window_epoch_rebase_bundle_v2.ts":"ee624b14bcb279d846f6331b31fb6abee56731f9",
    "apps/server/src/runtime/twin_runtime/external_formal_window_epoch_rebase_persistence_service_v1.ts":"a420ef34e4c0a58ba5507e46d623fcc12980b946",
    "apps/server/src/persistence/twin_runtime/postgres_runtime_repository_v1.ts":"9650d2875c6737714d22de7cc2b1d9229aea33a5"
  };
  for(const [file,sha] of Object.entries(pins)){eq(blob(base,file),sha,`T3R1_SUCCESSOR_PERSISTENCE_BASE_PIN:${file}`);eq(blob("HEAD",file),sha,`T3R1_SUCCESSOR_PERSISTENCE_PREDECESSOR_MUTATED:${file}`);}
  eq(blob("HEAD",P.executor),"862b937462d5ac1ced45b389a6904f56f54a2669","T3R1_SUCCESSOR_PERSISTENCE_EXECUTOR_BLOB_REQUIRED");

  const builder=json("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-SUCCESSOR-RUNTIME-CONFIG-BUILDER-QUALIFICATION-V2.json");
  const be=builder.effect_if_exact_head_proof_passes_and_candidate_merges_to_protected_main;
  yes(be.successor_runtime_config_builder_v2_qualified,"T3R1_SUCCESSOR_PERSISTENCE_BUILDER_QUALIFIED_REQUIRED");
  yes(be.successor_runtime_config_persistence_authorized,"T3R1_SUCCESSOR_PERSISTENCE_AUTHORIZED_REQUIRED");
  no(be.successor_runtime_configs_persisted,"T3R1_SUCCESSOR_PERSISTENCE_PREDECESSOR_PERSISTED_FORBIDDEN");
  no(be.ea5e3_authorized,"T3R1_SUCCESSOR_PERSISTENCE_PREDECESSOR_EA5E3_FORBIDDEN");
  eq(builder.next_legal_successor_if_effective,"S6-T3R1-SUCCESSOR-RUNTIME-CONFIG-PERSISTENCE-V2","T3R1_SUCCESSOR_PERSISTENCE_FRONTIER_REQUIRED");

  const a=json(P.authority);
  eq(a.schema_version,"geox_mcft_cap09_t3r1_successor_runtime_config_persistence_v2","T3R1_SUCCESSOR_PERSISTENCE_SCHEMA_REQUIRED");
  eq(a.base_protected_main_sha,base,"T3R1_SUCCESSOR_PERSISTENCE_AUTHORITY_BASE_REQUIRED");
  eq(a.builder_qualification_effectiveness.pr_number,3191,"T3R1_SUCCESSOR_PERSISTENCE_BUILDER_PR_REQUIRED");
  eq(a.builder_qualification_effectiveness.merge_commit_sha,base,"T3R1_SUCCESSOR_PERSISTENCE_BUILDER_MERGE_REQUIRED");
  eq(a.builder_qualification_effectiveness.focused_workflow_run_id,31934715011,"T3R1_SUCCESSOR_PERSISTENCE_BUILDER_RUN_REQUIRED");
  eq(a.builder_qualification_effectiveness.focused_artifact_id,9260304898,"T3R1_SUCCESSOR_PERSISTENCE_BUILDER_ARTIFACT_REQUIRED");
  eq(a.builder_qualification_effectiveness.focused_artifact_digest,"sha256:38f5d2cbd2d0ac169e8ac1ef4e709d2a16f37fbd252348dee03bee36123508c","T3R1_SUCCESSOR_PERSISTENCE_BUILDER_DIGEST_REQUIRED");
  eq(a.selected_epoch.epoch_id,"mcft_cap09_external_formal_window_epoch_20260817t200000z_v2","T3R1_SUCCESSOR_PERSISTENCE_EPOCH_REQUIRED");
  eq(a.selected_epoch.ea5e3_readiness_deadline,"2026-08-17T08:00:00.000Z","T3R1_SUCCESSOR_PERSISTENCE_DEADLINE_REQUIRED");
  yes(a.candidate_implementation.reuses_generic_crash_safe_persistence_service_v1_unchanged,"T3R1_SUCCESSOR_PERSISTENCE_SERVICE_REUSE_REQUIRED");

  const pre=a.prestate_authority;
  eq(pre.expected_total_fact_count_without_selected_prefix,35,"T3R1_SUCCESSOR_PERSISTENCE_PRE_FACTS_REQUIRED");
  eq(pre.expected_runtime_config_count_without_selected_prefix,25,"T3R1_SUCCESSOR_PERSISTENCE_PRE_CONFIGS_REQUIRED");
  eq(pre.expected_external_soil_evidence_count,1,"T3R1_SUCCESSOR_PERSISTENCE_PRE_SOIL_REQUIRED");
  eq(pre.expected_canonical_twin_fact_count_without_selected_prefix,34,"T3R1_SUCCESSOR_PERSISTENCE_PRE_TWIN_REQUIRED");
  eq(pre.expected_state_count,1,"T3R1_SUCCESSOR_PERSISTENCE_PRE_STATE_REQUIRED");
  eq(pre.expected_scheduler_slot_count,0,"T3R1_SUCCESSOR_PERSISTENCE_PRE_SLOT_ZERO_REQUIRED");
  eq(pre.expected_scheduler_cursor_count,0,"T3R1_SUCCESSOR_PERSISTENCE_PRE_CURSOR_ZERO_REQUIRED");
  yes(pre.strict_crash_recovery_allowed,"T3R1_SUCCESSOR_PERSISTENCE_PREFIX_RECOVERY_REQUIRED");
  no(pre.foreign_selected_epoch_config_allowed,"T3R1_SUCCESSOR_PERSISTENCE_FOREIGN_CONFIG_FORBIDDEN");

  const w=a.write_authority;
  eq(w.first_successful_pristine_write_runtime_config_count,24,"T3R1_SUCCESSOR_PERSISTENCE_EXACT_24_WRITE_REQUIRED");
  eq(w.strict_prefix_recovery_write_count,"24_MINUS_EXISTING_VERIFIED_PREFIX","T3R1_SUCCESSOR_PERSISTENCE_PREFIX_WRITE_RULE_REQUIRED");
  eq(w.immediate_second_pass_runtime_config_write_count,0,"T3R1_SUCCESSOR_PERSISTENCE_SECOND_PASS_ZERO_REQUIRED");
  for(const key of ["evidence_write_count","a0_member_write_count","state_lineage_checkpoint_forecast_write_count","scheduler_slot_write_count","scheduler_cursor_write_count","provider_request_count","raw_object_write_count","recommendation_write_count","approval_write_count","ao_act_write_count","dispatch_count","model_activation_count"])eq(w[key],0,`T3R1_SUCCESSOR_PERSISTENCE_FORBIDDEN_WRITE_ZERO:${key}`);

  const final=a.required_final_formal_state;
  eq(final.total_fact_count,59,"T3R1_SUCCESSOR_PERSISTENCE_FINAL_FACTS_REQUIRED");
  eq(final.runtime_config_count,49,"T3R1_SUCCESSOR_PERSISTENCE_FINAL_CONFIGS_REQUIRED");
  eq(final.successor_hourly_runtime_config_count,24,"T3R1_SUCCESSOR_PERSISTENCE_FINAL_SUCCESSOR_24_REQUIRED");
  eq(final.scheduler_slot_count,0,"T3R1_SUCCESSOR_PERSISTENCE_FINAL_SLOT_ZERO_REQUIRED");
  eq(final.scheduler_cursor_count,0,"T3R1_SUCCESSOR_PERSISTENCE_FINAL_CURSOR_ZERO_REQUIRED");
  no(final.formal_window_started,"T3R1_SUCCESSOR_PERSISTENCE_FINAL_WINDOW_UNSTARTED_REQUIRED");

  const effect=a.effect_if_exact_head_proof_passes_and_candidate_merges_to_protected_main;
  yes(effect.successor_runtime_config_persistence_effective,"T3R1_SUCCESSOR_PERSISTENCE_EFFECT_REQUIRED");
  yes(effect.successor_runtime_configs_persisted,"T3R1_SUCCESSOR_PERSISTENCE_PERSISTED_EFFECT_REQUIRED");
  eq(effect.exact_successor_runtime_config_count,24,"T3R1_SUCCESSOR_PERSISTENCE_EFFECT_24_REQUIRED");
  yes(effect.successor_formal_db_preflight_and_window_input_manifest_authorized,"T3R1_SUCCESSOR_PERSISTENCE_MANIFEST_AUTH_REQUIRED");
  no(effect.ea5e3_authorized,"T3R1_SUCCESSOR_PERSISTENCE_EA5E3_PREMATURE");
  no(effect.formal_o00_start_authorized,"T3R1_SUCCESSOR_PERSISTENCE_O00_PREMATURE");
  no(effect.formal_window_started,"T3R1_SUCCESSOR_PERSISTENCE_WINDOW_PREMATURE");
  eq(effect.formal_execution_count,"0/24","T3R1_SUCCESSOR_PERSISTENCE_ZERO_OF_24_REQUIRED");
  no(effect.mcft_cap09_completed,"T3R1_SUCCESSOR_PERSISTENCE_COMPLETION_PREMATURE");
  eq(a.next_legal_successor_if_effective,"S6-T3R1-SUCCESSOR-FORMAL-DB-PREFLIGHT-AND-WINDOW-INPUT-MANIFEST-V2","T3R1_SUCCESSOR_PERSISTENCE_NEXT_FRONTIER_REQUIRED");

  const executor=fs.readFileSync(P.executor,"utf8");
  for(const marker of ["ExternalFormalWindowEpochRebasePersistenceServiceV1","PostgresRuntimeRepositoryV1","T3R1_SUCCESSOR_BUILDER_PROOF_PATH","T3R1_SUCCESSOR_PERSISTENCE_BUILDER_OUTPUT_DOES_NOT_MATCH_FROZEN_PROOF","successor_runtime_configs_persisted: true","formal_execution_count: \"0/24\""])if(!executor.includes(marker))throw new Error(`T3R1_SUCCESSOR_PERSISTENCE_EXECUTOR_MARKER_REQUIRED:${marker}`);
  for(const forbidden of ["fetch(","FORMAL_RAW_S3_ACCESS_KEY_ID","FORMAL_RAW_S3_SECRET_ACCESS_KEY","CONTROLLED_SYNTHETIC_REPLAY_PROXY","field_kbs_mcse_t1r1"])if(executor.includes(forbidden))throw new Error(`T3R1_SUCCESSOR_PERSISTENCE_EXECUTOR_FORBIDDEN:${forbidden}`);

  const workflow=fs.readFileSync(P.workflow,"utf8");
  if(workflow.includes("pull_request_target"))throw new Error("T3R1_SUCCESSOR_PERSISTENCE_PULL_REQUEST_TARGET_FORBIDDEN");
  for(const marker of ["9260304898","BEGIN TRANSACTION READ ONLY","35+prefix","25+prefix","Execute exact append-only T3R1 successor Runtime Config persistence","total_fact_count:59","runtime_config_count:49","first_pass_runtime_config_write_count!==pre.expected_first_pass_runtime_config_write_count","formal_execution_count!=='0/24'"])if(!workflow.includes(marker))throw new Error(`T3R1_SUCCESSOR_PERSISTENCE_WORKFLOW_MARKER_REQUIRED:${marker}`);
  if(/\b(INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|TRUNCATE\s+|CREATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE)\b/i.test(workflow))throw new Error("T3R1_SUCCESSOR_PERSISTENCE_WORKFLOW_DIRECT_WRITE_SQL_FORBIDDEN");

  const out={schema_version:"geox_mcft_cap09_t3r1_successor_runtime_config_persistence_v2_governance_result",status:"PASS",base_sha:base,subject_sha:git("rev-parse","HEAD"),exact_changed_file_count:changed.length,builder_proof_pinned:true,generic_persistence_service_reused_unchanged:true,strict_contiguous_prefix_recovery_required:true,pristine_runtime_config_write_count:24,immediate_second_pass_write_count:0,required_final_runtime_config_count:49,required_final_total_fact_count:59,persistence_effective_after_merge:true,ea5e3_authorized:false,formal_window_started:false,formal_execution_count:"0/24",mcft_cap09_completed:false};
  fs.mkdirSync("acceptance-output",{recursive:true});fs.writeFileSync(OUT,JSON.stringify(out,null,2)+"\n");console.log(JSON.stringify(out));
}
main();

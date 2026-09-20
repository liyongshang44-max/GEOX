"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const cp=require("node:child_process");

const ROOT=path.resolve(__dirname,"../..");
const BASE="2ce0c90ef30b3c04ed112639c87926ac19be4e03";
const AUTH="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-FORMAL-V5-PRODUCTION-ACTIVATION-SEAM-V1.json";
const ARM="scripts/runtime_acceptance/ASSEMBLE_MCFT_CAP_09_FORMAL_V5_ARM_V1.cjs";
const REARM="scripts/runtime_acceptance/VERIFY_MCFT_CAP_09_FORMAL_V5_MATERIALIZED_ZERO_REARM_ELIGIBILITY_V1.cjs";
const SCHEMA="scripts/runtime_acceptance/RUN_MCFT_CAP_09_FORMAL_V5_SCHEMA_ACL_MATERIALIZATION_V1.ts";
const RUNNER="apps/server/src/runtime/twin_runtime/external_formal_v5_amendment19_runner_v2.ts";
const RUNNER_ACCEPT="scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_FORMAL_V5_STAGE_AWARE_RUNNER_V2.ts";
const A0_REPLAY="scripts/runtime_acceptance/RUN_MCFT_CAP_09_FORMAL_V5_A0_PRODUCTION_REPLAY_PROMOTION_V1.ts";
const V5_BUNDLE="apps/server/src/domain/twin_runtime/external_formal_prewindow_authority_bundle_v5.ts";
const V5_BUNDLE_TEST="apps/server/src/domain/twin_runtime/external_formal_prewindow_authority_bundle_v5.test.ts";
const V5_MANIFEST="scripts/runtime_acceptance/mcft_cap09_formal_v5_manifest_from_stage_authority_v1.ts";
const V5_MANIFEST_TEST="scripts/runtime_acceptance/mcft_cap09_formal_v5_manifest_from_stage_authority_v1.test.ts";
const QCP="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json";
const FROZEN=[
  "scripts/governance_acceptance/ASSEMBLE_MCFT_CAP_09_AMENDMENT_19_FORMAL_ARM_V1.cjs",
  "scripts/runtime_acceptance/RUN_MCFT_CAP_09_AMENDMENT_19_FORMAL_A0_BOOTSTRAP_V1.ts",
  "scripts/runtime_acceptance/RUN_MCFT_CAP_09_AMENDMENT_19_FORMAL_V3_PRODUCTION_RUNNER_V1.ts",
  "apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_process_v2.ts",
  "apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_composition_v2.ts",
  "docker-compose.mcft-cap09-production.yml",
];
const FORMAL_SCHEMA_MIGRATIONS=[
  "apps/server/db/migrations/2026_07_09_mcft_cap_01_a0_persistence.sql",
  "apps/server/db/migrations/2026_07_10_mcft_cap_01_closure_remediation.sql",
  "apps/server/db/migrations/2026_07_13_mcft_cap_04_forecast_scenario_persistence.sql",
  "apps/server/db/migrations/2026_07_14_mcft_cap_05_feedback_persistence.sql",
  "apps/server/db/migrations/2026_08_06_mcft_cap_09_s3_persistent_sequential_scheduler.sql",
  "apps/server/db/migrations/2026_08_25_mcft_cap_09_v13_forcing_base_continuity.sql",
  "apps/server/db/migrations/2026_08_25_mcft_cap_09_v13_forcing_controller_admission.sql",
  "apps/server/db/migrations/2026_08_25_mcft_cap_09_v13_forcing_controller_lifecycle.sql"
];
const EXPECTED_FORMAL_V5_PUBLIC_TABLES=[
  "facts",
  "twin_action_feedback_cycle_projection_v1",
  "twin_action_feedback_evidence_index_v1",
  "twin_action_feedback_projection_v1",
  "twin_active_lineage_index_v1",
  "twin_approved_plan_binding_projection_v1",
  "twin_decision_record_projection_v1",
  "twin_external_formal_forcing_base_cursor_v1",
  "twin_external_formal_forcing_base_target_v1",
  "twin_external_formal_forcing_controller_lease_v1",
  "twin_forecast_point_projection_v1",
  "twin_forecast_residual_projection_v1",
  "twin_forecast_result_latest_index_v1",
  "twin_forecast_run_projection_v1",
  "twin_forecast_success_latest_index_v1",
  "twin_object_idempotency_index_v1",
  "twin_runtime_authority_snapshot_v1",
  "twin_runtime_checkpoint_latest_index_v1",
  "twin_runtime_health_latest_index_v1",
  "twin_runtime_lease_v1",
  "twin_scenario_latest_index_v1",
  "twin_scenario_point_projection_v1",
  "twin_scenario_set_projection_v1",
  "twin_scenario_set_uniqueness_v1",
  "twin_shadow_online_scheduler_cursor_v1",
  "twin_shadow_online_scheduler_slot_v1",
  "twin_state_history_projection_v1",
  "twin_state_latest_index_v1",
  "twin_terminal_tick_uniqueness_v1"
];

function read(rel){return fs.readFileSync(path.join(ROOT,rel),"utf8");}
function git(...args){return cp.execFileSync("git",args,{cwd:ROOT,encoding:"utf8"}).trim();}
function marker(text,value,code){assert.ok(text.includes(value),code+":"+value);}
function notMarker(text,value,code){assert.equal(text.includes(value),false,code+":"+value);}
function createTableNames(rel){
  return [...read(rel).matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-zA-Z0-9_]+)/gi)].map((m)=>m[1]);
}

const auth=JSON.parse(read(AUTH));
assert.equal(auth.schema_version,"geox_mcft_cap09_formal_v5_production_activation_seam_v1");
assert.equal(auth.frontier,"FORMAL_V5_ACTIVATION_SUCCESSOR_NOT_YET_PRODUCTIZED");
assert.equal(auth.closes_frontier_as,"H6_FORMAL_V5_PRODUCTION_ACTIVATION_SEAM");
assert.equal(auth.physical_store.database_name,"geox_mcft_cap09_s6_formal_t4r1_24h_v5");
assert.equal(auth.physical_store.failed_v4_reuse_forbidden,true);
assert.equal(auth.physical_store.compatibility_alias_for_v5_forbidden,true);
assert.equal(auth.arm.execution_host,"LOCAL_NON_GITHUB_PRODUCTION_HOST_ONLY");
assert.equal(auth.arm.epoch_selection.minimum_governance_lead_hours,36);
assert.equal(auth.arm.timing_budget.selected_budget_ms,2081804);
assert.equal(auth.arm.timing_budget.fixed_35_minute_lead_authorized,false);
assert.equal(auth.arm.pre_arm_store_modes.fresh_zero_state.mode,"FRESH_ZERO_STATE_PRE_ARM");
assert.equal(auth.arm.pre_arm_store_modes.fresh_zero_state.public_base_table_count,0);
assert.equal(auth.arm.pre_arm_store_modes.fresh_zero_state.public_routine_count,0);
const rearmMode=auth.arm.pre_arm_store_modes.governed_materialized_zero_rearm;
assert.equal(rearmMode.mode,"MATERIALIZED_ZERO_REARM");
assert.equal(rearmMode.eligibility_verifier_ref,REARM);
assert.equal(rearmMode.required_store_phase,"SCHEMA_ACL_MATERIALIZED_ZERO_ROWS_PRE_A0");
assert.equal(rearmMode.public_base_table_count,29);
assert.equal(rearmMode.public_routine_count,2);
assert.equal(rearmMode.all_table_rows_zero_required,true);
assert.equal(rearmMode.prior_arm_invalidated_by_non_authority_change_required,true);
assert.equal(rearmMode.prior_a0_artifact_absence_required,true);
assert.equal(rearmMode.prior_arm_artifact_overwrite_forbidden,true);
assert.equal(rearmMode.distinct_successor_arm_artifact_required,true);
assert.equal(rearmMode.database_reset_or_truncate_forbidden,true);
assert.equal(rearmMode.formal_database_mutation_allowed,false);
assert.equal(rearmMode.schema_acl_revalidation_required_after_arm,true);
assert.equal(rearmMode.historical_schema_materialization_proof_required,false);
assert.equal(rearmMode.historical_schema_materialization_proof_role,"OPTIONAL_CROSS_EVIDENCE_ONLY");
assert.equal(rearmMode.current_exact_store_readback_required,true);
assert.equal(rearmMode.post_rearm_schema_acl_idempotent_revalidation_required,true);
assert.equal(auth.schema_materialization.canonical_facts_schema_source,"docker/postgres/init/001_schema.sql");
assert.equal(auth.schema_materialization.canonical_facts_extraction_mode,"FACTS_ONLY");
assert.deepEqual(auth.schema_materialization.predecessor_schema_files,FORMAL_SCHEMA_MIGRATIONS.slice(0,5));
assert.deepEqual(auth.schema_materialization.v13_schema_files,FORMAL_SCHEMA_MIGRATIONS.slice(5));
const expectedFormalV5NewRelations=[
  "twin_external_formal_forcing_base_cursor_v1",
  "twin_external_formal_forcing_base_target_v1",
  "twin_external_formal_forcing_controller_lease_v1",
];
const expectedFormalV5PredecessorTables=EXPECTED_FORMAL_V5_PUBLIC_TABLES
  .filter((name)=>!expectedFormalV5NewRelations.includes(name))
  .sort();
assert.equal(auth.schema_materialization.exact_predecessor_public_table_count,26);
assert.deepEqual(
  [...auth.schema_materialization.exact_predecessor_public_table_set].sort(),
  expectedFormalV5PredecessorTables,
  "H6_AUTHORITY_EXACT_PREDECESSOR_TABLE_SET_REQUIRED",
);
assert.equal(auth.schema_materialization.exact_public_table_count_after_materialization,29);
assert.deepEqual(
  [...auth.schema_materialization.exact_public_table_set_after_materialization].sort(),
  [...EXPECTED_FORMAL_V5_PUBLIC_TABLES].sort(),
  "H6_AUTHORITY_EXACT_29_TABLE_SET_REQUIRED",
);
assert.equal(auth.schema_materialization.formal_store_must_be_zero_state_before_materialization,true);
assert.equal(auth.schema_materialization.materialized_zero_rearm_idempotent_revalidation_allowed,true);
assert.equal(auth.schema_materialization.materialized_zero_rearm_new_schema_creation_required,false);
assert.equal(auth.a0_adoption.historical_ea5e2_reference_database_forbidden,true);
assert.equal(auth.a0_adoption.provider_refetch_for_a0_forbidden,true);
assert.equal(auth.runtime_adoption.runtime_kernel_rewrite,false);
assert.equal(auth.runtime_adoption.scheduler_semantics_rewrite,false);
assert.equal(auth.runtime_adoption.github_production_wake_allowed,false);
assert.equal(auth.runtime_adoption.github_production_tick_allowed,false);
assert.equal(auth.owner_cutover.twin_double_owner_window_allowed,false);
const evidenceEpoch=auth.pre_arm_evidence_epoch_planning;
assert.equal(evidenceEpoch.status,"REQUIRED_BEFORE_H5_AND_ACTUAL_FORMAL_V5_ARM");
assert.equal(evidenceEpoch.owner_cutover_runner_ref,"scripts/runtime_acceptance/RUN_MCFT_CAP_09_PRODUCTION_RUNTIME_OWNER_CUTOVER_V1.cjs");
assert.equal(evidenceEpoch.epoch_selector_ref,"scripts/runtime_acceptance/MCFT_CAP_09_FORMAL_V5_EPOCH_CLOCK_SELECTOR_V1.cjs");
assert.equal(evidenceEpoch.candidate_contract_ref,"apps/server/src/runtime/mcft_cap09_formal_v5_evidence_runtime_handoff_authority_v1.ts");
assert.equal(evidenceEpoch.evidence_owner_entrypoint_ref,"apps/server/src/runtime/mcft_cap09_evidence_preformal_owner_runtime_v1.ts");
assert.equal(evidenceEpoch.candidate_materialized_during_fresh_owner_cutover,true);
assert.equal(evidenceEpoch.candidate_must_exist_before_evidence_owner_process_start,true);
assert.equal(evidenceEpoch.same_clock_selector_as_actual_formal_v5_arm_required,true);
assert.equal(evidenceEpoch.minimum_governance_lead_hours,36);
assert.deepEqual(evidenceEpoch.candidate_clock_fields,["A0","O00","O23","READINESS_DEADLINE"]);
assert.equal(evidenceEpoch.actual_arm_exact_candidate_clock_match_required,true);
assert.equal(evidenceEpoch.mismatch_policy,"FAIL_CLOSED_FRESH_OWNER_CUTOVER_H5_AND_ARM_REQUIRED");
assert.equal(evidenceEpoch.evidence_acquisition_may_begin_before_actual_formal_v5_arm,true);
assert.equal(evidenceEpoch.evidence_acquisition_stage_authority_required,false);
assert.equal(evidenceEpoch.governance_lead_controls_epoch_selection_not_provider_fetch,true);
assert.equal(evidenceEpoch.gfs_warm_start_due_window_start,"MAX(ACTIVATION_FENCE,A0_MINUS_PT70M)");
assert.equal(evidenceEpoch.gfs_provider_request_before_warm_start_due_window_authorized,false);
assert.equal(evidenceEpoch.evidence_owner_may_run_idle_before_gfs_due_window,true);
assert.equal(evidenceEpoch.o00_o23_goal,"REAL_UTC_RUNTIME_CONTINUITY_WITH_CAUSAL_INPUT_AVAILABILITY_NOT_PER_HOUR_PROVIDER_PERFECTION_REQUALIFICATION");
assert.equal(evidenceEpoch.future_stage_value_consulted,false);
assert.equal(evidenceEpoch.future_stage_authority_identity_frozen,false);
assert.equal(evidenceEpoch.evidence_owner_restart_candidate_valid_through,"O23_INCLUSIVE");
assert.equal(evidenceEpoch.evidence_owner_restart_after_o23_allowed,false);
for(const key of [
  "runtime_process_start_authorized","production_owner_activation_authorized",
  "formal_v5_arm_authorized","a0_authorized","o00_authorized",
  "formal_database_mutation_authorized","formal_raw_write_authorized",
  "runtime_config_write_authorized","scheduler_write_authorized"
])assert.equal(evidenceEpoch.candidate_authority_ceiling[key],false,"H6_EVIDENCE_EPOCH_CANDIDATE_CEILING:"+key);
assert.equal(evidenceEpoch.effect_source_for_running_evidence_process,"EXISTING_OWNER_CUTOVER_AUTHORITY_NOT_EPOCH_CANDIDATE");
assert.equal(evidenceEpoch.candidate_by_itself_provider_request_authorized,false);

const lanes=auth.runtime_validation_lanes;
assert.equal(lanes.principle,"TEST_EARLY_QUALIFY_LATE");
assert.equal(lanes.test_entry_must_not_require_conditions_the_test_itself_is_intended_to_prove,true);
assert.equal(lanes.lanes.length,3);
const accelerated=lanes.lanes.find(x=>x.run_class==="ACCELERATED_24T");
const rehearsal=lanes.lanes.find(x=>x.run_class==="QUALIFICATION_REHEARSAL");
const formalLane=lanes.lanes.find(x=>x.run_class==="FORMAL_CLOSURE");
assert.ok(accelerated&&rehearsal&&formalLane,"H6_RUNTIME_VALIDATION_LANES_REQUIRED");
assert.equal(accelerated.clock,"ACCELERATED_ENGINEERING_ONLY");
assert.equal(accelerated.formal_closure_evidence,false);
assert.equal(rehearsal.slot_labels,"R00_THROUGH_R23");
assert.equal(rehearsal.clock,"SYSTEM_AND_POSTGRESQL_UTC_WALL_CLOCK");
assert.equal(rehearsal.actual_utc_hourly_boundaries_required,24);
assert.equal(rehearsal.isolated_store_required,true);
assert.equal(rehearsal.same_production_binaries_required,true);
assert.equal(rehearsal.same_scheduler_required,true);
assert.equal(rehearsal.same_runtime_kernel_required,true);
assert.equal(rehearsal.provider_perfection_is_test_entry_requirement,false);
assert.equal(rehearsal.fresh_biological_stage_authority_required_for_test_entry,false);
assert.equal(rehearsal.formal_v5_arm_required,false);
assert.equal(rehearsal.formal_closure_evidence,false);
assert.equal(rehearsal.stage_1b_completion_claim,false);
assert.equal(formalLane.slot_labels,"O00_THROUGH_O23");
assert.equal(formalLane.exact_authority_binding_required,true);
assert.equal(formalLane.qualified_evidence_required,true);
assert.equal(formalLane.exact_sha_required,true);
assert.equal(formalLane.r2_evidence_required,true);
assert.equal(formalLane.zero_routine_manual_rescue_required,true);
assert.equal(formalLane.final_hard_acceptance_unchanged,true);
assert.deepEqual(lanes.rehearsal_nonclaims,[
  "R00_R23_IS_NOT_O00_O23",
  "NO_FORMAL_V5_EFFECT_FROM_REHEARSAL",
  "NO_STAGE_1B_CLOSURE_FROM_REHEARSAL",
  "NO_MCFT_CAP09_COMPLETION_FROM_REHEARSAL",
]);

assert.deepEqual(auth.execution_sequence.slice(0,3),[
  "FRESH_OWNER_CUTOVER_MATERIALIZES_PRE_ARM_EVIDENCE_EPOCH_CANDIDATE_AND_STARTS_EVIDENCE_OWNER",
  "REVERIFY_H5_EXACT_MAIN_AND_LIVE_OWNERS",
  "ARM_FRESH_V5_EPOCH_AND_REQUIRE_EXACT_PRE_ARM_EVIDENCE_EPOCH_MATCH",
]);
const expectedOperatorBindings=[
  "GEOX_MCFT_CAP09_FORMAL_V5_DATABASE_URL",
  "GEOX_MCFT_CAP09_FORMAL_V5_ADMIN_DATABASE_URL",
  "GEOX_MCFT_CAP09_EVIDENCE_RUNTIME_DATABASE_URL",
  "GEOX_MCFT_CAP09_EVIDENCE_S3_ENDPOINT",
  "GEOX_MCFT_CAP09_EVIDENCE_S3_BUCKET",
  "GEOX_MCFT_CAP09_EVIDENCE_S3_REGION",
  "GEOX_MCFT_CAP09_EVIDENCE_S3_ACCESS_KEY_ID",
  "GEOX_MCFT_CAP09_EVIDENCE_S3_SECRET_ACCESS_KEY",
  "GEOX_MCFT_CAP09_FORMAL_RAW_S3_ENDPOINT",
  "GEOX_MCFT_CAP09_FORMAL_RAW_S3_BUCKET",
  "GEOX_MCFT_CAP09_FORMAL_RAW_S3_REGION",
  "GEOX_MCFT_CAP09_FORMAL_RAW_S3_ACCESS_KEY_ID",
  "GEOX_MCFT_CAP09_FORMAL_RAW_S3_SECRET_ACCESS_KEY",
].sort();
assert.equal(auth.operator_bindings.secret_values_in_repository_forbidden,true);
assert.equal(auth.operator_bindings.github_actions_effectful_operator_binding_allowed,false);
assert.equal(auth.operator_bindings.exact_required_secret_binding_count,13);
assert.deepEqual([...auth.operator_bindings.required_secret_binding_names].sort(),expectedOperatorBindings);
assert.equal(auth.operator_bindings.arm_read_only_formal_database.default_transaction_read_only_required,true);
assert.equal(auth.operator_bindings.formal_v5_admin_database.github_actions_allowed,false);
assert.equal(auth.operator_bindings.production_evidence_source.required_login,"geox_mcft_cap09_evidence_runtime_login_v1");
assert.equal(auth.operator_bindings.production_evidence_source.default_transaction_read_only_required_for_a0_replay,true);
assert.equal(auth.operator_bindings.production_evidence_source.s3.bucket,"geox-mcft-cap09-evidence-runtime-v1");
assert.equal(auth.operator_bindings.production_evidence_source.s3.access_mode_for_a0_replay,"HEAD_GET_ONLY");
assert.equal(auth.operator_bindings.formal_raw_store.bucket,"geox-mcft-cap09-formal-raw-v1");
assert.equal(auth.operator_bindings.formal_raw_store.access_mode_for_a0_replay,"PUT_HEAD_AFTER_SOURCE_RAW_VERIFICATION");
for(const value of Object.values(auth.candidate_non_effects))assert.ok(value===false||value===0,"H6_CANDIDATE_NON_EFFECT_REQUIRED");

const arm=read(ARM);
for(const value of [
  "FORMAL_V5_ARM_LOCAL_NON_GITHUB_HOST_ONLY",
  "--operator-authorized",
  "VERIFY_MCFT_CAP_09_FORMAL_V5_POST_GRADUATION_ARM_READINESS_V1.cjs",
  "AUDIT_MCFT_CAP_09_PHASE6_GITHUB_PRODUCTION_OWNERS_V1.cjs",
  "geox_mcft_cap09_s6_formal_t4r1_24h_v5",
  "default_transaction_read_only=on",
  "selected_budget_ms===2081804",
  "fixed_35_minute_lead_authorized_for_v5===false",
  "minimum_epoch_selection_governance_lead_hours:36",
  "formal_runtime_config_pins_frozen:false",
  "formal_stage_authority_pins_frozen:false",
  "h6_stage_successor_materialization_still_required:true",
  "MATERIALIZED_ZERO_REARM",
  "FORMAL_V5_REARM_DISTINCT_ARM_OUTPUT_REQUIRED",
  "materialized_zero_rearm_revalidated_at_actual_arm",
  "schema_acl_revalidation_required_after_arm:true",
])marker(arm,value,"H6_ARM_MARKER_REQUIRED");
for(const value of [
  "geox_mcft_cap09_s6_formal_t4r1_24h_v4",
  "MIN_ARM_TO_O00_LEAD_MINUTES",
  "GITHUB_EVENT_NAME",
  "workflow_dispatch",
])notMarker(arm,value,"H6_ARM_HISTORICAL_PATH_FORBIDDEN");

const rearmVerifier=read(REARM);
for(const value of [
  "FORMAL_V5_REARM_LOCAL_PRODUCTION_HOST_ONLY",
  "SCHEMA_ACL_MATERIALIZED_ZERO_ROWS_PRE_A0",
  "FORMAL_V5_REARM_PRIOR_ARM_NOT_INVALIDATED_BY_SEMANTIC_CHANGE",
  "FORMAL_V5_REARM_PRE_A0_ROWS_NONZERO",
  "existing_arm_artifact_must_not_be_overwritten:true",
  "new_arm_output_must_be_distinct:true",
  "schema_acl_revalidation_required_after_rearm:true",
  'prior_schema_proof_role:"OPTIONAL_CROSS_EVIDENCE_ONLY"',
  "current_exact_store_readback_is_authoritative_for_rearm_eligibility:true",
  "post_rearm_schema_acl_idempotent_revalidation_required:true",
  "formal_database_mutation:false",
])marker(rearmVerifier,value,"H6_REARM_MARKER_REQUIRED");
for(const value of ["DROP DATABASE","TRUNCATE ","DELETE FROM ","CREATE DATABASE"])notMarker(rearmVerifier,value,"H6_REARM_DESTRUCTIVE_DATABASE_PATH_FORBIDDEN");

const schema=read(SCHEMA);
for(const value of [
  "FORMAL_V5_SCHEMA_ACL_LOCAL_NON_GITHUB_HOST_ONLY",
  "geox_mcft_cap09_s6_formal_t4r1_24h_v5",
  "FORMAL_V5_SCHEMA_ACL_PARTIAL_TABLE_STATE_FORBIDDEN",
  "FORMAL_V5_SCHEMA_ACL_PARTIAL_ROUTINE_STATE_FORBIDDEN",
  "assert.equal(midTables.length,29",
  "mcft_cap09_twin_runtime_append_fact_v1",
  "mcft_cap09_v13_evidence_runtime_append_exact_base_facts_v1",
  "FORMAL_V5_SCHEMA_ACL_FACTS_MATRIX_MISMATCH",
  "FORMAL_V5_SCHEMA_ACL_FORCING_MATRIX_MISMATCH",
  "GRANTED BY CURRENT_USER RESTRICT",
  "m.set_option",
  "FORMAL_V5_SCHEMA_ACL_TEMP_OWNER_SET_MEMBERSHIP_MUST_BE_REVOKED",
  "FORMAL_V5_SCHEMA_ACL_EFFECTIVE_SET_AUTHORITY_MUST_BE_ZERO",
  "FORMAL_V5_SCHEMA_ACL_TEMP_OWNER_SELF_GRANT_MUST_BE_ZERO",
  "provider_request_count:0",
])marker(schema,value,"H6_SCHEMA_MARKER_REQUIRED");
notMarker(schema,"runSqlMigrations","H6_SCHEMA_GENERIC_MIGRATION_LEDGER_FORBIDDEN");
notMarker(schema,"external_evidence_producer_lease_v1","H6_FORMAL_STORE_OPERATIONAL_EVIDENCE_LEASE_FORBIDDEN");
notMarker(schema,"external_evidence_supply_cursor_v1","H6_FORMAL_STORE_OPERATIONAL_EVIDENCE_CURSOR_FORBIDDEN");
for(const value of [
  "CANONICAL_FACTS_SCHEMA",
  "2026_07_13_mcft_cap_04_forecast_scenario_persistence.sql",
  "2026_07_14_mcft_cap_05_feedback_persistence.sql",
  "2026_08_06_mcft_cap_09_s3_persistent_sequential_scheduler.sql",
  "EXPECTED_PUBLIC_TABLES",
  "FORMAL_V5_SCHEMA_ACL_EXACT_29_TABLE_SET_REQUIRED",
  "FORMAL_V5_SCHEMA_ACL_MATERIALIZED_TABLE_SET_MISMATCH",
])marker(schema,value,"H6_SCHEMA_COMPOSITION_MARKER_REQUIRED");
notMarker(schema,"field_index_v1","H6_FORMAL_V5_GENERIC_FIELD_SCHEMA_FORBIDDEN");
notMarker(schema,"device_index_v1","H6_FORMAL_V5_GENERIC_DEVICE_SCHEMA_FORBIDDEN");
const composedFormalTables=[
  "facts",
  ...FORMAL_SCHEMA_MIGRATIONS.flatMap(createTableNames),
].sort();
assert.deepEqual(
  composedFormalTables,
  EXPECTED_FORMAL_V5_PUBLIC_TABLES,
  "H6_FORMAL_V5_EXACT_29_TABLE_COMPOSITION_REQUIRED",
);

const runner=read(RUNNER);
for(const value of [
  "ExternalFormalV4Amendment19RunnerV2",
  "ExternalFormalV5ViabilityGatedSchedulerV1",
  "ExternalFormalNextTickNotViablePreclaimErrorV1",
  "requireLastTerminalSuccessorAdjudication",
  "provider_request_count: 0",
  "r2_request_count: 0",
])marker(runner,value,"H6_RUNNER_COMPOSITION_MARKER_REQUIRED");
notMarker(runner,"new Postgres","H6_RUNNER_NEW_PERSISTENCE_FORBIDDEN");
notMarker(runner,"fetch(","H6_RUNNER_PROVIDER_FETCH_FORBIDDEN");

const runnerAccept=read(RUNNER_ACCEPT);
for(const value of [
  "preclaim_nonviability_prevents_underlying_claim:true",
  "post_commit_adjudication_failure_does_not_reterminalize_predecessor:true",
  "scheduler_semantics_rewritten:false",
  "persistent_tick_semantics_rewritten:false",
  "runtime_kernel_rewritten:false",
])marker(runnerAccept,value,"H6_RUNNER_ACCEPTANCE_MARKER_REQUIRED");

const a0Replay=read(A0_REPLAY);
for(const value of [
  "FORMAL_V5_A0_REPLAY_LOCAL_NON_GITHUB_HOST_ONLY",
  "FORMAL_V5_A0_REPLAY_SOURCE_READ_ONLY_REQUIRED",
  "PostgresGfsCanonicalTargetPairHistoryV1",
  "from_target_logical_time:a0",
  "a0_base_supports_o00_warm_start:true",
  "buildFrozenEvidenceWindowV1",
  "PostgresExternalEvidenceFactReplayProvenanceV1",
  "S3CompatiblePrivateRetainedRawReaderV1",
  "createFormalDurableRawEvidenceRetentionAdapterV1",
  "GfsRawBundleEvidenceDecoderV1(a0",
  "KbsVariate25SoilEvidenceDecoderV1",
  "normalized_semantic_equivalence_verified:true",
  "exact_cross_bucket_fact_identity_preserved:false",
  "provider_request_count:0",
  "a0_bootstrap:false",
  "formal_o00_started:false",
])marker(a0Replay,value,"H6_A0_REPLAY_MARKER_REQUIRED");
for(const value of [
  "REFERENCE_DATABASE_URL",
  "ea5e2_readiness",
  "MCFT_EA5E2_TRANSIENT_S3_",
  "fetch(",
])notMarker(a0Replay,value,"H6_A0_HISTORICAL_OR_PROVIDER_PATH_FORBIDDEN");

const v5Bundle=read(V5_BUNDLE);
for(const value of [
  "buildExternalFormalPrewindowAuthorityBundleV4",
  "compileExternalFormalRuntimeConfigV1",
  "MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_REF_V5",
  "GEOX-MCFT-CAP-09-T4R1-ACTUAL-FORMAL-STORE-AUTHORITY-V3.json",
  "V4_DATABASE_AUTHORITY_RESIDUAL_FORBIDDEN",
  "EXTERNAL_FORMAL_V5_EXACT_24_HOURLY_CONFIGS_REQUIRED",
])marker(v5Bundle,value,"H6_V5_BUNDLE_MARKER_REQUIRED");
const v5BundleTest=read(V5_BUNDLE_TEST);
for(const value of [
  "preserves A18 stage pins while rebinding only fresh-store authority",
  "inherits fail-closed A18 forward-stability boundary",
  "never exposes the V4 fresh-store authority",
])marker(v5BundleTest,value,"H6_V5_BUNDLE_TEST_MARKER_REQUIRED");

const qcp=JSON.parse(read(QCP));
const h6Resolver=qcp.dependency_resolvers?.FORMAL_V5_H6_SUCCESSOR_SEAM_V1;
assert.ok(h6Resolver,"H6_QCP_SUCCESSOR_RESOLVER_REQUIRED");
assert.equal(h6Resolver.kind,"EXACT_PATH_SET");
for(const rel of [RUNNER,V5_BUNDLE,V5_BUNDLE_TEST,V5_MANIFEST,V5_MANIFEST_TEST,A0_REPLAY,REARM]){
  assert.ok(h6Resolver.paths.includes(rel),"H6_QCP_SUCCESSOR_PATH_REQUIRED:"+rel);
}
const v13Runtime=qcp.dependency_resolvers?.V13_RUNTIME_SEMANTIC_CLOSURE;
assert.ok(v13Runtime,"H6_QCP_V13_RUNTIME_RESOLVER_REQUIRED");
assert.equal(
  (v13Runtime.additional_exact_paths||[]).includes(RUNNER),
  false,
  "H6_QCP_RUNNER_MUST_NOT_REOPEN_FROZEN_V13_PRODUCER_CLOSURE",
);
const twinV2=qcp.dependency_resolvers?.TWIN_V2_STAGE_AUTHORITY_SUCCESSOR_V1;
assert.ok(twinV2,"H6_QCP_TWIN_V2_RESOLVER_REQUIRED");
for(const rel of [V5_BUNDLE,V5_BUNDLE_TEST,V5_MANIFEST,V5_MANIFEST_TEST]){
  assert.equal(
    (twinV2.paths||[]).includes(rel),
    false,
    "H6_QCP_CONSUMER_MUST_NOT_REOPEN_TWIN_V2_PRODUCER_AUTHORITY:"+rel,
  );
}
const h6Check=(qcp.checks||[]).find((row)=>row.check_id==="FORMAL_V5_H6_SUCCESSOR_SEAM");
assert.ok(h6Check,"H6_QCP_SUCCESSOR_CHECK_REQUIRED");
assert.deepEqual(h6Check.resolver_ids,["FORMAL_V5_H6_SUCCESSOR_SEAM_V1"]);
assert.deepEqual(h6Check.applicable_stages,["SUCCESSOR_SUBJECT_PRE_MERGE","POST_MERGE_V13_QUALIFICATION"]);
assert.equal(h6Check.carry_forward_policy,"NONE");
assert.equal(h6Check.fail_policy,"FAIL_CLOSED_NO_FORMAL_ARM_OR_DATABASE_EFFECT");
const formalActivation=(qcp.checks||[]).find((row)=>row.check_id==="FORMAL_V5_ACTIVATION");
assert.ok(formalActivation,"H6_QCP_FORMAL_ACTIVATION_CHECK_REQUIRED");
assert.deepEqual(formalActivation.applicable_stages,["POST_GRADUATION_FORMAL_V5_ACTIVATION"]);

assert.equal(git("merge-base",BASE,"HEAD"),BASE,"H6_EXACT_PREDECESSOR_MUST_BE_ANCESTOR");
for(const frozen of FROZEN){
  assert.equal(git("rev-parse","HEAD:"+frozen),git("rev-parse",BASE+":"+frozen),"H6_HISTORICAL_OR_PRODUCTION_V2_REWRITE_FORBIDDEN:"+frozen);
}
const changed=git("diff","--name-only",BASE+"...HEAD").split(/\r?\n/).filter(Boolean);
const allowedDomainSuccessors=new Set([V5_BUNDLE,V5_BUNDLE_TEST]);
for(const rel of changed){
  assert.equal(rel.startsWith("apps/web/"),false,"H6_WEB_CHANGE_FORBIDDEN:"+rel);
  if(rel.startsWith("apps/server/src/domain/")&&!allowedDomainSuccessors.has(rel)){
    assert.fail("H6_DOMAIN_KERNEL_CHANGE_FORBIDDEN:"+rel);
  }
}
const githubChanges=changed.filter((rel)=>rel.startsWith(".github/workflows/"));
const allowedGithubQualificationChanges=new Set([
  ".github/workflows/mcft-cap-09-formal-v5-post-graduation-readiness.yml",
  ".github/workflows/mcft-cap-09-phase3-evidence-runtime-persistence.yml",
  ".github/workflows/mcft-cap-09-phase5-two-service-accelerated-24t.yml",
  ".github/workflows/mcft-cap-09-production-runtime-owner-cutover-v1.yml",
  ".github/workflows/mcft-cap-09-v13-holistic-schema-postgres.yml",
  ".github/workflows/mcft-cap-09-v13-autonomous-forcing-foundation.yml",
  ".github/workflows/mcft-cap-09-phase7-candidate-promotion-composition.yml",
  ".github/workflows/mcft-cap-09-v13-next-tick-viability-postgres.yml",
  ".github/workflows/mcft-cap-09-final-semantic-closure.yml",
]);
for(const rel of githubChanges){
  assert.equal(allowedGithubQualificationChanges.has(rel),true,"H6_UNGOVERNED_GITHUB_WORKFLOW_CHANGE:"+rel);
  if(rel!==".github/workflows/mcft-cap-09-formal-v5-post-graduation-readiness.yml"){
    const workflow=read(rel);
    const triggerBlock=workflow.match(/^on:\n[\s\S]*?^permissions:/m)?.[0]??"";
    assert.ok(triggerBlock,"H6_SCHEMA_QUALIFICATION_TRIGGER_BLOCK_REQUIRED:"+rel);
    assert.equal(/^  schedule:/m.test(triggerBlock),false,"H6_SCHEMA_QUALIFICATION_SCHEDULE_FORBIDDEN:"+rel);
    notMarker(workflow,"GEOX_MCFT_CAP09_T4R1_S6_DATABASE_URL: ${{ secrets.","H6_SCHEMA_QUALIFICATION_PRODUCTION_DB_SECRET_FORBIDDEN");
  }
}

const proof={
  schema_version:"geox_mcft_cap09_formal_v5_h6_production_activation_seam_acceptance_v1",
  status:"PASS",
  exact_predecessor_sha:BASE,
  subject_head_sha:git("rev-parse","HEAD"),
  changed_file_count:changed.length,
  historical_formal_execution_files_rewritten:false,
  production_v2_default_rewritten:false,
  runtime_kernel_rewritten:false,
  scheduler_semantics_rewritten:false,
  new_database_schema_designed:false,
  github_production_execution_reintroduced:false,
  explicit_v5_physical_store_identity:true,
  pre_arm_evidence_epoch_candidate_required:true,
  evidence_acquisition_decoupled_from_future_stage_authority:true,
  governance_lead_decoupled_from_provider_fetch_timing:true,
  test_early_qualify_late_lanes_frozen:true,
  real_clock_rehearsal_non_authority_bearing:true,
  formal_o00_o23_hard_acceptance_unchanged:true,
  actual_arm_exact_pre_arm_evidence_epoch_match_required:true,
  local_operator_arm_surface_present:true,
  governed_materialized_zero_rearm_surface_present:true,
  prior_arm_overwrite_forbidden:true,
  destructive_store_reset_for_rearm_forbidden:true,
  local_operator_secret_binding_contract_frozen:true,
  fresh_v5_schema_acl_surface_present:true,
  v5_stage_aware_runner_composition_present:true,
  v5_store_bound_prewindow_config_successor_present:true,
  a18_dt02_stage_semantics_reused_without_v4_rewrite:true,
  a0_production_replay_promotion_surface_present:true,
  h6_successor_consumer_resolver_present:true,
  frozen_v13_and_twin_v2_producer_resolvers_not_reopened_by_h6_consumers:true,
  source_operational_database_read_only_contract_present:true,
  production_to_formal_raw_store_transition_explicit:true,
  cross_bucket_fact_identity_promotion_forbidden:true,
  actual_formal_v5_arm:false,
  formal_database_mutation:false,
  a0_bootstrap:false,
  o00_started:false,
  mcft_cap09_completed:false,
};
fs.mkdirSync(path.join(ROOT,"acceptance-output"),{recursive:true});
fs.writeFileSync(path.join(ROOT,"acceptance-output/MCFT_CAP_09_FORMAL_V5_H6_PRODUCTION_ACTIVATION_SEAM_V1_RESULT.json"),JSON.stringify(proof,null,2)+"\n");
console.log(JSON.stringify(proof,null,2));

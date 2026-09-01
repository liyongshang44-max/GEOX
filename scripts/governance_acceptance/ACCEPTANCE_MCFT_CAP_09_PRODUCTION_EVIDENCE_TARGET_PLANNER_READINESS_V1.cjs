#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const cp = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const AUTHORITY_REF = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-EVIDENCE-TARGET-PLANNER-READINESS-V1.json";
const HOST_AUTHORITY_REF = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-NON-GITHUB-HOST-BINDING-AUTHORITY-V1.json";
const OUT = path.join(ROOT, "acceptance-output/MCFT_CAP_09_PRODUCTION_EVIDENCE_TARGET_PLANNER_READINESS_V1_RESULT.json");

const read = (ref) => fs.readFileSync(path.join(ROOT, ref), "utf8");
const json = (ref) => JSON.parse(read(ref));
const includes = (text, marker, code) => assert.ok(text.includes(marker), code);
const write = (value) => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(value, null, 2) + "\n");
  console.log(JSON.stringify(value, null, 2));
};

try {
  const authority = json(AUTHORITY_REF);
  const hostAuthority = json(HOST_AUTHORITY_REF);
  const subject = String(process.env.SUBJECT_SHA || cp.execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" })).trim();
  assert.match(subject, /^[0-9a-f]{40}$/, "EVIDENCE_TARGET_PLANNER_READINESS_SUBJECT_REQUIRED");

  assert.equal(authority.schema_version, "geox_mcft_cap09_production_evidence_target_planner_readiness_v1");
  assert.equal(authority.status, "KBS_HISTORICAL_PREFIX_COMPARISON_IMPLEMENTED_REMEDIATION_READY_NOT_AUTHORIZED");
  assert.equal(authority.stage, "POST_LOCAL_STATIC_MACHINE_ADMISSION_PRE_RUNTIME_START");
  assert.equal(authority.subject_predecessor_sha, "ac753bcef691a20c6f1429cd6d86e6a5a59a45d9");
  cp.execFileSync("git", ["merge-base", "--is-ancestor", authority.subject_predecessor_sha, subject]);

  assert.equal(hostAuthority.next_stage?.local_24h_host_preflight_status, "PASS_STATIC_MACHINE_ADMISSION_PARENT_SUBJECT");
  assert.equal(hostAuthority.next_stage?.evidence_production_target_planner_status, "NOT_BOUND");
  assert.equal(hostAuthority.next_stage?.evidence_production_compiled_entrypoint_status, "PACKAGED_FAIL_CLOSED_TARGET_PLANNER_UNBOUND");

  const workItems = read(authority.production_work_item_factory_ref);
  includes(workItems, "new KbsRawHourlyLiveTransportV1", "KBS_CURRENT_EXACT_TARGET_TRANSPORT_REQUIRED");
  includes(workItems, "new KbsRawHourlyExactIntervalDecoderV1(target", "KBS_CURRENT_EXACT_TARGET_DECODER_REQUIRED");
  includes(workItems, "buildKbsRawHourlyBatch", "KBS_MULTI_INTERVAL_FACTORY_PATH_REQUIRED");
  includes(workItems, "new KbsRawHourlyMultiIntervalDecoderV1", "KBS_MULTI_INTERVAL_DECODER_BINDING_REQUIRED");
  const kbsProvider = read("apps/server/src/external_evidence/provider/kbs_raw_hourly_live_provider_v1.ts");
  includes(kbsProvider, "KbsRawHourlyMultiIntervalDecoderV1", "KBS_MULTI_INTERVAL_DECODER_REQUIRED");
  includes(kbsProvider, "drafts.length === this.target_interval_ends.length * 2", "KBS_MULTI_INTERVAL_EXACT_TWO_DRAFTS_PER_TARGET_REQUIRED");

  const cursor = read(authority.durable_cursor_ref);
  includes(cursor, "binding_id=$7 AND origin_source_id=$8", "EVIDENCE_CURSOR_EXACT_BINDING_ORIGIN_READ_REQUIRED");
  includes(cursor, "readSupplyCursorsByBindings", "EVIDENCE_CURSOR_BINDING_SET_READ_REQUIRED");
  includes(cursor, "binding_id = ANY($7::text[])", "EVIDENCE_CURSOR_BINDING_SET_SQL_REQUIRED");

  const sourceProgress = read(authority.source_progress_ref);
  includes(sourceProgress, "EvidenceSourceSpecificProgressReaderV1", "SOURCE_PROGRESS_READER_REQUIRED");
  includes(sourceProgress, "MCFT_CAP09_KBS_RAIN_ORIGIN_SOURCE_ID_V1", "KBS_PAIR_PROGRESS_REQUIRED");
  includes(sourceProgress, "gfsCycleIdentityV1", "GFS_CROSS_CYCLE_PROGRESS_REQUIRED");
  includes(sourceProgress, "PRODUCTION_EVIDENCE_GFS_PAIR_VALID_FROM_SKEW", "GFS_PAIR_SKEW_FAIL_CLOSED_REQUIRED");
  includes(sourceProgress, "MCFT_CAP09_KBS_SOIL_ORIGIN_SOURCE_ID_V1", "SOIL_LATEST_PROGRESS_REQUIRED");

  const horizonAuthority = json(authority.acquisition_horizon_authority_ref);
  assert.equal(horizonAuthority.status, "ESTABLISHED_FULL_TABLE_BASELINE_POLICY_NO_ACTIVE_INSTANCE");
  assert.equal(horizonAuthority.decisive_ruling.activation_fence_source, "SEPARATE_PRODUCTION_RUNTIME_START_AUTHORITY");
  assert.equal(horizonAuthority.decisive_ruling.activation_fence_may_come_from_wall_clock_alone, false);
  assert.equal(horizonAuthority.decisive_ruling.formal_forcing_budget_may_define_bootstrap_horizon, false);
  assert.equal(horizonAuthority.decisive_ruling.fixed_historical_lookback_hours, null);
  assert.equal(horizonAuthority.bootstrap_policy.kbs_raw_hourly.endpoint_shape, "COMPLETE_ACCUMULATED_TABLE");
  assert.equal(horizonAuthority.bootstrap_policy.kbs_raw_hourly.baseline_canonical_emission_count, 0);
  assert.equal(horizonAuthority.bootstrap_policy.kbs_raw_hourly.first_canonical_emission_requires_observed_post_baseline_forward_event_delta, true);
  assert.equal(horizonAuthority.bootstrap_policy.kbs_raw_hourly.fixed_latest_24_rows_assumption_authorized, false);
  assert.equal(horizonAuthority.bootstrap_policy.kbs_raw_hourly.non_authoritative_daily_batch_operating_profile_may_define_promotion_set, false);
  assert.equal(horizonAuthority.restart_policy.kbs_publication_baseline_must_be_durable_when_no_evidence_progress, true);
  assert.equal(horizonAuthority.restart_policy.in_memory_only_kbs_baseline_sufficient_for_production, false);
  assert.equal(horizonAuthority.bootstrap_policy.gfs_bundle.historical_cycle_sweep_authorized, false);
  assert.equal(horizonAuthority.bootstrap_policy.kbs_soil.historical_event_scan_authorized, false);
  assert.equal(horizonAuthority.bootstrap_policy.kbs_soil.explicit_poll_due_policy_established, false);
  assert.equal(horizonAuthority.restart_policy.bootstrap_rewind_authorized, false);
  assert.equal(horizonAuthority.runtime_start_binding.active_horizon_instance_bound, false);

  const horizonContract = read(authority.acquisition_horizon_contract_ref);
  includes(horizonContract, "materializeProductionEvidenceAcquisitionHorizonV1", "PRODUCTION_EVIDENCE_HORIZON_TYPED_CONTRACT_REQUIRED");
  includes(horizonContract, "MCFT_CAP09_SEPARATE_PRODUCTION_RUNTIME_START_AUTHORITY", "PRODUCTION_EVIDENCE_HORIZON_RUNTIME_START_AUTHORITY_CLASS_REQUIRED");
  includes(horizonContract, "FIRST_RETAINED_FULL_TABLE_SNAPSHOT_ESTABLISHES_PRIVATE_PUBLICATION_BASELINE_NO_CANONICAL_EMISSION", "PRODUCTION_EVIDENCE_HORIZON_KBS_BASELINE_REQUIRED");
  includes(horizonContract, "EVENT_TIME_PLUS_ROW_IDENTITY_HASH", "PRODUCTION_EVIDENCE_HORIZON_KBS_DIFF_IDENTITY_REQUIRED");
  includes(horizonContract, "ONE_PROVIDER_SELECTED_CYCLE", "PRODUCTION_EVIDENCE_HORIZON_GFS_CYCLE_BOUND_REQUIRED");
  assert.equal(horizonContract.includes("Date.now"), false, "PRODUCTION_EVIDENCE_HORIZON_WALL_CLOCK_READ_FORBIDDEN");
  assert.equal(horizonContract.includes("process.env"), false, "PRODUCTION_EVIDENCE_HORIZON_ENV_READ_FORBIDDEN");

  const kbsSnapshotInspector = read(authority.kbs_publication_snapshot_inspector_ref);
  includes(kbsSnapshotInspector, "KbsRawHourlyPublicationSnapshotInspectorV1", "KBS_PUBLICATION_SNAPSHOT_INSPECTOR_REQUIRED");
  includes(kbsSnapshotInspector, '"NO_CHANGE" | "FORWARD_DELTA" | "AMBIGUOUS_FORWARD"', "KBS_PUBLICATION_DIFF_STATE_REQUIRED");
  includes(kbsSnapshotInspector, "revision_or_backfill_auto_promotion_authorized", "KBS_REVISION_BACKFILL_NONPROMOTION_REQUIRED");
  const kbsBaselineStore = read(authority.kbs_publication_baseline_store_ref);
  includes(kbsBaselineStore, "S3CompatibleKbsRawHourlyPublicationBaselineStoreV1", "KBS_PRIVATE_BASELINE_STORE_REQUIRED");
  includes(kbsBaselineStore, "PRIVATE_KBS_RAW_HOURLY_PUBLICATION_BASELINE", "KBS_PRIVATE_BASELINE_OBJECT_CLASS_REQUIRED");
  includes(kbsBaselineStore, "current_pointer_bound: false", "KBS_BASELINE_POINTER_MUST_REMAIN_UNBOUND");
  assert.equal(kbsBaselineStore.includes("INSERT INTO"), false, "KBS_BASELINE_STORE_DATABASE_WRITE_FORBIDDEN");
  const kbsBaselinePointerContract = read(authority.kbs_publication_baseline_pointer_contract_ref);
  includes(kbsBaselinePointerContract, "KbsRawHourlyPublicationBaselinePointerPortV1", "KBS_BASELINE_POINTER_CONTRACT_REQUIRED");
  includes(kbsBaselinePointerContract, "expected_previous_digest", "KBS_BASELINE_POINTER_PREDECESSOR_CAS_REQUIRED");
  const kbsBaselinePointerRepo = read(authority.kbs_publication_baseline_pointer_repository_ref);
  includes(kbsBaselinePointerRepo, "KBS_BASELINE_POINTER_STALE_FENCE", "KBS_BASELINE_POINTER_STALE_FENCE_REQUIRED");
  includes(kbsBaselinePointerRepo, "KBS_BASELINE_POINTER_EXPECTED_PREDECESSOR_MISMATCH", "KBS_BASELINE_POINTER_CAS_REQUIRED");
  includes(kbsBaselinePointerRepo, "KBS_BASELINE_POINTER_LATEST_EVENT_MUST_STRICTLY_ADVANCE", "KBS_BASELINE_POINTER_MONOTONE_LATEST_REQUIRED");
  includes(kbsBaselinePointerRepo, "kbs_raw_hourly_baseline_writer_fencing_token", "KBS_BASELINE_POINTER_WRITER_FENCE_REQUIRED");
  assert.equal(kbsBaselinePointerRepo.includes("RuntimeTickCursor"), true, "KBS_BASELINE_POINTER_BOUNDARY_COMMENT_REQUIRED");
  assert.equal(kbsBaselinePointerRepo.includes("fetch("), false, "KBS_BASELINE_POINTER_PROVIDER_FETCH_FORBIDDEN");
  const kbsBaselinePointerMigration = read(authority.kbs_publication_baseline_pointer_migration_ref);
  includes(kbsBaselinePointerMigration, "ALTER TABLE public.external_evidence_producer_lease_v1", "KBS_BASELINE_POINTER_LEASE_EXTENSION_REQUIRED");
  assert.equal(kbsBaselinePointerMigration.includes("CREATE TABLE"), false, "KBS_BASELINE_POINTER_NEW_TABLE_FORBIDDEN");

  const kbsProductionPointerRemediationAuthority = json(authority.kbs_production_baseline_pointer_schema_remediation_authority_ref);
  assert.equal(kbsProductionPointerRemediationAuthority.status, "READY_NOT_AUTHORIZED");
  assert.equal(kbsProductionPointerRemediationAuthority.target.database_name, "geox_mcft_cap09_production_runtime_v1");
  assert.equal(kbsProductionPointerRemediationAuthority.target.expected_table_count, 41);
  assert.equal(kbsProductionPointerRemediationAuthority.target.new_table_count_authorized, 0);
  assert.equal(kbsProductionPointerRemediationAuthority.authorization.production_kbs_baseline_pointer_schema_remediation_authorized, false);
  assert.equal(kbsProductionPointerRemediationAuthority.authorization.runtime_process_start_authorized, false);
  assert.equal(kbsProductionPointerRemediationAuthority.migration_ref, authority.kbs_publication_baseline_pointer_migration_ref);
  const kbsProductionPointerArm = json(authority.kbs_production_baseline_pointer_schema_remediation_arm_ref);
  assert.equal(kbsProductionPointerArm.armed, false);
  assert.equal(kbsProductionPointerArm.exact_target_database_name, null);
  assert.equal(kbsProductionPointerArm.production_kbs_baseline_pointer_schema_remediation_authorized, false);
  const kbsProductionPointerWorkflow = read(authority.kbs_production_baseline_pointer_schema_remediation_workflow_ref);
  includes(kbsProductionPointerWorkflow, "Read-only exact production KBS pointer schema preflight", "KBS_POINTER_PRODUCTION_READ_ONLY_PREFLIGHT_REQUIRED");
  includes(kbsProductionPointerWorkflow, "Apply pointer schema only when separately armed", "KBS_POINTER_PRODUCTION_SEPARATE_ARM_REQUIRED");

  const kbsSnapshotComparison = read(authority.kbs_publication_snapshot_comparison_ref);
  includes(kbsSnapshotComparison, "HISTORICAL_DRIFT", "KBS_HISTORICAL_DRIFT_STATE_REQUIRED");
  includes(kbsSnapshotComparison, "BASELINE_POINTER_SNAPSHOT_MISMATCH", "KBS_BASELINE_SNAPSHOT_IDENTITY_BOUNDARY_REQUIRED");
  includes(kbsSnapshotComparison, "historical_revision_or_backfill_auto_promotion_authorized", "KBS_HISTORICAL_AUTO_PROMOTION_FORBIDDEN_MARKER_REQUIRED");
  assert.equal(kbsSnapshotComparison.includes("fetch("), false, "KBS_SNAPSHOT_COMPARISON_PROVIDER_FETCH_FORBIDDEN");
  assert.equal(kbsSnapshotComparison.includes("INSERT INTO"), false, "KBS_SNAPSHOT_COMPARISON_DB_WRITE_FORBIDDEN");

  const purePlanner = read(authority.pure_source_planner_ref);
  includes(purePlanner, "planProductionEvidenceSourcesV1", "PURE_SOURCE_SPECIFIC_PLANNER_REQUIRED");
  includes(purePlanner, "KBS_RAW_HOURLY_PUBLICATION_BASELINE_REQUIRED", "KBS_PUBLICATION_BASELINE_PLAN_REQUIRED");
  includes(purePlanner, "KBS_RAW_HOURLY_PUBLICATION_DIFF_REQUIRED", "KBS_PUBLICATION_DIFF_PLAN_REQUIRED");
  includes(purePlanner, "GFS_TARGET_ALREADY_DURABLE", "GFS_DURABLE_TARGET_DEDUP_REQUIRED");
  includes(purePlanner, "GFS_PARTIAL_PAIR_REHYDRATION_REQUIRED", "GFS_PARTIAL_PAIR_REHYDRATION_PLAN_REQUIRED");
  includes(purePlanner, "KBS_SOIL_CURRENT_ACQUIRE", "SOIL_EXPLICIT_DUE_ACTION_REQUIRED");
  assert.equal(purePlanner.includes("Date.now"), false, "PURE_PLANNER_WALL_CLOCK_READ_FORBIDDEN");
  assert.equal(purePlanner.includes("process.env"), false, "PURE_PLANNER_ENV_READ_FORBIDDEN");
  assert.equal(purePlanner.includes("new Postgres"), false, "PURE_PLANNER_DATABASE_ADAPTER_FORBIDDEN");
  assert.equal(purePlanner.includes("fetch("), false, "PURE_PLANNER_PROVIDER_FETCH_FORBIDDEN");

  const host = read(authority.host_lifecycle_ref);
  includes(host, '"PLANNER_EXHAUSTED"', "EVIDENCE_HOST_NULL_TERMINAL_STATE_REQUIRED");
  includes(host, "PHASE3_EVIDENCE_HOST_PLANNER_EMPTY_WORK_ITEMS_FORBIDDEN", "EVIDENCE_HOST_EMPTY_WORK_FATAL_REQUIRED");
  includes(host, 'status: "NOT_DUE"', "EVIDENCE_HOST_NOT_DUE_STATE_REQUIRED");
  includes(host, 'reason: "PLANNER_NOT_DUE"', "EVIDENCE_HOST_NOT_DUE_WAIT_REQUIRED");

  const fixture = read("apps/server/src/external_evidence/qualification/mcft_cap09_phase5_evidence_runtime_qualification_v1.ts");
  includes(fixture, "createTargetPlanner(input?", "PHASE5_MANIFEST_PLANNER_REQUIRED");
  includes(fixture, "const targets = this.manifest.targets", "PHASE5_PLANNER_MUST_REMAIN_MANIFEST_BACKED");

  const forcing = read("apps/server/src/external_evidence/mcft_cap09_v13_forcing_production_composition_v1.ts");
  for (const marker of ["epoch_id: string", "first_required_base: string", "last_required_base: string"]) {
    includes(forcing, marker, `V13_FORCING_AUTHORITY_INPUT_REQUIRED:${marker}`);
  }

  const packager = read(authority.entrypoint_packager_ref);
  includes(packager, "MCFT_CAP09_EVIDENCE_PRODUCTION_TARGET_PLANNER_NOT_BOUND", "PRODUCTION_ENTRYPOINT_FAIL_CLOSED_REQUIRED");

  assert.deepEqual(authority.unconditional_blockers, [
    "KBS_RAW_HOURLY_EXPLICIT_DUE_POLICY_NOT_ESTABLISHED",
    "KBS_RAW_HOURLY_PRODUCTION_BASELINE_POINTER_SCHEMA_NOT_MATERIALIZED",
    "KBS_RAW_HOURLY_PUBLICATION_DIFF_NO_CHANGE_ADAPTER_NOT_IMPLEMENTED",
    "KBS_RAW_HOURLY_PAIR_SKEW_REPAIR_NOT_IMPLEMENTED",
    "GFS_PARTIAL_PAIR_PRODUCTION_REHYDRATION_ADAPTER_NOT_IMPLEMENTED",
    "KBS_SOIL_EXPLICIT_DUE_POLICY_NOT_ESTABLISHED",
    "EVIDENCE_PRODUCTION_TARGET_PLANNER_NOT_BOUND",
  ]);
  assert.equal(authority.adjudication.phase5_fixture_manifest_may_be_production_planner, false);
  assert.equal(authority.adjudication.v13_forcing_controller_may_be_general_evidence_planner, false);
  assert.equal(authority.adjudication.wall_clock_floor_alone_may_select_all_source_targets, false);
  assert.equal(authority.adjudication.runtime_tick_cursor_may_drive_evidence_acquisition, false);
  assert.equal(authority.current_entrypoint.binding_authorized, false);
  assert.equal(authority.current_entrypoint.failure_code, "MCFT_CAP09_EVIDENCE_PRODUCTION_TARGET_PLANNER_NOT_BOUND");
  assert.equal(authority.bootstrap_authority_gap.production_acquisition_start_or_bounded_backfill_horizon_established, true);
  assert.equal(authority.bootstrap_authority_gap.active_runtime_start_horizon_instance_bound, false);
  assert.equal(authority.bootstrap_authority_gap.activation_fence_source, "SEPARATE_PRODUCTION_RUNTIME_START_AUTHORITY");
  assert.equal(authority.bootstrap_authority_gap.may_inherit_formal_forcing_budget_as_bootstrap_horizon, false);
  assert.equal(authority.source_specific_requirements.kbs_raw_hourly.pure_planner_decision_implemented, true);
  assert.equal(authority.source_specific_requirements.kbs_raw_hourly.publication_snapshot_inspector_implemented, true);
  assert.equal(authority.source_specific_requirements.kbs_raw_hourly.forward_delta_discovery_implemented, true);
  assert.equal(authority.source_specific_requirements.kbs_raw_hourly.no_change_discovery_implemented, true);
  assert.equal(authority.source_specific_requirements.kbs_raw_hourly.content_addressed_private_baseline_manifest_store_implemented, true);
  assert.equal(authority.source_specific_requirements.kbs_raw_hourly.baseline_manifest_idempotent_readback_implemented, true);
  assert.equal(authority.source_specific_requirements.kbs_raw_hourly.durable_baseline_current_pointer_implemented, true);
  assert.equal(authority.source_specific_requirements.kbs_raw_hourly.fenced_baseline_pointer_compare_and_set_implemented, true);
  assert.equal(authority.source_specific_requirements.kbs_raw_hourly.baseline_pointer_preserves_writer_identity_across_takeover, true);
  assert.equal(authority.source_specific_requirements.kbs_raw_hourly.baseline_pointer_restart_readback_implemented, true);
  assert.equal(authority.source_specific_requirements.kbs_raw_hourly.production_baseline_pointer_schema_remediation_capability_implemented, true);
  assert.equal(authority.source_specific_requirements.kbs_raw_hourly.production_baseline_pointer_schema_remediation_authorized, false);
  assert.equal(authority.source_specific_requirements.kbs_raw_hourly.production_baseline_pointer_schema_materialized, false);
  assert.equal(authority.source_specific_requirements.kbs_raw_hourly.production_durable_baseline_available, false);
  assert.equal(authority.source_specific_requirements.kbs_raw_hourly.durable_publication_baseline_implemented, true);
  assert.equal(authority.source_specific_requirements.kbs_raw_hourly.historical_prefix_snapshot_comparison_implemented, true);
  assert.equal(authority.source_specific_requirements.kbs_raw_hourly.historical_revision_backfill_fail_closed, true);
  assert.equal(authority.source_specific_requirements.kbs_raw_hourly.baseline_pointer_snapshot_identity_mismatch_fail_closed, true);
  assert.equal(authority.source_specific_requirements.kbs_raw_hourly.publication_diff_no_change_adapter_implemented, false);
  assert.equal(authority.source_specific_requirements.kbs_raw_hourly.fixed_latest_24_rows_bootstrap_authorized, false);
  assert.equal(authority.source_specific_requirements.kbs_raw_hourly.pair_skew_repair_implemented, false);
  assert.equal(authority.source_specific_requirements.gfs_bundle.pure_planner_decision_implemented, true);
  assert.equal(authority.source_specific_requirements.gfs_bundle.durable_target_dedup_implemented, true);
  assert.equal(authority.source_specific_requirements.gfs_bundle.partial_pair_production_rehydration_adapter_implemented, false);
  assert.equal(authority.source_specific_requirements.kbs_soil.pure_planner_decision_implemented, true);
  assert.equal(authority.source_specific_requirements.kbs_raw_hourly.single_fetch_multi_interval_path_implemented, true);
  assert.equal(authority.source_specific_requirements.kbs_raw_hourly.single_private_retention_per_batch_implemented, true);
  assert.equal(authority.source_specific_requirements.gfs_bundle.cross_cycle_progress_read_port_implemented, true);
  assert.equal(authority.source_specific_requirements.gfs_bundle.weather_et0_pair_skew_fail_closed, true);
  assert.equal(authority.source_specific_requirements.kbs_soil.latest_observed_event_progress_read_implemented, true);
  assert.equal(authority.host_lifecycle_gap.not_due_wait_implemented, true);
  assert.equal(authority.host_lifecycle_gap.production_planner_still_bindable, false);

  for (const [key, expected] of Object.entries({
    runtime_secret_read: false,
    database_connection_attempted: false,
    provider_request_count: 0,
    container_start_count: 0,
    runtime_process_start: false,
    production_owner_activation: false,
    formal_v5_arm: false,
    a0_bootstrap: false,
    o00_started: false,
    mcft_cap09_completed: false,
  })) assert.equal(authority.non_effects[key], expected, `EVIDENCE_TARGET_PLANNER_NON_EFFECT_REQUIRED:${key}`);

  write({
    schema_version: "geox_mcft_cap09_production_evidence_target_planner_readiness_result_v1",
    status: "PASS",
    subject_sha: subject,
    authority_status: authority.status,
    current_frontier: "KBS_RETAINED_SNAPSHOT_CYCLE_ADAPTER_REQUIRED",
    kbs_historical_prefix_snapshot_comparison_implemented: true,
    production_kbs_baseline_pointer_schema_remediation_capability_implemented: true,
    production_kbs_baseline_pointer_schema_remediation_authorized: false,
    kbs_fenced_baseline_pointer_implemented_isolated: true,
    kbs_content_addressed_baseline_manifest_store_implemented: true,
    kbs_forward_delta_no_change_discovery_implemented: true,
    kbs_complete_table_bootstrap_corrected: true,
    pure_source_specific_planner_core_implemented: true,
    acquisition_horizon_authority_established: true,
    active_runtime_start_horizon_instance_bound: false,
    kbs_single_fetch_multi_interval_path_implemented: true,
    source_specific_progress_ports_implemented: true,
    unconditional_blockers: authority.unconditional_blockers,
    static_machine_admission: "PASS_PARENT_SUBJECT",
    production_target_planner_bound: false,
    compiled_entrypoint_fail_closed: true,
    planner_not_due_wait_implemented: true,
    database_connection_attempted: false,
    provider_request_count: 0,
    runtime_process_start: false,
    production_owner_activation: false,
    formal_v5_arm: false,
    a0_bootstrap: false,
    o00_started: false,
  });
} catch (error) {
  write({
    schema_version: "geox_mcft_cap09_production_evidence_target_planner_readiness_result_v1",
    status: "FAIL",
    subject_sha: String(process.env.SUBJECT_SHA || ""),
    error: error instanceof Error ? error.message : String(error),
    database_connection_attempted: false,
    provider_request_count: 0,
    runtime_process_start: false,
    production_owner_activation: false,
    formal_v5_arm: false,
    a0_bootstrap: false,
    o00_started: false,
  });
  process.exitCode = 1;
}

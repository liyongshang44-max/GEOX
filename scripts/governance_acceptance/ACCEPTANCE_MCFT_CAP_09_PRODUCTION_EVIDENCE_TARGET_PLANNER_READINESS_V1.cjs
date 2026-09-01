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
  assert.equal(authority.status, "GFS_DURABLE_RETRY_IMPLEMENTED_SINGLE_HOST_EXECUTION_SEAM_NEXT");
  assert.equal(authority.stage, "POST_LOCAL_STATIC_MACHINE_ADMISSION_PRE_RUNTIME_START");
  assert.equal(authority.subject_predecessor_sha, "6cb65b7091886994d4c5854b2a064021ec2d8f6b");
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

  const gfsTargetDueReadiness = json(authority.gfs_target_due_readiness_ref);
  assert.equal(gfsTargetDueReadiness.status, "ESTABLISHED_NO_ACTIVE_INSTANCE");
  assert.equal(gfsTargetDueReadiness.target_progression.first_target_rule, "TARGET_EQUALS_FORMAL_A0");
  assert.equal(gfsTargetDueReadiness.target_progression.provider_creates_target_logical_time, false);
  assert.equal(gfsTargetDueReadiness.target_progression.runtime_tick_cursor_may_drive_target_progression, false);
  assert.equal(gfsTargetDueReadiness.due_policy.subsequent.earliest_start_lead_minutes, 70);
  assert.equal(gfsTargetDueReadiness.due_policy.subsequent.latest_start_lead_minutes_exclusive, 30);
  assert.equal(gfsTargetDueReadiness.due_policy.retry.max_attempts_per_target_window, 3);
  assert.equal(gfsTargetDueReadiness.due_policy.retry.minimum_retry_interval_seconds, 60);
  assert.equal(gfsTargetDueReadiness.due_policy.retry.retry_is_operational_only, true);
  assert.equal(gfsTargetDueReadiness.active_instance.runtime_start_authority_bound, false);
  assert.equal(gfsTargetDueReadiness.implementation_readiness.pure_target_due_policy_implemented, true);
  assert.equal(gfsTargetDueReadiness.implementation_readiness.durable_gfs_retry_throttle_implemented, true);
  assert.equal(gfsTargetDueReadiness.implementation_readiness.durable_gfs_attempt_budget_implemented, true);
  assert.equal(gfsTargetDueReadiness.durable_retry_state.per_target_attempt_budget, 3);
  assert.equal(gfsTargetDueReadiness.durable_retry_state.retry_minimum_interval_seconds, 60);
  assert.equal(gfsTargetDueReadiness.durable_retry_state.current_production_schema_materialized, false);
  const gfsRetryRepo = read(authority.gfs_retry_schedule_repository_ref);
  includes(gfsRetryRepo, "claimGfsAttemptBeforeProviderFetch", "GFS_RETRY_FENCED_CLAIM_REQUIRED");
  includes(gfsRetryRepo, "GFS_RETRY_STALE_FENCE", "GFS_RETRY_STALE_FENCE_REQUIRED");
  includes(gfsRetryRepo, "GFS_RETRY_TARGET_SKIP_FORBIDDEN", "GFS_RETRY_TARGET_SKIP_FAIL_CLOSED_REQUIRED");
  includes(gfsRetryRepo, "ATTEMPT_BUDGET_EXHAUSTED", "GFS_RETRY_ATTEMPT_BUDGET_REQUIRED");
  assert.equal(gfsRetryRepo.includes("RuntimeTickCursor"), false, "GFS_RETRY_RUNTIME_TICK_CURSOR_FORBIDDEN");
  const gfsTargetDuePolicy = read(authority.gfs_target_due_policy_ref);
  includes(gfsTargetDuePolicy, "nextProductionGfsTargetLogicalTimeV1", "GFS_TARGET_PROGRESSION_POLICY_REQUIRED");
  includes(gfsTargetDuePolicy, "PRODUCTION_GFS_TARGET_DUE_DURABLE_PROGRESS_GAP", "GFS_TARGET_GAP_FAIL_CLOSED_REQUIRED");
  includes(gfsTargetDuePolicy, "MCFT_CAP09_GFS_SUBSEQUENT_EARLIEST_START_LEAD_MINUTES_V1 = 70", "GFS_EARLIEST_LEAD_POLICY_REQUIRED");
  includes(gfsTargetDuePolicy, "MCFT_CAP09_GFS_LATEST_SAFE_START_LEAD_MINUTES_V1 = 30", "GFS_LATEST_SAFE_START_REQUIRED");
  includes(gfsTargetDuePolicy, "MCFT_CAP09_GFS_MAX_ATTEMPTS_PER_TARGET_WINDOW_V1 = 3", "GFS_MAX_ATTEMPTS_REQUIRED");
  includes(gfsTargetDuePolicy, "MCFT_CAP09_GFS_RETRY_MINIMUM_INTERVAL_SECONDS_V1 = 60", "GFS_RETRY_INTERVAL_REQUIRED");
  assert.equal(gfsTargetDuePolicy.includes("Date.now"), false, "GFS_TARGET_DUE_WALL_CLOCK_READ_FORBIDDEN");
  assert.equal(gfsTargetDuePolicy.includes("process.env"), false, "GFS_TARGET_DUE_ENV_READ_FORBIDDEN");

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
  assert.equal(horizonAuthority.bootstrap_policy.kbs_raw_hourly.explicit_poll_due_policy_established, true);
  assert.equal(horizonAuthority.bootstrap_policy.kbs_raw_hourly.minimum_poll_interval_seconds, 900);
  assert.equal(horizonAuthority.bootstrap_policy.kbs_soil.explicit_poll_due_policy_established, true);
  assert.equal(horizonAuthority.bootstrap_policy.kbs_soil.minimum_poll_interval_seconds, 300);
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

  const sourcePollRemediationAuthority = json(authority.source_poll_schedule_schema_remediation_authority_ref);
  assert.equal(sourcePollRemediationAuthority.status, "READY_NOT_AUTHORIZED");
  assert.equal(sourcePollRemediationAuthority.target.database_name, "geox_mcft_cap09_production_runtime_v1");
  assert.equal(sourcePollRemediationAuthority.target.expected_table_count, 41);
  assert.equal(sourcePollRemediationAuthority.target.new_table_count_authorized, 0);
  assert.equal(sourcePollRemediationAuthority.authorization.production_evidence_source_poll_schedule_schema_remediation_authorized, false);
  assert.equal(sourcePollRemediationAuthority.authorization.runtime_process_start_authorized, false);
  assert.equal(sourcePollRemediationAuthority.migration_ref, authority.source_poll_schedule_migration_ref);
  const sourcePollRemediationArm = json(authority.source_poll_schedule_schema_remediation_arm_ref);
  assert.equal(sourcePollRemediationArm.armed, false);
  assert.equal(sourcePollRemediationArm.exact_target_database_name, null);
  assert.equal(sourcePollRemediationArm.production_evidence_source_poll_schedule_schema_remediation_authorized, false);
  const sourcePollRemediationWorkflow = read(authority.source_poll_schedule_schema_remediation_workflow_ref);
  includes(sourcePollRemediationWorkflow, "Read-only exact production source poll schema preflight", "SOURCE_POLL_PRODUCTION_READ_ONLY_PREFLIGHT_REQUIRED");
  includes(sourcePollRemediationWorkflow, "Apply source poll schema only when separately armed", "SOURCE_POLL_PRODUCTION_SEPARATE_ARM_REQUIRED");
  assert.equal(authority.source_poll_schedule_schema_remediation_capability_implemented, true);
  assert.equal(authority.source_poll_schedule_schema_remediation_authorized, false);

  const kbsSnapshotComparison = read(authority.kbs_publication_snapshot_comparison_ref);
  includes(kbsSnapshotComparison, "HISTORICAL_DRIFT", "KBS_HISTORICAL_DRIFT_STATE_REQUIRED");
  includes(kbsSnapshotComparison, "previousLatest !== baseline", "KBS_BASELINE_SNAPSHOT_IDENTITY_BOUNDARY_REQUIRED");
  includes(kbsSnapshotComparison, "historical_revision_or_backfill_auto_promotion_authorized", "KBS_HISTORICAL_AUTO_PROMOTION_FORBIDDEN_MARKER_REQUIRED");
  assert.equal(kbsSnapshotComparison.includes("fetch("), false, "KBS_SNAPSHOT_COMPARISON_PROVIDER_FETCH_FORBIDDEN");
  assert.equal(kbsSnapshotComparison.includes("INSERT INTO"), false, "KBS_SNAPSHOT_COMPARISON_DB_WRITE_FORBIDDEN");

  const retainedReplay = read(authority.verified_retained_raw_replay_ref);
  includes(retainedReplay, "VerifiedRetainedRawReadbackTransportV1", "VERIFIED_RETAINED_RAW_TRANSPORT_REQUIRED");
  includes(retainedReplay, "ExistingRetainedRawVerificationBarrierV1", "VERIFIED_RETAINED_RAW_BARRIER_REQUIRED");
  includes(retainedReplay, "provider_refetch_count = 0", "VERIFIED_RETAINED_RAW_ZERO_REFETCH_REQUIRED");
  includes(retainedReplay, "raw_store_write_count = 0", "VERIFIED_RETAINED_RAW_ZERO_REWRITE_REQUIRED");
  includes(retainedReplay, "RETAINED_REPLAY_VERIFIED_READ_RECEIPT_MISMATCH", "VERIFIED_RETAINED_RAW_RECEIPT_IDENTITY_REQUIRED");
  const phase7ReplayConsumer = read("apps/server/src/external_evidence/mcft_cap09_phase7_private_candidate_capture_promotion_v1.ts");
  includes(phase7ReplayConsumer, "VerifiedRetainedRawReadbackTransportV1", "PHASE7_SHARED_REPLAY_TRANSPORT_REQUIRED");
  includes(phase7ReplayConsumer, "ExistingRetainedRawVerificationBarrierV1", "PHASE7_SHARED_REPLAY_BARRIER_REQUIRED");
  assert.equal(phase7ReplayConsumer.includes("class PrivateCandidateReadbackTransportV1"), false, "PHASE7_LOCAL_REPLAY_TRANSPORT_DUPLICATE_FORBIDDEN");

  const kbsPublicationCycle = read(authority.kbs_publication_cycle_service_ref);
  includes(kbsPublicationCycle, "collectAndRetainRawEvidenceV1", "KBS_CYCLE_CANONICAL_RETENTION_STAGE_REQUIRED");
  includes(kbsPublicationCycle, "PostCommitVisibleExternalFormalEvidenceIngressV1", "KBS_CYCLE_VISIBLE_INGRESS_REQUIRED");
  includes(kbsPublicationCycle, "BLOCKED_HISTORICAL_DRIFT", "KBS_CYCLE_HISTORICAL_DRIFT_BLOCK_REQUIRED");
  includes(kbsPublicationCycle, "BLOCKED_FORWARD_GAP", "KBS_CYCLE_FORWARD_GAP_BLOCK_REQUIRED");
  includes(kbsPublicationCycle, "expected_previous_digest: pointer.baseline_digest", "KBS_CYCLE_POINTER_CAS_REQUIRED");
  includes(kbsPublicationCycle, "baseline_pointer_advance_count", "KBS_CYCLE_POINTER_LAST_MACHINE_FIELD_REQUIRED");
  assert.equal(kbsPublicationCycle.includes("setInterval("), false, "KBS_CYCLE_CADENCE_OWNERSHIP_FORBIDDEN");
  assert.equal(kbsPublicationCycle.includes("process.env"), false, "KBS_CYCLE_ENV_AUTHORITY_FORBIDDEN");

  const gfsPartialAdapter = read(authority.gfs_partial_pair_rehydration_adapter_ref);
  includes(gfsPartialAdapter, "VerifiedRetainedRawReadbackTransportV1", "GFS_PARTIAL_REPLAY_TRANSPORT_REQUIRED");
  includes(gfsPartialAdapter, "ExistingRetainedRawVerificationBarrierV1", "GFS_PARTIAL_REPLAY_RETENTION_REQUIRED");
  includes(gfsPartialAdapter, "readReplayProvenance", "GFS_PARTIAL_FACT_READ_REQUIRED");
  includes(gfsPartialAdapter, "readRetainedRawEvidence", "GFS_PARTIAL_PRIVATE_RAW_READ_REQUIRED");
  includes(gfsPartialAdapter, "provider_request_count: 0", "GFS_PARTIAL_ZERO_PROVIDER_REQUIRED");
  assert.equal(gfsPartialAdapter.includes("process.env"), false, "GFS_PARTIAL_ENV_FORBIDDEN");

  const gfsReplayReader = read(authority.gfs_fact_replay_provenance_reader_ref);
  includes(gfsReplayReader, "mcft-cap09-retained-replay:", "GFS_REPLAY_DETERMINISTIC_REQUEST_ID_REQUIRED");
  includes(gfsReplayReader, "replaySourceLocator = finalLocator", "GFS_REPLAY_FINAL_LOCATOR_DERIVATION_REQUIRED");
  includes(gfsReplayReader, "externalFormalEvidenceFactIdV1", "GFS_REPLAY_FACT_ID_RECOMPUTE_REQUIRED");
  includes(gfsReplayReader, "FACT_REPLAY_RECORD_SEMANTIC_HASH_MISMATCH", "GFS_REPLAY_SEMANTIC_HASH_REQUIRED");
  includes(gfsReplayReader, "FACT_REPLAY_CONTENT_TYPE_REQUIRED", "GFS_REPLAY_CONTENT_TYPE_REQUIRED");
  includes(gfsReplayReader, "database_write_count: 0", "GFS_REPLAY_READ_ONLY_REQUIRED");
  assert.equal(gfsReplayReader.includes("fetch("), false, "GFS_REPLAY_PROVIDER_FETCH_FORBIDDEN");
  assert.equal(gfsReplayReader.includes("process.env"), false, "GFS_REPLAY_ENV_AUTHORITY_FORBIDDEN");

  const replayCanonicalizer = read("apps/server/src/external_evidence/mcft_cap09_external_collector_canonicalizer_v1.ts");
  includes(replayCanonicalizer, "content_type: input.provenance.content_type", "CANONICAL_REPLAY_CONTENT_TYPE_PERSISTENCE_REQUIRED");

  const duePolicy = read(authority.source_due_policy_authority_ref);
  includes(duePolicy, '"minimum_poll_interval_seconds": 900', "KBS_RAW_DUE_INTERVAL_REQUIRED");
  includes(duePolicy, '"minimum_poll_interval_seconds": 300', "KBS_SOIL_DUE_INTERVAL_REQUIRED");
  includes(duePolicy, '"provider_observed_cadence_is_due_authority": false', "OBSERVED_CADENCE_AUTHORITY_FORBIDDEN");
  const duePolicyRuntime = read("apps/server/src/external_evidence/mcft_cap09_production_evidence_source_due_policy_v1.ts");
  includes(duePolicyRuntime, "GEOX_OPERATIONAL_THROTTLE_NOT_PROVIDER_CADENCE", "DUE_POLICY_OPERATIONAL_SEMANTICS_REQUIRED");
  assert.equal(duePolicyRuntime.includes("Date.now"), false, "DUE_POLICY_WALL_CLOCK_FORBIDDEN");
  assert.equal(duePolicyRuntime.includes("process.env"), false, "DUE_POLICY_ENV_FORBIDDEN");
  const pollScheduleRepo = read(authority.source_poll_schedule_repository_ref);
  includes(pollScheduleRepo, "claimPollBeforeProviderFetch", "SOURCE_POLL_FENCED_CLAIM_REQUIRED");
  includes(pollScheduleRepo, "EVIDENCE_SOURCE_POLL_STALE_FENCE", "SOURCE_POLL_STALE_FENCE_REQUIRED");
  includes(pollScheduleRepo, "nextProductionEvidenceSourcePollEligibleAtV1", "SOURCE_POLL_NEXT_ELIGIBLE_REQUIRED");
  assert.equal(pollScheduleRepo.includes("RuntimeTickCursor"), false, "SOURCE_POLL_RUNTIME_TICK_CURSOR_FORBIDDEN");

  const purePlanner = read(authority.pure_source_planner_ref);
  includes(purePlanner, "planProductionEvidenceSourcesV1", "PURE_SOURCE_SPECIFIC_PLANNER_REQUIRED");
  includes(purePlanner, "KBS_RAW_HOURLY_PUBLICATION_CYCLE", "KBS_PUBLICATION_CYCLE_PLAN_REQUIRED");
  includes(purePlanner, "bindable_to_current_cycle_service: true", "KBS_PUBLICATION_CYCLE_BINDING_REQUIRED");
  assert.equal(
    purePlanner.includes("KBS_RAW_HOURLY_PUBLICATION_DIFF_NO_CHANGE_ADAPTER_NOT_IMPLEMENTED"),
    false,
    "KBS_STALE_DIFF_CAPABILITY_BLOCKER_FORBIDDEN",
  );
  assert.equal(
    purePlanner.includes("KBS_RAW_HOURLY_PAIR_SKEW_REPAIR_NOT_IMPLEMENTED"),
    false,
    "KBS_STALE_PAIR_REPAIR_CAPABILITY_BLOCKER_FORBIDDEN",
  );
  includes(purePlanner, "GFS_TARGET_ALREADY_DURABLE", "GFS_DURABLE_TARGET_DEDUP_REQUIRED");
  includes(purePlanner, "GFS_PARTIAL_PAIR_REHYDRATE", "GFS_PARTIAL_PAIR_REHYDRATION_ACTION_REQUIRED");
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
    "PRODUCTION_EVIDENCE_SOURCE_POLL_SCHEDULE_SCHEMA_NOT_MATERIALIZED",
    "KBS_RAW_HOURLY_PRODUCTION_BASELINE_POINTER_SCHEMA_NOT_MATERIALIZED",
    "EVIDENCE_PRODUCTION_TARGET_PLANNER_NOT_BOUND",
    "HETEROGENEOUS_SOURCE_PLAN_EXECUTION_SEAM_NOT_IMPLEMENTED",
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
  assert.equal(authority.source_specific_requirements.kbs_raw_hourly.batch_discovery_no_change_adapter_implemented, true);
  assert.equal(authority.source_specific_requirements.kbs_raw_hourly.publication_diff_no_change_adapter_implemented, true);
  assert.equal(authority.source_specific_requirements.kbs_raw_hourly.pair_skew_repair_implemented, true);
  assert.equal(authority.source_specific_requirements.kbs_raw_hourly.forward_gap_fail_closed, true);
  assert.equal(authority.source_specific_requirements.kbs_raw_hourly.pointer_advance_after_all_visible_cursor_advances, true);
  assert.equal(authority.source_specific_requirements.kbs_raw_hourly.single_forward_hour_supported, true);
  assert.equal(authority.source_specific_requirements.kbs_raw_hourly.planner_routes_due_work_to_publication_cycle_service, true);
  assert.equal(authority.source_specific_requirements.kbs_raw_hourly.planner_cycle_service_binding_implemented, true);
  assert.equal(authority.source_specific_requirements.kbs_raw_hourly.production_baseline_pointer_schema_materialized, false);
  assert.equal(authority.source_specific_requirements.kbs_raw_hourly.production_durable_baseline_available, false);
  assert.equal(authority.source_specific_requirements.kbs_raw_hourly.explicit_due_policy_established, true);
  assert.equal(authority.source_specific_requirements.kbs_raw_hourly.minimum_poll_interval_seconds, 900);
  assert.equal(authority.source_specific_requirements.kbs_raw_hourly.durable_poll_schedule_implemented, true);
  assert.equal(authority.source_specific_requirements.kbs_raw_hourly.fenced_poll_claim_before_provider_attempt_implemented, true);
  assert.equal(authority.source_specific_requirements.kbs_raw_hourly.durable_publication_baseline_implemented, true);
  assert.equal(authority.source_specific_requirements.kbs_raw_hourly.historical_prefix_snapshot_comparison_implemented, true);
  assert.equal(authority.source_specific_requirements.kbs_raw_hourly.historical_revision_backfill_fail_closed, true);
  assert.equal(authority.source_specific_requirements.kbs_raw_hourly.baseline_pointer_snapshot_identity_mismatch_fail_closed, true);
  assert.equal(authority.source_specific_requirements.kbs_raw_hourly.verified_retained_raw_replay_primitive_implemented, true);
  assert.equal(authority.source_specific_requirements.gfs_bundle.verified_retained_raw_replay_primitive_implemented, true);
  assert.equal(authority.source_specific_requirements.kbs_raw_hourly.fixed_latest_24_rows_bootstrap_authorized, false);
  assert.equal(authority.source_specific_requirements.gfs_bundle.pure_planner_decision_implemented, true);
  assert.equal(authority.source_specific_requirements.gfs_bundle.durable_target_dedup_implemented, true);
  assert.equal(authority.source_specific_requirements.gfs_bundle.canonical_fact_request_id_persisted, false);
  assert.equal(authority.source_specific_requirements.gfs_bundle.canonical_fact_source_locator_persisted, false);
  assert.equal(authority.source_specific_requirements.gfs_bundle.canonical_fact_operational_request_envelope_excluded, true);
  assert.equal(authority.source_specific_requirements.gfs_bundle.deterministic_replay_request_id_from_fact_id, true);
  assert.equal(authority.source_specific_requirements.gfs_bundle.replay_source_locator_from_final_locator, true);
  assert.equal(authority.source_specific_requirements.gfs_bundle.exact_fact_replay_provenance_read_port_implemented, true);
  assert.equal(authority.source_specific_requirements.gfs_bundle.restored_ingested_at_replay_input_available, true);
  assert.equal(authority.source_specific_requirements.gfs_bundle.current_shape_bindable, false);
  assert.equal(authority.source_specific_requirements.gfs_bundle.target_logical_time_authority_established, true);
  assert.equal(authority.source_specific_requirements.gfs_bundle.operational_due_retry_policy_established, true);
  assert.equal(authority.source_specific_requirements.gfs_bundle.active_target_instance_bound, false);
  assert.equal(authority.source_specific_requirements.gfs_bundle.earliest_start_lead_minutes, 70);
  assert.equal(authority.source_specific_requirements.gfs_bundle.latest_start_lead_minutes_exclusive, 30);
  assert.equal(authority.source_specific_requirements.gfs_bundle.max_attempts_per_target_window, 3);
  assert.equal(authority.source_specific_requirements.gfs_bundle.retry_minimum_interval_seconds, 60);
  assert.equal(authority.source_specific_requirements.gfs_bundle.durable_retry_throttle_established, true);
  assert.equal(authority.source_specific_requirements.gfs_bundle.durable_attempt_budget_established, true);
  assert.equal(authority.source_specific_requirements.gfs_bundle.retry_state_owner_takeover_safe, true);
  assert.equal(authority.source_specific_requirements.gfs_bundle.retry_state_stale_fence_fail_closed, true);
  assert.equal(authority.source_specific_requirements.gfs_bundle.partial_pair_production_rehydration_adapter_implemented, true);
  assert.equal(authority.source_specific_requirements.gfs_bundle.retained_replay_uses_same_evidence_runtime_cycle_service, true);
  assert.equal(authority.source_specific_requirements.gfs_bundle.per_work_item_retention_override_implemented, true);
  assert.equal(authority.source_specific_requirements.gfs_bundle.existing_side_idempotent_missing_side_insert_proven, true);
  assert.equal(authority.source_specific_requirements.gfs_bundle.zero_provider_refetch_rehydration_proven, true);
  assert.equal(authority.source_specific_requirements.gfs_bundle.canonical_fact_content_type_persisted, true);
  assert.equal(authority.source_specific_requirements.gfs_bundle.replay_envelope_content_type_restored, true);
  assert.equal(authority.source_specific_requirements.kbs_soil.pure_planner_decision_implemented, true);
  assert.equal(authority.source_specific_requirements.kbs_soil.explicit_due_policy_established, true);
  assert.equal(authority.source_specific_requirements.kbs_soil.minimum_poll_interval_seconds, 300);
  assert.equal(authority.source_specific_requirements.kbs_soil.durable_poll_schedule_implemented, true);
  assert.equal(authority.source_specific_requirements.kbs_soil.fenced_poll_claim_before_provider_attempt_implemented, true);
  assert.equal(authority.production_source_poll_schedule_schema_materialized, false);
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
    current_frontier: "EXPLICIT_KBS_BATCH_AND_SOIL_DUE_AUTHORITIES_REQUIRED",
    kbs_planner_cycle_wiring_aligned: true,
    gfs_replay_provenance_foundation_implemented: true,
    kbs_publication_cycle_adapter_implemented: true,
    shared_verified_retained_raw_replay_primitive_implemented: true,
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

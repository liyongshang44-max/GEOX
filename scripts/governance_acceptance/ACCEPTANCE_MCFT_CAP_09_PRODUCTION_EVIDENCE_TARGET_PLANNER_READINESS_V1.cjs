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
  assert.equal(authority.status, "PRODUCTION_SCHEMA_MATERIALIZED_PLANNER_ENTRYPOINT_BOUND_RUNTIME_START_BLOCKED_CURRENT_T4R1_FORMAL_WINDOW_EXPIRED");
  assert.equal(authority.stage, "POST_LOCAL_STATIC_MACHINE_ADMISSION_PRE_RUNTIME_START");
  assert.equal(authority.subject_predecessor_sha, "9e291eb52b97c9f3f7dd24c3208d8bfc7b357f31");
  cp.execFileSync("git", ["merge-base", "--is-ancestor", authority.subject_predecessor_sha, subject]);

  assert.equal(hostAuthority.next_stage?.local_24h_host_preflight_status, "PASS_STATIC_MACHINE_ADMISSION_PARENT_SUBJECT");
  assert.equal(hostAuthority.next_stage?.evidence_production_target_planner_status, "BOUND");
  assert.equal(hostAuthority.next_stage?.evidence_production_compiled_entrypoint_status, "PACKAGED_PRODUCTION_PLANNER_BOUND_RUNTIME_START_AUTHORITY_NOT_ARMED");

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

  const gfsTargetHistory = read(authority.gfs_target_pair_history_postgres_ref);
  includes(gfsTargetHistory, "FROM public.facts", "GFS_TARGET_HISTORY_CANONICAL_FACT_READ_REQUIRED");
  includes(gfsTargetHistory, "GFS_TARGET_HISTORY_CROSS_CYCLE_PAIR_FORBIDDEN", "GFS_TARGET_HISTORY_CROSS_CYCLE_FAIL_CLOSED_REQUIRED");
  includes(gfsTargetHistory, "source_record_id", "GFS_TARGET_HISTORY_SOURCE_RECORD_ID_VALIDATION_REQUIRED");
  assert.equal(gfsTargetHistory.includes("RuntimeTickCursor"), false, "GFS_TARGET_HISTORY_RUNTIME_CURSOR_FORBIDDEN");
  assert.equal(authority.source_specific_requirements.gfs_bundle.hourly_target_completion_authority, "APPEND_ONLY_CANONICAL_EXTERNAL_EVIDENCE_FACT_PAIRS");
  assert.equal(authority.source_specific_requirements.gfs_bundle.supply_cursor_cycle_summary_hourly_target_completion_authorized, false);
  assert.equal(authority.source_specific_requirements.gfs_bundle.source_planner_exact_target_dedup_uses_canonical_history, true);
  assert.equal(authority.source_specific_requirements.gfs_bundle.provider_fence_after_lease_exact_target_recheck, true);

  const gfsTargetDueReadiness = json(authority.gfs_target_due_readiness_ref);
  assert.equal(gfsTargetDueReadiness.status, "ESTABLISHED_FENCE_BOUND_SCHEMA_MATERIALIZED_NO_ACTIVE_INSTANCE");
  assert.equal(gfsTargetDueReadiness.target_progression.first_target_rule, "TARGET_EQUALS_FORMAL_A0");
  assert.equal(gfsTargetDueReadiness.target_progression.provider_creates_target_logical_time, false);
  assert.equal(gfsTargetDueReadiness.target_progression.durable_target_pair_history_source, "APPEND_ONLY_CANONICAL_EXTERNAL_EVIDENCE_FACT_PAIRS");
  assert.equal(gfsTargetDueReadiness.target_progression.supply_cursor_cycle_summary_may_establish_hourly_target_completion, false);
  assert.equal(gfsTargetDueReadiness.implementation_readiness.provider_attempt_fence_after_lease_exact_target_recheck, true);
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
  assert.equal(gfsTargetDueReadiness.durable_retry_state.current_production_schema_materialized, true);
  assert.deepEqual(gfsTargetDueReadiness.blockers, ["ACTIVE_RUNTIME_START_AUTHORITY_NOT_BOUND"]);
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
  assert.equal(horizonAuthority.status, "ENGINEERING_READINESS_QUALIFIED_LIVE_ACTIVATION_BLOCKED_CURRENT_T4R1_AUTHORITY_UNRESOLVED");
  assert.equal(horizonAuthority.stage, "POST_PRODUCTION_EQUIVALENT_ENGINEERING_READINESS_PRE_LIVE_ACTIVATION");
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

  const separation = horizonAuthority.engineering_readiness_live_activation_separation;
  assert.equal(separation.schema_version, "geox_mcft_cap09_engineering_readiness_live_activation_separation_v1");
  assert.equal(separation.status, "QUALIFIED_ENGINEERING_READINESS_LIVE_ACTIVATION_NOT_CURRENTLY_ELIGIBLE");
  assert.equal(separation.authority_role, "ENGINEERING_READINESS_ONLY_NOT_STAGE1B_COMPLETION_NOT_LIVE_ACTIVATION");
  assert.equal(separation.evidence_frontier_parent_sha, "3a83b76450b5459bde8d1d56234e5bba80b49398");
  assert.equal(separation.ruling.software_implementation_qualification_is_distinct_from_operational_activation_qualification, true);
  assert.equal(separation.ruling.uncontrollable_third_party_provider_availability_may_block_engineering_readiness, false);
  assert.equal(separation.ruling.uncontrollable_third_party_provider_availability_may_block_live_activation, true);
  assert.equal(separation.ruling.kbs_material_provider_change_is_engineering_blocker, false);
  assert.equal(separation.ruling.kbs_material_provider_change_is_live_activation_gate, true);
  assert.equal(separation.ruling.synthetic_or_fixture_evidence_may_be_promoted_to_real_t4r1_authority, false);
  assert.equal(separation.ruling.cross_season_stitching_authorized, false);
  assert.equal(separation.ruling.taskbook_stage1b_completion_gate_changed, false);
  assert.equal(separation.engineering_readiness.status, "QUALIFIED");
  assert.equal(
    separation.engineering_readiness.allowed_claim,
    "MCFT_CAP_09_PRODUCTION_EQUIVALENT_ENGINEERING_READINESS_QUALIFIED",
  );
  assert.equal(
    separation.engineering_readiness.claim_scope,
    "CONTROLLABLE_SOFTWARE_RUNTIME_GOVERNANCE_AND_PRODUCTION_EQUIVALENT_MECHANISMS",
  );
  assert.equal(separation.engineering_readiness.protected_semantic_core.baseline_subject_sha, "12473c491b354e49305f22bfa24c8701ce5e3ff9");
  assert.equal(separation.engineering_readiness.protected_semantic_core.path_count, 12);
  assert.equal(
    separation.engineering_readiness.protected_semantic_core.semantic_scope,
    "IMMUTABLE_PHASE5_TEMPORAL_RUNTIME_CORE",
  );
  assert.equal(separation.engineering_readiness.protected_semantic_core.all_paths_unchanged_to_current_subject_required, true);
  assert.equal(separation.engineering_readiness.protected_semantic_core.excludes_runtime_ownership_fencing_layer, true);
  assert.equal(separation.engineering_readiness.runtime_ownership_fencing_layer.path_count, 3);
  assert.equal(
    separation.engineering_readiness.runtime_ownership_fencing_layer
      .planner_readiness_may_classify_change_as_temporal_semantic_drift,
    false,
  );
  assert.equal(
    separation.engineering_readiness.runtime_ownership_fencing_layer
      .may_change_only_with_focused_current_head_requalification,
    true,
  );

  const taskbook = read("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md");
  includes(taskbook, "Allowed claim only after S6 O00–O23 plus final exact-SHA/R2 effectiveness", "ENGINEERING_READINESS_TASKBOOK_COMPLETION_BOUNDARY_REQUIRED");
  includes(taskbook, "STAGE_1B_SHADOW_ONLINE_CLOSURE_COMPLETE", "ENGINEERING_READINESS_STAGE1B_CLAIM_MUST_REMAIN_TASKBOOK_GOVERNED");
  includes(taskbook, "MCFT_CAP_09_COMPLETE", "ENGINEERING_READINESS_CAP09_COMPLETE_CLAIM_MUST_REMAIN_TASKBOOK_GOVERNED");

  const amendment08 = read(horizonAuthority.authority_basis.amendment08_implementation_activation_separation_ref);
  includes(amendment08, "software implementation qualification", "ENGINEERING_READINESS_AMENDMENT08_IMPLEMENTATION_SEPARATION_REQUIRED");
  includes(amendment08, "operational activation qualification", "ENGINEERING_READINESS_AMENDMENT08_ACTIVATION_SEPARATION_REQUIRED");
  includes(amendment08, "EA5E2_IMPLEMENTATION_QUALIFIED", "ENGINEERING_READINESS_AMENDMENT08_IMPLEMENTATION_CLAIM_REQUIRED");
  includes(amendment08, "EA5E2_OPERATIONAL_ACTIVATION_QUALIFIED", "ENGINEERING_READINESS_AMENDMENT08_ACTIVATION_CLAIM_REQUIRED");
  const postActivation = json(horizonAuthority.authority_basis.post_activation_readiness_audit_ref);
  assert.equal(postActivation.current_effective_state.ea5e2_implementation_qualified, true);
  assert.equal(postActivation.current_effective_state.ea5e2_operational_activation_runner_qualified, true);
  assert.equal(postActivation.current_effective_state.ea5e2_operational_activation_qualified, false);

  const phase5SettlementScript = read(horizonAuthority.authority_basis.phase5_temporal_settlement_ref);
  includes(phase5SettlementScript, 'const OLD_FULL_HEAD = "12473c491b354e49305f22bfa24c8701ce5e3ff9"', "ENGINEERING_READINESS_PHASE5_FULL24_HEAD_REQUIRED");
  includes(phase5SettlementScript, 'const OLD_FULL_RUN_ID = 33101400822', "ENGINEERING_READINESS_PHASE5_FULL24_RUN_REQUIRED");
  includes(phase5SettlementScript, 'const OLD_FULL_ARTIFACT_ID = 9659440229', "ENGINEERING_READINESS_PHASE5_FULL24_ARTIFACT_REQUIRED");
  includes(phase5SettlementScript, 'const EVIDENCE_RESILIENCE_RUN_ID = 33110416779', "ENGINEERING_READINESS_PHASE5_RESILIENCE_RUN_REQUIRED");
  includes(phase5SettlementScript, 'const EVIDENCE_RESILIENCE_ARTIFACT_ID = 9671930864', "ENGINEERING_READINESS_PHASE5_RESILIENCE_ARTIFACT_REQUIRED");
  includes(
    phase5SettlementScript,
    "PROTECTED_TEMPORAL_SEMANTIC_CORE",
    "ENGINEERING_READINESS_TEMPORAL_CORE_SPLIT_REQUIRED",
  );
  includes(
    phase5SettlementScript,
    "RUNTIME_OWNERSHIP_FENCING_LAYER",
    "ENGINEERING_READINESS_OWNERSHIP_FENCING_LAYER_REQUIRED",
  );

  const protectedSemanticCore = [
    "apps/server/src/domain/twin_runtime/external_formal_amendment19_window_manifest_v1.ts",
    "apps/server/src/domain/twin_runtime/external_formal_prewindow_authority_bundle_v3.ts",
    "apps/server/src/runtime/twin_runtime/external_formal_a18_crop_context_v3.ts",
    "apps/server/src/runtime/twin_runtime/external_formal_v3_amendment19_runner_v1.ts",
    "apps/server/src/runtime/twin_runtime/external_formal_v3_amendment19_persistent_tick_service_v1.ts",
    "apps/server/src/runtime/twin_runtime/postgres_external_formal_amendment19_evidence_source_v1.ts",
    "apps/server/src/persistence/twin_runtime/postgres_runtime_repository_v1.ts",
    "apps/server/src/persistence/twin_runtime/postgres_next_tick_repository_v1.ts",
    "apps/server/src/persistence/twin_runtime/postgres_forecast_scenario_repository_v1.ts",
    "apps/server/src/persistence/twin_runtime/postgres_forecast_scenario_recovery_repository_v1.ts",
    "apps/server/src/runtime/twin_runtime/qualification/mcft_cap09_phase5_prepare_24t_v1.ts",
    "apps/server/src/runtime/twin_runtime/qualification/mcft_cap09_phase5_verify_24t_v1.ts",
  ];
  assert.equal(protectedSemanticCore.length, 12);
  assert.deepEqual(
    separation.engineering_readiness.runtime_ownership_fencing_layer.paths,
    [
      "apps/server/src/runtime/twin_runtime/postgres_persistent_sequential_scheduler_adapter_v1.ts",
      "apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_host_v1.ts",
      "apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_composition_v1.ts",
    ],
  );
  for (const protectedPath of protectedSemanticCore) {
    const changed = cp.execFileSync(
      "git",
      ["diff", "--name-only", "12473c491b354e49305f22bfa24c8701ce5e3ff9.." + subject, "--", protectedPath],
      { encoding: "utf8" },
    ).trim();
    assert.equal(changed, "", "ENGINEERING_READINESS_PROTECTED_SEMANTIC_CORE_DRIFT:" + protectedPath);
  }

  for (const evidenceSubject of [
    "12473c491b354e49305f22bfa24c8701ce5e3ff9",
    "3349eaaaab68f80fc9b771f16e4bfe909126eed2",
    "48ceafe7c6e7d3d57a1dc17411fb4bf673486333",
    "776ba8381608cb906f68b57a56fc9aef6258cc52",
    "bf1d345f925f543779718973f8c9419684498e2a",
    "60e4fd93c9dff017fd0d62967fad17a49383f12e",
    "d631d20b3a2a0c179ba2ed98dd827e3e6431f6db",
    "3a83b76450b5459bde8d1d56234e5bba80b49398",
  ]) cp.execFileSync("git", ["merge-base", "--is-ancestor", evidenceSubject, subject]);

  const registry = json(horizonAuthority.authority_basis.qualification_evidence_registry_ref);
  const registryRows = [];
  (function collect(value) {
    if (Array.isArray(value)) {
      for (const row of value) collect(row);
      return;
    }
    if (!value || typeof value !== "object") return;
    if (typeof value.evidence_id === "string" && typeof value.check_id === "string") registryRows.push(value);
    for (const row of Object.values(value)) collect(row);
  })(registry);
  const phase5Evidence = registryRows.find((row) => row.evidence_id === "PHASE5_PRODUCTION_EQUIVALENT_CONTAINERS_REQUAL_776BA838");
  assert.ok(phase5Evidence, "ENGINEERING_READINESS_PHASE5_REGISTRY_EVIDENCE_REQUIRED");
  assert.equal(phase5Evidence.run_id, 33164682861);
  assert.equal(phase5Evidence.run_conclusion, "success");
  assert.equal(phase5Evidence.immutable, true);
  assert.equal(phase5Evidence.dependency_digest, "sha256:01f8f55f611d9b15bb2e4b00cf2828205acf95bea8fc4c167a43687f3c688e7c");
  const producerEvidence = registryRows.find((row) => row.evidence_id === "V13_PRODUCER_DRIVEN_QUALIFICATION_POSTMERGE_BF1D345F");
  assert.ok(producerEvidence, "ENGINEERING_READINESS_V13_PRODUCER_EVIDENCE_REQUIRED");
  assert.equal(producerEvidence.subject_sha, "bf1d345f925f543779718973f8c9419684498e2a");
  assert.equal(producerEvidence.run_id, 33605700840);
  assert.equal(producerEvidence.run_conclusion, "success");
  assert.equal(producerEvidence.immutable, true);
  assert.equal(producerEvidence.dependency_digest, "sha256:db6bbfe41052d262481bb2a911cbe1501247c32ed111daa2af0b8ab5c58088b3");

  const phase6Workflow = read(horizonAuthority.authority_basis.phase6_runtime_independence_workflow_ref);
  includes(phase6Workflow, "PHASE6_ACCEPTED_HEAD: '48ceafe7c6e7d3d57a1dc17411fb4bf673486333'", "ENGINEERING_READINESS_PHASE6_ACCEPTED_HEAD_REQUIRED");
  includes(phase6Workflow, "PHASE6_RUNTIME_ARTIFACT_ID: '9676455831'", "ENGINEERING_READINESS_PHASE6_ARTIFACT_REQUIRED");
  includes(phase6Workflow, "sha256:9a3a22b8b844fc1538d4a6986a9d3477b895208b1e88cdf13106f0f0dbf463d7", "ENGINEERING_READINESS_PHASE6_ARTIFACT_DIGEST_REQUIRED");

  const evidenceChain = separation.engineering_readiness.evidence_chain;
  assert.equal(evidenceChain.phase5_immutable_full_24t.workflow_run_id, 33101400822);
  assert.equal(evidenceChain.phase5_immutable_full_24t.artifact_id, 9659440229);
  assert.equal(evidenceChain.phase5_immutable_full_24t.exact_24t, true);
  assert.equal(evidenceChain.phase5_immutable_full_24t.live_causal_evidence, true);
  assert.equal(evidenceChain.phase5_fresh_evidence_resilience.workflow_run_id, 33110416779);
  assert.equal(evidenceChain.phase5_fresh_evidence_resilience.duplicate_restart_fencing_fresh, true);
  assert.equal(evidenceChain.phase5_temporal_settlement_and_twin_fencing.workflow_run_id, 33164682861);
  assert.equal(evidenceChain.phase5_temporal_settlement_and_twin_fencing.artifact_id, 9683116099);
  assert.equal(evidenceChain.phase5_temporal_settlement_and_twin_fencing.production_owner_cutover, false);
  assert.equal(evidenceChain.phase5_temporal_settlement_and_twin_fencing.formal_v5_armed, false);
  assert.equal(evidenceChain.phase6_runtime_independence.workflow_run_id, 33146391000);
  assert.equal(evidenceChain.phase6_runtime_independence.artifact_id, 9676455831);
  assert.equal(evidenceChain.phase6_successor_carry_forward.workflow_run_id, 33164682799);
  assert.equal(evidenceChain.phase6_successor_carry_forward.artifact_id, 9683075686);
  assert.equal(evidenceChain.v13_producer_driven_runtime.source_evidence_id, "V13_PRODUCER_DRIVEN_QUALIFICATION_POSTMERGE_BF1D345F");
  assert.equal(evidenceChain.v13_producer_driven_runtime.projected_evidence_id, "V13_PRODUCER_DRIVEN_QUALIFICATION_POSTMERGE_BF1D345F_RUNTIME_PROJECTION_V1");
  assert.equal(evidenceChain.v13_producer_driven_runtime.runtime_resolver_id, "V13_RUNTIME_SEMANTIC_CLOSURE");
  assert.equal(evidenceChain.v13_producer_driven_runtime.projected_dependency_digest, "sha256:b312d05f816ab2494f503749d2a2b9d62be91b3ba235e24bce268440b6070235");
  assert.equal(evidenceChain.v13_producer_driven_runtime.settlement_subject_sha, "c8e4b23557fc825d8b40baf06857aaa96cc801fa");
  assert.equal(evidenceChain.v13_producer_driven_runtime.settlement_workflow_run_id, 33639258830);
  assert.equal(evidenceChain.v13_producer_driven_runtime.current_durable_evidence_valid, true);
  assert.equal(evidenceChain.v13_producer_driven_runtime.applicability_resolved_before_live_arm, true);
  assert.equal(evidenceChain.v13_producer_driven_runtime.live_requalification_required, false);
  assert.equal(evidenceChain.v13_producer_driven_runtime.provider_request_count, 0);
  assert.equal(evidenceChain.t4r1_live_activation_fail_closed.current_stage_authority_established, false);
  assert.equal(evidenceChain.t4r1_live_activation_fail_closed.current_natural_season_successor_authority_established, false);

  assert.equal(separation.live_activation.status, "NOT_CURRENTLY_ELIGIBLE");
  assert.equal(separation.live_activation.runtime_start_authority_may_be_armed, false);
  assert.equal(separation.live_activation.production_owner_activation_authorized, false);
  assert.equal(separation.live_activation.formal_v5_arm_authorized, false);
  assert.equal(separation.live_activation.a0_authorized, false);
  assert.equal(separation.live_activation.o00_authorized, false);
  assert.equal(separation.live_activation.stage1b_completion_claim_authorized, false);
  assert.equal(separation.live_activation.mcft_cap09_complete_claim_authorized, false);
  assert.deepEqual(separation.engineering_readiness.nonclaims, [
    "STAGE_1B_SHADOW_ONLINE_CLOSURE_COMPLETE",
    "MCFT_CAP_09_COMPLETE",
    "REAL_FIELD_24_HOUR_ONLINE_PROVEN",
    "MINIMUM_COMPLETE_FIELD_TWIN_COMPLETE",
    "CURRENT_T4R1_LIVE_ACTIVATION_ELIGIBLE",
  ]);
  const producerDebt = separation.nonblocking_engineering_debt;
  assert.equal(producerDebt.id, "V13_PRODUCER_STALE_ARM_ORDERING");
  assert.equal(producerDebt.status, "SETTLED_RUNTIME_HARNESS_RESOLVER_MIGRATION");
  assert.equal(producerDebt.classification, "QUALIFICATION_HARNESS_CONTROL_PLANE_DEBT");
  assert.equal(producerDebt.blocks_engineering_readiness, false);
  assert.equal(producerDebt.live_provider_failure_observed, false);
  assert.equal(producerDebt.current_durable_producer_evidence_invalidated, false);
  assert.equal(producerDebt.requires_resolution_before_fresh_producer_live_requalification_if_dependency_contract_reopened, false);
  assert.equal(producerDebt.settlement_subject_sha, "c8e4b23557fc825d8b40baf06857aaa96cc801fa");
  assert.equal(producerDebt.migration_proof_subject_sha, "5e162fceb5758aa3eaf7894a474a5886fa069057");
  assert.equal(producerDebt.runtime_resolver_id, "V13_RUNTIME_SEMANTIC_CLOSURE");
  assert.equal(producerDebt.qualification_harness_resolver_id, "V13_QUALIFICATION_HARNESS_CLOSURE");
  assert.equal(producerDebt.legacy_resolver_id, "V13_AUTONOMOUS_FORCING_IMPORT_CLOSURE");
  assert.equal(producerDebt.legacy_path_count, 124);
  assert.equal(producerDebt.runtime_path_count, 108);
  assert.equal(producerDebt.legacy_harness_path_count, 16);
  assert.equal(producerDebt.current_harness_path_count, 20);
  assert.equal(producerDebt.exact_partition_proven, true);
  assert.equal(producerDebt.runtime_harness_overlap_count, 0);
  assert.equal(producerDebt.runtime_path_digest_bf1d, "sha256:8374cf46dd3e40768de512b7c89319b8913c5de61affeb6a8378e7a81cdc7d25");
  assert.equal(producerDebt.runtime_path_digest_settlement_subject, producerDebt.runtime_path_digest_bf1d);
  assert.equal(producerDebt.projected_runtime_aggregate_digest, "sha256:b312d05f816ab2494f503749d2a2b9d62be91b3ba235e24bce268440b6070235");
  assert.equal(producerDebt.projected_producer_evidence_id, "V13_PRODUCER_DRIVEN_QUALIFICATION_POSTMERGE_BF1D345F_RUNTIME_PROJECTION_V1");
  assert.equal(producerDebt.source_producer_evidence_id, "V13_PRODUCER_DRIVEN_QUALIFICATION_POSTMERGE_BF1D345F");
  assert.equal(producerDebt.producer_workflow_run_id, 33639258830);
  assert.equal(producerDebt.producer_workflow_conclusion, "success");
  assert.equal(producerDebt.producer_applicability_resolved_before_live_arm, true);
  assert.equal(producerDebt.producer_live_required, false);
  assert.equal(producerDebt.stale_arm_freshness_check_executed, false);
  assert.equal(producerDebt.provider_request_count, 0);
  assert.equal(producerDebt.production_runtime_mutation, false);
  assert.equal(producerDebt.production_owner_activation, false);
  assert.equal(producerDebt.formal_v5_arm, false);
  assert.equal(producerDebt.a0_bootstrap, false);
  assert.equal(producerDebt.o00_started, false);
  assert.equal(producerDebt.post_merge_control_plane.workflow_run_id, 33639259326);
  assert.equal(producerDebt.post_merge_control_plane.conclusion, "success");
  assert.equal(producerDebt.post_merge_control_plane.artifact_id, 9850214136);
  assert.equal(producerDebt.post_merge_control_plane.artifact_digest, "sha256:9d2b11289be5ba992d41dfb83d92a66f1a77b888380c8692219b66fb7ee4d808");
  assert.equal(producerDebt.post_merge_control_plane.blocker_count, 1);
  assert.equal(producerDebt.post_merge_control_plane.only_blocker, "EXACT_ONE_PRODUCTION_OWNER");
  assert.equal(producerDebt.qualification_control_plane.workflow_run_id, 33639259224);
  assert.equal(producerDebt.qualification_control_plane.deliberate_fail_closed, true);
  assert.equal(producerDebt.qualification_control_plane.artifact_id, 9850279193);
  assert.equal(producerDebt.qualification_control_plane.artifact_digest, "sha256:6b2798025d1149429526e12fdaa28e2c4204455f018a12fe580e910b82d0c434");
  assert.equal(producerDebt.qualification_control_plane.blocker_count, 1);
  assert.equal(producerDebt.qualification_control_plane.only_blocker, "EXACT_ONE_PRODUCTION_OWNER");
  assert.equal(producerDebt.projection_authorizes_new_live_claim, false);
  assert.equal(producerDebt.taskbook_completion_gate_changed, false);

  for (const evidenceSubject of [
    producerDebt.migration_proof_subject_sha,
    producerDebt.settlement_subject_sha,
  ]) cp.execFileSync("git", ["merge-base", "--is-ancestor", evidenceSubject, subject]);

  const v13Qcp = json("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json");
  const v13Registry = json("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-EVIDENCE-REGISTRY-V1.json");
  assert.ok(v13Qcp.dependency_resolvers?.V13_RUNTIME_SEMANTIC_CLOSURE, "V13_RUNTIME_SEMANTIC_RESOLVER_REQUIRED");
  assert.ok(v13Qcp.dependency_resolvers?.V13_QUALIFICATION_HARNESS_CLOSURE, "V13_HARNESS_RESOLVER_REQUIRED");
  for (const checkId of [
    "V13_AUTONOMOUS_FORCING_FOUNDATION",
    "V13_HOLISTIC_SCHEMA",
    "V13_NEXT_TICK_VIABILITY",
    "V13_PRODUCER_DRIVEN_QUALIFICATION",
  ]) {
    const check = v13Qcp.checks.find((row) => row.check_id === checkId);
    assert.deepEqual(check?.resolver_ids, ["V13_RUNTIME_SEMANTIC_CLOSURE"], "V13_RUNTIME_CHECK_RESOLVER_SETTLEMENT_REQUIRED:" + checkId);
  }
  const projectedProducer = v13Registry.requalification_evidence?.entries?.find(
    (row) => row.evidence_id === producerDebt.projected_producer_evidence_id,
  );
  assert.ok(projectedProducer, "V13_PROJECTED_PRODUCER_EVIDENCE_REQUIRED");
  assert.equal(projectedProducer.dependency_digest, producerDebt.projected_runtime_aggregate_digest);
  assert.equal(projectedProducer.projection_source_evidence_id, producerDebt.source_producer_evidence_id);
  assert.equal(projectedProducer.projection_authorizes_new_live_claim, false);

  const producerWorkflow = read(".github/workflows/mcft-cap-09-v13-producer-driven-live-qualification.yml");
  const applicabilityIndex = producerWorkflow.indexOf("- name: Resolve governed producer live applicability");
  const durableIndex = producerWorkflow.indexOf("- name: Accept durable producer evidence without live rerun");
  const armIndex = producerWorkflow.indexOf("- name: Resolve explicit live arm");
  assert.ok(applicabilityIndex >= 0 && durableIndex > applicabilityIndex && armIndex > durableIndex, "V13_PRODUCER_APPLICABILITY_MUST_PRECEDE_ARM");
  includes(producerWorkflow, "if: steps.applicability.outputs.live_required == 'false'", "V13_PRODUCER_DURABLE_SKIP_MUST_USE_APPLICABILITY");
  includes(producerWorkflow, "id: arm\n        if: steps.applicability.outputs.live_required == 'true'", "V13_PRODUCER_ARM_MUST_ONLY_RUN_FOR_LIVE_REQUALIFICATION");
  includes(producerWorkflow, "V13_LIVE_ARM_FIRST_BASE_MUST_LEAD_BY_MORE_THAN_6H", "V13_PRODUCER_STALE_ARM_FRESHNESS_GUARD_MUST_REMAIN");
  assert.equal(separation.completion_boundary.taskbook_completion_gate_unchanged, true);
  assert.equal(separation.completion_boundary.real_s6_o00_o23_plus_final_exact_sha_r2_still_required_for_stage1b_completion, true);
  assert.equal(horizonAuthority.next_legal_frontier.status_scope, "LIVE_ACTIVATION_ONLY");
  assert.equal(
    horizonAuthority.next_legal_frontier.engineering_frontier_status,
    "MCFT_CAP_09_PRODUCTION_EQUIVALENT_ENGINEERING_READINESS_QUALIFIED",
  );
  assert.equal(horizonAuthority.next_legal_frontier.engineering_work_blocked_by_material_provider_change, false);
  assert.equal(horizonAuthority.next_legal_frontier.material_provider_change_is_engineering_blocker, false);
  assert.equal(horizonAuthority.next_legal_frontier.material_provider_change_is_live_activation_gate, true);

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
  assert.equal(kbsProductionPointerRemediationAuthority.status, "MATERIALIZED_SETTLED_UNARMED");
  assert.equal(kbsProductionPointerRemediationAuthority.target.database_name, "geox_mcft_cap09_production_runtime_v1");
  assert.equal(kbsProductionPointerRemediationAuthority.target.expected_table_count, 41);
  assert.equal(kbsProductionPointerRemediationAuthority.target.new_table_count_authorized, 0);
  assert.equal(kbsProductionPointerRemediationAuthority.authorization.production_kbs_baseline_pointer_schema_remediation_authorized, false);
  assert.equal(kbsProductionPointerRemediationAuthority.authorization.runtime_process_start_authorized, false);
  assert.equal(kbsProductionPointerRemediationAuthority.migration_ref, authority.kbs_publication_baseline_pointer_migration_ref);
  assert.deepEqual(
    [
      kbsProductionPointerRemediationAuthority.materialization_evidence.applied_subject_sha,
      kbsProductionPointerRemediationAuthority.materialization_evidence.applied_workflow_run_id,
      kbsProductionPointerRemediationAuthority.materialization_evidence.applied_status,
      kbsProductionPointerRemediationAuthority.materialization_evidence.settled_subject_sha,
      kbsProductionPointerRemediationAuthority.materialization_evidence.settled_workflow_run_id,
      kbsProductionPointerRemediationAuthority.materialization_evidence.settled_preflight_status,
      kbsProductionPointerRemediationAuthority.materialization_evidence.settled_runner_status,
      kbsProductionPointerRemediationAuthority.materialization_evidence.current_production_schema_materialized,
    ],
    [
      "d3da67cf19baa8a6ebff69171d0b00c9e2fe018e",
      33614379767,
      "PASS_REMEDIATION_APPLIED",
      "5ed1ff5340507bb6d722810a64132b5e1a7966e0",
      33614715938,
      "PASS_ALREADY_MATERIALIZED",
      "SKIPPED_NOT_ARMED",
      true,
    ],
  );
  const kbsProductionPointerArm = json(authority.kbs_production_baseline_pointer_schema_remediation_arm_ref);
  assert.equal(kbsProductionPointerArm.armed, false);
  assert.equal(kbsProductionPointerArm.exact_target_database_name, null);
  assert.equal(kbsProductionPointerArm.production_kbs_baseline_pointer_schema_remediation_authorized, false);
  const kbsProductionPointerWorkflow = read(authority.kbs_production_baseline_pointer_schema_remediation_workflow_ref);
  includes(kbsProductionPointerWorkflow, "Read-only exact production KBS pointer schema preflight", "KBS_POINTER_PRODUCTION_READ_ONLY_PREFLIGHT_REQUIRED");
  includes(kbsProductionPointerWorkflow, "Apply pointer schema only when separately armed", "KBS_POINTER_PRODUCTION_SEPARATE_ARM_REQUIRED");

  const sourcePollRemediationAuthority = json(authority.source_poll_schedule_schema_remediation_authority_ref);
  assert.equal(sourcePollRemediationAuthority.status, "MATERIALIZED_SETTLED_UNARMED");
  assert.equal(sourcePollRemediationAuthority.target.database_name, "geox_mcft_cap09_production_runtime_v1");
  assert.equal(sourcePollRemediationAuthority.target.expected_table_count, 41);
  assert.equal(sourcePollRemediationAuthority.target.new_table_count_authorized, 0);
  assert.equal(sourcePollRemediationAuthority.authorization.production_evidence_source_poll_schedule_schema_remediation_authorized, false);
  assert.equal(sourcePollRemediationAuthority.authorization.runtime_process_start_authorized, false);
  assert.equal(sourcePollRemediationAuthority.migration_ref, authority.source_poll_schedule_migration_ref);
  assert.deepEqual(
    [
      sourcePollRemediationAuthority.materialization_evidence.applied_subject_sha,
      sourcePollRemediationAuthority.materialization_evidence.applied_workflow_run_id,
      sourcePollRemediationAuthority.materialization_evidence.applied_status,
      sourcePollRemediationAuthority.materialization_evidence.settled_subject_sha,
      sourcePollRemediationAuthority.materialization_evidence.settled_workflow_run_id,
      sourcePollRemediationAuthority.materialization_evidence.settled_preflight_status,
      sourcePollRemediationAuthority.materialization_evidence.settled_runner_status,
      sourcePollRemediationAuthority.materialization_evidence.current_production_schema_materialized,
    ],
    [
      "d3da67cf19baa8a6ebff69171d0b00c9e2fe018e",
      33614379928,
      "PASS_REMEDIATION_APPLIED",
      "5ed1ff5340507bb6d722810a64132b5e1a7966e0",
      33614716061,
      "PASS_ALREADY_MATERIALIZED",
      "SKIPPED_NOT_ARMED",
      true,
    ],
  );
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
  const duePolicyAuthority = json(authority.source_due_policy_authority_ref);
  assert.equal(duePolicyAuthority.status, "ESTABLISHED_SCHEMA_MATERIALIZED_NOT_BOUND");
  assert.equal(duePolicyAuthority.durable_state.current_production_schema_materialized, true);
  assert.equal(
    duePolicyAuthority.durable_state.materialization_settled_subject_sha,
    "5ed1ff5340507bb6d722810a64132b5e1a7966e0",
  );
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
  includes(purePlanner, "partial_progress: partial", "GFS_PARTIAL_EXACT_PROGRESS_SNAPSHOT_REQUIRED");
  includes(purePlanner, "KBS_SOIL_CURRENT_ACQUIRE", "SOIL_EXPLICIT_DUE_ACTION_REQUIRED");
  assert.equal(purePlanner.includes("Date.now"), false, "PURE_PLANNER_WALL_CLOCK_READ_FORBIDDEN");
  assert.equal(purePlanner.includes("process.env"), false, "PURE_PLANNER_ENV_READ_FORBIDDEN");
  assert.equal(purePlanner.includes("new Postgres"), false, "PURE_PLANNER_DATABASE_ADAPTER_FORBIDDEN");
  assert.equal(purePlanner.includes("fetch("), false, "PURE_PLANNER_PROVIDER_FETCH_FORBIDDEN");

  const composition = read(authority.production_composition_ref);
  includes(composition, "host_planner: EvidenceRuntimeHostPlannerV1", "PRODUCTION_COMPOSITION_DIRECT_HOST_PLANNER_SEAM_REQUIRED");
  includes(composition, "PHASE3_EVIDENCE_RUNTIME_EXACTLY_ONE_PLANNER_BOUNDARY_REQUIRED", "PRODUCTION_COMPOSITION_EXACT_ONE_PLANNER_REQUIRED");
  const productionProcess = read(authority.production_process_ref);
  includes(productionProcess, "host_planner: EvidenceRuntimeHostPlannerV1", "PRODUCTION_PROCESS_DIRECT_HOST_PLANNER_SEAM_REQUIRED");

  const plannerAssembly = read(authority.production_planner_assembly_ref);
  includes(plannerAssembly, "PostgresEvidenceSupplyCursorReadV1", "PLANNER_ASSEMBLY_CURSOR_READER_REQUIRED");
  includes(plannerAssembly, "PostgresEvidenceSourcePollScheduleV1", "PLANNER_ASSEMBLY_SOURCE_POLL_REQUIRED");
  includes(plannerAssembly, "PostgresGfsRetryScheduleV1", "PLANNER_ASSEMBLY_GFS_RETRY_REQUIRED");
  includes(plannerAssembly, "PostgresGfsCanonicalTargetPairHistoryV1", "PLANNER_ASSEMBLY_GFS_HISTORY_REQUIRED");
  includes(plannerAssembly, "ProductionEvidenceProviderAttemptFenceFactoryV1", "PLANNER_ASSEMBLY_PROVIDER_FENCE_REQUIRED");
  includes(plannerAssembly, "ProductionEvidenceSourcePlanExecutorV1", "PLANNER_ASSEMBLY_EXECUTOR_REQUIRED");
  includes(plannerAssembly, "ProductionEvidenceHostPlannerV1", "PLANNER_ASSEMBLY_HOST_PLANNER_REQUIRED");
  assert.equal(plannerAssembly.includes("process.env"), false, "PLANNER_ASSEMBLY_ENV_FORBIDDEN");
  assert.equal(plannerAssembly.includes("Date.now"), false, "PLANNER_ASSEMBLY_WALL_CLOCK_FORBIDDEN");
  assert.equal(authority.production_planner_dependency_assembly_implemented, true);
  assert.equal(authority.production_planner_dependency_assembly_construction_zero_io, true);
  assert.equal(authority.production_planner_dependency_assembly_runtime_start_effect, false);

  const host = read(authority.host_lifecycle_ref);
  includes(host, '"PLANNER_EXHAUSTED"', "EVIDENCE_HOST_NULL_TERMINAL_STATE_REQUIRED");
  includes(host, "PHASE3_EVIDENCE_HOST_ATTEMPT_PLAN_INVALID", "EVIDENCE_HOST_ATTEMPT_PLAN_FAIL_CLOSED_REQUIRED");
  includes(host, 'status: "NOT_DUE"', "EVIDENCE_HOST_NOT_DUE_STATE_REQUIRED");
  includes(host, 'reason: "PLANNER_NOT_DUE"', "EVIDENCE_HOST_NOT_DUE_WAIT_REQUIRED");
  includes(host, '"PROVIDER_NOT_DUE"', "EVIDENCE_HOST_PROVIDER_NOT_DUE_REQUIRED");
  includes(host, 'reason:"PROVIDER_NOT_DUE"', "EVIDENCE_HOST_PROVIDER_NOT_DUE_WAIT_REQUIRED");
  includes(host, '"ATTEMPT_COMPLETED"', "EVIDENCE_HOST_ATTEMPT_HEALTH_REQUIRED");
  includes(host, "EVIDENCE_PLANE_DURABLE_PROGRESS_SET", "EVIDENCE_HOST_DURABLE_PROGRESS_SET_REQUIRED");
  assert.equal(host.includes("EvidenceRuntimeCycleServiceV1"), false, "EVIDENCE_HOST_DIRECT_CYCLE_SERVICE_FORBIDDEN");
  const hostAttempt = read(authority.host_attempt_contract_ref);
  includes(hostAttempt, "EvidenceRuntimeHostAttemptPlanV1", "EVIDENCE_HOST_ATTEMPT_PLAN_CONTRACT_REQUIRED");
  includes(hostAttempt, '"KBS_RAW_HOURLY_PUBLICATION_CYCLE"', "EVIDENCE_HOST_KBS_ATTEMPT_KIND_REQUIRED");
  includes(hostAttempt, '"GFS_PARTIAL_PAIR_REHYDRATION"', "EVIDENCE_HOST_GFS_REHYDRATION_ATTEMPT_KIND_REQUIRED");
  includes(hostAttempt, "buildCanonicalWorkItemAttemptPlanV1", "EVIDENCE_HOST_CANONICAL_ATTEMPT_ADAPTER_REQUIRED");
  assert.equal(authority.host_lifecycle_gap.production_host_planner_process_seam_implemented, true);
  assert.equal(authority.host_lifecycle_gap.production_process_accepts_direct_host_planner, true);

  const sourcePlanExecutor = read(authority.production_source_plan_executor_ref);
  includes(sourcePlanExecutor, "ProductionEvidenceSourcePlanExecutorV1", "SOURCE_PLAN_EXECUTOR_REQUIRED");
  includes(sourcePlanExecutor, "KBS_RAW_HOURLY_PUBLICATION_CYCLE", "SOURCE_PLAN_EXECUTOR_KBS_REQUIRED");
  includes(sourcePlanExecutor, "GFS_PARTIAL_PAIR_REHYDRATION", "SOURCE_PLAN_EXECUTOR_GFS_REPAIR_REQUIRED");
  includes(sourcePlanExecutor, "buildKbsSoilCurrent", "SOURCE_PLAN_EXECUTOR_SOIL_TARGET_FREE_PATH_REQUIRED");
  includes(sourcePlanExecutor, "partial: operation.partial_progress", "SOURCE_PLAN_EXECUTOR_EXACT_PARTIAL_SNAPSHOT_REQUIRED");
  includes(sourcePlanExecutor, "PRODUCTION_SOURCE_PLAN_EXECUTOR_KBS_BLOCKED", "SOURCE_PLAN_EXECUTOR_KBS_BLOCK_FAIL_CLOSED_REQUIRED");
  assert.equal(sourcePlanExecutor.includes("Date.now"), false, "SOURCE_PLAN_EXECUTOR_WALL_CLOCK_FORBIDDEN");
  assert.equal(sourcePlanExecutor.includes("process.env"), false, "SOURCE_PLAN_EXECUTOR_ENV_FORBIDDEN");
  includes(sourcePlanExecutor, "provider_attempt_fence_factory", "SOURCE_PLAN_EXECUTOR_PROVIDER_FENCE_REQUIRED");
  includes(sourcePlanExecutor, "provider_attempt_fence: providerFence", "SOURCE_PLAN_EXECUTOR_PROVIDER_FENCE_BINDING_REQUIRED");
  includes(sourcePlanExecutor, "GFS_REHYDRATION_PROVIDER_FENCE_FORBIDDEN", "GFS_REHYDRATION_ZERO_PROVIDER_BUDGET_REQUIRED");
  const providerFenceContract=read(authority.provider_attempt_fence_contract_ref);
  includes(providerFenceContract, "claimBeforeProviderFetch", "PROVIDER_FENCE_CONTRACT_REQUIRED");
  const providerFenceFactory=read(authority.provider_attempt_fence_factory_ref);
  includes(providerFenceFactory, "claimPollBeforeProviderFetch", "PROVIDER_FENCE_SOURCE_POLL_CLAIM_REQUIRED");
  includes(providerFenceFactory, "claimGfsAttemptBeforeProviderFetch", "PROVIDER_FENCE_GFS_RETRY_CLAIM_REQUIRED");
  includes(providerFenceFactory, "GFS_ATTEMPT_BUDGET_EXHAUSTED", "PROVIDER_FENCE_GFS_BUDGET_FAIL_CLOSED_REQUIRED");
  includes(providerFenceFactory, "GFS_MISSED_WINDOW", "PROVIDER_FENCE_GFS_MISSED_WINDOW_FAIL_CLOSED_REQUIRED");
  assert.equal(providerFenceFactory.includes("Date.now"), false, "PROVIDER_FENCE_WALL_CLOCK_FORBIDDEN");
  assert.equal(providerFenceFactory.includes("process.env"), false, "PROVIDER_FENCE_ENV_FORBIDDEN");

  const fixture = read("apps/server/src/external_evidence/qualification/mcft_cap09_phase5_evidence_runtime_qualification_v1.ts");
  includes(fixture, "createTargetPlanner(input?", "PHASE5_MANIFEST_PLANNER_REQUIRED");
  includes(fixture, "const targets = this.manifest.targets", "PHASE5_PLANNER_MUST_REMAIN_MANIFEST_BACKED");

  const forcing = read("apps/server/src/external_evidence/mcft_cap09_v13_forcing_production_composition_v1.ts");
  for (const marker of ["epoch_id: string", "first_required_base: string", "last_required_base: string"]) {
    includes(forcing, marker, `V13_FORCING_AUTHORITY_INPUT_REQUIRED:${marker}`);
  }

  const packager = read(authority.entrypoint_packager_ref);
  includes(packager, "runMcftCap09ProductionEvidenceRuntimeV1", "PRODUCTION_ENTRYPOINT_PLANNER_BINDING_REQUIRED");
  assert.equal(packager.includes("MCFT_CAP09_EVIDENCE_PRODUCTION_TARGET_PLANNER_NOT_BOUND"), false);

  assert.deepEqual(authority.unconditional_blockers, []);
  assert.equal(authority.adjudication.phase5_fixture_manifest_may_be_production_planner, false);
  assert.equal(authority.adjudication.v13_forcing_controller_may_be_general_evidence_planner, false);
  assert.equal(authority.adjudication.wall_clock_floor_alone_may_select_all_source_targets, false);
  assert.equal(authority.adjudication.runtime_tick_cursor_may_drive_evidence_acquisition, false);
  assert.equal(
    authority.current_entrypoint.status,
    "PACKAGED_PRODUCTION_PLANNER_BOUND_RUNTIME_START_AUTHORITY_NOT_ARMED",
  );
  assert.equal(authority.current_entrypoint.binding_authorized, true);
  assert.equal(authority.current_entrypoint.failure_code, "MCFT_CAP09_PRODUCTION_RUNTIME_START_AUTHORITY_NOT_ARMED");
  const runtimeStartAuthorityDocument = json(authority.production_runtime_start_authority_ref);
  assert.equal(authority.production_runtime_start_authority_json_pointer, "/runtime_start_binding");
  const runtimeStartAuthority = runtimeStartAuthorityDocument.runtime_start_binding;
  assert.equal(runtimeStartAuthority.status, "ENTRYPOINT_BOUND_NOT_ARMED");
  assert.equal(runtimeStartAuthority.armed, false);
  assert.equal(runtimeStartAuthority.runtime_process_start_authorized, false);
  assert.equal(runtimeStartAuthority.production_owner_activation_authorized, false);
  assert.equal(
    runtimeStartAuthorityDocument.status,
    "ENGINEERING_READINESS_QUALIFIED_LIVE_ACTIVATION_BLOCKED_CURRENT_T4R1_AUTHORITY_UNRESOLVED",
  );
  const runtimeStartReadiness = runtimeStartAuthorityDocument.runtime_start_readiness_settlement;
  assert.equal(runtimeStartReadiness.status, "BLOCKED_NO_VIABLE_FUTURE_FORMAL_WINDOW_UNDER_CURRENT_T4R1_CROP_AUTHORITY");
  assert.equal(runtimeStartReadiness.proof_subject_sha, "9a27816e456402a8eb6a3a7d572713bd8e0737f0");
  assert.equal(runtimeStartReadiness.workflow_run_id, 33622744383);
  assert.equal(runtimeStartReadiness.artifact_id, 9843579935);
  assert.equal(runtimeStartReadiness.latest_viable_a0, "2026-08-27T21:00:00.000Z");
  assert.equal(runtimeStartReadiness.latest_viable_o00, "2026-08-27T22:00:00.000Z");
  assert.equal(runtimeStartReadiness.latest_viable_o23, "2026-08-28T21:00:00.000Z");
  assert.equal(runtimeStartReadiness.viable_future_formal_window_available, false);
  assert.equal(runtimeStartReadiness.runtime_start_authority_may_be_armed, false);
  const rescueSettlement = runtimeStartAuthorityDocument.alternative_scope_rescue_settlement;
  assert.equal(rescueSettlement.status, "SETTLED_IMMUTABLE_READ_ONLY_SCAN");
  assert.equal(rescueSettlement.proof_subject_sha, "76e990f18275eb0bb1bb115540c9725b0fef1321");
  assert.equal(rescueSettlement.workflow_run_id, 33623030240);
  assert.equal(rescueSettlement.artifact_id, 9843705746);
  assert.equal(rescueSettlement.result, "NO_ALTERNATIVE_SCOPE_CANDIDATE_CURRENTLY_ESTABLISHED");
  assert.equal(rescueSettlement.scanned_observation_row_count, 240);
  assert.equal(rescueSettlement.planting_lead_count, 4);
  assert.equal(rescueSettlement.eligible_candidate_count, 0);
  assert.equal(rescueSettlement.all_inspected_legal_o00_count_zero, true);
  assert.equal(rescueSettlement.selected_candidate, null);
  assert.equal(rescueSettlement.database_write_count, 0);
  assert.equal(rescueSettlement.runtime_process_start, false);

  const stageSeasonSettlement = runtimeStartAuthorityDocument.t4r1_stage_or_natural_season_requalification_settlement;
  assert.equal(
    stageSeasonSettlement.status,
    "SETTLED_NO_CURRENT_T4R1_STAGE_OR_NATURAL_SEASON_SUCCESSOR_AUTHORITY_ESTABLISHED",
  );
  assert.equal(stageSeasonSettlement.predecessor_frontier_head, "e075d48b13ef1c85888c0f3dfbf3173bb5232f96");

  const stageRoute = stageSeasonSettlement.contemporaneous_stage_route;
  assert.equal(stageRoute.proof_subject_sha, "60e4fd93c9dff017fd0d62967fad17a49383f12e");
  assert.equal(stageRoute.workflow_run_id, 33630413934);
  assert.equal(stageRoute.artifact_id, 9846584085);
  assert.equal(
    stageRoute.artifact_digest,
    "sha256:38a6b645cab971c70ed13e116392186f0eafee2c32538d062a02e265a24a18c4",
  );
  assert.equal(stageRoute.result, "NO_T4R1_CONTEMPORANEOUS_STAGE_INPUT_AUTHORITY_CURRENTLY_ESTABLISHED");
  assert.equal(stageRoute.scanned_index_page_count, 5);
  assert.equal(stageRoute.scanned_observation_row_count, 150);
  assert.equal(stageRoute.inspected_detail_count, 6);
  assert.equal(stageRoute.direct_stage_input_candidate_count, 0);
  assert.equal(stageRoute.termination_input_candidate_count, 0);
  assert.equal(stageRoute.stage_authority_established, false);
  assert.equal(stageRoute.stage, null);
  assert.equal(stageRoute.whole_window_6h_30h_guard_passed, false);
  assert.equal(stageRoute.database_write_count, 0);
  assert.equal(stageRoute.runtime_process_start, false);
  assert.equal(stageRoute.provider_body_emitted, false);
  assert.equal(stageRoute.formal_execution_count, "0/24");

  const naturalSeasonRoute = stageSeasonSettlement.natural_season_route;
  assert.equal(naturalSeasonRoute.proof_subject_sha, "d631d20b3a2a0c179ba2ed98dd827e3e6431f6db");
  assert.equal(naturalSeasonRoute.workflow_run_id, 33630968448);
  assert.equal(naturalSeasonRoute.artifact_id, 9846818521);
  assert.equal(
    naturalSeasonRoute.artifact_digest,
    "sha256:6275357bf5a6e054f0656dc907215439e20829b9e94a1925e317ecfcea9af09b",
  );
  assert.equal(naturalSeasonRoute.result, "NO_T4R1_NATURAL_SEASON_SUCCESSOR_CANDIDATE_CURRENTLY_OBSERVED");
  assert.equal(naturalSeasonRoute.scanned_index_page_count, 5);
  assert.equal(naturalSeasonRoute.scanned_observation_row_count, 150);
  assert.equal(naturalSeasonRoute.post_anchor_t4_planting_lead_count, 0);
  assert.equal(naturalSeasonRoute.exact_t4r1_successor_candidate_count, 0);
  assert.equal(naturalSeasonRoute.time_gated_snapshot, true);
  assert.equal(naturalSeasonRoute.global_new_season_source_absence_claimed, false);
  assert.equal(naturalSeasonRoute.new_natural_season_created, false);
  assert.equal(naturalSeasonRoute.new_season_id, null);
  assert.equal(naturalSeasonRoute.new_crop, null);
  assert.equal(naturalSeasonRoute.historical_geometry_reused, false);
  assert.equal(naturalSeasonRoute.cross_season_stitching_authorized, false);
  assert.equal(naturalSeasonRoute.database_write_count, 0);
  assert.equal(naturalSeasonRoute.runtime_process_start, false);
  assert.equal(naturalSeasonRoute.provider_body_emitted, false);
  assert.equal(naturalSeasonRoute.formal_execution_count, "0/24");

  assert.equal(stageSeasonSettlement.conclusion.current_t4r1_stage_authority_established, false);
  assert.equal(stageSeasonSettlement.conclusion.current_t4r1_natural_season_successor_authority_established, false);
  assert.equal(stageSeasonSettlement.conclusion.viable_future_formal_window_available, false);
  assert.equal(stageSeasonSettlement.conclusion.runtime_start_authority_may_be_armed, false);
  assert.equal(stageSeasonSettlement.conclusion.production_owner_activation_authorized, false);
  assert.equal(stageSeasonSettlement.conclusion.cross_season_stitching_authorized, false);
  assert.equal(stageSeasonSettlement.conclusion.requalification_without_material_provider_change_authorized, false);
  assert.equal(
    stageSeasonSettlement.conclusion.next_legal_frontier,
    "T4R1_STAGE_OR_NATURAL_SEASON_AUTHORITY_REQUALIFICATION_REQUIRED_ON_MATERIAL_PROVIDER_CHANGE",
  );
  assert.deepEqual(stageSeasonSettlement.material_provider_change_triggers, [
    "NEW_EXACT_CURRENT_T4R1_PHENOLOGY_EVIDENCE_BECOMES_PUBLICLY_RETRIEVABLE",
    "NEW_EXACT_CURRENT_T4R1_TERMINATION_OR_HARVEST_EVIDENCE_BECOMES_PUBLICLY_RETRIEVABLE",
    "NEW_KBS_AGLOG_T4_OR_T4R1_PLANTING_OBSERVATION_AFTER_2026_05_27_BECOMES_PUBLICLY_RETRIEVABLE",
  ]);
  assert.equal(stageSeasonSettlement.transient_proof_scaffolding.status, "RETIRED_AFTER_DURABLE_CANONICAL_SETTLEMENT");
  assert.equal(stageSeasonSettlement.transient_proof_scaffolding.repository_history_preserves_exact_blobs, true);
  assert.equal(stageSeasonSettlement.transient_proof_scaffolding.files.length, 8);
  for (const row of stageSeasonSettlement.transient_proof_scaffolding.files) {
    assert.match(row.blob_sha, /^[0-9a-f]{40}$/, `T4R1_REQUALIFICATION_RETIRED_BLOB_SHA_REQUIRED:${row.path}`);
    assert.equal(
      fs.existsSync(path.join(ROOT, row.path)),
      false,
      `T4R1_REQUALIFICATION_TRANSIENT_PATH_MUST_BE_RETIRED:${row.path}`,
    );
  }
  assert.equal(stageSeasonSettlement.non_effects.production_database_mutation, false);
  assert.equal(stageSeasonSettlement.non_effects.raw_object_mutation, false);
  assert.equal(stageSeasonSettlement.non_effects.runtime_config_mutation, false);
  assert.equal(stageSeasonSettlement.non_effects.scheduler_mutation, false);
  assert.equal(stageSeasonSettlement.non_effects.production_runtime_start, false);
  assert.equal(stageSeasonSettlement.non_effects.production_owner_activation, false);
  assert.equal(stageSeasonSettlement.non_effects.formal_v5_execution, false);
  assert.equal(stageSeasonSettlement.non_effects.a0_bootstrap, false);
  assert.equal(stageSeasonSettlement.non_effects.o00_started, false);
  assert.equal(stageSeasonSettlement.non_effects.mcft_cap09_completed, false);
  assert.equal(
    runtimeStartAuthorityDocument.next_legal_frontier.latest_requalification_settlement_status,
    "SETTLED_NO_CURRENT_T4R1_STAGE_OR_NATURAL_SEASON_SUCCESSOR_AUTHORITY_ESTABLISHED",
  );
  assert.equal(runtimeStartAuthorityDocument.next_legal_frontier.requalification_without_material_provider_change_authorized, false);
  assert.equal(runtimeStartAuthorityDocument.next_legal_frontier.runtime_start_authority_may_be_armed, false);
  assert.equal(authority.runtime_start_frontier.viable_future_formal_window_available, false);
  assert.equal(authority.runtime_start_frontier.alternative_scope_eligible_candidate_count, 0);
  assert.equal(authority.runtime_start_frontier.runtime_start_authority_may_be_armed, false);
  assert.equal(
    authority.current_frontier,
    "T4R1_STAGE_OR_NATURAL_SEASON_AUTHORITY_REQUALIFICATION_BEFORE_RUNTIME_START",
  );
  assert.deepEqual(authority.implementation_order, [
    "RESOLVE_T4R1_STAGE_OR_NATURAL_SEASON_AUTHORITY_TO_RESTORE_VIABLE_FUTURE_FORMAL_WINDOW",
    "ESTABLISH_AND_ARM_SEPARATE_PRODUCTION_RUNTIME_START_AUTHORITY",
  ]);
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
  assert.equal(authority.source_specific_requirements.kbs_raw_hourly.production_baseline_pointer_schema_materialized, true);
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
  assert.equal(authority.source_specific_requirements.gfs_bundle.current_shape_bindable, true);
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
  assert.equal(authority.production_source_poll_schedule_schema_materialized, true);
  assert.deepEqual(
    [
      authority.production_schema_materialization_evidence.source_poll_schedule_applied_workflow_run_id,
      authority.production_schema_materialization_evidence.source_poll_schedule_settled_workflow_run_id,
      authority.production_schema_materialization_evidence.source_poll_schedule_settled_preflight_status,
      authority.production_schema_materialization_evidence.source_poll_schedule_settled_runner_status,
      authority.production_schema_materialization_evidence.kbs_baseline_pointer_applied_workflow_run_id,
      authority.production_schema_materialization_evidence.kbs_baseline_pointer_settled_workflow_run_id,
      authority.production_schema_materialization_evidence.kbs_baseline_pointer_settled_preflight_status,
      authority.production_schema_materialization_evidence.kbs_baseline_pointer_settled_runner_status,
      authority.production_schema_materialization_evidence.table_count,
      authority.production_schema_materialization_evidence.lease_row_count,
    ],
    [33614379928, 33614716061, "PASS_ALREADY_MATERIALIZED", "SKIPPED_NOT_ARMED", 33614379767, 33614715938, "PASS_ALREADY_MATERIALIZED", "SKIPPED_NOT_ARMED", 41, 0],
  );
  assert.equal(authority.source_specific_requirements.kbs_raw_hourly.current_shape_bindable, true);
  assert.equal(authority.source_specific_requirements.kbs_soil.current_shape_bindable, true);
  assert.equal(authority.source_specific_requirements.kbs_raw_hourly.single_fetch_multi_interval_path_implemented, true);
  assert.equal(authority.source_specific_requirements.kbs_raw_hourly.single_private_retention_per_batch_implemented, true);
  assert.equal(authority.source_specific_requirements.gfs_bundle.cross_cycle_progress_read_port_implemented, true);
  assert.equal(authority.source_specific_requirements.gfs_bundle.weather_et0_pair_skew_fail_closed, true);
  assert.equal(authority.source_specific_requirements.kbs_soil.latest_observed_event_progress_read_implemented, true);
  assert.equal(authority.host_lifecycle_gap.not_due_wait_implemented, true);
  assert.equal(authority.host_lifecycle_gap.production_planner_bound, true);
  assert.equal(authority.host_lifecycle_gap.heterogeneous_source_plan_execution_seam_implemented, true);
  assert.equal(authority.host_lifecycle_gap.kbs_publication_cycle_can_share_single_host_lifecycle, true);
  assert.equal(authority.host_lifecycle_gap.gfs_partial_rehydration_can_share_single_host_lifecycle, true);
  assert.equal(authority.host_lifecycle_gap.second_evidence_host_authorized, false);
  assert.equal(authority.host_lifecycle_gap.production_source_plan_executor_adapter_implemented, true);
  assert.equal(authority.host_lifecycle_gap.provider_attempt_fence_binding_implemented, true);
  assert.equal(authority.host_lifecycle_gap.provider_not_due_nonfailure_standby_implemented, true);
  assert.equal(authority.host_lifecycle_gap.durable_restart_authority, "EVIDENCE_PLANE_DURABLE_PROGRESS_SET");

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
    current_frontier: authority.current_frontier,
    kbs_planner_cycle_wiring_aligned: true,
    gfs_replay_provenance_foundation_implemented: true,
    kbs_publication_cycle_adapter_implemented: true,
    shared_verified_retained_raw_replay_primitive_implemented: true,
    kbs_historical_prefix_snapshot_comparison_implemented: true,
    production_kbs_baseline_pointer_schema_remediation_capability_implemented: true,
    production_kbs_baseline_pointer_schema_remediation_authorized: false,
    production_kbs_baseline_pointer_schema_materialized: true,
    production_source_poll_schedule_schema_materialized: true,
    kbs_fenced_baseline_pointer_implemented_isolated: true,
    kbs_content_addressed_baseline_manifest_store_implemented: true,
    kbs_forward_delta_no_change_discovery_implemented: true,
    kbs_complete_table_bootstrap_corrected: true,
    pure_source_specific_planner_core_implemented: true,
    acquisition_horizon_authority_established: true,
    active_runtime_start_horizon_instance_bound: false,
    runtime_start_readiness_status: runtimeStartReadiness.status,
    latest_viable_formal_o00: runtimeStartReadiness.latest_viable_o00,
    viable_future_formal_window_available: false,
    alternative_scope_rescue_result: rescueSettlement.result,
    alternative_scope_eligible_candidate_count: rescueSettlement.eligible_candidate_count,
    engineering_readiness_status: separation.engineering_readiness.status,
    engineering_readiness_claim: separation.engineering_readiness.allowed_claim,
    v13_producer_stale_arm_debt_status: producerDebt.status,
    v13_producer_projected_evidence_id: producerDebt.projected_producer_evidence_id,
    v13_producer_live_requalification_required: producerDebt.producer_live_required,
    engineering_work_blocked_by_material_provider_change: false,
    live_activation_status: separation.live_activation.status,
    material_provider_change_is_live_activation_gate: true,
    runtime_start_authority_may_be_armed: false,
    kbs_single_fetch_multi_interval_path_implemented: true,
    source_specific_progress_ports_implemented: true,
    unconditional_blockers: authority.unconditional_blockers,
    static_machine_admission: "PASS_PARENT_SUBJECT",
    production_target_planner_bound: true,
    compiled_entrypoint_fail_closed: true,
    compiled_entrypoint_fail_closed_reason: "RUNTIME_START_AUTHORITY_NOT_ARMED",
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

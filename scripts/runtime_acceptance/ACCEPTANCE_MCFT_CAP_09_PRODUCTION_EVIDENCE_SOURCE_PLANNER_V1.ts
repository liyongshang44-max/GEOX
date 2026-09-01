import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import type {
  EvidenceSupplyCursorSnapshotV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_evidence_runtime_persistence_v1.js";
import type {
  EvidenceSourceSpecificProgressV1,
  GfsCyclePairProgressV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_evidence_source_progress_v1.js";
import {
  MCFT_CAP09_PRODUCTION_EVIDENCE_ACQUISITION_HORIZON_AUTHORITY_ID_V1,
  type ProductionEvidenceAcquisitionHorizonV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_production_evidence_acquisition_horizon_v1.js";
import {
  planProductionEvidenceSourcesV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_production_evidence_source_planner_v1.js";

const OUT = path.resolve(
  "acceptance-output/MCFT_CAP_09_PRODUCTION_EVIDENCE_SOURCE_PLANNER_V1_RESULT.json",
);
const PLANNING_TIME = "2026-09-01T20:00:00.000Z";
const ACTIVATION = "2026-09-01T19:00:00.000Z";

function horizon(): ProductionEvidenceAcquisitionHorizonV1 {
  return {
    authority_id: MCFT_CAP09_PRODUCTION_EVIDENCE_ACQUISITION_HORIZON_AUTHORITY_ID_V1,
    runtime_start_authority_ref: "authority://mcft-cap09/runtime-start/focused-fixture",
    activation_fence_time: ACTIVATION,
    kbs_raw_hourly: {
      bootstrap_mode: "FIRST_RETAINED_FULL_TABLE_SNAPSHOT_ESTABLISHES_PRIVATE_PUBLICATION_BASELINE_NO_CANONICAL_EMISSION",
      endpoint_shape: "COMPLETE_ACCUMULATED_TABLE",
      baseline_retention_required: true,
      baseline_event_index_required: true,
      baseline_canonical_emission_count: 0,
      first_canonical_emission_requires_observed_post_baseline_forward_event_delta: true,
      post_baseline_diff_basis: "EVENT_TIME_PLUS_ROW_IDENTITY_HASH",
      fixed_latest_24_rows_assumption_authorized: false,
      non_authoritative_daily_batch_operating_profile_may_define_promotion_set: false,
      revision_or_backfill_before_previous_latest_auto_promotion_authorized: false,
    },
    gfs_bundle: {
      bootstrap_mode: "FIRST_PROVIDER_SELECTED_CYCLE_FETCH_STARTED_AT_OR_AFTER_ACTIVATION_FENCE",
      bounded_backfill_unit: "ONE_PROVIDER_SELECTED_CYCLE",
      historical_cycle_sweep_authorized: false,
      provider_cycle_selection_owner: "PRODUCT_GFS_PROVIDER",
    },
    kbs_soil: {
      bootstrap_mode: "FIRST_CURRENT_PROVIDER_RESPONSE_FETCH_STARTED_AT_OR_AFTER_ACTIVATION_FENCE",
      bounded_backfill_unit: "ONE_CURRENT_PROVIDER_RESPONSE",
      historical_event_scan_authorized: false,
      explicit_poll_due_policy_established: false,
    },
    restart: {
      durable_progress_present: "RESUME_FROM_EVIDENCE_OWNED_DURABLE_SOURCE_PROGRESS",
      kbs_publication_baseline_must_be_durable_when_no_evidence_progress: true,
      in_memory_only_kbs_baseline_sufficient_for_production: false,
      bootstrap_rewind_authorized: false,
      runtime_tick_cursor_fallback_authorized: false,
      successful_cycle_count_fallback_authorized: false,
    },
  };
}

function cursor(input: {
  binding_id: string;
  origin_source_id: string;
  event_time: string;
  valid_from?: string;
}): EvidenceSupplyCursorSnapshotV1 {
  return {
    scope: {
      tenant_id: "tenant_mcft_external",
      project_id: "project_mcft_cap09",
      group_id: "group_mcft_cap09",
      field_id: "field_mcft_external",
      season_id: "season_2026",
      zone_id: "zone_root",
    },
    binding_id: input.binding_id,
    origin_source_id: input.origin_source_id,
    fact_id: "fact_" + "1".repeat(64),
    record_semantic_sha256: "sha256:" + "2".repeat(64),
    available_to_runtime_at: "2026-09-01T19:30:00.000Z",
    publication_available_through: "2026-09-01T19:30:00.000Z",
    latest_event_time: input.event_time,
    latest_source_record_id: "source-record",
    event_time_contiguous_from: input.event_time,
    event_time_contiguous_through: input.event_time,
    event_time_max_seen: input.event_time,
    event_gap_count: 0,
    revision_count: 0,
    publication_event_count: 1,
    cadence_profile_id: "qualification",
    role_time: input.valid_from
      ? { issued_at: input.event_time, valid_from: input.valid_from }
      : { observed_at: input.event_time },
    post_commit_db_readback_at: "2026-09-01T19:31:00.000Z",
    lease_owner: "evidence-runtime",
    fencing_token: 1n,
    advanced_at: "2026-09-01T19:31:00.000Z",
  };
}

function baseProgress(): EvidenceSourceSpecificProgressV1 {
  return {
    reader_id: "MCFT_CAP09_EVIDENCE_SOURCE_PROGRESS_READER_V1",
    kbs_raw_hourly: {
      state: "PAIRED",
      rainfall: null,
      historical_et0: null,
      paired_contiguous_through: "2026-09-01T18:00:00.000Z",
      pair_skew_seconds: 0,
    },
    gfs_bundle: {
      cycles: [],
      complete_pair_count: 0,
      partial_pair_count: 0,
    },
    kbs_soil: {
      latest: null,
    },
  };
}

function notDue(authority: string) {
  return {
    status: "NOT_DUE" as const,
    authority_ref: authority,
    evaluated_at: PLANNING_TIME,
  };
}

function due(authority: string) {
  return {
    status: "DUE" as const,
    authority_ref: authority,
    evaluated_at: PLANNING_TIME,
    requested_at: PLANNING_TIME,
  };
}

function gfsCycle(input: {
  cycle_key: string;
  issued_at: string;
  target: string;
  state: "PAIRED" | "PARTIAL";
  role?: "WEATHER" | "FUTURE_ET0";
}): GfsCyclePairProgressV1 {
  const weather = input.state === "PAIRED" || input.role === "WEATHER"
    ? cursor({
        binding_id: "noaa_ncep_gfs_pgrb2_kbs_nearest_72h_v1",
        origin_source_id: "gfs_" + input.cycle_key + "_pgrb2_0p25_kbs",
        event_time: input.issued_at,
        valid_from: input.target,
      })
    : null;
  const futureEt0 = input.state === "PAIRED" || input.role === "FUTURE_ET0"
    ? cursor({
        binding_id: "noaa_ncep_gfs_asce_short_reference_et0_v1",
        origin_source_id: "gfs_" + input.cycle_key + "_asce_short_reference_et0_kbs",
        event_time: input.issued_at,
        valid_from: input.target,
      })
    : null;
  return {
    cycle_key: input.cycle_key,
    cycle_issued_at: input.issued_at,
    state: input.state,
    weather,
    future_et0: futureEt0,
    paired_valid_from: input.state === "PAIRED" ? input.target : null,
  };
}

function main(): void {
  const allNotDue = planProductionEvidenceSourcesV1({
    planning_time: PLANNING_TIME,
    horizon: horizon(),
    progress: baseProgress(),
    due_state: {
      kbs_raw_hourly: notDue("authority://kbs/not-due"),
      gfs_bundle: notDue("authority://gfs/not-due"),
      kbs_soil: notDue("authority://soil/not-due"),
    },
  });
  assert.equal(allNotDue.status, "NOT_DUE");
  assert.equal(allNotDue.action_count, 0);
  assert.equal(allNotDue.blocked_capability_count, 0);
  assert.deepEqual(allNotDue.blockers, []);

  const kbsDue = planProductionEvidenceSourcesV1({
    planning_time: PLANNING_TIME,
    horizon: horizon(),
    progress: baseProgress(),
    due_state: {
      kbs_raw_hourly: due("authority://kbs/due-fixture"),
      gfs_bundle: notDue("authority://gfs/not-due"),
      kbs_soil: notDue("authority://soil/not-due"),
    },
  });
  assert.equal(kbsDue.status, "ACTIONABLE");
  assert.deepEqual(kbsDue.blockers, []);
  assert.equal(kbsDue.action_count, 1);
  assert.equal(kbsDue.decisions[0]?.status, "ACTION");
  assert.equal(
    kbsDue.decisions[0]?.status === "ACTION" ? kbsDue.decisions[0].operation.kind : null,
    "KBS_RAW_HOURLY_PUBLICATION_CYCLE",
  );
  assert.equal(
    kbsDue.decisions[0]?.status === "ACTION"
      && kbsDue.decisions[0].operation.kind === "KBS_RAW_HOURLY_PUBLICATION_CYCLE"
      ? kbsDue.decisions[0].operation.bindable_to_current_cycle_service
      : null,
    true,
  );

  const bootstrapProgress = baseProgress();
  bootstrapProgress.kbs_raw_hourly = {
    state: "ABSENT",
    rainfall: null,
    historical_et0: null,
    paired_contiguous_through: null,
    pair_skew_seconds: null,
  };
  const kbsBootstrap = planProductionEvidenceSourcesV1({
    planning_time: PLANNING_TIME,
    horizon: horizon(),
    progress: bootstrapProgress,
    due_state: {
      kbs_raw_hourly: due("authority://kbs/bootstrap-due-fixture"),
      gfs_bundle: notDue("authority://gfs/not-due"),
      kbs_soil: notDue("authority://soil/not-due"),
    },
  });
  assert.equal(kbsBootstrap.status, "ACTIONABLE");
  assert.deepEqual(kbsBootstrap.blockers, []);
  assert.equal(
    kbsBootstrap.decisions[0]?.status === "ACTION"
      && kbsBootstrap.decisions[0].operation.kind === "KBS_RAW_HOURLY_PUBLICATION_CYCLE"
      ? kbsBootstrap.decisions[0].operation.observed_pair_state
      : null,
    "ABSENT",
  );

  const skewProgress = baseProgress();
  skewProgress.kbs_raw_hourly = {
    ...skewProgress.kbs_raw_hourly,
    pair_skew_seconds: 3600,
  };
  const kbsSkew = planProductionEvidenceSourcesV1({
    planning_time: PLANNING_TIME,
    horizon: horizon(),
    progress: skewProgress,
    due_state: {
      kbs_raw_hourly: due("authority://kbs/due-fixture"),
      gfs_bundle: notDue("authority://gfs/not-due"),
      kbs_soil: notDue("authority://soil/not-due"),
    },
  });
  assert.equal(kbsSkew.status, "ACTIONABLE");
  assert.deepEqual(kbsSkew.blockers, []);
  assert.equal(
    kbsSkew.decisions[0]?.status === "ACTION"
      && kbsSkew.decisions[0].operation.kind === "KBS_RAW_HOURLY_PUBLICATION_CYCLE"
      ? kbsSkew.decisions[0].operation.pair_skew_seconds
      : null,
    3600,
  );

  const gfsAction = planProductionEvidenceSourcesV1({
    planning_time: PLANNING_TIME,
    horizon: horizon(),
    progress: baseProgress(),
    due_state: {
      kbs_raw_hourly: notDue("authority://kbs/not-due"),
      gfs_bundle: {
        ...due("authority://gfs/due-fixture"),
        target_logical_time: "2026-09-01T20:00:00.000Z",
      },
      kbs_soil: notDue("authority://soil/not-due"),
    },
  });
  assert.equal(gfsAction.status, "ACTIONABLE");
  assert.equal(gfsAction.action_count, 1);
  const gfsDecision = gfsAction.decisions[1];
  assert.equal(gfsDecision?.status, "ACTION");
  assert.equal(
    gfsDecision?.status === "ACTION" ? gfsDecision.operation.kind : null,
    "GFS_BUNDLE_ACQUIRE",
  );

  const durableProgress = baseProgress();
  durableProgress.gfs_bundle = {
    cycles: [gfsCycle({
      cycle_key: "20260901t180000z",
      issued_at: "2026-09-01T18:00:00.000Z",
      target: "2026-09-01T20:00:00.000Z",
      state: "PAIRED",
    })],
    complete_pair_count: 1,
    partial_pair_count: 0,
  };
  const gfsAlreadyDurable = planProductionEvidenceSourcesV1({
    planning_time: PLANNING_TIME,
    horizon: horizon(),
    progress: durableProgress,
    due_state: {
      kbs_raw_hourly: notDue("authority://kbs/not-due"),
      gfs_bundle: {
        ...due("authority://gfs/due-fixture"),
        target_logical_time: "2026-09-01T20:00:00.000Z",
      },
      kbs_soil: notDue("authority://soil/not-due"),
    },
  });
  assert.equal(gfsAlreadyDurable.status, "NOT_DUE");
  assert.equal(gfsAlreadyDurable.decisions[1]?.status, "NOT_DUE");
  assert.equal(
    gfsAlreadyDurable.decisions[1]?.status === "NOT_DUE"
      ? gfsAlreadyDurable.decisions[1].reason
      : null,
    "GFS_TARGET_ALREADY_DURABLE",
  );

  const partialProgress = baseProgress();
  partialProgress.gfs_bundle = {
    cycles: [gfsCycle({
      cycle_key: "20260901t180000z",
      issued_at: "2026-09-01T18:00:00.000Z",
      target: "2026-09-01T20:00:00.000Z",
      state: "PARTIAL",
      role: "WEATHER",
    })],
    complete_pair_count: 0,
    partial_pair_count: 1,
  };
  const gfsPartial = planProductionEvidenceSourcesV1({
    planning_time: PLANNING_TIME,
    horizon: horizon(),
    progress: partialProgress,
    due_state: {
      kbs_raw_hourly: notDue("authority://kbs/not-due"),
      gfs_bundle: {
        ...due("authority://gfs/due-fixture"),
        target_logical_time: "2026-09-01T20:00:00.000Z",
      },
      kbs_soil: notDue("authority://soil/not-due"),
    },
  });
  assert.equal(gfsPartial.status, "ACTIONABLE");
  assert.deepEqual(gfsPartial.blockers, []);
  assert.equal(gfsPartial.action_count, 1);
  assert.equal(gfsPartial.blocked_capability_count, 0);
  const gfsPartialDecision = gfsPartial.decisions[1];
  assert.equal(gfsPartialDecision?.status, "ACTION");
  assert.equal(
    gfsPartialDecision?.status === "ACTION" ? gfsPartialDecision.operation.kind : null,
    "GFS_PARTIAL_PAIR_REHYDRATE",
  );
  assert.equal(
    gfsPartialDecision?.status === "ACTION"
      && gfsPartialDecision.operation.kind === "GFS_PARTIAL_PAIR_REHYDRATE"
      ? gfsPartialDecision.operation.bindable_to_current_cycle_service
      : null,
    true,
  );
  assert.equal(
    gfsPartialDecision?.status === "ACTION"
      && gfsPartialDecision.operation.kind === "GFS_PARTIAL_PAIR_REHYDRATE"
      ? gfsPartialDecision.operation.partial_progress.cycle_key
      : null,
    "20260901t180000z",
  );
  assert.equal(
    gfsPartialDecision?.status === "ACTION"
      && gfsPartialDecision.operation.kind === "GFS_PARTIAL_PAIR_REHYDRATE"
      ? gfsPartialDecision.operation.partial_progress.weather?.fact_id
      : null,
    "fact_" + "1".repeat(64),
  );

  const soilAction = planProductionEvidenceSourcesV1({
    planning_time: PLANNING_TIME,
    horizon: horizon(),
    progress: baseProgress(),
    due_state: {
      kbs_raw_hourly: notDue("authority://kbs/not-due"),
      gfs_bundle: notDue("authority://gfs/not-due"),
      kbs_soil: due("authority://soil/due-fixture"),
    },
  });
  assert.equal(soilAction.status, "ACTIONABLE");
  assert.equal(soilAction.action_count, 1);
  assert.equal(
    soilAction.decisions[2]?.status === "ACTION"
      ? soilAction.decisions[2].operation.kind
      : null,
    "KBS_SOIL_CURRENT_ACQUIRE",
  );

  assert.throws(
    () => planProductionEvidenceSourcesV1({
      planning_time: "2026-09-01T18:59:59.000Z",
      horizon: horizon(),
      progress: baseProgress(),
      due_state: {
        kbs_raw_hourly: notDue("authority://kbs/not-due"),
        gfs_bundle: notDue("authority://gfs/not-due"),
        kbs_soil: notDue("authority://soil/not-due"),
      },
    }),
    /PRODUCTION_EVIDENCE_SOURCE_PLANNER_BEFORE_ACTIVATION_FENCE/,
  );

  assert.throws(
    () => planProductionEvidenceSourcesV1({
      planning_time: PLANNING_TIME,
      horizon: horizon(),
      progress: baseProgress(),
      due_state: {
        kbs_raw_hourly: {
          ...due("authority://kbs/due-fixture"),
          requested_at: "2026-09-01T18:59:59.000Z",
        },
        gfs_bundle: notDue("authority://gfs/not-due"),
        kbs_soil: notDue("authority://soil/not-due"),
      },
    }),
    /PRODUCTION_EVIDENCE_SOURCE_PLANNER_REQUEST_BEFORE_ACTIVATION_FENCE/,
  );

  const proof = {
    schema_version: "geox_mcft_cap09_production_evidence_source_planner_result_v1",
    status: "PASS",
    all_not_due_is_zero_action: true,
    kbs_due_routes_to_current_publication_cycle_service: true,
    kbs_absent_progress_routes_to_baseline_initializing_cycle: true,
    kbs_pair_skew_routes_to_idempotent_cycle_repair: true,
    gfs_action_uses_explicit_target: true,
    gfs_durable_target_is_not_reacquired: true,
    gfs_partial_pair_rehydration_gap_machine_visible: true,
    gfs_partial_plan_carries_exact_progress_snapshot: true,
    soil_action_requires_explicit_due_input: true,
    activation_fence_fail_closed: true,
    production_due_authorities_established_by_this_proof: false,
    production_host_binding_authorized: false,
    database_connection_attempted: false,
    provider_request_count: 0,
    runtime_tick_cursor_access_count: 0,
    runtime_process_start: false,
    production_owner_activation: false,
    formal_v5_arm: false,
    a0_bootstrap: false,
    o00_started: false,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(proof, null, 2) + "\n");
  console.log(JSON.stringify(proof, null, 2));
}

try {
  main();
} catch (error) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({
    schema_version: "geox_mcft_cap09_production_evidence_source_planner_result_v1",
    status: "FAIL",
    error: error instanceof Error ? error.message : String(error),
    database_connection_attempted: false,
    provider_request_count: 0,
    production_host_binding_authorized: false,
  }, null, 2) + "\n");
  throw error;
}

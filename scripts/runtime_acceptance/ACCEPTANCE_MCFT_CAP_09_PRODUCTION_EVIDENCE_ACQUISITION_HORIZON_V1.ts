import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  MCFT_CAP09_PRODUCTION_EVIDENCE_ACQUISITION_HORIZON_AUTHORITY_ID_V1,
  MCFT_CAP09_SEPARATE_PRODUCTION_RUNTIME_START_AUTHORITY_CLASS_V1,
  materializeProductionEvidenceAcquisitionHorizonV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_production_evidence_acquisition_horizon_v1.js";

const OUT = path.resolve(
  "acceptance-output/MCFT_CAP_09_PRODUCTION_EVIDENCE_ACQUISITION_HORIZON_V1_RESULT.json",
);

function main(): void {
  const horizon = materializeProductionEvidenceAcquisitionHorizonV1({
    authority_class: MCFT_CAP09_SEPARATE_PRODUCTION_RUNTIME_START_AUTHORITY_CLASS_V1,
    authority_ref: "authority://mcft-cap09/runtime-start/focused-fixture",
    activation_fence_time: "2026-09-01T12:34:00.000Z",
  });

  assert.equal(
    horizon.authority_id,
    MCFT_CAP09_PRODUCTION_EVIDENCE_ACQUISITION_HORIZON_AUTHORITY_ID_V1,
  );
  assert.equal(horizon.activation_fence_time, "2026-09-01T12:34:00.000Z");
  assert.equal(
    horizon.kbs_raw_hourly.bootstrap_mode,
    "FIRST_RETAINED_FULL_TABLE_SNAPSHOT_ESTABLISHES_PRIVATE_PUBLICATION_BASELINE_NO_CANONICAL_EMISSION",
  );
  assert.equal(horizon.kbs_raw_hourly.endpoint_shape, "COMPLETE_ACCUMULATED_TABLE");
  assert.equal(horizon.kbs_raw_hourly.baseline_retention_required, true);
  assert.equal(horizon.kbs_raw_hourly.baseline_event_index_required, true);
  assert.equal(horizon.kbs_raw_hourly.baseline_canonical_emission_count, 0);
  assert.equal(
    horizon.kbs_raw_hourly.first_canonical_emission_requires_observed_post_baseline_forward_event_delta,
    true,
  );
  assert.equal(horizon.kbs_raw_hourly.post_baseline_diff_basis, "EVENT_TIME_PLUS_ROW_IDENTITY_HASH");
  assert.equal(horizon.kbs_raw_hourly.fixed_latest_24_rows_assumption_authorized, false);
  assert.equal(
    horizon.kbs_raw_hourly.non_authoritative_daily_batch_operating_profile_may_define_promotion_set,
    false,
  );
  assert.equal(
    horizon.kbs_raw_hourly.revision_or_backfill_before_previous_latest_auto_promotion_authorized,
    false,
  );
  assert.equal(horizon.kbs_raw_hourly.explicit_poll_due_policy_established, true);
  assert.equal(horizon.kbs_raw_hourly.minimum_poll_interval_seconds, 900);

  assert.equal(
    horizon.gfs_bundle.bootstrap_mode,
    "FIRST_PROVIDER_SELECTED_CYCLE_FETCH_STARTED_AT_OR_AFTER_ACTIVATION_FENCE",
  );
  assert.equal(horizon.gfs_bundle.bounded_backfill_unit, "ONE_PROVIDER_SELECTED_CYCLE");
  assert.equal(horizon.gfs_bundle.historical_cycle_sweep_authorized, false);
  assert.equal(horizon.gfs_bundle.provider_cycle_selection_owner, "PRODUCT_GFS_PROVIDER");

  assert.equal(
    horizon.kbs_soil.bootstrap_mode,
    "FIRST_CURRENT_PROVIDER_RESPONSE_FETCH_STARTED_AT_OR_AFTER_ACTIVATION_FENCE",
  );
  assert.equal(horizon.kbs_soil.historical_event_scan_authorized, false);
  assert.equal(horizon.kbs_soil.explicit_poll_due_policy_established, true);
  assert.equal(horizon.kbs_soil.minimum_poll_interval_seconds, 300);

  assert.equal(
    horizon.restart.durable_progress_present,
    "RESUME_FROM_EVIDENCE_OWNED_DURABLE_SOURCE_PROGRESS",
  );
  assert.equal(horizon.restart.kbs_publication_baseline_must_be_durable_when_no_evidence_progress, true);
  assert.equal(horizon.restart.in_memory_only_kbs_baseline_sufficient_for_production, false);
  assert.equal(horizon.restart.bootstrap_rewind_authorized, false);
  assert.equal(horizon.restart.runtime_tick_cursor_fallback_authorized, false);
  assert.equal(horizon.restart.successful_cycle_count_fallback_authorized, false);

  assert.throws(
    () => materializeProductionEvidenceAcquisitionHorizonV1({
      authority_class: "NOT_RUNTIME_START_AUTHORITY" as never,
      authority_ref: "authority://wrong",
      activation_fence_time: "2026-09-01T12:34:00.000Z",
    }),
    /PRODUCTION_EVIDENCE_HORIZON_RUNTIME_START_AUTHORITY_CLASS_INVALID/,
  );
  assert.throws(
    () => materializeProductionEvidenceAcquisitionHorizonV1({
      authority_class: MCFT_CAP09_SEPARATE_PRODUCTION_RUNTIME_START_AUTHORITY_CLASS_V1,
      authority_ref: "",
      activation_fence_time: "2026-09-01T12:34:00.000Z",
    }),
    /PRODUCTION_EVIDENCE_HORIZON_RUNTIME_START_AUTHORITY_REF_REQUIRED/,
  );
  assert.throws(
    () => materializeProductionEvidenceAcquisitionHorizonV1({
      authority_class: MCFT_CAP09_SEPARATE_PRODUCTION_RUNTIME_START_AUTHORITY_CLASS_V1,
      authority_ref: "authority://mcft-cap09/runtime-start/focused-fixture",
      activation_fence_time: "2026-09-01T12:34:00Z",
    }),
    /PRODUCTION_EVIDENCE_HORIZON_ACTIVATION_FENCE_TIME_INVALID/,
  );

  const proof = {
    schema_version: "geox_mcft_cap09_production_evidence_acquisition_horizon_result_v1",
    status: "PASS",
    explicit_runtime_start_fence_required: true,
    wall_clock_derived_fence: false,
    deployment_environment_derived_fence: false,
    formal_epoch_derived_fence: false,
    phase5_fixture_derived_fence: false,
    fixed_historical_lookback_hours: null,
    kbs_bootstrap_first_full_table_snapshot_is_baseline_only: true,
    kbs_fixed_24_row_bootstrap_forbidden: true,
    kbs_post_baseline_forward_event_delta_required_for_first_emission: true,
    kbs_durable_publication_baseline_required_without_evidence_progress: true,
    gfs_bootstrap_bounded_by_one_provider_selected_cycle: true,
    soil_bootstrap_bounded_by_one_current_response: true,
    restart_resumes_from_evidence_owned_durable_progress: true,
    soil_explicit_due_policy_established: true,
    kbs_raw_hourly_explicit_due_policy_established: true,
    kbs_raw_hourly_operational_poll_interval_seconds: 900,
    kbs_soil_operational_poll_interval_seconds: 300,
    database_connection_attempted: false,
    provider_request_count: 0,
    evidence_cursor_mutation_count: 0,
    runtime_tick_cursor_mutation_count: 0,
    production_target_planner_bound: false,
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
    schema_version: "geox_mcft_cap09_production_evidence_acquisition_horizon_result_v1",
    status: "FAIL",
    error: error instanceof Error ? error.message : String(error),
    database_connection_attempted: false,
    provider_request_count: 0,
    runtime_process_start: false,
  }, null, 2) + "\n");
  throw error;
}

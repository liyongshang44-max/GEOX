// MCFT-CAP-09 production Evidence acquisition horizon contract.
// Pure policy materialization only. It does not read wall clock/environment,
// call providers, access databases, mutate cursors, bind the production planner,
// or start any runtime process.

export const MCFT_CAP09_PRODUCTION_EVIDENCE_ACQUISITION_HORIZON_AUTHORITY_ID_V1 =
  "GEOX-MCFT-CAP-09-PRODUCTION-EVIDENCE-ACQUISITION-HORIZON-AUTHORITY-V1" as const;

export const MCFT_CAP09_SEPARATE_PRODUCTION_RUNTIME_START_AUTHORITY_CLASS_V1 =
  "MCFT_CAP09_SEPARATE_PRODUCTION_RUNTIME_START_AUTHORITY" as const;

export type ProductionRuntimeStartFenceV1 = {
  authority_class: typeof MCFT_CAP09_SEPARATE_PRODUCTION_RUNTIME_START_AUTHORITY_CLASS_V1;
  authority_ref: string;
  activation_fence_time: string;
};

export type ProductionEvidenceAcquisitionHorizonV1 = {
  authority_id: typeof MCFT_CAP09_PRODUCTION_EVIDENCE_ACQUISITION_HORIZON_AUTHORITY_ID_V1;
  runtime_start_authority_ref: string;
  activation_fence_time: string;
  kbs_raw_hourly: {
    bootstrap_mode: "FIRST_RETAINED_FULL_TABLE_SNAPSHOT_ESTABLISHES_PRIVATE_PUBLICATION_BASELINE_NO_CANONICAL_EMISSION";
    endpoint_shape: "COMPLETE_ACCUMULATED_TABLE";
    baseline_retention_required: true;
    baseline_event_index_required: true;
    baseline_canonical_emission_count: 0;
    first_canonical_emission_requires_observed_post_baseline_forward_event_delta: true;
    post_baseline_diff_basis: "EVENT_TIME_PLUS_ROW_IDENTITY_HASH";
    fixed_latest_24_rows_assumption_authorized: false;
    non_authoritative_daily_batch_operating_profile_may_define_promotion_set: false;
    revision_or_backfill_before_previous_latest_auto_promotion_authorized: false;
  };
  gfs_bundle: {
    bootstrap_mode: "FIRST_PROVIDER_SELECTED_CYCLE_FETCH_STARTED_AT_OR_AFTER_ACTIVATION_FENCE";
    bounded_backfill_unit: "ONE_PROVIDER_SELECTED_CYCLE";
    historical_cycle_sweep_authorized: false;
    provider_cycle_selection_owner: "PRODUCT_GFS_PROVIDER";
  };
  kbs_soil: {
    bootstrap_mode: "FIRST_CURRENT_PROVIDER_RESPONSE_FETCH_STARTED_AT_OR_AFTER_ACTIVATION_FENCE";
    bounded_backfill_unit: "ONE_CURRENT_PROVIDER_RESPONSE";
    historical_event_scan_authorized: false;
    explicit_poll_due_policy_established: false;
  };
  restart: {
    durable_progress_present: "RESUME_FROM_EVIDENCE_OWNED_DURABLE_SOURCE_PROGRESS";
    kbs_publication_baseline_must_be_durable_when_no_evidence_progress: true;
    in_memory_only_kbs_baseline_sufficient_for_production: false;
    bootstrap_rewind_authorized: false;
    runtime_tick_cursor_fallback_authorized: false;
    successful_cycle_count_fallback_authorized: false;
  };
};

function canonicalIsoV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(code);
  const canonical = new Date(parsed).toISOString();
  if (canonical !== value) throw new Error(code);
  return canonical;
}

function authorityRefV1(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("PRODUCTION_EVIDENCE_HORIZON_RUNTIME_START_AUTHORITY_REF_REQUIRED");
  }
  return value.trim();
}

export function materializeProductionEvidenceAcquisitionHorizonV1(
  fence: ProductionRuntimeStartFenceV1,
): ProductionEvidenceAcquisitionHorizonV1 {
  if (
    fence.authority_class !==
    MCFT_CAP09_SEPARATE_PRODUCTION_RUNTIME_START_AUTHORITY_CLASS_V1
  ) {
    throw new Error("PRODUCTION_EVIDENCE_HORIZON_RUNTIME_START_AUTHORITY_CLASS_INVALID");
  }
  const authorityRef = authorityRefV1(fence.authority_ref);
  const activationFenceTime = canonicalIsoV1(
    fence.activation_fence_time,
    "PRODUCTION_EVIDENCE_HORIZON_ACTIVATION_FENCE_TIME_INVALID",
  );

  return {
    authority_id: MCFT_CAP09_PRODUCTION_EVIDENCE_ACQUISITION_HORIZON_AUTHORITY_ID_V1,
    runtime_start_authority_ref: authorityRef,
    activation_fence_time: activationFenceTime,
    kbs_raw_hourly: {
      bootstrap_mode:
        "FIRST_RETAINED_FULL_TABLE_SNAPSHOT_ESTABLISHES_PRIVATE_PUBLICATION_BASELINE_NO_CANONICAL_EMISSION",
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
      bootstrap_mode:
        "FIRST_PROVIDER_SELECTED_CYCLE_FETCH_STARTED_AT_OR_AFTER_ACTIVATION_FENCE",
      bounded_backfill_unit: "ONE_PROVIDER_SELECTED_CYCLE",
      historical_cycle_sweep_authorized: false,
      provider_cycle_selection_owner: "PRODUCT_GFS_PROVIDER",
    },
    kbs_soil: {
      bootstrap_mode:
        "FIRST_CURRENT_PROVIDER_RESPONSE_FETCH_STARTED_AT_OR_AFTER_ACTIVATION_FENCE",
      bounded_backfill_unit: "ONE_CURRENT_PROVIDER_RESPONSE",
      historical_event_scan_authorized: false,
      explicit_poll_due_policy_established: false,
    },
    restart: {
      durable_progress_present:
        "RESUME_FROM_EVIDENCE_OWNED_DURABLE_SOURCE_PROGRESS",
      kbs_publication_baseline_must_be_durable_when_no_evidence_progress: true,
      in_memory_only_kbs_baseline_sufficient_for_production: false,
      bootstrap_rewind_authorized: false,
      runtime_tick_cursor_fallback_authorized: false,
      successful_cycle_count_fallback_authorized: false,
    },
  };
}

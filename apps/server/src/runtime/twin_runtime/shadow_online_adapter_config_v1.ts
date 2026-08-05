// Immutable MCFT-CAP-09.S1 Shadow-online adapter configuration contract.
// This module contains no environment reads, timers, scheduler loop, database access, or writes.

import type { ShadowOnlineSlotIdV1 } from "./ports.js";

export const SHADOW_ONLINE_SLOT_IDS_V1 = [
  "O00", "O01", "O02", "O03", "O04", "O05",
  "O06", "O07", "O08", "O09", "O10", "O11",
  "O12", "O13", "O14", "O15", "O16", "O17",
  "O18", "O19", "O20", "O21", "O22", "O23",
] as const satisfies readonly ShadowOnlineSlotIdV1[];

export const SHADOW_ONLINE_ADAPTER_CONFIG_V1 = {
  schema_version: "geox_mcft_cap09_shadow_online_adapter_config_v1",
  config_id: "GEOX-MCFT-CAP-09-SHADOW-ONLINE-ADAPTER-CONFIG-V1",
  runtime_mode: "SHADOW_ONLINE",
  scope_policy: {
    exact_six_key_scope_required: true,
    scope_count: 1,
    multi_field_concurrency_allowed: false,
  },
  clock: {
    source: "SCHEDULER_PROVIDED_UTC_WALL_CLOCK",
    slot_interval: "PT1H",
    slot_interval_seconds: 3600,
    slot_ids: SHADOW_ONLINE_SLOT_IDS_V1,
    accelerated_clock_allowed: false,
    future_boundary_claim_allowed: false,
    duplicate_boundary_claim_policy: "IDEMPOTENT",
    wall_clock_drift_measured: true,
  },
  evidence_ingress: {
    source: "EXISTING_GOVERNED_DATABASE_EVIDENCE_ONLY",
    boundary_fields: ["observed_at", "ingested_at", "available_to_runtime_at"],
    freeze_at_tick_boundary: true,
    future_evidence_leakage_allowed: false,
    post_boundary_evidence_allowed: false,
    synthesize_sensor_truth_allowed: false,
    production_gateway_authority: false,
    required_metrics: ["coverage", "freshness", "maximum_gap", "exclusions"],
  },
  scheduler: {
    execution_model: "PERSISTENT_SINGLE_SCOPE_SEQUENTIAL",
    durable_cursor_required: true,
    lease_required: true,
    fencing_required: true,
    maximum_running_ticks_per_scope: 1,
    missed_slot_order: "OLDEST_ELIGIBLE_FIRST",
    same_scope_parallel_commit_allowed: false,
    implicit_retry_after_terminal_success_allowed: false,
  },
  execution_feedback: {
    mode: "READ_ONLY_EXISTING_ACTION_EVIDENCE",
    planned_action_is_execution: false,
    approved_action_is_execution: false,
    decision_write_allowed: false,
    approval_write_allowed: false,
    task_write_allowed: false,
    dispatch_write_allowed: false,
    receipt_write_allowed: false,
  },
  availability: {
    restart_from_persisted_checkpoint_required: true,
    missed_boundary_detection_required: true,
    stale_evidence_detection_required: true,
    scheduler_lag_detection_required: true,
    runtime_health_only: true,
    crop_health_claim_allowed: false,
    idempotency_across_restart_required: true,
  },
  s1_authority: {
    interface_contracts_frozen: true,
    immutable_configuration_frozen: true,
    adapter_implementation_authorized: false,
    scheduler_loop_authorized: false,
    database_read_implementation_authorized: false,
    database_write_authorized: false,
    canonical_write_authorized: false,
    public_http_writer_authorized: false,
    automatic_real_world_action_authorized: false,
    model_activation_authorized: false,
  },
} as const;

export type ShadowOnlineAdapterConfigV1 = typeof SHADOW_ONLINE_ADAPTER_CONFIG_V1;

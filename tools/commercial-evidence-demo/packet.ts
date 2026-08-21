// tools/commercial-evidence-demo/packet.ts
// Purpose: build a deterministic Commercial Evidence Demo packet by executing the existing MCFT-CAP-09 Amendment-19 canonical current-interval forcing selector.
// Boundary: controlled demo inputs only; no provider request, database access, scheduler effect, canonical write, Formal effect, recommendation, approval, dispatch, or model activation.

import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_HISTORICAL_ET0_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_RAINFALL_BINDING_ID_V1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_evidence_binding_profile_v1.js";
import { MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 } from "../../apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.js";
import {
  MCFT_CAP09_CURRENT_INTERVAL_STATE_FORCING_AUTHORITY_ID_V1,
  MCFT_CAP09_CURRENT_INTERVAL_STATE_FORCING_SELECTION_POLICY_ID_V1,
  selectExternalFormalCurrentIntervalForcingV1,
} from "../../apps/server/src/runtime/twin_runtime/external_formal_current_interval_forcing_selector_v1.js";
import type { CanonicalReplayEvidenceRecordV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";

export const COMMERCIAL_EVIDENCE_DEMO_SCHEMA_V1 = "geox_commercial_evidence_demo_v1" as const;
export const COMMERCIAL_EVIDENCE_DEMO_DECISION_TIME_V1 = "2026-09-01T12:00:00.000Z" as const;

function addHours(value: string, hours: number): string {
  return new Date(Date.parse(value) + hours * 3_600_000).toISOString();
}

function addMinutes(value: string, minutes: number): string {
  return new Date(Date.parse(value) + minutes * 60_000).toISOString();
}

function weatherPoints(base: string, h1: number): Array<Record<string, unknown>> {
  return Array.from({ length: 72 }, (_, index) => ({
    horizon: index + 1,
    valid_from: addHours(base, index),
    valid_to: addHours(base, index + 1),
    precipitation_mm: index === 0 ? h1 : 0,
  }));
}

function et0Points(base: string, h1: number): Array<Record<string, unknown>> {
  return Array.from({ length: 72 }, (_, index) => ({
    horizon: index + 1,
    valid_from: addHours(base, index),
    valid_to: addHours(base, index + 1),
    et0_mm_per_hour: index === 0 ? h1 : 0.12,
  }));
}

function assumptionRecord(input: {
  kind: "weather" | "et0";
  logicalTime: string;
  sourceId: string;
  h1: number;
}): CanonicalReplayEvidenceRecordV1 {
  const base = addHours(input.logicalTime, -1);
  const issuedAt = addMinutes(base, -30);
  const availableAt = addMinutes(base, -20);
  const recordType = input.kind === "weather" ? "future_weather_assumption_v1" : "future_et0_assumption_v1";
  const bindingId = input.kind === "weather"
    ? MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1
    : MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1;
  const snapshotKind = input.kind === "weather" ? "FUTURE_WEATHER_ASSUMPTION" : "FUTURE_ET0_ASSUMPTION";
  const payload = {
    snapshot_kind: snapshotKind,
    points: input.kind === "weather" ? weatherPoints(base, input.h1) : et0Points(base, input.h1),
  };
  const identity = { source_id: input.sourceId, binding_id: bindingId, base, issued_at: issuedAt, available_at: availableAt, payload };
  return {
    dataset_id: "mcft_cap09_amendment19_engineering_fixture",
    source_record_id: input.sourceId,
    source_record_hash: semanticHashV1(identity),
    record_type: recordType,
    binding_id: bindingId,
    origin_source_kind: "CONTROLLED_ENGINEERING_FIXTURE",
    origin_source_id: input.kind === "weather" ? "NOAA_GFS_ENGINEERING_FIXTURE" : "ASCE_ET0_FROM_GFS_ENGINEERING_FIXTURE",
    epistemic_class: "ASSUMED",
    ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
    available_to_runtime_at: availableAt,
    role_time: {
      issued_at: issuedAt,
      available_to_runtime_at: availableAt,
      retrieved_at: availableAt,
      ingested_at: availableAt,
      valid_from: base,
      valid_to: addHours(base, 72),
    },
    quality: { status: "PASS" },
    source_payload: structuredClone(payload),
    canonical_payload: payload,
    source_unit: "mm",
    canonical_unit: "mm",
    conversion_rule: { rule_id: input.kind === "weather" ? "PRECIPITATION_MM_IDENTITY_V1" : "ET0_MM_PER_HOUR_IDENTITY_V1" },
    limitations: ["CONTROLLED_COMMERCIAL_EVIDENCE_DEMO_ONLY", "NOT_FORMAL_EXTERNAL_EVIDENCE"],
  };
}

function exactRecord(input: {
  kind: "rainfall" | "et0";
  logicalTime: string;
  sourceId: string;
  value: number;
  availableAt: string;
}): CanonicalReplayEvidenceRecordV1 {
  const recordType = input.kind === "rainfall" ? "observed_rainfall_v1" : "historical_et0_estimate_v1";
  const bindingId = input.kind === "rainfall"
    ? MCFT_CAP09_EXTERNAL_FORMAL_RAINFALL_BINDING_ID_V1
    : MCFT_CAP09_EXTERNAL_FORMAL_HISTORICAL_ET0_BINDING_ID_V1;
  const epistemicClass = input.kind === "rainfall" ? "OBSERVED" : "ESTIMATED";
  const intervalStart = addHours(input.logicalTime, -1);
  const identity = {
    source_id: input.sourceId,
    binding_id: bindingId,
    interval_start: intervalStart,
    interval_end: input.logicalTime,
    value: input.value,
    available_at: input.availableAt,
  };
  return {
    dataset_id: "mcft_cap09_amendment19_engineering_fixture",
    source_record_id: input.sourceId,
    source_record_hash: semanticHashV1(identity),
    record_type: recordType,
    binding_id: bindingId,
    origin_source_kind: "CONTROLLED_ENGINEERING_FIXTURE",
    origin_source_id: "KBS_ENGINEERING_FIXTURE",
    epistemic_class: epistemicClass,
    ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
    available_to_runtime_at: input.availableAt,
    role_time: {
      interval_start: intervalStart,
      interval_end: input.logicalTime,
      ingested_at: input.availableAt,
    },
    quality: { status: "PASS" },
    source_payload: { value: input.value },
    canonical_payload: { value: input.value },
    source_unit: "mm",
    canonical_unit: "mm",
    conversion_rule: { rule_id: "ENGINEERING_IDENTITY_V1" },
    limitations: ["CONTROLLED_COMMERCIAL_EVIDENCE_DEMO_ONLY", "NOT_FORMAL_EXTERNAL_EVIDENCE"],
  };
}

function priorPair(logicalTime: string): CanonicalReplayEvidenceRecordV1[] {
  return [
    assumptionRecord({ kind: "weather", logicalTime, sourceId: "commercial_demo_gfs_weather", h1: 0.2 }),
    assumptionRecord({ kind: "et0", logicalTime, sourceId: "commercial_demo_gfs_et0", h1: 0.11 }),
  ];
}

function select(logicalTime: string, records: CanonicalReplayEvidenceRecordV1[]) {
  return selectExternalFormalCurrentIntervalForcingV1({
    scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
    logical_time: logicalTime,
    evidence_snapshot_time: logicalTime,
    candidate_records: records,
  });
}

function captureError(run: () => unknown): string {
  try {
    run();
  } catch (error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error("COMMERCIAL_EVIDENCE_DEMO_EXPECTED_FAIL_CLOSED_CASE_DID_NOT_FAIL");
}

export function buildCommercialEvidencePacketV1() {
  const logicalTime = COMMERCIAL_EVIDENCE_DEMO_DECISION_TIME_V1;
  const sameRainfallMm = 0.8;
  const sameEt0Mm = 0.13;

  const onTimeExact = [
    exactRecord({ kind: "rainfall", logicalTime, sourceId: "commercial_demo_exact_rain", value: sameRainfallMm, availableAt: logicalTime }),
    exactRecord({ kind: "et0", logicalTime, sourceId: "commercial_demo_exact_et0", value: sameEt0Mm, availableAt: logicalTime }),
  ];
  const onTimeSelection = select(logicalTime, [...priorPair(logicalTime), ...onTimeExact]);

  const lateAvailability = addMinutes(logicalTime, 20);
  const lateExact = [
    exactRecord({ kind: "rainfall", logicalTime, sourceId: "commercial_demo_late_rain", value: sameRainfallMm, availableAt: lateAvailability }),
    exactRecord({ kind: "et0", logicalTime, sourceId: "commercial_demo_late_et0", value: sameEt0Mm, availableAt: lateAvailability }),
  ];
  const lateSelection = select(logicalTime, [...priorPair(logicalTime), ...lateExact]);

  const conflictRainA = exactRecord({ kind: "rainfall", logicalTime, sourceId: "commercial_demo_conflict_rain", value: 0.8, availableAt: logicalTime });
  const conflictRainB = exactRecord({ kind: "rainfall", logicalTime, sourceId: "commercial_demo_conflict_rain", value: 1.6, availableAt: logicalTime });
  const conflictEt0 = exactRecord({ kind: "et0", logicalTime, sourceId: "commercial_demo_conflict_et0", value: sameEt0Mm, availableAt: logicalTime });
  const sourceConflictError = captureError(() => select(logicalTime, [conflictRainA, conflictRainB, conflictEt0]));
  const missingEvidenceError = captureError(() => select(logicalTime, []));

  return {
    schema_version: COMMERCIAL_EVIDENCE_DEMO_SCHEMA_V1,
    object_type: "commercial_evidence_demo_v1",
    generated_by: "buildCommercialEvidencePacketV1",
    source_truth_mode: "CONTROLLED_DETERMINISTIC_DEMO_INPUT",
    canonical_runtime_code_executed: true,
    canonical_selector_contract_id: MCFT_CAP09_CURRENT_INTERVAL_STATE_FORCING_AUTHORITY_ID_V1,
    canonical_selection_policy_id: MCFT_CAP09_CURRENT_INTERVAL_STATE_FORCING_SELECTION_POLICY_ID_V1,
    problem: {
      concise: "Prevent an agricultural decision system from treating evidence that was not actually knowable at decision time as if it had been known.",
      concise_zh: "阻止农业决策系统把决策时尚不可知的数据，当成当时已经知道的事实。",
    },
    architecture: {
      frozen_runtime_path: [
        "Reality / Evidence",
        "Evidence Window",
        "Pure Domain Model",
        "Runtime Orchestrator",
        "Canonical append-only Facts",
        "Rebuildable Projections",
        "Read-only Operator APIs",
        "Operator Runtime",
      ],
      commercial_trace_path: ["Evidence", "State", "Forecast", "Scenario", "Runtime decision boundary"],
    },
    comparison: {
      decision_time: logicalTime,
      exact_interval: { start: addHours(logicalTime, -1), end: logicalTime },
      same_exact_payload: { rainfall_mm: sameRainfallMm, historical_et0_mm: sameEt0Mm },
      event_time_only_baseline: {
        kind: "ILLUSTRATIVE_BASELINE_NOT_A_COMPETITOR_IMPLEMENTATION",
        rule: "event_time <= decision_time",
        would_treat_late_exact_payload_as_historical_fact: true,
      },
      geox_rule: "Evidence must satisfy source identity, exact interval, quality and real availability/ingress chronology at the decision snapshot.",
    },
    cases: [
      {
        case_id: "healthy_exact_provider_pair",
        label: "Exact provider evidence available at boundary",
        input: {
          event_time: logicalTime,
          available_to_runtime_at: logicalTime,
          ingested_at: logicalTime,
          evidence_snapshot_time: logicalTime,
          rainfall_mm: sameRainfallMm,
          historical_et0_mm: sameEt0Mm,
        },
        outcome: {
          action: "CONTINUE",
          runtime_health: onTimeSelection.runtime_health,
          forcing_mode: onTimeSelection.mode,
          precipitation_epistemic_class: onTimeSelection.precipitation_epistemic_class,
          et0_epistemic_class: onTimeSelection.et0_epistemic_class,
          provider_wait_required: onTimeSelection.provider_wait_required,
          selection_hash: onTimeSelection.selection_hash,
        },
      },
      {
        case_id: "provider_late",
        label: "Same exact payload, but provider publishes after decision",
        input: {
          event_time: logicalTime,
          available_to_runtime_at: lateAvailability,
          ingested_at: lateAvailability,
          evidence_snapshot_time: logicalTime,
          rainfall_mm: sameRainfallMm,
          historical_et0_mm: sameEt0Mm,
          prior_causal_assumption_pair_available: true,
        },
        outcome: {
          action: "DEGRADE_AND_CONTINUE",
          runtime_health: lateSelection.runtime_health,
          forcing_mode: lateSelection.mode,
          precipitation_epistemic_class: lateSelection.precipitation_epistemic_class,
          et0_epistemic_class: lateSelection.et0_epistemic_class,
          exact_provider_pair_available: lateSelection.exact_provider_pair_available,
          provider_wait_required: lateSelection.provider_wait_required,
          completed_tick_retroactive_rewrite_authorized: lateSelection.completed_tick_retroactive_rewrite_authorized,
          limitations: lateSelection.limitations,
          selection_hash: lateSelection.selection_hash,
        },
      },
      {
        case_id: "source_conflict",
        label: "Same source identity carries conflicting payload hashes",
        input: {
          source_record_id: "commercial_demo_conflict_rain",
          conflicting_values_mm: [0.8, 1.6],
          evidence_snapshot_time: logicalTime,
        },
        outcome: {
          action: "FAIL_CLOSED",
          error_code: sourceConflictError,
          state_write_authorized: false,
          scenario_authorized: false,
        },
      },
      {
        case_id: "missing_evidence",
        label: "No exact provider pair and no prior causal assumption pair",
        input: {
          evidence_snapshot_time: logicalTime,
          candidate_record_count: 0,
        },
        outcome: {
          action: "FAIL_CLOSED",
          error_code: missingEvidenceError,
          state_write_authorized: false,
          scenario_authorized: false,
        },
      },
    ],
    behavior_matrix: [
      { condition: "Exact evidence valid and available by T", behavior: "CONTINUE", claim: "HEALTHY / OBSERVED+ESTIMATED" },
      { condition: "Provider late, causal prior exists", behavior: "DEGRADE + CONTINUE", claim: "ASSUMED forcing; no relabel; no wait" },
      { condition: "State valid but Forecast prerequisite missing", behavior: "BLOCK FORECAST + CONTINUE STATE", claim: "0 forecast points; no Scenario" },
      { condition: "No causal current-interval forcing", behavior: "FAIL CLOSED", claim: "No invented State forcing" },
      { condition: "Source identity conflict", behavior: "FAIL CLOSED", claim: "No winner guessed" },
      { condition: "Late exact evidence later arrives", behavior: "APPEND FORWARD", claim: "No retroactive tick rewrite" },
    ],
    persisted_trace: {
      trace_api: "/api/v1/twin-kernel/traces/:decision_cycle_id",
      expected_chain: [
        "field_state_snapshot_v1",
        "forecast_run_v1",
        "scenario_set_v1",
        "calibration_replay_v1",
        "forecast_error_v1",
        "field_learning_candidate_v1",
        "decision_cycle_v1",
      ],
      read_only: true,
      decision_cycle_id_supplied_at_demo_time: true,
    },
    side_effects: {
      provider_request_count: 0,
      database_read_count: 0,
      database_write_count: 0,
      scheduler_write_count: 0,
      canonical_runtime_write_count: 0,
      recommendation_write_count: 0,
      approval_write_count: 0,
      action_write_count: 0,
      dispatch_write_count: 0,
      model_activation_write_count: 0,
    },
    hard_nonclaims: [
      "COMMERCIAL_DEMO_IS_NOT_PRODUCTION_RUNTIME_AUTHORITY",
      "CONTROLLED_DEMO_INPUT_IS_NOT_FORMAL_EXTERNAL_EVIDENCE",
      "NO_MCFT_CAP09_COMPLETION_CLAIM",
      "NO_FORMAL_O00_O23_CLAIM",
      "NO_AUTONOMOUS_RECOMMENDATION_OR_DISPATCH",
      "NO_RETROACTIVE_TICK_REWRITE",
    ],
  };
}

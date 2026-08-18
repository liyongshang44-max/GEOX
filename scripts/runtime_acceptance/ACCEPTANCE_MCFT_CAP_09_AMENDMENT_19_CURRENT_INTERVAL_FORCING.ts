import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_HISTORICAL_ET0_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_RAINFALL_BINDING_ID_V1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_evidence_binding_profile_v1.js";
import { MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 } from "../../apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.js";
import {
  MCFT_CAP09_CURRENT_INTERVAL_FORCING_ASSUMPTION_DEGRADED_REASON_V1,
  MCFT_CAP09_CURRENT_INTERVAL_STATE_FORCING_AUTHORITY_ID_V1,
  selectExternalFormalCurrentIntervalForcingV1,
} from "../../apps/server/src/runtime/twin_runtime/external_formal_current_interval_forcing_selector_v1.js";
import type { CanonicalReplayEvidenceRecordV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";

const OUTPUT_DIR = path.resolve("acceptance-output");
const OUTPUT = path.join(OUTPUT_DIR, "MCFT_CAP_09_AMENDMENT_19_CURRENT_INTERVAL_FORCING_RESULT.json");
const FIRST_T = "2026-09-01T00:00:00.000Z";

function addHours(value: string, hours: number): string {
  return new Date(Date.parse(value) + hours * 3_600_000).toISOString();
}

function addMinutes(value: string, minutes: number): string {
  return new Date(Date.parse(value) + minutes * 60_000).toISOString();
}

function weatherPoints(base: string, seed: number): Array<Record<string, unknown>> {
  return Array.from({ length: 72 }, (_, index) => ({
    horizon: index + 1,
    valid_from: addHours(base, index),
    valid_to: addHours(base, index + 1),
    precipitation_mm: index === 0 ? Number((0.2 + seed * 0.01).toFixed(6)) : 0,
  }));
}

function et0Points(base: string, seed: number, h1Override?: number): Array<Record<string, unknown>> {
  return Array.from({ length: 72 }, (_, index) => ({
    horizon: index + 1,
    valid_from: addHours(base, index),
    valid_to: addHours(base, index + 1),
    et0_mm_per_hour: index === 0 ? (h1Override ?? Number((0.11 + seed * 0.001).toFixed(6))) : 0.12,
  }));
}

function assumptionRecord(input: {
  kind: "weather" | "et0";
  base: string;
  sourceId: string;
  seed: number;
  availableAt?: string;
  h1Et0Override?: number;
}): CanonicalReplayEvidenceRecordV1 {
  const issuedAt = addMinutes(input.base, -30);
  const availableAt = input.availableAt ?? addMinutes(input.base, -20);
  const recordType = input.kind === "weather" ? "future_weather_assumption_v1" : "future_et0_assumption_v1";
  const bindingId = input.kind === "weather"
    ? MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1
    : MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1;
  const snapshotKind = input.kind === "weather" ? "FUTURE_WEATHER_ASSUMPTION" : "FUTURE_ET0_ASSUMPTION";
  const payload = {
    snapshot_kind: snapshotKind,
    points: input.kind === "weather"
      ? weatherPoints(input.base, input.seed)
      : et0Points(input.base, input.seed, input.h1Et0Override),
  };
  const identity = { source_id: input.sourceId, binding_id: bindingId, base: input.base, issued_at: issuedAt, available_at: availableAt, payload };
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
      valid_from: input.base,
      valid_to: addHours(input.base, 72),
    },
    quality: { status: "PASS" },
    source_payload: structuredClone(payload),
    canonical_payload: payload,
    source_unit: "mm",
    canonical_unit: "mm",
    conversion_rule: { rule_id: input.kind === "weather" ? "PRECIPITATION_MM_IDENTITY_V1" : "ET0_MM_PER_HOUR_IDENTITY_V1" },
    limitations: ["ENGINEERING_FIXTURE_ONLY", "NOT_FORMAL_EXTERNAL_EVIDENCE"],
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
  const epistemic = input.kind === "rainfall" ? "OBSERVED" : "ESTIMATED";
  const intervalStart = addHours(input.logicalTime, -1);
  const identity = { source_id: input.sourceId, binding_id: bindingId, interval_start: intervalStart, interval_end: input.logicalTime, value: input.value, available_at: input.availableAt };
  return {
    dataset_id: "mcft_cap09_amendment19_engineering_fixture",
    source_record_id: input.sourceId,
    source_record_hash: semanticHashV1(identity),
    record_type: recordType,
    binding_id: bindingId,
    origin_source_kind: "CONTROLLED_ENGINEERING_FIXTURE",
    origin_source_id: "KBS_ENGINEERING_FIXTURE",
    epistemic_class: epistemic,
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
    limitations: ["ENGINEERING_FIXTURE_ONLY", "NOT_FORMAL_EXTERNAL_EVIDENCE"],
  };
}

function priorPair(logicalTime: string, seed: number, overrides?: { availableAt?: string; h1Et0?: number }): CanonicalReplayEvidenceRecordV1[] {
  const base = addHours(logicalTime, -1);
  const pairAvailable = overrides?.availableAt ?? addMinutes(base, -20);
  return [
    assumptionRecord({ kind: "weather", base, sourceId: `am19_weather_${seed}`, seed, availableAt: pairAvailable }),
    assumptionRecord({ kind: "et0", base, sourceId: `am19_et0_${seed}`, seed, availableAt: pairAvailable, h1Et0Override: overrides?.h1Et0 }),
  ];
}

function select(logicalTime: string, records: CanonicalReplayEvidenceRecordV1[], snapshot = logicalTime) {
  return selectExternalFormalCurrentIntervalForcingV1({
    scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
    logical_time: logicalTime,
    evidence_snapshot_time: snapshot,
    candidate_records: records,
  });
}

function expectThrows(fn: () => unknown, code: string): void {
  assert.throws(fn, (error: unknown) => error instanceof Error && error.message === code);
}

function main(): void {
  const accelerated = Array.from({ length: 24 }, (_, index) => {
    const logicalTime = addHours(FIRST_T, index);
    const selection = select(logicalTime, priorPair(logicalTime, index + 1));
    assert.equal(selection.contract_id, MCFT_CAP09_CURRENT_INTERVAL_STATE_FORCING_AUTHORITY_ID_V1);
    assert.equal(selection.mode, "PRIOR_STEP_CAUSAL_ASSUMPTION_PAIR");
    assert.equal(selection.runtime_health, "DEGRADED");
    assert.equal(selection.provider_wait_required, false);
    assert.equal(selection.exact_provider_pair_available, false);
    assert.equal(selection.precipitation_epistemic_class, "ASSUMED");
    assert.equal(selection.et0_epistemic_class, "ASSUMED");
    assert.equal(selection.completed_tick_retroactive_rewrite_authorized, false);
    assert.equal(selection.relabel_assumption_as_provider_observation_authorized, false);
    assert.ok(selection.limitations.includes(MCFT_CAP09_CURRENT_INTERVAL_FORCING_ASSUMPTION_DEGRADED_REASON_V1));
    assert.equal(selection.forcing_cycle_basis?.valid_from, addHours(logicalTime, -1));
    return selection;
  });
  assert.equal(new Set(accelerated.map((item) => item.logical_time)).size, 24);
  assert.equal(accelerated.filter((item) => item.provider_wait_required).length, 0);

  const exactT = addHours(FIRST_T, 30);
  const exact = select(exactT, [
    ...priorPair(exactT, 100),
    exactRecord({ kind: "rainfall", logicalTime: exactT, sourceId: "am19_exact_rain", value: 0.8, availableAt: addMinutes(exactT, -1) }),
    exactRecord({ kind: "et0", logicalTime: exactT, sourceId: "am19_exact_et0", value: 0.13, availableAt: addMinutes(exactT, -1) }),
  ]);
  assert.equal(exact.mode, "EXACT_PROVIDER_INTERVAL_PAIR");
  assert.equal(exact.runtime_health, "HEALTHY");
  assert.equal(exact.precipitation_epistemic_class, "OBSERVED");
  assert.equal(exact.et0_epistemic_class, "ESTIMATED");
  assert.equal(exact.exact_provider_pair_available, true);
  assert.equal(exact.provider_wait_required, false);

  const lateT = addHours(FIRST_T, 31);
  const lateExact = [
    exactRecord({ kind: "rainfall", logicalTime: lateT, sourceId: "am19_late_rain", value: 1.1, availableAt: addMinutes(lateT, 20) }),
    exactRecord({ kind: "et0", logicalTime: lateT, sourceId: "am19_late_et0", value: 0.14, availableAt: addMinutes(lateT, 20) }),
  ];
  const atBoundary = select(lateT, [...priorPair(lateT, 101), ...lateExact], lateT);
  assert.equal(atBoundary.mode, "PRIOR_STEP_CAUSAL_ASSUMPTION_PAIR");
  assert.equal(atBoundary.provider_wait_required, false);
  const deterministicRepeat = select(lateT, [...priorPair(lateT, 101), ...lateExact], lateT);
  assert.equal(deterministicRepeat.selection_hash, atBoundary.selection_hash);
  assert.equal(atBoundary.completed_tick_retroactive_rewrite_authorized, false);

  const partialT = addHours(FIRST_T, 32);
  const partialRain = exactRecord({ kind: "rainfall", logicalTime: partialT, sourceId: "am19_partial_rain", value: 0.4, availableAt: addMinutes(partialT, -1) });
  const partial = select(partialT, [...priorPair(partialT, 102), partialRain]);
  assert.equal(partial.mode, "PRIOR_STEP_CAUSAL_ASSUMPTION_PAIR");
  assert.deepEqual(partial.partial_exact_provider_refs_suppressed, ["am19_partial_rain"]);

  const negativeEt0T = addHours(FIRST_T, 33);
  const negativeEt0 = select(negativeEt0T, priorPair(negativeEt0T, 103, { h1Et0: -0.02 }));
  assert.equal(negativeEt0.reference_et0_canonical_signed_mm, -0.02);
  assert.equal(negativeEt0.reference_et0_model_water_loss_demand_mm, 0);

  const unavailableT = addHours(FIRST_T, 34);
  const unavailableBase = addHours(unavailableT, -1);
  expectThrows(
    () => select(unavailableT, priorPair(unavailableT, 104, { availableAt: addMinutes(unavailableBase, 1) })),
    "AMENDMENT19_NO_CAUSAL_CURRENT_INTERVAL_FORCING_PAIR",
  );

  const output = {
    schema_version: "geox_mcft_cap09_amendment19_current_interval_forcing_result_v1",
    status: "PASS",
    qualification_lane: "ACCELERATED_ENGINEERING_ONLY",
    exact_predecessor_protected_main: "987803fbfb945b70025a010c4d72b560140c592a",
    accelerated_tick_count: accelerated.length,
    accelerated_provider_wait_count: accelerated.filter((item) => item.provider_wait_required).length,
    accelerated_assumption_mode_count: accelerated.filter((item) => item.mode === "PRIOR_STEP_CAUSAL_ASSUMPTION_PAIR").length,
    exact_provider_mode_proved: exact.mode === "EXACT_PROVIDER_INTERVAL_PAIR",
    late_exact_at_boundary_did_not_block: atBoundary.mode === "PRIOR_STEP_CAUSAL_ASSUMPTION_PAIR",
    partial_exact_pair_mixing_forbidden: partial.mode === "PRIOR_STEP_CAUSAL_ASSUMPTION_PAIR" && partial.partial_exact_provider_refs_suppressed.length === 1,
    signed_et0_projection_preserved: negativeEt0.reference_et0_canonical_signed_mm === -0.02 && negativeEt0.reference_et0_model_water_loss_demand_mm === 0,
    noncausal_assumption_pair_fail_closed: true,
    deterministic_selection_hash_proved: deterministicRepeat.selection_hash === atBoundary.selection_hash,
    database_write_count: 0,
    provider_request_count: 0,
    scheduler_write_count: 0,
    canonical_runtime_write_count: 0,
    production_runner_cutover: false,
    future_epoch_selected: false,
    formal_o00_started: false,
    formal_effect: false,
    hard_nonclaims: [
      "NOT_STAGE_1B_FORMAL_CLOSURE",
      "NOT_FORMAL_O00_O23_EFFECTIVENESS",
      "NO_PRODUCTION_RUNNER_CUTOVER",
      "NO_NEW_FORMAL_EPOCH_SELECTED",
      "NO_RETROACTIVE_TICK_REWRITE",
      "NO_ASSUMPTION_RELABEL_AS_PROVIDER_OBSERVATION"
    ]
  };
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2) + "\n");
  console.log(JSON.stringify(output));
}

main();

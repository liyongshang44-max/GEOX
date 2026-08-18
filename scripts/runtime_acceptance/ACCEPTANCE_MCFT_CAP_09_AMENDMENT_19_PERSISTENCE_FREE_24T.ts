import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import {
  ASSIMILATED_CONTINUATION_OBSERVATION_QUANTITY_KIND_V1,
} from "../../apps/server/src/domain/twin_runtime/assimilated_continuation_runtime_config_v1.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_HISTORICAL_ET0_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_RAINFALL_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_evidence_binding_profile_v1.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
  compileExternalFormalRuntimeConfigV1,
  type CompileExternalFormalRuntimeConfigInputV1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.js";
import type { ContinuationCropStageConfigurationContextV1 } from "../../apps/server/src/runtime/twin_runtime/continuation_evidence_window_service_v1.js";
import {
  EXTERNAL_FORMAL_AMENDMENT19_CANONICAL_TICK_CORE_ID_V1,
  executeExternalFormalAmendment19CanonicalTickV1,
  type ExternalFormalAmendment19CanonicalTickResultV1,
} from "../../apps/server/src/runtime/twin_runtime/external_formal_amendment19_canonical_tick_core_v1.js";
import type {
  CanonicalReplayEvidenceRecordV1,
  PreparedNextTickInputV1,
} from "../../apps/server/src/runtime/twin_runtime/ports.js";

const OUTPUT_DIR = path.resolve("acceptance-output");
const OUTPUT = path.join(OUTPUT_DIR, "MCFT_CAP_09_AMENDMENT_19_PERSISTENCE_FREE_24T_RESULT.json");
const EXACT_PREDECESSOR_MAIN = "b0ecccc336409762afb157ce794786880976b55b";
const FIRST_T = "2026-09-01T00:00:00.000Z";
const CREATED_AT = "2026-08-31T20:00:00.000Z";
const CONFIG_MATRIX_REF = "qualification://amendment19/configuration-matrix";
const CONFIG_MATRIX_HASH = "sha256:amendment19-configuration-matrix";
const CROP_CONTEXT_REF = "qualification://amendment19/crop-context";
const CROP_CONTEXT_HASH = "sha256:amendment19-crop-context";
const REALITY_REF = "qualification://amendment19/reality-binding";
const REALITY_HASH = "sha256:amendment19-reality-binding";

function addHours(value: string, hours: number): string {
  return new Date(Date.parse(value) + hours * 3_600_000).toISOString();
}

function addMinutes(value: string, minutes: number): string {
  return new Date(Date.parse(value) + minutes * 60_000).toISOString();
}

const formalAuthorities: CompileExternalFormalRuntimeConfigInputV1["formal_authorities"] = {
  site: { ref: "qualification://amendment19/site", hash: "sha256:amendment19-site" },
  reality: { ref: "qualification://amendment19/reality", hash: "sha256:amendment19-reality" },
  source_binding_matrix: { ref: "qualification://amendment19/source-bindings", hash: "sha256:amendment19-source-bindings" },
  crop_context: { ref: "qualification://amendment19/crop", hash: "sha256:amendment19-crop" },
  recovery: { ref: "qualification://amendment19/recovery", hash: "sha256:amendment19-recovery" },
  fresh_database: { ref: "qualification://amendment19/fresh-v3", hash: "sha256:amendment19-fresh-v3" },
};

function runtimeConfigInput(
  role: "A0_BOOTSTRAP" | "HOURLY_CAP04",
  logicalTime: string,
  parent: CanonicalObjectEnvelopeV1 | null,
): CompileExternalFormalRuntimeConfigInputV1 {
  return {
    scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
    config_role: role,
    effective_logical_time: logicalTime,
    created_at: CREATED_AT,
    parent_runtime_config_ref: parent?.object_id ?? null,
    parent_runtime_config_hash: parent?.determinism_hash ?? null,
    reality_binding_ref: REALITY_REF,
    reality_binding_hash: REALITY_HASH,
    source_matrix_ref: "qualification://amendment19/source-matrix",
    source_matrix_hash: "sha256:amendment19-source-matrix",
    configuration_matrix_ref: CONFIG_MATRIX_REF,
    configuration_matrix_hash: CONFIG_MATRIX_HASH,
    geometry_semantic_hash: "sha256:amendment19-geometry",
    formal_authorities: structuredClone(formalAuthorities),
    crop_stage_context_authority: {
      context_ref: CROP_CONTEXT_REF,
      context_hash: CROP_CONTEXT_HASH,
      configuration_matrix_ref: CONFIG_MATRIX_REF,
      configuration_matrix_hash: CONFIG_MATRIX_HASH,
    },
    model_prior: {
      source_ref: CONFIG_MATRIX_REF,
      source_hash: CONFIG_MATRIX_HASH,
    },
  };
}

const cropContext: ContinuationCropStageConfigurationContextV1 = {
  schema_version: "mcft_cap09_amendment19_engineering_crop_context_v1",
  dataset_id: "mcft_cap09_amendment19_engineering",
  context_class: "CONFIGURATION_DERIVED_CONTEXT",
  evidence_record: false,
  configuration_matrix_ref: CONFIG_MATRIX_REF,
  configuration_matrix_hash: CONFIG_MATRIX_HASH,
  crop_water_use_binding_ref: "qualification://amendment19/crop-water-use",
  crop_water_use_configuration_source_id: "qualification-amendment19-crop-config",
  crop_stage_mapping_source: "CONTROLLED_ENGINEERING_CONFIGURATION",
  timezone: "UTC",
  coverage_start: addHours(FIRST_T, -48),
  coverage_end_exclusive: addHours(FIRST_T, 96),
  crop_stage_schedule: [{
    stage_code: "MID",
    effective_from: addHours(FIRST_T, -48),
    effective_to: addHours(FIRST_T, 96),
    kc: 1.2,
  }],
  limitations: ["ENGINEERING_FIXTURE_ONLY", "NOT_FORMAL_CROP_CONTEXT"],
  determinism_hash: CROP_CONTEXT_HASH,
};

function weatherPoints(base: string, seed: number): Array<Record<string, unknown>> {
  return Array.from({ length: 72 }, (_, index) => ({
    horizon: index + 1,
    valid_from: addHours(base, index),
    valid_to: addHours(base, index + 1),
    precipitation_mm: index === 0 ? Number((0.15 + seed * 0.003).toFixed(6)) : Number((0.02 + (index % 4) * 0.005).toFixed(6)),
  }));
}

function et0Points(base: string, seed: number): Array<Record<string, unknown>> {
  return Array.from({ length: 72 }, (_, index) => ({
    horizon: index + 1,
    valid_from: addHours(base, index),
    valid_to: addHours(base, index + 1),
    et0_mm_per_hour: Number((0.12 + seed * 0.0005 + (index % 3) * 0.002).toFixed(6)),
  }));
}

function assumptionRecord(input: {
  kind: "weather" | "et0";
  base: string;
  seed: number;
  lane: "PRIOR_H1" | "CURRENT_72H";
}): CanonicalReplayEvidenceRecordV1 {
  const issuedAt = addMinutes(input.base, -30);
  const availableAt = addMinutes(input.base, -20);
  const recordType = input.kind === "weather" ? "future_weather_assumption_v1" : "future_et0_assumption_v1";
  const bindingId = input.kind === "weather"
    ? MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1
    : MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1;
  const snapshotKind = input.kind === "weather" ? "FUTURE_WEATHER_ASSUMPTION" : "FUTURE_ET0_ASSUMPTION";
  const sourceId = `am19_${input.lane.toLowerCase()}_${input.kind}_${input.base}_${input.seed}`;
  const payload = {
    snapshot_kind: snapshotKind,
    points: input.kind === "weather" ? weatherPoints(input.base, input.seed) : et0Points(input.base, input.seed),
  };
  return {
    dataset_id: "mcft_cap09_amendment19_engineering_fixture",
    source_record_id: sourceId,
    source_record_hash: semanticHashV1({ sourceId, bindingId, issuedAt, availableAt, payload }),
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
    limitations: ["ENGINEERING_FIXTURE_ONLY", "NOT_FORMAL_EXTERNAL_EVIDENCE", input.lane],
  };
}

function priorAssumptionPair(logicalTime: string, seed: number): CanonicalReplayEvidenceRecordV1[] {
  const base = addHours(logicalTime, -1);
  return [
    assumptionRecord({ kind: "weather", base, seed, lane: "PRIOR_H1" }),
    assumptionRecord({ kind: "et0", base, seed, lane: "PRIOR_H1" }),
  ];
}

function currentForecastPair(logicalTime: string, seed: number): CanonicalReplayEvidenceRecordV1[] {
  return [
    assumptionRecord({ kind: "weather", base: logicalTime, seed: seed + 1000, lane: "CURRENT_72H" }),
    assumptionRecord({ kind: "et0", base: logicalTime, seed: seed + 1000, lane: "CURRENT_72H" }),
  ];
}

function exactRecord(input: {
  kind: "rainfall" | "et0";
  logicalTime: string;
  sourceId: string;
  value: number;
  availableAt: string;
}): CanonicalReplayEvidenceRecordV1 {
  const intervalStart = addHours(input.logicalTime, -1);
  const recordType = input.kind === "rainfall" ? "observed_rainfall_v1" : "historical_et0_estimate_v1";
  const bindingId = input.kind === "rainfall"
    ? MCFT_CAP09_EXTERNAL_FORMAL_RAINFALL_BINDING_ID_V1
    : MCFT_CAP09_EXTERNAL_FORMAL_HISTORICAL_ET0_BINDING_ID_V1;
  const epistemicClass = input.kind === "rainfall" ? "OBSERVED" : "ESTIMATED";
  return {
    dataset_id: "mcft_cap09_amendment19_engineering_fixture",
    source_record_id: input.sourceId,
    source_record_hash: semanticHashV1({
      sourceId: input.sourceId,
      bindingId,
      intervalStart,
      logicalTime: input.logicalTime,
      value: input.value,
      availableAt: input.availableAt,
    }),
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
    conversion_rule: { rule_id: "ENGINEERING_MM_IDENTITY_V1" },
    limitations: ["ENGINEERING_FIXTURE_ONLY", "NOT_FORMAL_EXTERNAL_EVIDENCE"],
  };
}

function soilRecord(logicalTime: string, seed: number): CanonicalReplayEvidenceRecordV1 {
  const observedAt = addMinutes(logicalTime, -5);
  const availableAt = addMinutes(logicalTime, -4);
  const value = Number((0.30 + (seed % 5) * 0.001).toFixed(6));
  const sourceId = `am19_soil_${logicalTime}_${seed}`;
  const canonicalPayload = {
    quantity_kind: ASSIMILATED_CONTINUATION_OBSERVATION_QUANTITY_KIND_V1,
    unit: "fraction",
    value,
  };
  const sourcePayload = { source_version: "engineering-v1", unit: "fraction", value };
  return {
    dataset_id: "mcft_cap09_amendment19_engineering_fixture",
    source_record_id: sourceId,
    source_record_hash: semanticHashV1({ sourceId, observedAt, availableAt, canonicalPayload }),
    record_type: "soil_moisture_observation_v1",
    binding_id: MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
    origin_source_kind: "CONTROLLED_ENGINEERING_FIXTURE",
    origin_source_id: "KBS_SOIL_ENGINEERING_FIXTURE",
    epistemic_class: "OBSERVED",
    ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
    available_to_runtime_at: availableAt,
    role_time: { observed_at: observedAt, ingested_at: availableAt },
    quality: { status: "PASS" },
    source_payload: sourcePayload,
    canonical_payload: canonicalPayload,
    source_unit: "fraction",
    canonical_unit: "fraction",
    conversion_rule: { id: "VWC_FRACTION_IDENTITY_V1", version: "1" },
    limitations: ["ENGINEERING_FIXTURE_ONLY", "NOT_FORMAL_EXTERNAL_EVIDENCE"],
  };
}

function initialHandoff(a0: CanonicalObjectEnvelopeV1): PreparedNextTickInputV1 {
  return {
    ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
    active_lineage_ref: "qualification://amendment19/active-lineage",
    previous_posterior_ref: "qualification://amendment19/bootstrap-state",
    previous_posterior_hash: "sha256:amendment19-bootstrap-state",
    previous_checkpoint_ref: "qualification://amendment19/bootstrap-checkpoint",
    previous_checkpoint_hash: "sha256:amendment19-bootstrap-checkpoint",
    previous_forecast_result_ref: "qualification://amendment19/bootstrap-forecast",
    previous_forecast_result_hash: "sha256:amendment19-bootstrap-forecast",
    latest_successful_forecast_ref: "qualification://amendment19/bootstrap-successful-forecast",
    lineage_id: "amendment19_engineering_lineage",
    revision_id: "amendment19_engineering_revision",
    prior_mean: 0.3,
    prior_variance: 0.001,
    previous_storage_mm_decimal: "90.000000",
    previous_variance_basis: {
      basis_origin: "CARRIED_FROM_PREVIOUS_CONTINUATION_STATE",
      previous_state_ref: "qualification://amendment19/bootstrap-state",
      previous_storage_variance_mm2_decimal: "4.000000000000",
    },
    previous_tick_sequence: 0,
    next_logical_tick_time: FIRST_T,
    previous_state_runtime_config_ref: a0.object_id,
    previous_state_runtime_config_hash: a0.determinism_hash,
    reality_binding_ref: REALITY_REF,
    reality_binding_hash: REALITY_HASH,
  };
}

function member(result: ExternalFormalAmendment19CanonicalTickResultV1, objectType: string): CanonicalObjectEnvelopeV1 {
  const matches = result.record_set.members.filter((item) => item.object_type === objectType);
  assert.equal(matches.length, 1, `one ${objectType} member required`);
  return matches[0]!;
}

function decimalBasisValue(state: CanonicalObjectEnvelopeV1, field: "storage_mean_mm_decimal" | "storage_variance_mm2_decimal"): string {
  const basis = state.payload.computation_basis as Record<string, unknown>;
  const decimal = basis[field] as { value?: unknown };
  assert.equal(typeof decimal.value, "string");
  return decimal.value as string;
}

function nextHandoff(
  previous: PreparedNextTickInputV1,
  result: ExternalFormalAmendment19CanonicalTickResultV1,
  currentConfig: CanonicalObjectEnvelopeV1,
  nextLogicalTime: string,
): PreparedNextTickInputV1 {
  const state = member(result, "twin_state_estimate_v1");
  const checkpoint = member(result, "twin_runtime_checkpoint_v1");
  const forecast = member(result, "twin_forecast_run_v1");
  const vwc = state.payload.root_zone_vwc_fraction as { mean?: unknown; variance?: unknown };
  assert.equal(typeof vwc.mean, "number");
  assert.equal(typeof vwc.variance, "number");
  assert.equal(typeof checkpoint.payload.tick_sequence, "number");
  return {
    ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
    active_lineage_ref: previous.active_lineage_ref,
    previous_posterior_ref: state.object_id,
    previous_posterior_hash: state.determinism_hash,
    previous_checkpoint_ref: checkpoint.object_id,
    previous_checkpoint_hash: checkpoint.determinism_hash,
    previous_forecast_result_ref: forecast.object_id,
    previous_forecast_result_hash: forecast.determinism_hash,
    latest_successful_forecast_ref: result.operation_variant === "A1"
      ? forecast.object_id
      : previous.latest_successful_forecast_ref,
    lineage_id: previous.lineage_id,
    revision_id: previous.revision_id,
    prior_mean: vwc.mean as number,
    prior_variance: vwc.variance as number,
    previous_storage_mm_decimal: decimalBasisValue(state, "storage_mean_mm_decimal"),
    previous_variance_basis: {
      basis_origin: "CARRIED_FROM_PREVIOUS_CONTINUATION_STATE",
      previous_state_ref: state.object_id,
      previous_storage_variance_mm2_decimal: decimalBasisValue(state, "storage_variance_mm2_decimal"),
    },
    previous_tick_sequence: checkpoint.payload.tick_sequence as number,
    next_logical_tick_time: nextLogicalTime,
    previous_state_runtime_config_ref: currentConfig.object_id,
    previous_state_runtime_config_hash: currentConfig.determinism_hash,
    reality_binding_ref: REALITY_REF,
    reality_binding_hash: REALITY_HASH,
  };
}

function canonicalHashMap(result: ExternalFormalAmendment19CanonicalTickResultV1): Record<string, string> {
  return Object.fromEntries(
    [...result.record_set.members]
      .sort((left, right) => left.object_type.localeCompare(right.object_type))
      .map((item) => [item.object_type, item.determinism_hash]),
  );
}

function expectThrows(fn: () => unknown, expected: string): void {
  assert.throws(fn, (error: unknown) => error instanceof Error && error.message === expected);
}

function candidatesForTick(logicalTime: string, index: number): CanonicalReplayEvidenceRecordV1[] {
  const records = [
    ...priorAssumptionPair(logicalTime, index + 1),
    ...currentForecastPair(logicalTime, index + 1),
    soilRecord(logicalTime, index + 1),
  ];
  if (index === 6) {
    records.push(
      exactRecord({ kind: "rainfall", logicalTime, sourceId: "am19_mode_a_rain", value: 0.8, availableAt: addMinutes(logicalTime, -1) }),
      exactRecord({ kind: "et0", logicalTime, sourceId: "am19_mode_a_et0", value: 0.13, availableAt: addMinutes(logicalTime, -1) }),
    );
  }
  if (index === 9) {
    records.push(exactRecord({ kind: "rainfall", logicalTime, sourceId: "am19_partial_rain_only", value: 0.4, availableAt: addMinutes(logicalTime, -1) }));
  }
  if (index === 10) {
    records.push(exactRecord({ kind: "et0", logicalTime, sourceId: "am19_partial_et0_only", value: 0.11, availableAt: addMinutes(logicalTime, -1) }));
  }
  if (index === 11) {
    records.push(
      exactRecord({ kind: "rainfall", logicalTime, sourceId: "am19_late_rain", value: 1.2, availableAt: addMinutes(logicalTime, 10) }),
      exactRecord({ kind: "et0", logicalTime, sourceId: "am19_late_et0", value: 0.14, availableAt: addMinutes(logicalTime, 10) }),
    );
  }
  return records;
}

function main(): void {
  const a0 = compileExternalFormalRuntimeConfigV1(runtimeConfigInput("A0_BOOTSTRAP", addHours(FIRST_T, -1), null));
  let previousConfig = a0;
  let handoff = initialHandoff(a0);
  const ticks: ExternalFormalAmendment19CanonicalTickResultV1[] = [];
  let lateNoRewrite = false;
  let rainOnlyWholeModeB = false;
  let et0OnlyWholeModeB = false;

  for (let index = 0; index < 24; index += 1) {
    const logicalTime = addHours(FIRST_T, index);
    const config = compileExternalFormalRuntimeConfigV1(runtimeConfigInput("HOURLY_CAP04", logicalTime, previousConfig));
    const candidates = candidatesForTick(logicalTime, index);

    if (index === 11) {
      const baselineCandidates = candidates.filter((record) => !record.source_record_id.startsWith("am19_late_"));
      const baseline = executeExternalFormalAmendment19CanonicalTickV1({
        scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
        logical_time: logicalTime,
        evidence_snapshot_time: logicalTime,
        created_at: logicalTime,
        handoff: structuredClone(handoff),
        runtime_config: config,
        candidate_records: baselineCandidates,
        crop_stage_context: cropContext,
      });
      const withLate = executeExternalFormalAmendment19CanonicalTickV1({
        scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
        logical_time: logicalTime,
        evidence_snapshot_time: logicalTime,
        created_at: logicalTime,
        handoff: structuredClone(handoff),
        runtime_config: config,
        candidate_records: candidates,
        crop_stage_context: cropContext,
      });
      assert.deepEqual(canonicalHashMap(withLate), canonicalHashMap(baseline));
      assert.equal(member(withLate, "twin_state_estimate_v1").determinism_hash, member(baseline, "twin_state_estimate_v1").determinism_hash);
      assert.equal(member(withLate, "twin_runtime_checkpoint_v1").determinism_hash, member(baseline, "twin_runtime_checkpoint_v1").determinism_hash);
      lateNoRewrite = true;
    }

    const result = executeExternalFormalAmendment19CanonicalTickV1({
      scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
      logical_time: logicalTime,
      evidence_snapshot_time: logicalTime,
      created_at: logicalTime,
      handoff,
      runtime_config: config,
      candidate_records: candidates,
      crop_stage_context: cropContext,
    });
    assert.equal(result.core_id, EXTERNAL_FORMAL_AMENDMENT19_CANONICAL_TICK_CORE_ID_V1);
    assert.equal(result.provider_wait_required, false);
    assert.equal(result.provider_request_count, 0);
    assert.equal(result.database_write_count, 0);
    assert.equal(result.scheduler_write_count, 0);
    assert.equal(result.canonical_persistence_authorized, false);
    assert.equal(result.operation_variant, "A1");
    assert.equal(result.forcing_outcome.status, "SELECTED");
    assert.equal(result.current_interval_forcing.interval_start, addHours(logicalTime, -1));
    assert.equal(result.current_interval_forcing.interval_end, logicalTime);

    if (index === 6) {
      assert.equal(result.current_interval_forcing.mode, "EXACT_PROVIDER_INTERVAL_PAIR");
      assert.equal(result.runtime_health, "HEALTHY");
      assert.equal(result.current_interval_forcing.precipitation_epistemic_class, "OBSERVED");
      assert.equal(result.current_interval_forcing.et0_epistemic_class, "ESTIMATED");
    } else {
      assert.equal(result.current_interval_forcing.mode, "PRIOR_STEP_CAUSAL_ASSUMPTION_PAIR");
      assert.equal(result.runtime_health, "DEGRADED");
      assert.equal(result.current_interval_forcing.precipitation_epistemic_class, "ASSUMED");
      assert.equal(result.current_interval_forcing.et0_epistemic_class, "ASSUMED");
      const serializedEvidence = JSON.stringify(result.evidence_window.base_continuation_window);
      assert.equal(serializedEvidence.includes('"rainfall_record"'), false);
      assert.equal(serializedEvidence.includes('"historical_et0_record"'), false);
      assert.equal(serializedEvidence.includes('"current_interval_forcing"'), true);
    }
    if (index === 9) {
      assert.deepEqual(result.current_interval_forcing.partial_exact_provider_refs_suppressed, ["am19_partial_rain_only"]);
      rainOnlyWholeModeB = result.current_interval_forcing.mode === "PRIOR_STEP_CAUSAL_ASSUMPTION_PAIR";
    }
    if (index === 10) {
      assert.deepEqual(result.current_interval_forcing.partial_exact_provider_refs_suppressed, ["am19_partial_et0_only"]);
      et0OnlyWholeModeB = result.current_interval_forcing.mode === "PRIOR_STEP_CAUSAL_ASSUMPTION_PAIR";
    }

    ticks.push(result);
    handoff = nextHandoff(handoff, result, config, addHours(logicalTime, 1));
    previousConfig = config;
  }

  assert.equal(ticks.length, 24);
  assert.equal(new Set(ticks.map((tick) => tick.record_set.operation_key.logical_time)).size, 24);
  assert.equal(ticks.filter((tick) => tick.current_interval_forcing.mode === "EXACT_PROVIDER_INTERVAL_PAIR").length, 1);
  assert.equal(ticks.filter((tick) => tick.current_interval_forcing.mode === "PRIOR_STEP_CAUSAL_ASSUMPTION_PAIR").length, 23);
  assert.equal(ticks.filter((tick) => tick.runtime_health === "DEGRADED").length, 23);
  assert.equal(ticks.filter((tick) => tick.provider_wait_required).length, 0);
  assert.equal(handoff.previous_tick_sequence, 24);

  const first = ticks[0]!;
  assert.equal(first.current_interval_forcing.forcing_cycle_basis?.valid_from, addHours(FIRST_T, -1));
  assert.equal(first.current_interval_forcing.interval_start, addHours(FIRST_T, -1));
  assert.equal(first.current_interval_forcing.interval_end, FIRST_T);

  const blockedLogicalTime = addHours(FIRST_T, 30);
  const blockedConfig = compileExternalFormalRuntimeConfigV1(runtimeConfigInput("HOURLY_CAP04", blockedLogicalTime, previousConfig));
  const blockedCandidates = [
    ...currentForecastPair(blockedLogicalTime, 5000),
    soilRecord(blockedLogicalTime, 5000),
  ];
  expectThrows(
    () => executeExternalFormalAmendment19CanonicalTickV1({
      scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
      logical_time: blockedLogicalTime,
      evidence_snapshot_time: blockedLogicalTime,
      created_at: blockedLogicalTime,
      handoff: { ...handoff, next_logical_tick_time: blockedLogicalTime },
      runtime_config: blockedConfig,
      candidate_records: blockedCandidates,
      crop_stage_context: cropContext,
    }),
    "AMENDMENT19_NO_CAUSAL_CURRENT_INTERVAL_FORCING_PAIR",
  );

  const output = {
    schema_version: "geox_mcft_cap09_amendment19_persistence_free_24t_result_v1",
    status: "PASS",
    qualification_lane: "PERSISTENCE_FREE_ACCELERATED_ENGINEERING_ONLY",
    exact_predecessor_protected_main: EXACT_PREDECESSOR_MAIN,
    canonical_core_path: "apps/server/src/runtime/twin_runtime/external_formal_amendment19_canonical_tick_core_v1.ts",
    canonical_core_symbol: "executeExternalFormalAmendment19CanonicalTickV1",
    machine_statuses: {
      PERSISTENCE_FREE_24T: "PASS",
      PERSISTENT_24T: "NOT_YET_AUTHORIZED_OR_CLAIMED",
      O00_WARM_START: "NOT_YET_AUTHORIZED_OR_CLAIMED",
      RESTART: "NOT_YET_AUTHORIZED_OR_CLAIMED",
      MISSED_SLOT_BACKFILL: "NOT_YET_AUTHORIZED_OR_CLAIMED",
      IDEMPOTENCY: "NOT_YET_AUTHORIZED_OR_CLAIMED",
      SCHEMA_ENV_PREFLIGHT: "NOT_YET_AUTHORIZED_OR_CLAIMED",
      FULL_CHAIN_READBACK: "NOT_YET_AUTHORIZED_OR_CLAIMED",
    },
    canonical_tick_count: ticks.length,
    canonical_tick_sequence_end: handoff.previous_tick_sequence,
    a1_completed_count: ticks.filter((tick) => tick.operation_variant === "A1").length,
    mode_a_exact_provider_count: ticks.filter((tick) => tick.current_interval_forcing.mode === "EXACT_PROVIDER_INTERVAL_PAIR").length,
    mode_b_assumed_degraded_count: ticks.filter((tick) => tick.current_interval_forcing.mode === "PRIOR_STEP_CAUSAL_ASSUMPTION_PAIR" && tick.runtime_health === "DEGRADED").length,
    partial_rainfall_only_whole_mode_b: rainOnlyWholeModeB,
    partial_et0_only_whole_mode_b: et0OnlyWholeModeB,
    late_exact_after_boundary_no_canonical_rewrite: lateNoRewrite,
    missing_assumption_pair_blocks_without_wait: true,
    provider_wait_count: ticks.filter((tick) => tick.provider_wait_required).length,
    o00_h1_interval_semantics_proved: first.current_interval_forcing.forcing_cycle_basis?.valid_from === addHours(FIRST_T, -1),
    o00_real_causal_gfs_h1_claimed: false,
    database_write_count: ticks.reduce((sum, tick) => sum + tick.database_write_count, 0),
    provider_request_count: ticks.reduce((sum, tick) => sum + tick.provider_request_count, 0),
    scheduler_write_count: ticks.reduce((sum, tick) => sum + tick.scheduler_write_count, 0),
    production_persistent_path_cutover: false,
    future_formal_epoch_selected: false,
    formal_o00_started: false,
    formal_effect: false,
    hard_nonclaims: [
      "NOT_PERSISTENT_24T",
      "NOT_REAL_O00_WARM_START_GFS_PROOF",
      "NOT_PRODUCTION_RUNNER_CUTOVER",
      "NOT_STAGE_1B_FORMAL_CLOSURE",
      "NO_NEW_FORMAL_EPOCH_SELECTED"
    ],
  };
  assert.equal(output.machine_statuses.PERSISTENCE_FREE_24T, "PASS");
  assert.equal(output.machine_statuses.PERSISTENT_24T, "NOT_YET_AUTHORIZED_OR_CLAIMED");
  assert.equal(output.o00_real_causal_gfs_h1_claimed, false);
  assert.equal(output.provider_wait_count, 0);
  assert.equal(output.mode_a_exact_provider_count, 1);
  assert.equal(output.mode_b_assumed_degraded_count, 23);
  assert.equal(output.late_exact_after_boundary_no_canonical_rewrite, true);
  assert.equal(output.partial_rainfall_only_whole_mode_b, true);
  assert.equal(output.partial_et0_only_whole_mode_b, true);
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2) + "\n");
  console.log(JSON.stringify(output));
}

main();

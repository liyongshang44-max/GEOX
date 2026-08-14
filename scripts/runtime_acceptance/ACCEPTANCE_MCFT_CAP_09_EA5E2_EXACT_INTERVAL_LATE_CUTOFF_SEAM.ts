import assert from "node:assert/strict";

import { buildContinuationEvidenceWindowV1, type ContinuationCropStageConfigurationContextV1 } from "../../apps/server/src/runtime/twin_runtime/continuation_evidence_window_service_v1.js";
import type { CanonicalReplayEvidenceRecordV1, TwinScopeKeyV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";

const SCOPE: TwinScopeKeyV1 = {
  tenant_id: "tenant_external_research_v1",
  project_id: "project_kbs_lter_v1",
  group_id: "group_kbs_lter_v1",
  field_id: "field_kbs_lter_main_v1",
  season_id: "season_2026_corn_v1",
  zone_id: "zone_kbs_lter_main_v1",
};
const T = "2026-08-11T17:00:00.000Z";
const START = "2026-08-11T16:00:00.000Z";
const CUTOFF = "2026-08-12T00:12:00.000Z";

const crop: ContinuationCropStageConfigurationContextV1 = {
  schema_version: "test_crop_context_v1",
  dataset_id: "test",
  context_class: "CONFIGURATION_DERIVED_CONTEXT",
  evidence_record: false,
  configuration_matrix_ref: "matrix",
  configuration_matrix_hash: "matrix-hash",
  crop_water_use_binding_ref: "crop-binding",
  crop_water_use_configuration_source_id: "crop-source",
  crop_stage_mapping_source: "test",
  timezone: "UTC",
  coverage_start: "2026-08-01T00:00:00.000Z",
  coverage_end_exclusive: "2026-09-01T00:00:00.000Z",
  crop_stage_schedule: [{ stage_code: "MID", effective_from: "2026-08-01T00:00:00.000Z", effective_to: "2026-09-01T00:00:00.000Z", kc: 1.0 }],
  limitations: [],
  determinism_hash: "crop-hash",
};

function record(input: {
  id: string;
  record_type: string;
  binding_id: string;
  epistemic_class: string;
  available: string;
  role_time: Record<string, unknown>;
}): CanonicalReplayEvidenceRecordV1 {
  return {
    ...SCOPE,
    dataset_id: "ea5e2-test",
    source_record_id: input.id,
    source_record_hash: `hash-${input.id}`,
    record_type: input.record_type,
    binding_id: input.binding_id,
    origin_source_kind: "EXTERNAL_PUBLIC_RESEARCH_SCOPE",
    origin_source_id: "test-source",
    epistemic_class: input.epistemic_class,
    available_to_runtime_at: input.available,
    role_time: { ...input.role_time, ingested_at: input.available },
    quality: { status: "PASS" },
    source_payload: {},
    canonical_payload: { value: 1 },
    source_unit: "mm",
    canonical_unit: "mm",
    conversion_rule: { rule: "IDENTITY" },
    limitations: [],
  };
}

const rain = record({
  id: "rain",
  record_type: "observed_rainfall_v1",
  binding_id: "kbs_lter_raw_hourly_rain_mm_v1",
  epistemic_class: "OBSERVED",
  available: "2026-08-11T23:45:00.000Z",
  role_time: { interval_start: START, interval_end: T },
});
const et0 = record({
  id: "et0",
  record_type: "historical_et0_estimate_v1",
  binding_id: "kbs_lter_asce_short_reference_et_hourly_v1",
  epistemic_class: "ESTIMATED",
  available: "2026-08-12T00:11:00.000Z",
  role_time: { interval_start: START, interval_end: T, calculation_method: "ASCE", method_version: "v1" },
});
const lateFutureWeather = record({
  id: "future-weather-late",
  record_type: "future_weather_assumption_v1",
  binding_id: "noaa_ncep_gfs_pgrb2_kbs_nearest_72h_v1",
  epistemic_class: "ASSUMED",
  available: "2026-08-11T17:01:00.000Z",
  role_time: { issued_at: "2026-08-11T16:00:00.000Z" },
});

assert.throws(
  () => buildContinuationEvidenceWindowV1({
    scope: SCOPE,
    logical_time: T,
    candidate_records: [rain, et0],
    crop_stage_context_ref: "crop",
    crop_stage_context_hash: "crop-hash",
    crop_stage_context: crop,
  }),
  /MISSING_EXACT_HOURLY_RAINFALL_INTERVAL/,
  "GENERIC_DEFAULT_MUST_REMAIN_LOGICAL_TIME_CUTOFF",
);

const external = buildContinuationEvidenceWindowV1({
  scope: SCOPE,
  logical_time: T,
  candidate_records: [rain, et0, lateFutureWeather],
  crop_stage_context_ref: "crop",
  crop_stage_context_hash: "crop-hash",
  crop_stage_context: crop,
  evidence_snapshot_time: CUTOFF,
});
assert.equal(external.rainfall_record.source_record_id, "rain");
assert.equal(external.historical_et0_record.source_record_id, "et0");
assert(external.excluded_records.some((item) => item.source_record_id === "future-weather-late" && item.exclusion_reason === "NOT_AVAILABLE_AT_LOGICAL_TICK"),
  "FUTURE_FORCING_MUST_REMAIN_PRE_T_CAUSAL");

const rainAfterCutoff = structuredClone(rain);
rainAfterCutoff.source_record_id = "rain-after-cutoff";
rainAfterCutoff.source_record_hash = "hash-rain-after-cutoff";
rainAfterCutoff.available_to_runtime_at = "2026-08-12T00:13:00.000Z";
rainAfterCutoff.role_time.ingested_at = "2026-08-12T00:13:00.000Z";
assert.throws(
  () => buildContinuationEvidenceWindowV1({
    scope: SCOPE,
    logical_time: T,
    candidate_records: [rainAfterCutoff, et0],
    crop_stage_context_ref: "crop",
    crop_stage_context_hash: "crop-hash",
    crop_stage_context: crop,
    evidence_snapshot_time: CUTOFF,
  }),
  /MISSING_EXACT_HOURLY_RAINFALL_INTERVAL/,
  "EXACT_INTERVAL_AFTER_T_PLUS_7H12_MUST_FAIL_CLOSED",
);

console.log(JSON.stringify({
  status: "PASS",
  generic_default_cutoff: T,
  external_exact_interval_cutoff: CUTOFF,
  delayed_rain_accepted: true,
  delayed_historical_et0_accepted: true,
  post_t_future_forcing_rejected: true,
  post_cutoff_exact_interval_rejected: true,
}, null, 2));

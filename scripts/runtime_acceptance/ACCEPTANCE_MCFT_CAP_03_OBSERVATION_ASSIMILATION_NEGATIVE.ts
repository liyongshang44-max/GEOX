// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_OBSERVATION_ASSIMILATION_NEGATIVE.ts
// Purpose: prove CAP-03 selector and pure assimilation fail closed for malformed/conflicting Evidence and exclude ordinary unusable candidates without fabricating an applied update.
// Boundary: pure in-memory negative acceptance only; no database, persistence, Runtime tick, route, scheduler, or production claim.

import { composeAssimilatedContinuationPosteriorV1 } from "../../apps/server/src/domain/soil_water/assimilated_continuation_posterior_v1.js";
import { selectAssimilatedContinuationObservationV1 } from "../../apps/server/src/runtime/twin_runtime/assimilated_continuation_observation_selector_v1.js";
import { buildMcftCap03ObservationAssimilationFixtureV1 } from "./mcft_cap_03_observation_assimilation_fixture_v1.js";

let pass = 0;
let fail = 0;

function check(value: unknown, message: string): void {
  if (value) {
    pass += 1;
    console.log(`PASS ${message}`);
  } else {
    fail += 1;
    console.error(`FAIL ${message}`);
  }
}

function throwsCode(fn: () => unknown, code: string): boolean {
  try {
    fn();
    return false;
  } catch (error) {
    return error instanceof Error && error.message.includes(code);
  }
}

async function mainV1(): Promise<void> {
  const fixture = await buildMcftCap03ObservationAssimilationFixtureV1();
  const logicalTime = fixture.cap02.evidenceFixture.logical_time;
  const selectorInput = {
    scope: fixture.cap02.scope,
    logical_time: logicalTime,
    saturation_fraction: 0.5,
  };

  const conflictA = fixture.makeObservation({ source_record_id: "conflict_a", value: 0.23, ingested_at: "2026-06-01T01:56:00.000Z" });
  const conflictB = fixture.makeObservation({ source_record_id: "conflict_b", value: 0.24, ingested_at: "2026-06-01T01:57:00.000Z" });
  check(throwsCode(() => selectAssimilatedContinuationObservationV1({ ...selectorInput, observation_records: [conflictA, conflictB] }), "CONFLICTING_DUPLICATE_EVIDENCE"), "same semantic identity with different semantic content fails the entire selector");

  const malformed = fixture.makeObservation({ source_record_id: "malformed" });
  malformed.source_record_hash = "";
  check(throwsCode(() => selectAssimilatedContinuationObservationV1({ ...selectorInput, observation_records: [malformed] }), "MALFORMED_CANONICAL_OBSERVATION:SOURCE_RECORD_HASH_REQUIRED"), "missing canonical provenance hash fails closed instead of becoming a candidate exclusion");

  const nonFinite = fixture.makeObservation({ source_record_id: "nonfinite" });
  nonFinite.canonical_payload.value = Number.NaN;
  check(throwsCode(() => selectAssimilatedContinuationObservationV1({ ...selectorInput, observation_records: [nonFinite] }), "CANONICAL_VALUE_NON_FINITE"), "non-finite canonical observation value fails closed");

  const multiFailure = fixture.makeObservation({
    source_record_id: "multi_failure",
    field_id: "other_field",
    observed_at: "2026-06-01T02:01:00.000Z",
    available_to_runtime_at: "2026-06-01T02:02:00.000Z",
    ingested_at: "2026-06-01T02:02:00.000Z",
    binding_id: "unauthorized_binding",
    canonical_unit: "percent",
    quantity_kind: "OTHER",
    value: 0.9,
    quality_status: "FAIL",
  });
  const multiFailureResult = selectAssimilatedContinuationObservationV1({ ...selectorInput, observation_records: [multiFailure] });
  check(multiFailureResult.candidates[0]?.candidate_assessment === "REJECTED_SCOPE", "candidate primary assessment follows frozen scope-first priority");
  check(multiFailureResult.candidates[0]?.reason_codes.includes("REJECTED_TIME_FUTURE") === true, "secondary failure reasons remain traceable without changing the primary assessment");

  const stale = fixture.makeObservation({
    source_record_id: "stale",
    observed_at: "2026-06-01T01:44:59.000Z",
    ingested_at: "2026-06-01T01:45:00.000Z",
  });
  const exactBoundary = fixture.makeObservation({
    source_record_id: "exact_15m",
    observed_at: "2026-06-01T01:45:00.000Z",
    ingested_at: "2026-06-01T01:45:01.000Z",
  });
  const timeResult = selectAssimilatedContinuationObservationV1({ ...selectorInput, observation_records: [stale, exactBoundary] });
  check(timeResult.selected_observation_ref === "exact_15m", "observation exactly 15 minutes before T remains eligible");
  check(timeResult.candidates.find((candidate) => candidate.source_record_id === "stale")?.candidate_assessment === "REJECTED_TIME_STALE", "observation older than 15 minutes is excluded as stale");

  const failQuality = fixture.makeObservation({ source_record_id: "quality_fail", quality_status: "FAIL" });
  const physical = fixture.makeObservation({ source_record_id: "physical_fail", value: 0.51, observed_at: "2026-06-01T01:54:00.000Z" });
  const ordinaryExclusion = selectAssimilatedContinuationObservationV1({ ...selectorInput, observation_records: [failQuality, physical] });
  check(ordinaryExclusion.selected_observation === null, "FAIL-quality and physical-bound violations cannot become the selected observation");
  check(ordinaryExclusion.candidates.find((candidate) => candidate.source_record_id === "quality_fail")?.candidate_assessment === "REJECTED_QUALITY_FAIL", "FAIL quality remains a candidate exclusion and never enters observation variance");
  check(ordinaryExclusion.candidates.find((candidate) => candidate.source_record_id === "physical_fail")?.candidate_assessment === "REJECTED_PHYSICAL_BOUNDS", "physical-bound violation remains an explicit candidate exclusion");

  check(throwsCode(() => composeAssimilatedContinuationPosteriorV1({
    prior_mean: 0.2,
    prior_variance: 0.01,
    selected_observation: null,
    saturation_fraction: 0.5,
    root_zone_depth_mm: 300,
    sensor_measurement_stddev_fraction: 0.02,
    point_to_zone_representativeness_stddev_fraction: 0.06,
    quality_weights: { PASS: 1, LIMITED: 0.5, FAIL: 0.1 } as never,
  }), "ASSIMILATION_FAIL_QUALITY_WEIGHT_MUST_BE_ZERO"), "Runtime Config cannot permit nonzero FAIL quality weight");

  check(throwsCode(() => composeAssimilatedContinuationPosteriorV1({
    prior_mean: 0.6,
    prior_variance: 0.01,
    selected_observation: null,
    saturation_fraction: 0.5,
    root_zone_depth_mm: 300,
    sensor_measurement_stddev_fraction: 0.02,
    point_to_zone_representativeness_stddev_fraction: 0.06,
    quality_weights: { PASS: 1, LIMITED: 0.5, FAIL: 0 },
  }), "ASSIMILATION_PRIOR_MEAN_OUT_OF_PHYSICAL_BOUNDS"), "propagated prior outside governed physical bounds fails closed");

  console.log(`MCFT-CAP-03 observation-assimilation negative: ${pass} PASS, ${fail} FAIL`);
  if (fail) process.exitCode = 1;
}

void mainV1().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

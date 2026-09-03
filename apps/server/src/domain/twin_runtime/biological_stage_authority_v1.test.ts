import test from "node:test";
import assert from "node:assert/strict";
import {
  accumulateCornBase50GduBoundsV1,
  computeCornBase50DailyGduFromFahrenheitV1,
  mapBiologicalAuthorityToWaterUseStageV1,
  resolveBiologicalStageAuthorityV1,
} from "./biological_stage_authority_v1.js";

const scope = {
  tenant_id: "tenant_kbs",
  project_id: "project_mcft_cap09",
  group_id: "group_s6",
  field_id: "field_kbs_mcse_t4r1",
  season_id: "season_2026_corn",
  zone_id: "zone_kbs_mcse_t4r1_crop_formal_v1",
};

function baseInput() {
  return {
    authority_id: "bio_stage_test",
    authority_version: "v1",
    scope,
    crop_code: "corn",
    cultivar_or_hybrid_id: "43-96P",
    as_of_logical_time: "2026-09-03T00:00:00.000Z",
    valid_from: "2026-09-03T00:00:00.000Z",
    valid_until: "2026-09-04T00:00:00.000Z",
    epistemic_class: "THERMAL_MODEL_DERIVED" as const,
    biological_stage_system: "CORN_REPRODUCTIVE_THERMAL_LANDMARK_V1",
    candidate_biological_stages: ["R6_OR_LATER_MODEL_ESTIMATE"],
    observed_biological_stage_claimed: false,
    evidence: [{
      ref: "temperature_digest",
      hash: "sha256:temperature",
      occurred_at: "2026-09-02T23:59:59.000Z",
      available_at: "2026-09-03T00:00:00.000Z",
    }],
    method_ref: "CORN_BASE50_DAILY_EXTREMA_CAP86_FLOOR50_V1",
    method_hash: "sha256:method",
    uncertainty_contract_ref: "T4R1_GDD_BOUNDS_V1",
    uncertainty_contract_hash: "sha256:uncertainty",
    limitation_codes: ["NOT_FIELD_OBSERVED_PHENOLOGY"],
  };
}

test("derived singleton stage resolves without claiming observation", () => {
  const authority = resolveBiologicalStageAuthorityV1(baseInput());
  assert.equal(authority.resolved_biological_stage, "R6_OR_LATER_MODEL_ESTIMATE");
  assert.equal(authority.observed_biological_stage_claimed, false);
  assert.match(authority.determinism_hash, /^sha256:/);
});

test("derived authority cannot claim observed biological truth", () => {
  assert.throws(
    () => resolveBiologicalStageAuthorityV1({ ...baseInput(), observed_biological_stage_claimed: true }),
    /BIO_STAGE_DERIVED_CANNOT_CLAIM_OBSERVED/,
  );
});

test("future evidence is rejected", () => {
  const input = baseInput();
  input.evidence = [{
    ...input.evidence[0]!,
    available_at: "2026-09-03T00:00:01.000Z",
  }];
  assert.throws(() => resolveBiologicalStageAuthorityV1(input), /BIO_STAGE_FUTURE_EVIDENCE_FORBIDDEN/);
});

test("non-singleton derived stage remains unresolved", () => {
  const authority = resolveBiologicalStageAuthorityV1({
    ...baseInput(),
    candidate_biological_stages: ["PRE_R6_MODEL_ESTIMATE", "R6_OR_LATER_MODEL_ESTIMATE"],
  });
  assert.equal(authority.resolved_biological_stage, null);
});

test("direct observation may explicitly claim observed stage", () => {
  const authority = resolveBiologicalStageAuthorityV1({
    ...baseInput(),
    epistemic_class: "DIRECT_OBSERVED_PHENOLOGY",
    candidate_biological_stages: ["R5"],
    observed_biological_stage_claimed: true,
  });
  assert.equal(authority.resolved_biological_stage, "R5");
  assert.equal(authority.observed_biological_stage_claimed, true);
});

test("corn Base-50 daily GDU applies 86F cap and 50F floor", () => {
  assert.equal(computeCornBase50DailyGduFromFahrenheitV1(90, 40), 18);
  assert.equal(computeCornBase50DailyGduFromFahrenheitV1(70, 50), 10);
  assert.equal(computeCornBase50DailyGduFromFahrenheitV1(45, 30), 0);
});

test("bounded accumulation preserves planting-time and missing-day uncertainty", () => {
  const result = accumulateCornBase50GduBoundsV1([
    { local_date: "2026-05-27", coverage: "PLANTING_DAY_UNCERTAIN", max_temp_f: 85, min_temp_f: 54 },
    { local_date: "2026-05-28", coverage: "MISSING_OR_INVALID", max_temp_f: null, min_temp_f: null },
    { local_date: "2026-05-29", coverage: "COMPLETE", max_temp_f: 81, min_temp_f: 46 },
  ]);
  assert.equal(result.lower_gdu, 15.5);
  assert.equal(result.upper_gdu, 71);
  assert.equal(result.complete_day_count, 1);
  assert.equal(result.planting_uncertain_day_count, 1);
  assert.equal(result.missing_or_invalid_day_count, 1);
});

test("biological R6 mapping can resolve LATE without changing observed claim", () => {
  const authority = resolveBiologicalStageAuthorityV1(baseInput());
  const mapped = mapBiologicalAuthorityToWaterUseStageV1(authority, {
    R6_OR_LATER_MODEL_ESTIMATE: ["LATE"],
  });
  assert.deepEqual(mapped.candidate_water_use_stages, ["LATE"]);
  assert.equal(mapped.resolved_water_use_stage, "LATE");
  assert.equal(authority.observed_biological_stage_claimed, false);
});

test("pre-R6 mapping preserves MID/LATE ambiguity", () => {
  const authority = resolveBiologicalStageAuthorityV1({
    ...baseInput(),
    candidate_biological_stages: ["PRE_R6_MODEL_ESTIMATE"],
  });
  const mapped = mapBiologicalAuthorityToWaterUseStageV1(authority, {
    PRE_R6_MODEL_ESTIMATE: ["MID", "LATE"],
  });
  assert.deepEqual(mapped.candidate_water_use_stages, ["LATE", "MID"]);
  assert.equal(mapped.resolved_water_use_stage, null);
});

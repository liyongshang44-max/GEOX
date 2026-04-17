import test from "node:test";
import assert from "node:assert/strict";

import { inferDerivedSensingStateViaDeviceSkills } from "@geox/device-skills";
import { inferFertilityFromObservationAggregateV1 } from "./fertility_inference_v1.js";

type ComparableResult = Pick<ReturnType<typeof inferFertilityFromObservationAggregateV1>,
  "fertility_level" | "recommendation_bias" | "salinity_risk" | "confidence" | "explanation_codes">;

const SKILL_CODE = "SENSING_SKILL_FERTILITY_INFERENCE_V1";
const WAIT_RULE_CODE = "RULE_EC_TEMP_AVAILABILITY_WAIT";
const FERTILIZE_RULE_CODE = "RULE_EC_TEMP_AVAILABLE_FERTILIZE";

function runBoth(input: { soil_moisture_pct?: number | null; ec_ds_m?: number | null; canopy_temp_c?: number | null; }): {
  route: ComparableResult;
  skill: ComparableResult;
} {
  const route = inferFertilityFromObservationAggregateV1(input);
  const derived = inferDerivedSensingStateViaDeviceSkills({
    device_observation_v1: [
      {
        soil_moisture_pct: input.soil_moisture_pct,
        ec_ds_m: input.ec_ds_m,
        canopy_temp_c: input.canopy_temp_c,
      },
    ],
    hinted_skill_id: "fertility_inference_v1",
  });

  assert.ok(derived, "fertility_inference_v1 should return derived sensing state");

  return {
    route,
    skill: derived!.derived_sensing_state_v1,
  };
}

test("fertility inference: route and skill outputs are identical for dry input", () => {
  const { route, skill } = runBoth({ soil_moisture_pct: 18, ec_ds_m: 1.4, canopy_temp_c: 28 });
  assert.deepEqual(skill, route);
  assert.equal(route.recommendation_bias, "irrigate_first");
  assert.equal(route.salinity_risk, "low");
  assert.equal(route.confidence, 0.95);
  assert.ok(route.explanation_codes.includes(SKILL_CODE));
  assert.ok(route.explanation_codes.includes("RULE_MOISTURE_LOW_IRRIGATE_FIRST"));
});

test("fertility inference: route and skill outputs are identical for high salinity input", () => {
  const { route, skill } = runBoth({ soil_moisture_pct: 28, ec_ds_m: 3.2, canopy_temp_c: 24 });
  assert.deepEqual(skill, route);
  assert.equal(route.recommendation_bias, "inspect");
  assert.equal(route.salinity_risk, "high");
  assert.equal(route.confidence, 0.95);
  assert.ok(route.explanation_codes.includes(SKILL_CODE));
  assert.ok(route.explanation_codes.includes("RULE_SALINITY_HIGH_INSPECT"));
});

test("fertility inference: route and skill outputs are identical at normal wait/fertilize boundary", () => {
  const fertilizeBoundary = runBoth({ soil_moisture_pct: 30, ec_ds_m: 2.2, canopy_temp_c: 30 });
  assert.deepEqual(fertilizeBoundary.skill, fertilizeBoundary.route);
  assert.equal(fertilizeBoundary.route.recommendation_bias, "fertilize");
  assert.equal(fertilizeBoundary.route.salinity_risk, "medium");
  assert.equal(fertilizeBoundary.route.confidence, 0.85);
  assert.ok(fertilizeBoundary.route.explanation_codes.includes(SKILL_CODE));
  assert.ok(fertilizeBoundary.route.explanation_codes.includes(FERTILIZE_RULE_CODE));
  assert.ok(!fertilizeBoundary.route.explanation_codes.includes(WAIT_RULE_CODE));

  const waitBoundary = runBoth({ soil_moisture_pct: 30, ec_ds_m: 2.21, canopy_temp_c: 30 });
  assert.deepEqual(waitBoundary.skill, waitBoundary.route);
  assert.equal(waitBoundary.route.recommendation_bias, "wait");
  assert.equal(waitBoundary.route.salinity_risk, "medium");
  assert.equal(waitBoundary.route.confidence, 0.85);
  assert.ok(waitBoundary.route.explanation_codes.includes(SKILL_CODE));
  assert.ok(waitBoundary.route.explanation_codes.includes(WAIT_RULE_CODE));
  assert.ok(!waitBoundary.route.explanation_codes.includes(FERTILIZE_RULE_CODE));
});

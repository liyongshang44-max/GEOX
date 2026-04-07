import test from "node:test";
import assert from "node:assert/strict";

import { inferDerivedSensingStateViaDeviceSkills } from "@geox/device-skills";
import { inferFertilityFromObservationAggregateV1 } from "./fertility_inference_v1";

type ComparableResult = Pick<ReturnType<typeof inferFertilityFromObservationAggregateV1>,
  "fertility_level" | "recommendation_bias" | "salinity_risk" | "confidence" | "explanation_codes">;

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

test("fertility inference: route and skill outputs are identical for dry/high-ec input", () => {
  const { route, skill } = runBoth({ soil_moisture_pct: 18, ec_ds_m: 3.1, canopy_temp_c: 33 });
  assert.deepEqual(skill, route);
});

test("fertility inference: route and skill outputs are identical for balanced input", () => {
  const { route, skill } = runBoth({ soil_moisture_pct: 30, ec_ds_m: 1.8, canopy_temp_c: 24 });
  assert.deepEqual(skill, route);
});

test("fertility inference: route and skill outputs are identical when all signals missing", () => {
  const { route, skill } = runBoth({ soil_moisture_pct: null, ec_ds_m: null, canopy_temp_c: null });
  assert.deepEqual(skill, route);
});

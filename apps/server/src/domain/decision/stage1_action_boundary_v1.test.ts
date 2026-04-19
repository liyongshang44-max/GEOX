import test from "node:test";
import assert from "node:assert/strict";
import {
  FORMAL_STAGE1_ACTION_FIELDS,
  SUPPORT_ONLY_STAGE1_FIELDS,
  FORBIDDEN_STAGE1_TRIGGER_FIELDS,
  normalizeStage1RecommendationInput,
  assertFormalTriggerInputLayer,
  assertNoForbiddenTriggerFields,
  deriveFormalTriggerSignalsFromStage1Summary,
} from "./stage1_action_boundary_v1.js";

test("stage1 action boundary constants remain explicit", () => {
  assert.deepEqual(FORMAL_STAGE1_ACTION_FIELDS, ["irrigation_effectiveness", "leak_risk"]);
  assert.deepEqual(SUPPORT_ONLY_STAGE1_FIELDS, ["canopy_temp_status", "evapotranspiration_risk", "sensor_quality_level"]);
  assert.deepEqual(FORBIDDEN_STAGE1_TRIGGER_FIELDS, [
    "fertility_state",
    "salinity_risk_state",
    "canopy_state",
    "water_flow_state",
    "irrigation_need_state",
    "irrigation_need_level",
    "sensor_quality",
  ]);
});

test("normalizeStage1RecommendationInput keeps whitelist only", () => {
  const output = normalizeStage1RecommendationInput({
    irrigation_effectiveness: "high",
    leak_risk: "low",
    canopy_temp_status: "normal",
    sensor_quality: "bad",
    random: "ignored",
  });
  assert.deepEqual(output, {
    irrigation_effectiveness: "high",
    leak_risk: "low",
    canopy_temp_status: "normal",
  });
});

test("assertFormalTriggerInputLayer enforces stage1 summary contract layer", () => {
  assert.doesNotThrow(() => assertFormalTriggerInputLayer("stage1_sensing_summary_v1"));
  assert.throws(() => assertFormalTriggerInputLayer("field_sensing_overview_v1"), /STAGE1_FORMAL_TRIGGER_LAYER_REQUIRED/);
});

test("forbidden fields are rejected and formal trigger signals are derived from formal fields only", () => {
  assert.throws(
    () => assertNoForbiddenTriggerFields({ sensor_quality: "bad" }),
    /STAGE1_FORBIDDEN_TRIGGER_FIELD:sensor_quality/
  );
  const formal = deriveFormalTriggerSignalsFromStage1Summary({
    irrigation_effectiveness: "medium",
    leak_risk: "high",
    canopy_temp_status: "hot",
  });
  assert.deepEqual(formal, {
    irrigation_effectiveness: "medium",
    leak_risk: "high",
  });
});

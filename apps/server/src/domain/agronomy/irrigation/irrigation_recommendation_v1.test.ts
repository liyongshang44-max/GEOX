import test from "node:test";
import assert from "node:assert/strict";

import { diagnoseIrrigationV1 } from "./irrigation_diagnosis_v1.js";
import { buildIrrigationRecommendationV1 } from "./irrigation_recommendation_v1.js";

test("irrigation recommendation carries IRRIGATE action_type, skill_trace and evidence_basis.telemetry_refs", () => {
  const diagnosis = diagnoseIrrigationV1({
    soil_moisture: 0.18,
    soil_moisture_threshold: 0.22,
    rain_forecast_mm: 0,
    crop_stage: "vegetative",
    evidence_refs: ["obs:soil_moisture:fieldA"],
  });

  const recommendation = buildIrrigationRecommendationV1({
    recommendation_id: "rec_test",
    snapshot_id: "snap_test",
    field_id: "fieldA",
    season_id: "seasonA",
    device_id: "deviceA",
    crop_code: "corn",
    crop_stage: "vegetative",
    diagnosis,
    suggested_amount: { amount: 25, unit: "L" },
    skill_trace: {
      skill_id: "irrigation_deficit_skill_v1",
      inputs: { soil_moisture: 0.18 },
      outputs: { recommended_amount: 25 },
      confidence: { level: "HIGH", basis: "measured" },
    },
  });

  assert.equal(recommendation.action_type, "IRRIGATE");
  assert.equal(recommendation.skill_trace?.skill_id, "irrigation_deficit_skill_v1");
  assert.equal(recommendation.skill_trace?.inputs?.soil_moisture, 0.18);
  assert.equal(recommendation.skill_trace?.outputs?.recommended_amount, 25);
  assert.equal(recommendation.skill_trace?.confidence?.level, "HIGH");
  assert.deepEqual(recommendation.evidence_basis?.telemetry_refs, ["obs:soil_moisture:fieldA"]);
});

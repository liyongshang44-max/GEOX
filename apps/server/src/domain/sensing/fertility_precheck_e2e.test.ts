import test from "node:test";
import assert from "node:assert/strict";

import { inferFertilityFromObservationAggregateV1 } from "./fertility_inference_v1";
import { composeFieldFertilityStateFromDerivedRowsV1 } from "../../projections/field_fertility_state_v1";
import { evaluateHardRuleHintsV1, getHardRuleRecommendationBlueprintV1 } from "../decision_engine_v1";

test("e2e scenario: telemetry->observation->derived state->field read model->recommendation precheck routing", () => {
  const sourceTs = Date.parse("2026-04-07T08:00:00.000Z");
  const telemetry = {
    soil_moisture_pct: 18,
    ec_ds_m: 3.1,
    canopy_temp_c: 33,
    source_ts_ms: sourceTs,
  };

  const observation = {
    type: "device_observation_v1",
    payload: {
      soil_moisture_pct: telemetry.soil_moisture_pct,
      ec_ds_m: telemetry.ec_ds_m,
      canopy_temp_c: telemetry.canopy_temp_c,
    },
    source_ts_ms: telemetry.source_ts_ms,
  };

  const inference = inferFertilityFromObservationAggregateV1({
    soil_moisture_pct: Number(observation.payload.soil_moisture_pct),
    ec_ds_m: Number(observation.payload.ec_ds_m),
    canopy_temp_c: Number(observation.payload.canopy_temp_c),
    observation_count: 1,
    source_ids: ["device_e2e_1"],
  });

  const readModel = composeFieldFertilityStateFromDerivedRowsV1([
    {
      state_type: "fertility_state",
      payload_json: {
        fertility_level: inference.fertility_level,
        recommendation_bias: inference.recommendation_bias,
        salinity_risk: inference.salinity_risk,
      },
      confidence: inference.confidence,
      explanation_codes_json: inference.explanation_codes,
      source_device_ids_json: ["device_e2e_1"],
      computed_at_ts_ms: observation.source_ts_ms,
    },
    {
      state_type: "salinity_risk_state",
      payload_json: {
        salinity_risk: inference.salinity_risk,
        recommendation_bias: inference.recommendation_bias,
      },
      confidence: inference.confidence,
      explanation_codes_json: inference.explanation_codes,
      source_device_ids_json: ["device_e2e_1"],
      computed_at_ts_ms: observation.source_ts_ms,
    }
  ], {
    tenant_id: "t_e2e",
    project_id: "p_e2e",
    group_id: "g_e2e",
    field_id: "field_e2e",
    now_ms: sourceTs + 1,
  });

  const hints = evaluateHardRuleHintsV1({
    moisture_constraint: readModel.recommendation_bias === "irrigate_first" ? "dry" : null,
    salinity_risk: String(readModel.salinity_risk ?? "").toLowerCase() === "high" ? "high" : null,
    source: "field_fertility_state_v1",
  });

  const routedActionHints = hints
    .map((hint) => getHardRuleRecommendationBlueprintV1(hint.action_hint))
        .flatMap((x) => x ? [x.action_hint] : [])
    .sort();

  assert.equal(readModel.fertility_level, "low");
  assert.equal(readModel.salinity_risk, "high");
  assert.equal(readModel.recommendation_bias, "irrigate_first");
  assert.equal(readModel.confidence, 0.95);
  assert.equal(readModel.computed_at_ts_ms, sourceTs);

  assert.ok(readModel.explanation_codes_json.includes("LOW_SOIL_MOISTURE"));
  assert.ok(readModel.explanation_codes_json.includes("HIGH_EC"));
  assert.ok(readModel.explanation_codes_json.includes("RULE_MOISTURE_LOW_IRRIGATE_FIRST"));

  assert.deepEqual(
    hints.map((x) => x.reason_code).sort(),
    ["hard_rule_moisture_constraint_dry", "hard_rule_salinity_risk_high"].sort()
  );
  assert.deepEqual(routedActionHints, ["inspect", "irrigate_first"]);
});

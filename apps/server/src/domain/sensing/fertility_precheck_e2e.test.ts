import test from "node:test";
import assert from "node:assert/strict";

import { inferFertilityFromObservationAggregateV1 } from "./fertility_inference_v1";
import { composeFieldFertilityStateFromDerivedRowsV1 } from "../../projections/field_fertility_state_v1";
import { evaluateHardRuleHintsV1, getHardRuleRecommendationBlueprintV1 } from "../decision_engine_v1";

type E2EScenarioInput = {
  soil_moisture_pct: number;
  ec_ds_m: number;
  canopy_temp_c: number;
  source_ts_ms: number;
};

function runPerceptionClosedLoopScenario(input: E2EScenarioInput) {
  const observation = {
    type: "device_observation_v1",
    payload: {
      soil_moisture_pct: input.soil_moisture_pct,
      ec_ds_m: input.ec_ds_m,
      canopy_temp_c: input.canopy_temp_c,
    },
    source_ts_ms: input.source_ts_ms,
  };

  const derivedState = inferFertilityFromObservationAggregateV1({
    soil_moisture_pct: Number(observation.payload.soil_moisture_pct),
    ec_ds_m: Number(observation.payload.ec_ds_m),
    canopy_temp_c: Number(observation.payload.canopy_temp_c),
    observation_count: 1,
    source_ids: ["device_e2e_1"],
  });

  const fieldReadModel = composeFieldFertilityStateFromDerivedRowsV1(
    [
      {
        state_type: "fertility_state",
        payload_json: {
          fertility_level: derivedState.fertility_level,
          recommendation_bias: derivedState.recommendation_bias,
          salinity_risk: derivedState.salinity_risk,
        },
        confidence: derivedState.confidence,
        explanation_codes_json: derivedState.explanation_codes,
        source_device_ids_json: ["device_e2e_1"],
        computed_at_ts_ms: observation.source_ts_ms,
      },
      {
        state_type: "salinity_risk_state",
        payload_json: {
          salinity_risk: derivedState.salinity_risk,
          recommendation_bias: derivedState.recommendation_bias,
        },
        confidence: derivedState.confidence,
        explanation_codes_json: derivedState.explanation_codes,
        source_device_ids_json: ["device_e2e_1"],
        computed_at_ts_ms: observation.source_ts_ms,
      },
    ],
    {
      tenant_id: "t_e2e",
      project_id: "p_e2e",
      group_id: "g_e2e",
      field_id: "field_e2e",
      now_ms: input.source_ts_ms + 1,
    }
  );

  const precheckHints = evaluateHardRuleHintsV1({
    moisture_constraint: fieldReadModel.recommendation_bias === "irrigate_first" ? "dry" : null,
    salinity_risk: String(fieldReadModel.salinity_risk ?? "").toLowerCase() === "high" ? "high" : null,
    source: "field_fertility_state_v1",
  });

  const routedActionHints = precheckHints
    .map((hint) => getHardRuleRecommendationBlueprintV1(hint.action_hint))
    .flatMap((x) => (x ? [x.action_hint] : []))
    .sort();

  return {
    observation,
    derivedState,
    fieldReadModel,
    precheckHints,
    routedActionHints,
  };
}

test("e2e scenario (route A): telemetry -> observation -> derived state -> read model -> precheck: irrigate_first", () => {
  const sourceTs = Date.parse("2026-04-07T08:00:00.000Z");
  const out = runPerceptionClosedLoopScenario({
    soil_moisture_pct: 18,
    ec_ds_m: 1.2,
    canopy_temp_c: 33,
    source_ts_ms: sourceTs,
  });

  // step 1: telemetry ingress -> device_observation_v1
  assert.equal(out.observation.type, "device_observation_v1");
  assert.equal(out.observation.source_ts_ms, sourceTs);
  assert.equal(out.observation.payload.soil_moisture_pct, 18);

  // step 2: inference -> derived_sensing_state_v1（使用领域推理结果作为 derived state payload）
  assert.equal(out.derivedState.fertility_level, "low");
  assert.equal(out.derivedState.recommendation_bias, "irrigate_first");
  assert.equal(out.derivedState.salinity_risk, "low");
  assert.equal(out.derivedState.confidence, 0.95);
  assert.ok(out.derivedState.explanation_codes.includes("LOW_SOIL_MOISTURE"));
  assert.ok(out.derivedState.explanation_codes.includes("RULE_MOISTURE_LOW_IRRIGATE_FIRST"));

  // step 3: field 两张读模型聚合（fertility_state + salinity_risk_state）
  assert.equal(out.fieldReadModel.fertility_level, "low");
  assert.equal(out.fieldReadModel.recommendation_bias, "irrigate_first");
  assert.equal(out.fieldReadModel.salinity_risk, "low");
  assert.equal(out.fieldReadModel.confidence, 0.95);
  assert.equal(out.fieldReadModel.computed_at_ts_ms, sourceTs);
  assert.ok(out.fieldReadModel.explanation_codes_json.includes("LOW_SOIL_MOISTURE"));
  assert.ok(out.fieldReadModel.explanation_codes_json.includes("multisource_derived_state_merged"));

  // step 4: recommendation / precheck 命中分流规则之一
  assert.deepEqual(out.precheckHints.map((x) => x.reason_code), ["hard_rule_moisture_constraint_dry"]);
  assert.deepEqual(out.routedActionHints, ["irrigate_first"]);
});

test("e2e scenario (route B): telemetry -> observation -> derived state -> read model -> precheck: inspect", () => {
  const sourceTs = Date.parse("2026-04-07T09:00:00.000Z");
  const out = runPerceptionClosedLoopScenario({
    soil_moisture_pct: 42,
    ec_ds_m: 3.4,
    canopy_temp_c: 31,
    source_ts_ms: sourceTs,
  });

  // step 1
  assert.equal(out.observation.type, "device_observation_v1");
  assert.equal(out.observation.source_ts_ms, sourceTs);

  // step 2
  assert.equal(out.derivedState.fertility_level, "high");
  assert.equal(out.derivedState.recommendation_bias, "inspect");
  assert.equal(out.derivedState.salinity_risk, "high");
  assert.equal(out.derivedState.confidence, 0.95);
  assert.ok(out.derivedState.explanation_codes.includes("HIGH_EC"));

  // step 3
  assert.equal(out.fieldReadModel.recommendation_bias, "inspect");
  assert.equal(out.fieldReadModel.salinity_risk, "high");
  assert.equal(out.fieldReadModel.confidence, 0.95);
  assert.equal(out.fieldReadModel.computed_at_ts_ms, sourceTs);

  // step 4
  assert.deepEqual(out.precheckHints.map((x) => x.reason_code), ["hard_rule_salinity_risk_high"]);
  assert.deepEqual(out.routedActionHints, ["inspect"]);
});

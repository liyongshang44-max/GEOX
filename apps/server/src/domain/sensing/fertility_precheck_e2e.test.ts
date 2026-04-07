import test from "node:test";
import assert from "node:assert/strict";

import { inferFertilityFromObservationAggregateV1 } from "./fertility_inference_v1";
import { composeFieldFertilityStateFromDerivedRowsV1 } from "../../projections/field_fertility_state_v1";
import { evaluateHardRuleHintsV1, getHardRuleRecommendationBlueprintV1 } from "../decision_engine_v1";

type E2EScenarioInput = {
  soil_moisture_pct?: number | null;
  ec_ds_m?: number | null;
  canopy_temp_c?: number | null;
  source_ts_ms: number;
};

function runPerceptionClosedLoopScenario(input: E2EScenarioInput) {
  const asFiniteOrNull = (value: number | null | undefined): number | null =>
    value == null ? null : Number.isFinite(value) ? value : null;

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
    soil_moisture_pct: asFiniteOrNull(observation.payload.soil_moisture_pct),
    ec_ds_m: asFiniteOrNull(observation.payload.ec_ds_m),
    canopy_temp_c: asFiniteOrNull(observation.payload.canopy_temp_c),
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

type RegressionScenario = {
  name: string;
  input: E2EScenarioInput;
  expected: {
    derived: {
      fertility_level: string;
      recommendation_bias: string;
      salinity_risk: string;
      confidence: number;
    };
    field: {
      fertility_level: string;
      recommendation_bias: string;
      salinity_risk: string;
      confidence: number;
    };
    precheck_reason_codes: string[];
    precheck_action_hints: string[];
  };
};

const REGRESSION_MATRIX: RegressionScenario[] = [
  {
    name: "dry -> irrigate_first",
    input: {
      soil_moisture_pct: 18,
      ec_ds_m: 1.2,
      canopy_temp_c: 33,
      source_ts_ms: Date.parse("2026-04-07T08:00:00.000Z"),
    },
    expected: {
      derived: {
        fertility_level: "low",
        recommendation_bias: "irrigate_first",
        salinity_risk: "low",
        confidence: 0.95,
      },
      field: {
        fertility_level: "low",
        recommendation_bias: "irrigate_first",
        salinity_risk: "low",
        confidence: 0.95,
      },
      precheck_reason_codes: ["hard_rule_moisture_constraint_dry"],
      precheck_action_hints: ["irrigate_first"],
    },
  },
  {
    name: "high salinity -> inspect",
    input: {
      soil_moisture_pct: 42,
      ec_ds_m: 3.4,
      canopy_temp_c: 31,
      source_ts_ms: Date.parse("2026-04-07T09:00:00.000Z"),
    },
    expected: {
      derived: {
        fertility_level: "high",
        recommendation_bias: "inspect",
        salinity_risk: "high",
        confidence: 0.95,
      },
      field: {
        fertility_level: "high",
        recommendation_bias: "inspect",
        salinity_risk: "high",
        confidence: 0.95,
      },
      precheck_reason_codes: ["hard_rule_salinity_risk_high"],
      precheck_action_hints: ["inspect"],
    },
  },
  {
    name: "normal (fertilize)",
    input: {
      soil_moisture_pct: 30,
      ec_ds_m: 1.8,
      canopy_temp_c: 25,
      source_ts_ms: Date.parse("2026-04-07T10:00:00.000Z"),
    },
    expected: {
      derived: {
        fertility_level: "medium",
        recommendation_bias: "fertilize",
        salinity_risk: "low",
        confidence: 0.85,
      },
      field: {
        fertility_level: "medium",
        recommendation_bias: "fertilize",
        salinity_risk: "low",
        confidence: 0.85,
      },
      precheck_reason_codes: [],
      precheck_action_hints: [],
    },
  },
  {
    name: "normal (wait)",
    input: {
      soil_moisture_pct: 30,
      ec_ds_m: 0.8,
      canopy_temp_c: 35,
      source_ts_ms: Date.parse("2026-04-07T11:00:00.000Z"),
    },
    expected: {
      derived: {
        fertility_level: "medium",
        recommendation_bias: "wait",
        salinity_risk: "low",
        confidence: 0.85,
      },
      field: {
        fertility_level: "medium",
        recommendation_bias: "wait",
        salinity_risk: "low",
        confidence: 0.85,
      },
      precheck_reason_codes: [],
      precheck_action_hints: [],
    },
  },
  {
    name: "observation missing fallback",
    input: {
      soil_moisture_pct: null,
      ec_ds_m: null,
      canopy_temp_c: null,
      source_ts_ms: Date.parse("2026-04-07T12:00:00.000Z"),
    },
    expected: {
      derived: {
        fertility_level: "unknown",
        recommendation_bias: "inspect",
        salinity_risk: "unknown",
        confidence: 0.2,
      },
      field: {
        fertility_level: "unknown",
        recommendation_bias: "inspect",
        salinity_risk: "unknown",
        confidence: 0.2,
      },
      precheck_reason_codes: [],
      precheck_action_hints: [],
    },
  },
];

for (const scenario of REGRESSION_MATRIX) {
  test(`fertility precheck regression matrix: ${scenario.name}`, () => {
    const out = runPerceptionClosedLoopScenario(scenario.input);

    assert.equal(out.observation.type, "device_observation_v1");
    assert.equal(out.observation.source_ts_ms, scenario.input.source_ts_ms);

    assert.equal(out.derivedState.fertility_level, scenario.expected.derived.fertility_level);
    assert.equal(out.derivedState.recommendation_bias, scenario.expected.derived.recommendation_bias);
    assert.equal(out.derivedState.salinity_risk, scenario.expected.derived.salinity_risk);
    assert.equal(out.derivedState.confidence, scenario.expected.derived.confidence);

    assert.equal(out.fieldReadModel.fertility_level, scenario.expected.field.fertility_level);
    assert.equal(out.fieldReadModel.recommendation_bias, scenario.expected.field.recommendation_bias);
    assert.equal(out.fieldReadModel.salinity_risk, scenario.expected.field.salinity_risk);
    assert.equal(out.fieldReadModel.confidence, scenario.expected.field.confidence);
    assert.equal(out.fieldReadModel.computed_at_ts_ms, scenario.input.source_ts_ms);
    assert.ok(out.fieldReadModel.explanation_codes_json.includes("multisource_derived_state_merged"));

    assert.deepEqual(out.precheckHints.map((x) => x.reason_code).sort(), scenario.expected.precheck_reason_codes);
    assert.deepEqual(out.routedActionHints, scenario.expected.precheck_action_hints);
  });
}

import test from "node:test";
import assert from "node:assert/strict";

import {
  STAGE1_PIPELINE_INPUT_WHITELIST_METRICS_V1,
  STAGE1_SENSING_INPUT_MAPPING_V1,
  getStage1SensingInputMappingEntryV1,
  mapStage1ObservationMetricToPipelineObservationV1,
} from "./stage1_sensing_input_mapping_v1.js";

test("stage1 sensing input mapping v1 covers all official canonical metrics", () => {
  for (const metric of STAGE1_PIPELINE_INPUT_WHITELIST_METRICS_V1) {
    const mapping = STAGE1_SENSING_INPUT_MAPPING_V1[metric];
    assert.ok(mapping, `missing mapping for ${metric}`);
    assert.equal(mapping.metric, metric);
    assert.ok(mapping.observation_canonical_fields.length >= 1);
    assert.ok(mapping.pipeline_aggregate_fields.length >= 1);
    assert.ok(mapping.downstream_derived_states.length >= 1);
    assert.equal(mapping.internal_summary_only, !mapping.enters_customer_summary);
  }
});

test("stage1 observation metric mapping produces canonical observation aliases", () => {
  const observation = mapStage1ObservationMetricToPipelineObservationV1("canopy_temperature", 31.2, "dev-1");
  assert.equal(observation.device_id, "dev-1");
  assert.equal(observation.canopy_temperature, 31.2);
  assert.equal(observation.canopy_temp_c, 31.2);
  assert.equal(observation.canopy_temp, 31.2);
  assert.equal(observation.temperature_c, 31.2);
});

test("stage1 input mapping defines stable canonical -> observation/pipeline targets", () => {
  const expected: Record<string, { observation: string[]; pipeline: string[]; derived: string[] }> = {
    soil_moisture: {
      observation: ["soil_moisture", "soil_moisture_pct"],
      pipeline: ["soil_moisture_pct"],
      derived: ["fertility_state", "salinity_risk_state"],
    },
    canopy_temperature: {
      observation: ["canopy_temperature", "canopy_temp_c", "canopy_temp", "temperature_c"],
      pipeline: ["canopy_temp_c"],
      derived: ["fertility_state", "salinity_risk_state", "canopy_temperature_state", "evapotranspiration_risk_state"],
    },
    soil_ec: {
      observation: ["soil_ec", "ec_ds_m", "soil_ec_ds_m"],
      pipeline: ["ec_ds_m"],
      derived: ["fertility_state", "salinity_risk_state"],
    },
    air_temperature: {
      observation: ["air_temperature", "ambient_temp_c", "air_temp_c", "ambient_temperature_c"],
      pipeline: ["ambient_temp_c"],
      derived: ["canopy_temperature_state", "evapotranspiration_risk_state"],
    },
    air_humidity: {
      observation: ["air_humidity", "relative_humidity_pct", "humidity_pct", "rh_pct"],
      pipeline: ["relative_humidity_pct"],
      derived: ["canopy_temperature_state", "evapotranspiration_risk_state"],
    },
    water_flow_rate: {
      observation: ["water_flow_rate", "inlet_flow_lpm", "inlet_lpm"],
      pipeline: ["inlet_flow_lpm"],
      derived: ["irrigation_effectiveness_state", "leak_risk_state"],
    },
    water_pressure: {
      observation: ["water_pressure", "pressure_drop_kpa", "pressure_kpa"],
      pipeline: ["pressure_drop_kpa"],
      derived: ["irrigation_effectiveness_state", "leak_risk_state"],
    },
  };

  for (const metric of STAGE1_PIPELINE_INPUT_WHITELIST_METRICS_V1) {
    const entry = getStage1SensingInputMappingEntryV1(metric);
    assert.ok(entry, `missing mapping for ${metric}`);
    assert.deepEqual(entry?.observation_canonical_fields, expected[metric].observation);
    assert.deepEqual(entry?.pipeline_aggregate_fields, expected[metric].pipeline);
    assert.deepEqual(entry?.downstream_derived_states, expected[metric].derived);
  }
});

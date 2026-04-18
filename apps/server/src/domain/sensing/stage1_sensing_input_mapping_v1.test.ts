import test from "node:test";
import assert from "node:assert/strict";

import {
  STAGE1_OFFICIAL_CANONICAL_INPUT_METRICS_V1,
  STAGE1_SENSING_INPUT_MAPPING_V1,
  mapStage1ObservationMetricToPipelineObservationV1,
} from "./stage1_sensing_input_mapping_v1.js";

test("stage1 sensing input mapping v1 covers all official canonical metrics", () => {
  for (const metric of STAGE1_OFFICIAL_CANONICAL_INPUT_METRICS_V1) {
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

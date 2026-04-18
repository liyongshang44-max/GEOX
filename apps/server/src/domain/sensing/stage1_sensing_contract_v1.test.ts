import test from "node:test";
import assert from "node:assert/strict";

import {
  STAGE1_OFFICIAL_PIPELINE_CANONICAL_INPUT_METRICS,
  STAGE1_OFFICIAL_SUMMARY_SOIL_METRICS,
  STAGE1_INPUT_CONTRACT_LAYERS,
  STAGE1_OFFICIAL_DERIVED_STATES,
  STAGE1_CUSTOMER_SUMMARY_FIELDS,
  STAGE1_REFRESH_SEMANTICS,
  STAGE1_RUNTIME_DIAGNOSTIC_BOUNDARY,
  STAGE1_DEVICE_RUNTIME_STATUS,
  STAGE1_SENSOR_QUALITY_DIAGNOSTIC_STATUS,
} from "./stage1_sensing_contract_v1.js";

test("stage1 sensing contract: official input/status/customer whitelist are stable", () => {
  assert.deepEqual(STAGE1_OFFICIAL_PIPELINE_CANONICAL_INPUT_METRICS, [
    "soil_moisture_pct",
    "ec_ds_m",
    "fertility_index",
    "n",
    "p",
    "k",
  ]);

  assert.deepEqual(STAGE1_OFFICIAL_DERIVED_STATES, [
    "canopy_temperature_state",
    "evapotranspiration_risk_state",
    "sensor_quality_state",
    "irrigation_effectiveness_state",
    "leak_risk_state",
  ]);

  assert.deepEqual(STAGE1_CUSTOMER_SUMMARY_FIELDS, [
    "canopy_temp_status",
    "evapotranspiration_risk",
    "sensor_quality_level",
    "irrigation_effectiveness",
    "leak_risk",
  ]);

  assert.deepEqual(STAGE1_REFRESH_SEMANTICS.status, ["ok", "fallback_stale", "no_data", "error"]);
  assert.deepEqual(STAGE1_REFRESH_SEMANTICS.freshness, ["fresh", "stale", "unknown"]);
});

test("stage1 sensing contract: summary soil metrics are an explicit subset of pipeline input whitelist", () => {
  const pipelineWhitelist = new Set<string>(STAGE1_OFFICIAL_PIPELINE_CANONICAL_INPUT_METRICS);
  for (const metric of STAGE1_OFFICIAL_SUMMARY_SOIL_METRICS) {
    assert.ok(pipelineWhitelist.has(metric), `summary soil metric must be in pipeline whitelist: ${metric}`);
  }
  assert.equal(STAGE1_INPUT_CONTRACT_LAYERS.pipeline_uses, "official_pipeline_input_whitelist");
  assert.equal(STAGE1_INPUT_CONTRACT_LAYERS.customer_summary_uses, "official_customer_summary_soil_metrics_subset");
});

test("stage1 sensing contract: runtime status and sensing diagnostic boundaries are explicit", () => {
  assert.equal(STAGE1_DEVICE_RUNTIME_STATUS.source_table, "device_status_index_v1");
  assert.equal(STAGE1_SENSOR_QUALITY_DIAGNOSTIC_STATUS.derived_state_type, "sensor_quality_state");
  assert.equal(STAGE1_RUNTIME_DIAGNOSTIC_BOUNDARY.default_equivalence_forbidden, true);
  assert.equal(STAGE1_RUNTIME_DIAGNOSTIC_BOUNDARY.explicit_bridge_rule_required, true);
  assert.ok(STAGE1_SENSOR_QUALITY_DIAGNOSTIC_STATUS.forbidden_direct_inputs.includes("last_heartbeat_ts_ms"));
});

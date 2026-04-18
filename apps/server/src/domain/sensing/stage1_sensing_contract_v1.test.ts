import test from "node:test";
import assert from "node:assert/strict";

import {
  STAGE1_OFFICIAL_INPUT_METRICS,
  STAGE1_OFFICIAL_DERIVED_STATES,
  STAGE1_CUSTOMER_SUMMARY_FIELDS,
  STAGE1_REFRESH_SEMANTICS,
  STAGE1_RUNTIME_DIAGNOSTIC_BOUNDARY,
  STAGE1_DEVICE_RUNTIME_STATUS,
  STAGE1_SENSOR_QUALITY_DIAGNOSTIC_STATUS,
} from "./stage1_sensing_contract_v1.js";

test("stage1 sensing contract: official input/status/customer whitelist are stable", () => {
  assert.deepEqual(STAGE1_OFFICIAL_INPUT_METRICS, [
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

test("stage1 sensing contract: runtime status and sensing diagnostic boundaries are explicit", () => {
  assert.equal(STAGE1_DEVICE_RUNTIME_STATUS.source_table, "device_status_index_v1");
  assert.equal(STAGE1_SENSOR_QUALITY_DIAGNOSTIC_STATUS.derived_state_type, "sensor_quality_state");
  assert.equal(STAGE1_RUNTIME_DIAGNOSTIC_BOUNDARY.default_equivalence_forbidden, true);
  assert.equal(STAGE1_RUNTIME_DIAGNOSTIC_BOUNDARY.explicit_bridge_rule_required, true);
  assert.ok(STAGE1_SENSOR_QUALITY_DIAGNOSTIC_STATUS.forbidden_direct_inputs.includes("last_heartbeat_ts_ms"));
});

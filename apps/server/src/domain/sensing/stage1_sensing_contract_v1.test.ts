import test from "node:test";
import assert from "node:assert/strict";

import {
  STAGE1_OFFICIAL_PIPELINE_CANONICAL_INPUT_METRICS,
  STAGE1_OFFICIAL_SUMMARY_SOIL_METRICS,
  STAGE1_INPUT_CONTRACT_LAYERS,
  STAGE1_CUSTOMER_FACING_SUMMARY_CONTRACT_SHAPE,
  STAGE1_INTERNAL_SUMMARY_CONTRACT_SHAPE,
  STAGE1_SUMMARY_CUSTOMER_FORBIDDEN_FIELDS,
  STAGE1_SUMMARY_DISPLAY_ONLY_FIELDS,
  STAGE1_OFFICIAL_SOIL_METRICS_SUMMARY_SUBSTRUCTURE,
  STAGE1_SUMMARY_REFRESH_CARRIAGE_SEMANTICS,
  STAGE1_OFFICIAL_DERIVED_STATES,
  STAGE1_CUSTOMER_SUMMARY_FIELDS,
  STAGE1_REFRESH_SEMANTICS,
  STAGE1_RUNTIME_DIAGNOSTIC_BOUNDARY,
  STAGE1_DEVICE_RUNTIME_STATUS,
  STAGE1_SENSOR_QUALITY_DIAGNOSTIC_STATUS,
} from "./stage1_sensing_contract_v1.js";
import {
  FORMAL_STAGE1_ACTION_FIELDS,
  SUPPORT_ONLY_STAGE1_FIELDS,
  FORBIDDEN_STAGE1_TRIGGER_FIELDS,
} from "../decision/stage1_action_boundary_v1.js";

test("stage1 sensing contract: official input/status/customer whitelist are stable", () => {
  assert.deepEqual(STAGE1_OFFICIAL_PIPELINE_CANONICAL_INPUT_METRICS, [
    "soil_moisture",
    "canopy_temperature",
    "soil_ec",
    "air_temperature",
    "air_humidity",
    "water_flow_rate",
    "water_pressure",
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

test("stage1 sensing contract: three-layer contracts remain explicit and non-confused", () => {
  assert.deepEqual(STAGE1_INPUT_CONTRACT_LAYERS.official_pipeline_input_whitelist, STAGE1_OFFICIAL_PIPELINE_CANONICAL_INPUT_METRICS);
  assert.deepEqual(STAGE1_INPUT_CONTRACT_LAYERS.official_customer_summary_soil_metrics_subset, STAGE1_OFFICIAL_SUMMARY_SOIL_METRICS);
  assert.equal(STAGE1_INPUT_CONTRACT_LAYERS.source_of_truth_layer, "official_pipeline_input_whitelist");
  assert.equal(STAGE1_INPUT_CONTRACT_LAYERS.aggregate_field_layer, "official_pipeline_aggregate_fields");
  assert.equal(STAGE1_INPUT_CONTRACT_LAYERS.summary_display_subset_layer, "official_customer_summary_soil_metrics_subset");
});

test("stage1 sensing contract: runtime status and sensing diagnostic boundaries are explicit", () => {
  assert.equal(STAGE1_DEVICE_RUNTIME_STATUS.source_table, "device_status_index_v1");
  assert.equal(STAGE1_SENSOR_QUALITY_DIAGNOSTIC_STATUS.derived_state_type, "sensor_quality_state");
  assert.equal(STAGE1_RUNTIME_DIAGNOSTIC_BOUNDARY.default_equivalence_forbidden, true);
  assert.equal(STAGE1_RUNTIME_DIAGNOSTIC_BOUNDARY.explicit_bridge_rule_required, true);
  assert.ok(STAGE1_SENSOR_QUALITY_DIAGNOSTIC_STATUS.forbidden_direct_inputs.includes("last_heartbeat_ts_ms"));
});

test("stage1 sensing contract: customer/internal summary structure semantics are explicit", () => {
  assert.ok(STAGE1_CUSTOMER_FACING_SUMMARY_CONTRACT_SHAPE.required_top_level_fields.includes("official_soil_metrics_json"));
  assert.ok(STAGE1_CUSTOMER_FACING_SUMMARY_CONTRACT_SHAPE.required_top_level_fields.includes("freshness"));
  assert.ok(STAGE1_CUSTOMER_FACING_SUMMARY_CONTRACT_SHAPE.required_top_level_fields.includes("updated_ts_ms"));
  assert.deepEqual(STAGE1_CUSTOMER_FACING_SUMMARY_CONTRACT_SHAPE.display_only_fields, STAGE1_SUMMARY_DISPLAY_ONLY_FIELDS);
  assert.ok(STAGE1_SUMMARY_CUSTOMER_FORBIDDEN_FIELDS.includes("sensor_quality"));
  assert.ok(STAGE1_SUMMARY_CUSTOMER_FORBIDDEN_FIELDS.includes("soil_indicators_json"));
  assert.ok(STAGE1_SUMMARY_CUSTOMER_FORBIDDEN_FIELDS.includes("sensing_overview"));
  assert.ok(STAGE1_INTERNAL_SUMMARY_CONTRACT_SHAPE.internal_only_fields.includes("irrigation_need_level"));
  assert.equal(STAGE1_CUSTOMER_FACING_SUMMARY_CONTRACT_SHAPE.nullability.field_id, false);
  assert.equal(STAGE1_CUSTOMER_FACING_SUMMARY_CONTRACT_SHAPE.nullability.confidence, true);
  assert.equal(STAGE1_CUSTOMER_FACING_SUMMARY_CONTRACT_SHAPE.nullability.official_soil_metrics_json, false);
  assert.equal(STAGE1_OFFICIAL_SOIL_METRICS_SUMMARY_SUBSTRUCTURE.container_field, "official_soil_metrics_json");
  assert.deepEqual(STAGE1_OFFICIAL_SOIL_METRICS_SUMMARY_SUBSTRUCTURE.item_shape.freshness, STAGE1_REFRESH_SEMANTICS.freshness);
  assert.deepEqual(
    STAGE1_SUMMARY_REFRESH_CARRIAGE_SEMANTICS.route_refresh_envelope.stage1_refresh_fields,
    ["freshness", "status", "refreshed_ts_ms"]
  );
});

test("stage1 formal action boundary snapshot stays aligned with stage1 summary contract", () => {
  assert.deepEqual(FORMAL_STAGE1_ACTION_FIELDS, ["irrigation_effectiveness", "leak_risk"]);
  for (const field of FORMAL_STAGE1_ACTION_FIELDS) {
    assert.ok(STAGE1_CUSTOMER_SUMMARY_FIELDS.includes(field as any), `formal action field must be part of customer summary fields: ${field}`);
  }
  for (const field of SUPPORT_ONLY_STAGE1_FIELDS) {
    assert.ok(STAGE1_SUMMARY_DISPLAY_ONLY_FIELDS.includes(field as any), `support-only field must stay display-only: ${field}`);
  }
  for (const forbidden of FORBIDDEN_STAGE1_TRIGGER_FIELDS) {
    assert.ok(STAGE1_SUMMARY_CUSTOMER_FORBIDDEN_FIELDS.includes(forbidden as any) || forbidden.endsWith("_state"), `forbidden trigger field must remain outside customer-facing action layer: ${forbidden}`);
  }
});

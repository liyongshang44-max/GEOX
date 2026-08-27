import assert from "node:assert/strict";
import test from "node:test";

import { buildMqttObservationInputV1 } from "./mqtt_observation_input_v1";

test("MQTT source Fahrenheit is not relabelled as Celsius before evidence QC", () => {
  const result = buildMqttObservationInputV1({
    tenant_id: "tenantA",
    project_id: "projectA",
    group_id: "groupA",
    field_id: "fieldA",
    device_id: "dev_temp",
    metric: "air_temperature",
    value: 72,
    unit: "°F",
    ts_ms: 1_787_790_000_000,
    source_fact_id: "tel_temp_f",
    quality_flags: ["OK"],
  });

  assert.equal(result.metric, "air_temperature");
  assert.equal(result.value, 72);
  assert.equal(result.unit, "°F");
  assert.equal(result.source_fact_id, "tel_temp_f");
  assert.equal(result.formal_eligible, true);
});

test("MQTT impossible humidity is preserved for shared physical QC", () => {
  const result = buildMqttObservationInputV1({
    tenant_id: "tenantA",
    project_id: "projectA",
    group_id: "groupA",
    field_id: "fieldA",
    device_id: "dev_rh",
    metric: "humidity",
    value: 102.7,
    unit: "%RH",
    ts_ms: 1_787_790_060_000,
    source_fact_id: "tel_rh_102_7",
    quality_flags: ["OK"],
  });

  assert.equal(result.metric, "humidity");
  assert.equal(result.value, 102.7);
  assert.equal(result.unit, "%RH");
});

test("MQTT missing value remains missing rather than receiving a transport default", () => {
  const result = buildMqttObservationInputV1({
    tenant_id: "tenantA",
    project_id: "projectA",
    group_id: "groupA",
    field_id: "fieldA",
    device_id: "dev_sm",
    metric: "soil_moisture",
    value: null,
    unit: "%VWC",
    ts_ms: 1_787_790_120_000,
    source_fact_id: "tel_sm_missing",
    quality_flags: ["MISSING_CONTEXT"],
  });

  assert.equal(result.value, null);
  assert.equal(result.unit, "%VWC");
});

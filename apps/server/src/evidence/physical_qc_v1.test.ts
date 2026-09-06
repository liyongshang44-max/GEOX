import assert from "node:assert/strict";
import test from "node:test";

import { classifyPhysicalMeasurementV1 } from "./physical_qc_v1.js";

test("air humidity 102.7 percent fails the catalog hard maximum", () => {
  const result = classifyPhysicalMeasurementV1({
    metric: "air_humidity",
    value: 102.7,
    unit: "%RH",
  });

  assert.equal(result.canonical_metric, "air_humidity");
  assert.equal(result.numeric_value, 102.7);
  assert.equal(result.measurement_health, "INVALID");
  assert.equal(result.physical_validity, "FAIL");
  assert.deepEqual(result.reason_codes, ["PHYSICAL_QC_ABOVE_HARD_MAX"]);
});

test("healthy-range humidity remains physically valid at the inclusive bound", () => {
  const result = classifyPhysicalMeasurementV1({
    metric: "humidity",
    value: 100,
    unit: "%",
  });

  assert.equal(result.canonical_metric, "air_humidity");
  assert.equal(result.measurement_health, "VALID");
  assert.equal(result.physical_validity, "PASS");
  assert.deepEqual(result.reason_codes, ["PHYSICAL_QC_OK"]);
});

test("soil moisture above 100 VWC percent is physically invalid", () => {
  const result = classifyPhysicalMeasurementV1({
    metric: "soil_moisture",
    value: 100.1,
    unit: "%VWC",
  });

  assert.equal(result.measurement_health, "INVALID");
  assert.equal(result.physical_validity, "FAIL");
  assert.deepEqual(result.reason_codes, ["PHYSICAL_QC_ABOVE_HARD_MAX"]);
});

test("missing numeric evidence stays unknown and no fallback value is fabricated", () => {
  const result = classifyPhysicalMeasurementV1({
    metric: "soil_moisture",
    value: null,
    unit: "%VWC",
  });

  assert.equal(result.numeric_value, null);
  assert.equal(result.measurement_health, "UNKNOWN");
  assert.equal(result.physical_validity, "UNKNOWN");
  assert.deepEqual(result.reason_codes, ["PHYSICAL_QC_MISSING_VALUE"]);
  assert.equal(Object.prototype.hasOwnProperty.call(result, "decision_eligibility"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result, "action_verdict"), false);
});

test("non-finite numeric evidence fails physical QC without normalization", () => {
  const result = classifyPhysicalMeasurementV1({
    metric: "water_flow_rate",
    value: Number.POSITIVE_INFINITY,
    unit: "L/min",
  });

  assert.equal(result.numeric_value, null);
  assert.equal(result.measurement_health, "INVALID");
  assert.equal(result.physical_validity, "FAIL");
  assert.deepEqual(result.reason_codes, ["PHYSICAL_QC_NON_FINITE_VALUE"]);
});

test("missing unit does not silently inherit the canonical unit", () => {
  const result = classifyPhysicalMeasurementV1({
    metric: "air_humidity",
    value: 55,
    unit: null,
  });

  assert.equal(result.input_unit, null);
  assert.equal(result.canonical_unit, "%RH");
  assert.equal(result.measurement_health, "UNKNOWN");
  assert.equal(result.physical_validity, "UNKNOWN");
  assert.deepEqual(result.reason_codes, ["PHYSICAL_QC_UNIT_REQUIRED"]);
});

test("unqualified unit does not get rewritten into catalog authority", () => {
  const result = classifyPhysicalMeasurementV1({
    metric: "air_temperature",
    value: 72,
    unit: "°F",
  });

  assert.equal(result.input_unit, "°F");
  assert.equal(result.canonical_unit, "°C");
  assert.equal(result.numeric_value, 72);
  assert.equal(result.measurement_health, "UNKNOWN");
  assert.equal(result.physical_validity, "UNKNOWN");
  assert.deepEqual(result.reason_codes, ["PHYSICAL_QC_UNIT_UNQUALIFIED"]);
});

test("unsupported metric remains unsupported rather than receiving invented limits", () => {
  const result = classifyPhysicalMeasurementV1({
    metric: "leaf_wetness_pct",
    value: 44,
    unit: "%",
  });

  assert.equal(result.canonical_metric, null);
  assert.equal(result.catalog_status, "UNSUPPORTED_METRIC");
  assert.equal(result.hard_min, null);
  assert.equal(result.hard_max, null);
  assert.equal(result.measurement_health, "UNKNOWN");
  assert.equal(result.physical_validity, "NOT_APPLICABLE");
  assert.deepEqual(result.reason_codes, ["PHYSICAL_QC_UNSUPPORTED_METRIC"]);
});

test("negative flow fails the existing catalog physical envelope", () => {
  const result = classifyPhysicalMeasurementV1({
    metric: "flow_rate",
    value: -0.1,
    unit: "lpm",
  });

  assert.equal(result.canonical_metric, "water_flow_rate");
  assert.equal(result.measurement_health, "INVALID");
  assert.equal(result.physical_validity, "FAIL");
  assert.deepEqual(result.reason_codes, ["PHYSICAL_QC_BELOW_HARD_MIN"]);
});

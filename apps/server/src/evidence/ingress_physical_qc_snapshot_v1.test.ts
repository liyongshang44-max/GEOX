import assert from "node:assert/strict";
import test from "node:test";

import { buildIngressPhysicalQcSnapshotV1 } from "./ingress_physical_qc_snapshot_v1.js";

test("ingress snapshot preserves impossible RH exactly while removing physical validity", () => {
  const snapshot = buildIngressPhysicalQcSnapshotV1({
    source_fact_id: "raw_rh_102_7",
    metric: "humidity",
    value: 102.7,
    unit: "%RH",
  });

  assert.equal(snapshot.source_fact_id, "raw_rh_102_7");
  assert.equal(snapshot.source_metric, "humidity");
  assert.equal(snapshot.source_value, 102.7);
  assert.equal(snapshot.source_unit, "%RH");
  assert.equal(snapshot.physical_qc.canonical_metric, "air_humidity");
  assert.equal(snapshot.physical_qc.numeric_value, 102.7);
  assert.equal(snapshot.physical_qc.measurement_health, "INVALID");
  assert.equal(snapshot.physical_qc.physical_validity, "FAIL");
});

test("ingress snapshot preserves unqualified source unit rather than fabricating Celsius authority", () => {
  const snapshot = buildIngressPhysicalQcSnapshotV1({
    source_fact_id: "raw_temp_f",
    metric: "air_temperature",
    value: 72,
    unit: "°F",
  });

  assert.equal(snapshot.source_value, 72);
  assert.equal(snapshot.source_unit, "°F");
  assert.equal(snapshot.physical_qc.canonical_unit, "°C");
  assert.equal(snapshot.physical_qc.input_unit, "°F");
  assert.equal(snapshot.physical_qc.measurement_health, "UNKNOWN");
  assert.equal(snapshot.physical_qc.physical_validity, "UNKNOWN");
  assert.deepEqual(snapshot.physical_qc.reason_codes, ["PHYSICAL_QC_UNIT_UNQUALIFIED"]);
});

test("missing source measurement remains missing in the annotation", () => {
  const snapshot = buildIngressPhysicalQcSnapshotV1({
    source_fact_id: "raw_missing_sm",
    metric: "soil_moisture",
    value: null,
    unit: "%VWC",
  });

  assert.equal(snapshot.source_value, null);
  assert.equal(snapshot.physical_qc.numeric_value, null);
  assert.equal(snapshot.physical_qc.measurement_health, "UNKNOWN");
  assert.equal(snapshot.physical_qc.physical_validity, "UNKNOWN");
  assert.deepEqual(snapshot.physical_qc.reason_codes, ["PHYSICAL_QC_MISSING_VALUE"]);
});

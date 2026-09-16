import assert from "node:assert/strict";
import test from "node:test";

import { evaluateRawSampleStage1PhysicalQcV1 } from "./raw_sample_stage1_physical_qc_v1.js";

function payload(health: string, validity: string) {
  return {
    ingress_physical_qc: {
      schema_version: "ingress_physical_qc_snapshot_v1",
      physical_qc: {
        measurement_health: health,
        physical_validity: validity,
      },
    },
  };
}

test("VALID/PASS raw sample is physically eligible", () => {
  assert.deepEqual(evaluateRawSampleStage1PhysicalQcV1(payload("VALID", "PASS")), {
    eligible: true,
    mode: "QUALIFIED",
    reason_code: "RAW_SAMPLE_PHYSICAL_QC_PASS",
  });
});

test("INVALID/FAIL raw sample is ineligible", () => {
  const result = evaluateRawSampleStage1PhysicalQcV1(payload("INVALID", "FAIL"));
  assert.equal(result.eligible, false);
  assert.equal(result.mode, "INELIGIBLE_INVALID");
});

test("UNKNOWN raw sample is ineligible", () => {
  const result = evaluateRawSampleStage1PhysicalQcV1(payload("UNKNOWN", "UNKNOWN"));
  assert.equal(result.eligible, false);
  assert.equal(result.mode, "INELIGIBLE_UNKNOWN");
});

test("pre-B04 raw sample stays on explicit legacy seam", () => {
  assert.deepEqual(evaluateRawSampleStage1PhysicalQcV1({}), {
    eligible: true,
    mode: "LEGACY_UNCLASSIFIED",
    reason_code: "RAW_SAMPLE_PHYSICAL_QC_LEGACY_UNCLASSIFIED",
  });
});

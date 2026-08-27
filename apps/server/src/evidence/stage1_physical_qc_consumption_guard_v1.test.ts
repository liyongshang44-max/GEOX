import assert from "node:assert/strict";
import test from "node:test";

import { evaluateStage1PhysicalQcConsumptionV1 } from "./stage1_physical_qc_consumption_guard_v1.js";

function formalPayload(physical_qc: any) {
  return {
    formal_eligible: true,
    source_lane: "FORMAL_OPERATION",
    ingress_physical_qc: {
      schema_version: "ingress_physical_qc_snapshot_v1",
      physical_qc,
    },
  };
}

test("formal VALID/PASS measurement is eligible for Stage-1", () => {
  assert.deepEqual(
    evaluateStage1PhysicalQcConsumptionV1(
      formalPayload({ measurement_health: "VALID", physical_validity: "PASS" }),
    ),
    {
      eligible: true,
      mode: "QUALIFIED",
      reason_code: "STAGE1_PHYSICAL_QC_PASS",
    },
  );
});

test("formal impossible measurement is rejected before Stage-1", () => {
  const result = evaluateStage1PhysicalQcConsumptionV1(
    formalPayload({ measurement_health: "INVALID", physical_validity: "FAIL" }),
  );
  assert.equal(result.eligible, false);
  assert.equal(result.mode, "REJECTED_INVALID");
});

test("formal unqualified unit remains UNKNOWN and is rejected before Stage-1", () => {
  const result = evaluateStage1PhysicalQcConsumptionV1(
    formalPayload({ measurement_health: "UNKNOWN", physical_validity: "UNKNOWN" }),
  );
  assert.equal(result.eligible, false);
  assert.equal(result.mode, "REJECTED_UNKNOWN");
});

test("explicitly formal observation without ingress QC is rejected fail-closed", () => {
  const result = evaluateStage1PhysicalQcConsumptionV1({
    formal_eligible: true,
    source_lane: "FORMAL_OPERATION",
  });
  assert.deepEqual(result, {
    eligible: false,
    mode: "REJECTED_MISSING_QC",
    reason_code: "STAGE1_PHYSICAL_QC_MISSING",
  });
});

test("explicitly non-formal observation is rejected", () => {
  const result = evaluateStage1PhysicalQcConsumptionV1({
    formal_eligible: false,
    ingress_physical_qc: {
      schema_version: "ingress_physical_qc_snapshot_v1",
      physical_qc: { measurement_health: "VALID", physical_validity: "PASS" },
    },
  });
  assert.equal(result.eligible, false);
  assert.equal(result.mode, "REJECTED_NON_FORMAL");
});

test("pre-contract unclassified observation stays on an explicit legacy compatibility seam", () => {
  assert.deepEqual(evaluateStage1PhysicalQcConsumptionV1({}), {
    eligible: true,
    mode: "LEGACY_COMPATIBILITY",
    reason_code: "STAGE1_LEGACY_UNCLASSIFIED_COMPATIBILITY",
  });
});

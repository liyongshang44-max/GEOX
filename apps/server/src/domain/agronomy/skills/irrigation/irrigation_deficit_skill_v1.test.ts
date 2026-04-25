import test from "node:test";
import assert from "node:assert/strict";

import { runIrrigationDeficitSkillV1 } from "./irrigation_deficit_skill_v1.js";

test("irrigation_deficit_skill_v1: soil_moisture below threshold returns deficit and default irrigation amount", () => {
  const result = runIrrigationDeficitSkillV1({
    tenant_id: "tenantA",
    project_id: "projectA",
    group_id: "groupA",
    field_id: "fieldA",
    soil_moisture: 0.18,
    evidence_refs: ["obs:soil_moisture:1", "obs:soil_moisture:1"],
  });

  assert.equal(result.deficit_detected, true);
  assert.equal(result.deficit_level, "MEDIUM");
  assert.equal(result.recommended_amount, 25);
  assert.equal(result.unit, "L");
  assert.equal(result.confidence.level, "HIGH");
  assert.equal(result.confidence.basis, "measured");
  assert.deepEqual(result.evidence_refs, ["obs:soil_moisture:1"]);
});

test("irrigation_deficit_skill_v1: soil_moisture above threshold returns no deficit and zero amount", () => {
  const result = runIrrigationDeficitSkillV1({
    tenant_id: "tenantA",
    project_id: "projectA",
    group_id: "groupA",
    field_id: "fieldA",
    soil_moisture: 0.31,
  });

  assert.equal(result.deficit_detected, false);
  assert.equal(result.deficit_level, "LOW");
  assert.equal(result.recommended_amount, 0);
  assert.equal(result.unit, "L");
});

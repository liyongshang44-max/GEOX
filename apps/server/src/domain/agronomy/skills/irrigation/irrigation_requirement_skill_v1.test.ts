/* apps/server/src/domain/agronomy/skills/irrigation/irrigation_requirement_skill_v1.test.ts */
/* PR18K-C verifies deterministic irrigation requirement calculation without touching database or control actions. */

import test from "node:test";
import assert from "node:assert/strict";

import { runIrrigationRequirementSkillV1 } from "./irrigation_requirement_skill_v1.js";

test("irrigation_requirement_skill_v1: computes net and gross requirement from soil deficit, rain credit, and et0", () => {
  const result = runIrrigationRequirementSkillV1({
    tenant_id: "tenantA",
    project_id: "projectA",
    group_id: "groupA",
    field_id: "fieldA",
    soil_moisture: 0.18,
    target_soil_moisture: 0.22,
    root_zone_depth_mm: 300,
    rain_forecast_mm_72h: 2,
    et0_mm_72h: 6,
    crop_stage: "vegetative",
    application_efficiency: 0.85,
    evidence_refs: ["obs:soil_moisture:1", "obs:soil_moisture:1", "weather:forecast:1"],
  });

  assert.equal(result.requirement_detected, true);
  assert.equal(result.net_irrigation_requirement_mm, 16);
  assert.equal(result.gross_irrigation_requirement_mm, 18.824);
  assert.equal(result.unit, "mm");
  assert.equal(result.rain_credit_mm, 2);
  assert.equal(result.et0_adjustment_mm, 6);
  assert.equal(result.confidence.level, "HIGH");
  assert.equal(result.confidence.basis, "measured");
  assert.deepEqual(result.evidence_refs, ["obs:soil_moisture:1", "weather:forecast:1"]);
  assert.equal(result.calculation_trace.soil_water_deficit_mm, 12);
});

test("irrigation_requirement_skill_v1: rainfall can offset soil-water deficit when et0 is zero", () => {
  const result = runIrrigationRequirementSkillV1({
    tenant_id: "tenantA",
    project_id: "projectA",
    group_id: "groupA",
    field_id: "fieldA",
    soil_moisture: 0.2,
    target_soil_moisture: 0.22,
    root_zone_depth_mm: 300,
    rain_forecast_mm_72h: 30,
    et0_mm_72h: 0,
    crop_stage: "vegetative",
    application_efficiency: 0.85,
  });

  assert.equal(result.requirement_detected, false);
  assert.equal(result.net_irrigation_requirement_mm, 0);
  assert.equal(result.gross_irrigation_requirement_mm, 0);
  assert.equal(result.rain_credit_mm, 6);
  assert.equal(result.calculation_trace.soil_water_deficit_mm, 6);
});

test("irrigation_requirement_skill_v1: missing soil moisture produces low-confidence zero requirement", () => {
  const result = runIrrigationRequirementSkillV1({
    tenant_id: "tenantA",
    project_id: "projectA",
    group_id: "groupA",
    field_id: "fieldA",
    soil_moisture: null,
    rain_forecast_mm_72h: 0,
    et0_mm_72h: 6,
  });

  assert.equal(result.requirement_detected, false);
  assert.equal(result.net_irrigation_requirement_mm, 0);
  assert.equal(result.gross_irrigation_requirement_mm, 0);
  assert.equal(result.confidence.level, "LOW");
  assert.equal(result.confidence.basis, "assumed");
  assert.equal(result.confidence.reasons.includes("soil_moisture_missing_or_invalid"), true);
});

test("irrigation_requirement_skill_v1: percentage-style moisture input is normalized", () => {
  const result = runIrrigationRequirementSkillV1({
    tenant_id: "tenantA",
    project_id: "projectA",
    group_id: "groupA",
    field_id: "fieldA",
    soil_moisture: 18,
    target_soil_moisture: 22,
    root_zone_depth_mm: 300,
    rain_forecast_mm_72h: 2,
    et0_mm_72h: 6,
    crop_stage: "vegetative",
    application_efficiency: 1,
  });

  assert.equal(result.calculation_trace.normalized_soil_moisture, 0.18);
  assert.equal(result.calculation_trace.target_soil_moisture, 0.22);
  assert.equal(result.net_irrigation_requirement_mm, 16);
});

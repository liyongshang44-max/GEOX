/* apps/server/src/domain/judge/agronomy_judge_v2.test.ts */
/* PR18K-D verifies that Agronomy Judge gates irrigation requirement without creating tasks or writing facts. */

import test from "node:test";
import assert from "node:assert/strict";

import { evaluateAgronomyJudgeV2 } from "./agronomy_judge_v2.js";

test("agronomy_judge_v2: emits WATER_DEFICIT when irrigation requirement skill detects net requirement", () => {
  const result = evaluateAgronomyJudgeV2({
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
    evidence_refs: ["obs:soil_moisture:1", "weather:forecast:1"],
  });

  assert.equal(result.verdict, "WATER_DEFICIT");
  assert.equal(result.severity, "HIGH");
  assert.equal(result.reasons.includes("irrigation_requirement_detected"), true);
  assert.equal((result.outputs as any).requirement_skill_id, "irrigation_requirement_skill_v1");
  assert.equal((result.outputs as any).net_irrigation_requirement_mm, 16);
  assert.equal((result.outputs as any).gross_irrigation_requirement_mm, 18.824);
  assert.equal((result.outputs as any).rain_credit_mm, 2);
  assert.equal((result.outputs as any).et0_adjustment_mm, 6);
});

test("agronomy_judge_v2: emits PASS when rain offsets requirement and et0 is zero", () => {
  const result = evaluateAgronomyJudgeV2({
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

  assert.equal(result.verdict, "PASS");
  assert.equal(result.severity, "LOW");
  assert.deepEqual(result.reasons, ["no_irrigation_requirement"]);
  assert.equal((result.outputs as any).requirement_detected, false);
  assert.equal((result.outputs as any).net_irrigation_requirement_mm, 0);
});

test("agronomy_judge_v2: evidence judge block overrides irrigation requirement verdict", () => {
  const result = evaluateAgronomyJudgeV2({
    tenant_id: "tenantA",
    project_id: "projectA",
    group_id: "groupA",
    field_id: "fieldA",
    soil_moisture: 0.18,
    target_soil_moisture: 0.22,
    root_zone_depth_mm: 300,
    rain_forecast_mm_72h: 2,
    et0_mm_72h: 6,
    evidence_judge_verdict: "DEVICE_OFFLINE",
  });

  assert.equal(result.verdict, "BLOCKED");
  assert.equal(result.severity, "HIGH");
  assert.deepEqual(result.reasons, ["blocked_by_evidence_judge"]);
  assert.ok(result.confidence);
  assert.equal(result.confidence.level, "MEDIUM");
  assert.equal(result.confidence.basis, "assumed");
  assert.equal((result.outputs as any).requirement_skill_id, "irrigation_requirement_skill_v1");
});

import assert from "node:assert/strict";
import test from "node:test";

import { runIrrigationDeficitSkillV1 } from "../agronomy/skills/irrigation/irrigation_deficit_skill_v1.js";
import { runIrrigationRequirementSkillV1 } from "../agronomy/skills/irrigation/irrigation_requirement_skill_v1.js";
import {
  projectIrrigationDeficitCalculationResultV1,
  projectIrrigationRequirementCalculationResultV1,
} from "./irrigation_calculation_result_adapter_v1.js";

const scope = {
  tenant_id: "tenantA",
  project_id: "projectA",
  group_id: "groupA",
  field_id: "fieldA",
  season_id: "seasonA",
  zone_id: null,
};

const projectionContext = {
  calculation_id: "calc_001",
  scope,
  evidence_qualification_refs: ["evidence_qualification_v1:eq1"],
  context_snapshot_ref: "context_snapshot_v1:ctx1",
  crop_stage_state_ref: "qualified_crop_stage_state_v1:stage1",
  trace_refs: ["trace:legacy-calc1"],
  evaluated_at: "2026-08-27T13:30:00.000Z",
  decision_time: "2026-08-27T13:30:00.000Z",
};

test("B-06b requirement skill projects only calculator authority", () => {
  const legacy = runIrrigationRequirementSkillV1({
    tenant_id: "tenantA",
    project_id: "projectA",
    group_id: "groupA",
    field_id: "fieldA",
    soil_moisture: 0.18,
    target_soil_moisture: 0.22,
    root_zone_depth_mm: 300,
    rain_forecast_mm_72h: 2,
    et0_mm_72h: 4,
    crop_stage: "vegetative",
    application_efficiency: 0.85,
    evidence_refs: ["raw_fact:legacy1"],
  });

  const projected = projectIrrigationRequirementCalculationResultV1(legacy, projectionContext);

  assert.equal(projected.authority_state, "CALCULATION_ONLY");
  assert.equal(projected.calculator_ref, "irrigation_requirement_skill_v1");
  assert.equal(projected.outputs.some((item) => item.key === "gross_irrigation_requirement_mm"), true);
  assert.equal("proposed_action" in projected, false);
  assert.equal("decision_eligibility" in projected, false);
  assert.equal("approval_status" in projected, false);
  assert.equal("task_id" in projected, false);
});

test("B-06b legacy evidence refs are not upgraded to EvidenceQualification refs", () => {
  const legacy = runIrrigationRequirementSkillV1({
    tenant_id: "tenantA",
    project_id: "projectA",
    group_id: "groupA",
    field_id: "fieldA",
    soil_moisture: 0.18,
    evidence_refs: ["raw_fact:must_not_be_promoted"],
  });

  const projected = projectIrrigationRequirementCalculationResultV1(legacy, {
    ...projectionContext,
    evidence_qualification_refs: ["evidence_qualification_v1:explicit"],
  });

  assert.deepEqual(projected.evidence_qualification_refs, ["evidence_qualification_v1:explicit"]);
  assert.equal(projected.evidence_qualification_refs.includes("raw_fact:must_not_be_promoted"), false);
});

test("B-06b requirement defaults remain explicit assumptions rather than hidden authority", () => {
  const legacy = runIrrigationRequirementSkillV1({
    tenant_id: "tenantA",
    project_id: "projectA",
    group_id: "groupA",
    field_id: "fieldA",
    soil_moisture: 0.18,
  });

  const projected = projectIrrigationRequirementCalculationResultV1(legacy, projectionContext);

  assert.equal(projected.assumptions.includes("target_soil_moisture_defaulted"), true);
  assert.equal(projected.assumptions.includes("root_zone_depth_defaulted"), true);
  assert.equal(projected.limitations.includes("LEGACY_DEFAULTS_PRESERVED_AS_EXPLICIT_ASSUMPTIONS"), true);
});

test("B-06b missing soil moisture remains a limitation with high uncertainty", () => {
  const legacy = runIrrigationRequirementSkillV1({
    tenant_id: "tenantA",
    project_id: "projectA",
    group_id: "groupA",
    field_id: "fieldA",
    soil_moisture: null,
  });

  const projected = projectIrrigationRequirementCalculationResultV1(legacy, projectionContext);

  assert.equal(projected.uncertainty.level, "HIGH");
  assert.equal(projected.limitations.includes("SOIL_MOISTURE_MISSING_OR_INVALID"), true);
});

test("B-06b deficit skill does not promote legacy recommended_amount into CalculationResult", () => {
  const legacy = runIrrigationDeficitSkillV1({
    tenant_id: "tenantA",
    project_id: "projectA",
    group_id: "groupA",
    field_id: "fieldA",
    soil_moisture: 0.15,
    evidence_refs: ["raw_fact:legacy2"],
  });

  assert.equal(legacy.recommended_amount > 0, true);

  const projected = projectIrrigationDeficitCalculationResultV1(legacy, {
    ...projectionContext,
    calculation_id: "calc_deficit_001",
  });

  assert.equal(projected.authority_state, "CALCULATION_ONLY");
  assert.equal(projected.outputs.some((item) => item.key === "recommended_amount"), false);
  assert.equal(projected.outputs.some((item) => item.key === "deficit_detected"), true);
  assert.equal(projected.outputs.some((item) => item.key === "deficit_level"), true);
  assert.equal(projected.limitations.includes("LEGACY_RECOMMENDED_AMOUNT_NOT_PROMOTED_TO_CALCULATION_RESULT"), true);
});

test("B-06b invalid canonical timestamps fail closed", () => {
  const legacy = runIrrigationDeficitSkillV1({
    tenant_id: "tenantA",
    project_id: "projectA",
    group_id: "groupA",
    field_id: "fieldA",
    soil_moisture: 0.2,
  });

  assert.throws(
    () => projectIrrigationDeficitCalculationResultV1(legacy, {
      ...projectionContext,
      evaluated_at: "not-a-time",
    }),
  );
});

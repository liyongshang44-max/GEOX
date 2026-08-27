import assert from "node:assert/strict";
import test from "node:test";

import { projectPrescriptionActionSpecCandidateV1 } from "./prescription_action_spec_candidate_adapter_v1.js";

const scope = {
  tenant_id: "tenantA",
  project_id: "projectA",
  group_id: "groupA",
  field_id: "fieldA",
  season_id: "seasonA",
  zone_id: null,
};

const context = {
  candidate_id: "candidate_prescription_001",
  source_ref: "prescription_contract_v1:prc1",
  scope,
  evidence_qualification_refs: ["evidence_qualification_v1:eq1"],
  context_snapshot_ref: "context_snapshot_v1:ctx1",
  crop_stage_state_ref: "qualified_crop_stage_state_v1:stage1",
  calculation_result_refs: ["calculation_result_v1:calc1"],
  interpretation_refs: [],
  created_at: "2026-08-27T16:00:00.000Z",
  decision_time: "2026-08-27T15:59:00.000Z",
};

function prescription(overrides: Record<string, unknown> = {}) {
  return {
    prescription_id: "prc1",
    recommendation_id: "rec1",
    tenant_id: "tenantA",
    project_id: "projectA",
    group_id: "groupA",
    field_id: "fieldA",
    season_id: "seasonA",
    crop_id: "corn",
    zone_id: null,
    operation_type: "IRRIGATION",
    spatial_scope: {},
    timing_window: {
      recommended_start_at: "2026-08-27T17:00:00.000Z",
    },
    operation_amount: {
      amount: 12,
      unit: "mm",
      parameters: {
        weather_constraints: { rain_mm: 2 },
      },
    },
    device_requirements: {
      device_type: "irrigation_controller",
    },
    risk: { level: "MEDIUM", reasons: [] },
    evidence_refs: ["raw_fact:legacy1"],
    skill_trace_id: "trace1",
    approval_requirement: {
      required: true,
      role: "field_manager",
      auto_execute_allowed: false,
    },
    acceptance_conditions: {
      evidence_required: ["receipt"],
      required_execution_window: true,
    },
    status: "READY_FOR_APPROVAL",
    created_at: "2026-08-27T15:30:00.000Z",
    updated_at: "2026-08-27T15:30:00.000Z",
    ...overrides,
  };
}

test("B-06e READY_FOR_APPROVAL prescription remains candidate-only and not approved", () => {
  const projected = projectPrescriptionActionSpecCandidateV1(prescription(), context);

  assert.equal(projected.authority_state, "CANDIDATE_ONLY");
  assert.equal(projected.source_class, "LEGACY_PRESCRIPTION_ACTION_SPEC");
  assert.equal(projected.proposed_action.action_type, "IRRIGATE");
  assert.equal(projected.proposed_action.target.ref, "fieldA");
  assert.equal(projected.proposed_action.parameters_hint.amount, 12);
  assert.equal(projected.proposed_action.parameters_hint.unit, "mm");
  assert.equal(projected.proposed_action.action_spec_ref, context.source_ref);
  assert.equal(projected.limitations.includes("PRESCRIPTION_STATUS_DOES_NOT_GRANT_APPROVAL"), true);
  assert.equal(projected.limitations.includes("PRESCRIPTION_REQUIRES_APPROVAL_NOT_APPROVED"), true);
  assert.equal("approval_status" in projected, false);
  assert.equal("task_id" in projected, false);
});

test("B-06e DRAFT prescription is candidate-compatible but incomplete", () => {
  const projected = projectPrescriptionActionSpecCandidateV1(prescription({
    status: "DRAFT",
    operation_amount: { amount: 0, unit: "pending", parameters: {} },
  }), context);

  assert.equal(projected.authority_state, "CANDIDATE_ONLY");
  assert.equal("amount" in projected.proposed_action.parameters_hint, false);
  assert.equal(projected.limitations.includes("PRESCRIPTION_DRAFT_INCOMPLETE_ACTION_SPEC"), true);
  assert.equal(projected.limitations.includes("PRESCRIPTION_AMOUNT_INCOMPLETE_NOT_PROMOTED"), true);
});

test("B-06e downstream prescription statuses fail closed", () => {
  for (const status of [
    "APPROVAL_REQUESTED",
    "APPROVED",
    "TASK_CREATED",
    "REJECTED",
    "CANCELLED",
    "",
  ]) {
    assert.throws(
      () => projectPrescriptionActionSpecCandidateV1(prescription({ status }), context),
      /B06E_PRESCRIPTION_STATUS_NOT_PRE_APPROVAL/,
      status || "missing",
    );
  }
});

test("B-06e only explicit high-level action mappings are accepted", () => {
  const mappings = [
    ["IRRIGATION", "IRRIGATE"],
    ["FERTILIZATION", "FERTILIZE"],
    ["SPRAYING", "SPRAY"],
    ["INSPECTION", "INSPECT"],
  ] as const;

  for (const [operation_type, action_type] of mappings) {
    const projected = projectPrescriptionActionSpecCandidateV1(
      prescription({ prescription_id: "prc_" + operation_type, operation_type }),
      { ...context, candidate_id: "candidate_" + operation_type, source_ref: "prescription:" + operation_type },
    );
    assert.equal(projected.proposed_action.action_type, action_type);
  }

  for (const operation_type of ["SAMPLING", "OTHER", ""]) {
    assert.throws(
      () => projectPrescriptionActionSpecCandidateV1(prescription({ operation_type }), context),
      /B06E_UNSUPPORTED_PRESCRIPTION_OPERATION_TYPE/,
    );
  }
});

test("B-06e legacy evidence refs stay provenance-only", () => {
  const projected = projectPrescriptionActionSpecCandidateV1(prescription({
    evidence_refs: ["raw_fact:must_not_promote"],
  }), context);

  assert.deepEqual(projected.basis.evidence_qualification_refs, ["evidence_qualification_v1:eq1"]);
  assert.equal(projected.basis.evidence_qualification_refs.includes("raw_fact:must_not_promote"), false);
  assert.equal(projected.basis.legacy_source_refs.includes("raw_fact:must_not_promote"), true);
  assert.equal(projected.limitations.includes("LEGACY_EVIDENCE_REFS_NOT_PROMOTED_TO_CANONICAL_QUALIFICATION"), true);
});

test("B-06e timing/device/approval/acceptance metadata never becomes candidate parameters", () => {
  const projected = projectPrescriptionActionSpecCandidateV1(prescription(), context);
  const hint = projected.proposed_action.parameters_hint;

  assert.deepEqual(Object.keys(hint).sort(), ["amount", "unit"]);
  assert.equal("recommended_start_at" in hint, false);
  assert.equal("device_type" in hint, false);
  assert.equal("approval_required" in hint, false);
  assert.equal("required_execution_window" in hint, false);
  assert.equal(projected.limitations.includes("PRESCRIPTION_TIMING_DEVICE_APPROVAL_ACCEPTANCE_METADATA_NOT_PROMOTED"), true);
});

test("B-06e nested operation parameters are not promoted", () => {
  const projected = projectPrescriptionActionSpecCandidateV1(prescription(), context);

  assert.equal("weather_constraints" in projected.proposed_action.parameters_hint, false);
  assert.equal(projected.limitations.includes("LEGACY_NESTED_OPERATION_PARAMETERS_NOT_PROMOTED"), true);
});

test("B-06e auto-execute capability fails closed even before approval", () => {
  assert.throws(
    () => projectPrescriptionActionSpecCandidateV1(prescription({
      approval_requirement: {
        required: false,
        auto_execute_allowed: true,
      },
    }), context),
    /B06E_PRESCRIPTION_AUTO_EXECUTE_CAPABILITY_FORBIDDEN/,
  );
});

test("B-06e explicit downstream identities fail closed", () => {
  for (const extra of [
    { approval_request_id: "apr1" },
    { operation_plan_id: "opl1" },
    { act_task_id: "task1" },
    { receipt_fact_id: "receipt1" },
  ]) {
    assert.throws(
      () => projectPrescriptionActionSpecCandidateV1(prescription(extra), context),
      /B06E_PRESCRIPTION_ALREADY_CARRIES_DOWNSTREAM_ID/,
    );
  }
});

test("B-06e prescription scope mismatch or missing required scope fails closed", () => {
  assert.throws(
    () => projectPrescriptionActionSpecCandidateV1(prescription({ tenant_id: "tenantB" }), context),
    /B06E_PRESCRIPTION_SCOPE_MISMATCH:tenant_id/,
  );

  assert.throws(
    () => projectPrescriptionActionSpecCandidateV1(prescription({ field_id: "" }), context),
    /B06E_PRESCRIPTION_REQUIRED_SCOPE_MISSING:field_id/,
  );
});

test("B-06e approval-not-required still does not grant execution authority", () => {
  const projected = projectPrescriptionActionSpecCandidateV1(prescription({
    operation_type: "INSPECTION",
    approval_requirement: {
      required: false,
      auto_execute_allowed: false,
    },
  }), context);

  assert.equal(projected.authority_state, "CANDIDATE_ONLY");
  assert.equal(projected.proposed_action.action_type, "INSPECT");
  assert.equal(projected.limitations.includes("PRESCRIPTION_APPROVAL_NOT_REQUIRED_STILL_HAS_NO_EXECUTION_AUTHORITY"), true);
});

test("B-06e requires prescription identity", () => {
  assert.throws(
    () => projectPrescriptionActionSpecCandidateV1(prescription({ prescription_id: "" }), context),
    /B06E_PRESCRIPTION_ID_REQUIRED/,
  );
});

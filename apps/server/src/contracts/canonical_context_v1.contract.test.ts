import assert from "node:assert/strict";
import test from "node:test";

import {
  contextAssertionV1Schema,
  contextSnapshotV1Schema,
  qualifiedCropStageStateV1Schema,
} from "./canonical_context_v1.js";

const scope = {
  tenant_id: "tenantA",
  project_id: "projectA",
  group_id: "groupA",
  field_id: "fieldA",
  season_id: "seasonA",
  zone_id: null,
};

const now = "2026-08-27T09:50:00.000Z";

test("B-05a declared crop context is represented as ContextAssertion, not crop-stage state", () => {
  const parsed = contextAssertionV1Schema.parse({
    schema_version: "context_assertion_v1",
    assertion_id: "ctx_crop_001",
    scope,
    kind: "CROP_IDENTITY",
    value: "corn",
    source_ref: "field_program_v1:programA",
    source_class: "COMPATIBILITY_LEGACY",
    asserted_at: now,
    effective_at: null,
    limitations: ["B05A_CONTRACT_ONLY"],
    reason_codes: [],
  });

  assert.equal(parsed.kind, "CROP_IDENTITY");
  assert.equal(parsed.value, "corn");
});

test("B-05a ContextSnapshot cannot smuggle crop_stage as declared context authority", () => {
  const result = contextSnapshotV1Schema.safeParse({
    schema_version: "context_snapshot_v1",
    snapshot_id: "ctx_snapshot_001",
    scope,
    decision_time: now,
    assertions: [],
    limitations: ["B05A_CONTRACT_ONLY"],
    reason_codes: [],
    crop_stage: "seedling",
  });

  assert.equal(result.success, false);
});

test("B-05a UNKNOWN crop stage must remain null and ineligible", () => {
  const parsed = qualifiedCropStageStateV1Schema.parse({
    schema_version: "qualified_crop_stage_state_v1",
    state_id: "stage_unknown_001",
    scope,
    stage: null,
    authority_state: "UNKNOWN",
    source_class: "NONE",
    context_snapshot_ref: null,
    evidence_qualification_refs: [],
    derived_state_ref: null,
    evaluated_at: now,
    decision_time: now,
    decision_input_eligible: false,
    limitations: ["NO_QUALIFIED_STAGE_STATE"],
    reason_codes: ["CROP_STAGE_UNKNOWN"],
  });

  assert.equal(parsed.stage, null);
  assert.equal(parsed.decision_input_eligible, false);

  const fabricated = qualifiedCropStageStateV1Schema.safeParse({
    ...parsed,
    state_id: "stage_unknown_fabricated_seedling",
    stage: "seedling",
  });
  assert.equal(fabricated.success, false);
});

test("B-05a compatibility stage may exist but can never be canonical decision input", () => {
  const parsed = qualifiedCropStageStateV1Schema.parse({
    schema_version: "qualified_crop_stage_state_v1",
    state_id: "stage_compat_001",
    scope,
    stage: "seedling",
    authority_state: "COMPATIBILITY_NON_AUTHORITATIVE",
    source_class: "DAP_CALCULATOR",
    context_snapshot_ref: "ctx_snapshot_001",
    evidence_qualification_refs: [],
    derived_state_ref: null,
    evaluated_at: now,
    decision_time: now,
    decision_input_eligible: false,
    limitations: ["LEGACY_DAP_STAGE_COMPATIBILITY_ONLY"],
    reason_codes: ["NOT_CANONICAL_STAGE_AUTHORITY"],
  });

  assert.equal(parsed.stage, "seedling");
  assert.equal(parsed.decision_input_eligible, false);

  const escalated = qualifiedCropStageStateV1Schema.safeParse({
    ...parsed,
    state_id: "stage_compat_illegal_escalation",
    decision_input_eligible: true,
  });
  assert.equal(escalated.success, false);
});

test("B-05a TWIN_QUALIFIED representation requires typed derived/context provenance", () => {
  const missingDerived = qualifiedCropStageStateV1Schema.safeParse({
    schema_version: "qualified_crop_stage_state_v1",
    state_id: "stage_twin_missing_ref",
    scope,
    stage: "vegetative",
    authority_state: "TWIN_QUALIFIED",
    source_class: "TWIN_DERIVED_STATE",
    context_snapshot_ref: "ctx_snapshot_001",
    evidence_qualification_refs: ["evidence_qualification_v1:q1"],
    derived_state_ref: null,
    evaluated_at: now,
    decision_time: now,
    decision_input_eligible: true,
    limitations: [],
    reason_codes: [],
  });
  assert.equal(missingDerived.success, false);

  const valid = qualifiedCropStageStateV1Schema.parse({
    schema_version: "qualified_crop_stage_state_v1",
    state_id: "stage_twin_contract_shape",
    scope,
    stage: "vegetative",
    authority_state: "TWIN_QUALIFIED",
    source_class: "TWIN_DERIVED_STATE",
    context_snapshot_ref: "ctx_snapshot_001",
    evidence_qualification_refs: ["evidence_qualification_v1:q1"],
    derived_state_ref: "future_twin_state:state1",
    evaluated_at: now,
    decision_time: now,
    decision_input_eligible: true,
    limitations: ["B05A_SCHEMA_CAPABILITY_NOT_RUNTIME_AUTHORITY"],
    reason_codes: [],
  });
  assert.equal(valid.authority_state, "TWIN_QUALIFIED");
});

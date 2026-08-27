import assert from "node:assert/strict";
import test from "node:test";

import { projectRootZoneScenarioCandidateV1 } from "./root_zone_scenario_candidate_adapter_v1.js";

const scope = {
  tenant_id: "tenantA",
  project_id: "projectA",
  group_id: "groupA",
  field_id: "fieldA",
  season_id: "seasonA",
  zone_id: "zoneA",
};

const context = {
  candidate_id: "candidate_scenario_001",
  source_ref: "fact:decision_recommendation_v1:root-zone-rec1",
  scope,
  evidence_qualification_refs: ["evidence_qualification_v1:eq1"],
  context_snapshot_ref: "context_snapshot_v1:ctx1",
  crop_stage_state_ref: "qualified_crop_stage_state_v1:stage1",
  calculation_result_refs: ["calculation_result_v1:calc1"],
  interpretation_refs: ["scenario_interpretation:option1"],
  created_at: "2026-08-27T15:30:00.000Z",
  decision_time: "2026-08-27T15:29:00.000Z",
};

function source(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    version: "v1",
    recommendation_id: "rec1",
    tenant_id: "tenantA",
    project_id: "projectA",
    group_id: "groupA",
    field_id: "fieldA",
    zone_id: "zoneA",
    source: "ROOT_ZONE_SCENARIO_SELECTION",
    source_scenario_set_id: "scenario_set_1",
    source_option_id: "IRRIGATE_20MM_DAY0",
    source_forecast_id: "forecast_1",
    source_submission_id: "submission_1",
    status: "CANDIDATE",
    human_approval_required: true,
    no_direct_execution: true,
    approval_created: false,
    operation_plan_created: false,
    task_created: false,
    dispatch_created: false,
    roi_created: false,
    field_memory_created: false,
    recommendation_kind: "IRRIGATION_CANDIDATE_FROM_SCENARIO",
    proposed_action: {
      action_type: "IRRIGATE",
      total_irrigation_mm: 20,
      total_effective_irrigation_mm: 17,
      timing: "DAY0",
    },
    evidence_refs: ["legacy:forecast1", "legacy:state1"],
    derivation: {
      scenario_derived: true,
      scenario_layer: "ROOT_ZONE_IRRIGATION_SCENARIO_SET_V1",
      no_direct_execution: true,
      requires_human_approval: true,
      auto_selected: false,
    },
    quality: {
      selected_option_quality_status: "COMPARABLE",
      evidence_quality_blocking: false,
    },
    created_at: "2026-08-27T15:20:00.000Z",
    ...overrides,
  };
}

test("B-06e root-zone scenario recommendation projects as candidate-only", () => {
  const projected = projectRootZoneScenarioCandidateV1(source(), context);

  assert.equal(projected.authority_state, "CANDIDATE_ONLY");
  assert.equal(projected.source_class, "LEGACY_RECOMMENDATION");
  assert.equal(projected.proposed_action.action_type, "IRRIGATE");
  assert.equal(projected.proposed_action.target.kind, "zone");
  assert.equal(projected.proposed_action.target.ref, "zoneA");
  assert.equal(projected.proposed_action.parameters_hint.irrigation_mm, 20);
  assert.equal(projected.proposed_action.parameters_hint.effective_irrigation_mm, 17);
  assert.equal(projected.proposed_action.parameters_hint.timing, "DAY0");
  assert.equal("approval_status" in projected, false);
  assert.equal("operation_plan_id" in projected, false);
  assert.equal("task_id" in projected, false);
});

test("B-06e delayed irrigation preserves explicit legacy candidate action", () => {
  const projected = projectRootZoneScenarioCandidateV1(source({
    source_option_id: "DELAY_3_DAYS_THEN_IRRIGATE_20MM",
    proposed_action: {
      action_type: "DELAYED_IRRIGATION",
      total_irrigation_mm: 20,
      total_effective_irrigation_mm: 17,
      timing: "DAY3",
    },
  }), context);

  assert.equal(projected.proposed_action.action_type, "DELAYED_IRRIGATION");
  assert.equal(projected.proposed_action.parameters_hint.timing, "DAY3");
});

test("B-06e legacy evidence refs are not promoted into canonical qualification refs", () => {
  const projected = projectRootZoneScenarioCandidateV1(source(), context);

  assert.deepEqual(projected.basis.evidence_qualification_refs, ["evidence_qualification_v1:eq1"]);
  assert.equal(projected.basis.evidence_qualification_refs.includes("legacy:forecast1"), false);
  assert.equal(
    projected.limitations.includes("LEGACY_SCENARIO_EVIDENCE_REFS_NOT_PROMOTED_TO_CANONICAL_QUALIFICATION"),
    true,
  );
});

test("B-06e downstream-created flags fail closed", () => {
  for (const key of [
    "approval_created",
    "operation_plan_created",
    "task_created",
    "dispatch_created",
    "roi_created",
    "field_memory_created",
  ]) {
    assert.throws(
      () => projectRootZoneScenarioCandidateV1(source({ [key]: true }), context),
      new RegExp("B06E_DOWNSTREAM_FLAG_MUST_BE_FALSE:" + key),
    );
  }
});

test("B-06e actionless ordinary scenario recommendation cannot be fabricated into CandidateDecision", () => {
  assert.throws(
    () => projectRootZoneScenarioCandidateV1({
      recommendation_id: "rec-actionless",
      tenant_id: "tenantA",
      project_id: "projectA",
      group_id: "groupA",
      field_id: "fieldA",
      zone_id: "zoneA",
      source: "ROOT_ZONE_SCENARIO_SELECTION",
      source_scenario_set_id: "scenario_set_1",
      source_option_id: "option_1",
      source_forecast_id: "forecast_1",
      source_submission_id: "submission_1",
      status: "CANDIDATE",
      human_approval_required: true,
      no_direct_execution: true,
      approval_created: false,
      operation_plan_created: false,
      task_created: false,
      dispatch_created: false,
      roi_created: false,
      field_memory_created: false,
      recommendation_kind: "IRRIGATION_CANDIDATE_FROM_SCENARIO",
      evidence_refs: ["legacy:e1"],
      derivation: {
        scenario_derived: true,
        no_direct_execution: true,
        requires_human_approval: true,
        auto_selected: false,
      },
      quality: {
        selected_option_quality_status: "COMPARABLE",
        evidence_quality_blocking: false,
      },
    }, context),
    /B06E_PROPOSED_ACTION_REQUIRED/,
  );
});

test("B-06e source scope mismatch fails closed", () => {
  assert.throws(
    () => projectRootZoneScenarioCandidateV1(source({ zone_id: "zoneB" }), context),
    /B06E_SOURCE_SCOPE_MISMATCH:zone_id/,
  );
});

test("B-06e invalid candidate timing/action pairing fails closed", () => {
  assert.throws(
    () => projectRootZoneScenarioCandidateV1(source({
      proposed_action: {
        action_type: "IRRIGATE",
        total_irrigation_mm: 20,
        total_effective_irrigation_mm: 17,
        timing: "DAY3",
      },
    }), context),
    /B06E_ACTION_TIMING_MISMATCH/,
  );
});

test("B-06e missing canonical zone scope fails closed", () => {
  assert.throws(
    () => projectRootZoneScenarioCandidateV1(source(), {
      ...context,
      scope: { ...scope, zone_id: null },
    }),
    /B06E_SOURCE_SCOPE_MISMATCH:zone_id/,
  );
});

test("B-06e canonical timestamps and provenance remain caller-explicit", () => {
  const projected = projectRootZoneScenarioCandidateV1(source({
    created_at: "2026-08-27T13:00:00.000Z",
  }), {
    ...context,
    created_at: "2026-08-27T15:30:00.000Z",
    evidence_qualification_refs: [],
    context_snapshot_ref: null,
    crop_stage_state_ref: null,
    calculation_result_refs: [],
  });

  assert.equal(projected.created_at, "2026-08-27T15:30:00.000Z");
  assert.deepEqual(projected.basis.evidence_qualification_refs, []);
  assert.equal(projected.basis.context_snapshot_ref, null);
  assert.equal(projected.basis.crop_stage_state_ref, null);
  assert.deepEqual(projected.basis.calculation_result_refs, []);
  assert.equal(projected.confidence, null);
});

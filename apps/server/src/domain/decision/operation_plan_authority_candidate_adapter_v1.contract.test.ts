import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyOperationPlanAuthorityV1,
  projectLegacyOperationPlanProposalCandidateV1,
} from "./operation_plan_authority_candidate_adapter_v1.js";

const scope = {
  tenant_id: "tenantA",
  project_id: "projectA",
  group_id: "groupA",
  field_id: "fieldA",
  season_id: "seasonA",
  zone_id: null,
};

const context = {
  candidate_id: "candidate_plan_001",
  source_ref: "fact:operation_plan:opl_agent_001",
  scope,
  evidence_qualification_refs: ["evidence_qualification_v1:eq1"],
  context_snapshot_ref: "context_snapshot_v1:ctx1",
  crop_stage_state_ref: "qualified_crop_stage_state_v1:stage1",
  calculation_result_refs: ["calculation_result_v1:calc1"],
  interpretation_refs: ["agronomy_interpretation_v1:int1"],
  created_at: "2026-08-27T16:30:00.000Z",
  decision_time: "2026-08-27T16:29:00.000Z",
};

function agentPlan(overrides: Record<string, unknown> = {}) {
  return {
    fact_id: "fact_plan_1",
    source: "jobs/agronomy_agent",
    record_json: {
      type: "operation_plan_v1",
      payload: {
        tenant_id: "tenantA",
        project_id: "projectA",
        group_id: "groupA",
        operation_plan_id: "opl_agent_001",
        recommendation_id: "rec_001",
        program_id: "program_001",
        field_id: "fieldA",
        season_id: "seasonA",
        crop_code: "corn",
        crop_stage: "VT",
        rule_id: "rule_001",
        reason_codes: ["SOIL_DEFICIT"],
        expected_effect: { soil_moisture_delta: 0.04 },
        device_id: "device_001",
        action_type: "IRRIGATE",
        status: "CREATED",
        created_ts: 1787850000000,
        updated_ts: 1787850000000,
        ...overrides,
      },
    },
  };
}

function agentTransition(overrides: Record<string, unknown> = {}) {
  return {
    fact_id: "fact_transition_1",
    source: "jobs/agronomy_agent",
    record_json: {
      type: "operation_plan_transition_v1",
      payload: {
        tenant_id: "tenantA",
        project_id: "projectA",
        group_id: "groupA",
        operation_plan_id: "opl_agent_001",
        status: "CREATED",
        trigger: "agronomy_agent_auto_create",
        created_ts: 1787850000000,
        ...overrides,
      },
    },
  };
}

test("B-06f exact Agronomy Agent dual provenance classifies as grandfathered direct plan authority", () => {
  const result = classifyOperationPlanAuthorityV1(agentPlan(), agentTransition());

  assert.equal(result.classification, "GRANDFATHERED_DIRECT_PLAN_AUTHORITY");
  assert.equal(result.candidate_compatible, true);
  assert.equal(result.operation_plan_id, "opl_agent_001");
  assert.equal(result.transition_trigger, "agronomy_agent_auto_create");
});

test("B-06f grandfathered plan projects only to CandidateDecision view", () => {
  const projected = projectLegacyOperationPlanProposalCandidateV1(agentPlan(), agentTransition(), context);

  assert.equal(projected.authority_state, "CANDIDATE_ONLY");
  assert.equal(projected.source_class, "LEGACY_OPERATION_PLAN_PROPOSAL");
  assert.equal(projected.proposed_action.action_type, "IRRIGATE");
  assert.equal(projected.proposed_action.target.ref, "fieldA");
  assert.deepEqual(projected.proposed_action.parameters_hint, {});
  assert.equal(projected.reasons.includes("SOIL_DEFICIT"), true);
  assert.equal(projected.limitations.includes("SOURCE_OPERATION_PLAN_RETAINS_HISTORICAL_PLAN_AUTHORITY_UNTIL_B09"), true);
  assert.equal("approval_request_id" in projected, false);
  assert.equal("task_id" in projected, false);
});

test("B-06f missing or inexact Agronomy Agent transition provenance fails closed", () => {
  assert.equal(
    classifyOperationPlanAuthorityV1(agentPlan(), null).classification,
    "UNKNOWN_PLAN_AUTHORITY",
  );

  for (const transition of [
    agentTransition({ trigger: "manual" }),
    agentTransition({ operation_plan_id: "opl_other" }),
    { ...agentTransition(), source: "another_source" },
  ]) {
    const result = classifyOperationPlanAuthorityV1(agentPlan(), transition as any);
    assert.equal(result.classification, "UNKNOWN_PLAN_AUTHORITY");
    assert.equal(result.candidate_compatible, false);
    assert.throws(
      () => projectLegacyOperationPlanProposalCandidateV1(agentPlan(), transition as any, context),
      /B06F_OPERATION_PLAN_NOT_CANDIDATE_COMPATIBLE/,
    );
  }
});

test("B-06f approval-derived CREATED plans never project back to CandidateDecision", () => {
  const h54Plan = agentPlan({
    approval_request_id: "apr_001",
    approval_decision: "APPROVE",
    approval_decision_fact_id: "fact_apd_001",
  });
  const result = classifyOperationPlanAuthorityV1(h54Plan, agentTransition());

  assert.equal(result.classification, "APPROVAL_DERIVED_PLAN_AUTHORITY");
  assert.equal(result.candidate_compatible, false);
  assert.throws(
    () => projectLegacyOperationPlanProposalCandidateV1(h54Plan, agentTransition(), context),
    /B06F_OPERATION_PLAN_NOT_CANDIDATE_COMPATIBLE:APPROVAL_DERIVED_PLAN_AUTHORITY/,
  );

  const controlAoActPlan = {
    ...agentPlan({ approval_request_id: "apr_002" }),
    source: "api/v1/approvals/approve",
  };
  assert.equal(
    classifyOperationPlanAuthorityV1(controlAoActPlan as any, {
      ...agentTransition({ trigger: "approval_operation_plan_auto_create", approval_request_id: "apr_002" }),
      source: "api/v1/approvals/approve",
    } as any).classification,
    "APPROVAL_DERIVED_PLAN_AUTHORITY",
  );
});

test("B-06f downstream status or task/receipt lineage is never candidate compatible", () => {
  for (const overrides of [
    { status: "APPROVED" },
    { status: "READY" },
    { status: "DISPATCHED" },
    { act_task_id: "task_1" },
    { receipt_fact_id: "receipt_1" },
  ]) {
    const result = classifyOperationPlanAuthorityV1(agentPlan(overrides), agentTransition());
    assert.equal(result.classification, "DOWNSTREAM_PLAN_AUTHORITY");
    assert.equal(result.candidate_compatible, false);
  }
});

test("B-06f unknown CREATED plan sources remain unknown rather than guessed", () => {
  for (const source of [
    "decision_engine_v1",
    "flight_table_operation_v1",
    "operator_approval_decision_operation_plan_api",
    "unknown",
  ]) {
    const plan = { ...agentPlan(), source };
    const result = classifyOperationPlanAuthorityV1(plan as any, agentTransition());
    assert.equal(result.classification, "UNKNOWN_PLAN_AUTHORITY");
    assert.equal(result.candidate_compatible, false);
  }
});

test("B-06f scope mismatch or missing required scope fails closed", () => {
  assert.throws(
    () => projectLegacyOperationPlanProposalCandidateV1(
      agentPlan({ tenant_id: "tenantB" }),
      agentTransition(),
      context,
    ),
    /B06F_OPERATION_PLAN_SCOPE_MISMATCH:tenant_id/,
  );

  assert.throws(
    () => projectLegacyOperationPlanProposalCandidateV1(
      agentPlan({ field_id: "" }),
      agentTransition(),
      context,
    ),
    /B06F_OPERATION_PLAN_REQUIRED_SCOPE_MISSING:field_id/,
  );
});

test("B-06f only existing Agronomy Agent high-level action types are accepted", () => {
  for (const action_type of ["IRRIGATE", "FERTILIZE", "SPRAY", "INSPECT"]) {
    const projected = projectLegacyOperationPlanProposalCandidateV1(
      agentPlan({ action_type }),
      agentTransition(),
      {
        ...context,
        candidate_id: "candidate_" + action_type,
        source_ref: "fact:plan:" + action_type,
      },
    );
    assert.equal(projected.proposed_action.action_type, action_type);
  }

  for (const action_type of ["EXECUTE", "OTHER", ""]) {
    assert.throws(
      () => projectLegacyOperationPlanProposalCandidateV1(
        agentPlan({ action_type }),
        agentTransition(),
        context,
      ),
      /B06F_OPERATION_PLAN_ACTION_NOT_CANONICAL_CANDIDATE/,
    );
  }
});

test("B-06f device and expected-effect plan fields do not become candidate parameters", () => {
  const projected = projectLegacyOperationPlanProposalCandidateV1(agentPlan(), agentTransition(), context);

  assert.deepEqual(projected.proposed_action.parameters_hint, {});
  assert.equal(projected.proposed_action.action_spec_ref, null);
  assert.equal(projected.limitations.includes("LEGACY_OPERATION_PLAN_DEVICE_EXPECTED_EFFECT_NOT_PROMOTED"), true);
});

test("B-06f canonical evidence refs remain explicit and legacy plan provenance stays legacy", () => {
  const projected = projectLegacyOperationPlanProposalCandidateV1(agentPlan(), agentTransition(), context);

  assert.deepEqual(projected.basis.evidence_qualification_refs, ["evidence_qualification_v1:eq1"]);
  assert.equal(projected.basis.legacy_source_refs.includes("recommendation:rec_001"), true);
  assert.equal(projected.basis.legacy_source_refs.includes("fact:fact_plan_1"), true);
  assert.equal(projected.basis.legacy_source_refs.includes("fact:fact_transition_1"), true);
  assert.equal(projected.basis.legacy_source_refs.includes("rule:rule_001"), true);
});

test("B-06f transition approval or downstream lineage overrides Agronomy Agent provenance", () => {
  assert.equal(
    classifyOperationPlanAuthorityV1(
      agentPlan(),
      agentTransition({ approval_request_id: "apr_1" }),
    ).classification,
    "APPROVAL_DERIVED_PLAN_AUTHORITY",
  );

  assert.equal(
    classifyOperationPlanAuthorityV1(
      agentPlan(),
      agentTransition({ act_task_id: "task_1" }),
    ).classification,
    "DOWNSTREAM_PLAN_AUTHORITY",
  );
});

test("B-06f canonical created_at is explicit and not sourced from legacy created_ts", () => {
  const projected = projectLegacyOperationPlanProposalCandidateV1(
    agentPlan({ created_ts: 1 }),
    agentTransition({ created_ts: 2 }),
    context,
  );

  assert.equal(projected.created_at, context.created_at);
  assert.equal(projected.limitations.includes("LEGACY_CREATED_TS_NOT_USED_AS_CANONICAL_CREATED_AT"), true);
});

test("B-06f requires recommendation lineage on candidate-compatible Agronomy Agent plan", () => {
  assert.throws(
    () => projectLegacyOperationPlanProposalCandidateV1(
      agentPlan({ recommendation_id: "" }),
      agentTransition(),
      context,
    ),
    /B06F_AGRONOMY_AGENT_RECOMMENDATION_ID_REQUIRED/,
  );
});

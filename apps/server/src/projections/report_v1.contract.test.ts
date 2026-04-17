import test from "node:test";
import assert from "node:assert/strict";

import { projectOperationReportV1 } from "./report_v1.js";
import type { OperationStateV1 } from "./operation_state_v1.js";

function buildState(finalStatus: OperationStateV1["final_status"]): OperationStateV1 {
  return {
    operation_id: "op-1",
    operation_plan_id: "plan-1",
    recommendation_id: null,
    approval_id: null,
    act_task_id: null,
    receipt_id: null,
    program_id: null,
    approval_request_id: null,
    approval_decision_id: null,
    task_id: null,
    device_id: null,
    field_id: "field-1",
    season_id: null,
    crop_code: null,
    crop_stage: null,
    rule_id: null,
    skill_id: null,
    rule_hit: [],
    reason_codes: [],
    action_type: null,
    before_metrics: {},
    after_metrics: {},
    expected_effect: null,
    risk_if_not_execute: null,
    actual_effect: null,
    dispatch_status: "PENDING",
    receipt_status: "PENDING",
    acceptance: { status: "PENDING", missing: [] },
    final_status: finalStatus,
    invalid_reason: null,
    last_event_ts: Date.now(),
    timeline: [],
    manual_fallback: null,
    skill_trace: {
      crop_skill: { skill_id: null, version: null, run_id: null, result_status: null, error_code: null },
      agronomy_skill: { skill_id: null, version: null, run_id: null, result_status: null, error_code: null },
      device_skill: { skill_id: null, version: null, run_id: null, result_status: null, error_code: null },
      acceptance_skill: { skill_id: null, version: null, run_id: null, result_status: null, error_code: null },
    },
  };
}

test("report v1 contract: risk.level and risk.reasons always exist", () => {
  const output = projectOperationReportV1({
    tenant: { tenant_id: "t1", project_id: "p1", group_id: "g1" },
    operation_plan_id: "plan-1",
    operation_state: buildState("PENDING_ACCEPTANCE"),
    evidence_bundle: {},
    acceptance: { verdict: null, missing_evidence: undefined, generated_at: undefined, status: "PENDING" },
    receipt: { execution_finished_at: new Date(Date.now() - 31 * 60 * 1000).toISOString() },
    cost: {},
    sla: {},
  });

  assert.ok(["LOW", "MEDIUM", "HIGH"].includes(output.risk.level));
  assert.ok(Array.isArray(output.risk.reasons));
  assert.notEqual(output.risk.reasons, undefined);
  assert.equal(output.cost.estimated_total, 0);
  assert.equal(output.cost.actual_total, undefined);
  assert.equal(output.cost.estimated_water_cost, undefined);
});

test("report v1 contract: workflow exposes linked_alert_ids", () => {
  const output = projectOperationReportV1({
    tenant: { tenant_id: "t1", project_id: "p1", group_id: "g1" },
    operation_plan_id: "plan-1",
    operation_state: buildState("SUCCESS"),
    evidence_bundle: {},
    acceptance: null,
    receipt: null,
    cost: {},
    sla: {},
    operation_workflow: {
      owner_actor_id: "actor-1",
      owner_name: "owner",
      last_note: "note",
      updated_at: Date.UTC(2026, 0, 1, 0, 0, 0),
      updated_by: "actor-1",
      linked_alert_ids: ["a-1", "a-2"],
    },
  });
  assert.deepEqual(output.workflow.linked_alert_ids, ["a-1", "a-2"]);
});

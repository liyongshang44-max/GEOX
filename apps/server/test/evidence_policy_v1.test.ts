import test from "node:test";
import assert from "node:assert/strict";
import { evaluateEvidence } from "../src/domain/acceptance/evidence_policy";
import { projectOperationStateFromFacts, type OperationProjectionFactRow } from "../src/projections/operation_state_v1";

function fact(type: string, payload: any, occurred_at: string, fact_id: string): OperationProjectionFactRow {
  return { fact_id, occurred_at, record_json: { type, payload } } as OperationProjectionFactRow;
}

test("evaluateEvidence: Case A only sim_trace", () => {
  const ev = evaluateEvidence({
    artifacts: [],
    media: [],
    metrics: [],
    logs: [{ kind: "sim_trace" }],
  });
  assert.equal(ev.has_formal_evidence, false);
  assert.equal(ev.has_only_sim_trace, true);
  assert.equal(ev.reason, "only_sim_trace");

  const out = projectOperationStateFromFacts([
    fact("operation_plan_v1", { operation_plan_id: "op_a", act_task_id: "task_a" }, "2026-03-31T01:00:00.000Z", "f1"),
    fact("ao_act_receipt_v1", {
      act_task_id: "task_a",
      status: "executed",
      logs_refs: [{ kind: "sim_trace" }],
      evidence_artifact_ids: ["artifact_id_only_should_not_count"],
    }, "2026-03-31T01:01:00.000Z", "f2"),
  ]);
  assert.equal(out[0].final_status, "INVALID_EXECUTION");
  assert.deepEqual(out[0].acceptance.missing, ["evidence_invalid"]);
});

test("evaluateEvidence: Case B device formal evidence with metrics", () => {
  const ev = evaluateEvidence({
    metrics: [{ kind: "flow_rate" }],
    artifacts: [],
    media: [],
    logs: [],
  });
  assert.equal(ev.has_formal_evidence, true);
  assert.equal(ev.reason, "formal_evidence");

  const out = projectOperationStateFromFacts([
    fact("operation_plan_v1", { operation_plan_id: "op_b", act_task_id: "task_b" }, "2026-03-31T01:00:00.000Z", "f3"),
    fact("ao_act_receipt_v1", { act_task_id: "task_b", status: "executed", metrics: [{ value: 1 }] }, "2026-03-31T01:01:00.000Z", "f4"),
  ]);
  assert.equal(out[0].final_status, "PENDING_ACCEPTANCE");
});

test("evaluateEvidence: Case C human formal evidence with media/artifacts", () => {
  const ev = evaluateEvidence({
    artifacts: [{ kind: "photo_upload" }],
    media: [{ kind: "photo" }],
    logs: [],
    metrics: [],
  });
  assert.equal(ev.has_formal_evidence, true);
  assert.equal(ev.reason, "formal_evidence");

  const out = projectOperationStateFromFacts([
    fact("operation_plan_v1", { operation_plan_id: "op_c", act_task_id: "task_c" }, "2026-03-31T01:00:00.000Z", "f5"),
    fact("ao_act_receipt_v1", { act_task_id: "task_c", status: "executed", evidence_artifact_ids: ["artifact_1"] }, "2026-03-31T01:01:00.000Z", "f6"),
    fact("evidence_artifact_v1", { operation_plan_id: "op_c", act_task_id: "task_c", kind: "photo" }, "2026-03-31T01:01:30.000Z", "f7"),
  ]);
  assert.equal(out[0].final_status, "PENDING_ACCEPTANCE");
});

test("evaluateEvidence: Case D executor success runtime_log is formal evidence", () => {
  const ev = evaluateEvidence({
    artifacts: [],
    media: [],
    metrics: [],
    logs: [{ kind: "runtime_log" }],
  });
  assert.equal(ev.has_formal_evidence, true);
  assert.equal(ev.reason, "formal_evidence");

  const out = projectOperationStateFromFacts([
    fact("operation_plan_v1", { operation_plan_id: "op_d", act_task_id: "task_d" }, "2026-03-31T01:00:00.000Z", "f8"),
    fact("ao_act_receipt_v1", {
      act_task_id: "task_d",
      status: "executed",
      logs_refs: [{ kind: "runtime_log", ref: "executor://run_dispatch_once/task_d" }],
    }, "2026-03-31T01:01:00.000Z", "f9"),
  ]);
  assert.equal(out[0].final_status, "PENDING_ACCEPTANCE");
});

test("evaluateEvidence: formal evidence can come from formal log kinds only", () => {
  const formalLogKinds = ["dispatch_ack", "valve_open_confirmation", "water_delivery_receipt"];

  for (const kind of formalLogKinds) {
    const ev = evaluateEvidence({
      artifacts: [],
      media: [],
      metrics: [],
      logs: [{ kind }],
    });
    assert.equal(ev.has_formal_evidence, true);
    assert.equal(ev.reason, "formal_evidence");
  }
});

test("operation_state_v1: executed receipt with formal log kinds should not become INVALID_EXECUTION", () => {
  const formalLogKinds = ["dispatch_ack", "valve_open_confirmation", "water_delivery_receipt"];

  for (const [index, kind] of formalLogKinds.entries()) {
    const opId = `op_smoke_${index}`;
    const taskId = `task_smoke_${index}`;
    const out = projectOperationStateFromFacts([
      fact("operation_plan_v1", { operation_plan_id: opId, act_task_id: taskId }, "2026-03-31T01:00:00.000Z", `sf_plan_${index}`),
      fact("ao_act_receipt_v1", {
        act_task_id: taskId,
        status: "executed",
        logs_refs: [{ kind, ref: `executor://success_smoke/${taskId}` }],
      }, "2026-03-31T01:01:00.000Z", `sf_receipt_${index}`),
    ]);
    assert.equal(out[0].final_status, "PENDING_ACCEPTANCE");
    assert.equal(out[0].invalid_reason, null);
  }
});

test("final_status: executed receipt + pending acceptance overrides transition FAILED when execution is valid", () => {
  const out = projectOperationStateFromFacts([
    fact("operation_plan_v1", { operation_plan_id: "op_e", act_task_id: "task_e" }, "2026-03-31T01:00:00.000Z", "f10"),
    fact("operation_plan_transition_v1", { operation_plan_id: "op_e", status: "FAILED" }, "2026-03-31T01:00:30.000Z", "f11"),
    fact("ao_act_receipt_v1", {
      act_task_id: "task_e",
      status: "executed",
      metrics: [{ kind: "flow_rate", value: 1 }],
    }, "2026-03-31T01:01:00.000Z", "f12"),
    fact("acceptance_result_v1", {
      operation_plan_id: "op_e",
      act_task_id: "task_e",
      verdict: "PENDING",
    }, "2026-03-31T01:01:30.000Z", "f13"),
  ]);

  assert.equal(out[0].invalid_reason, null);
  assert.equal(out[0].acceptance.status, "PENDING");
  assert.equal(out[0].final_status, "PENDING_ACCEPTANCE");
});

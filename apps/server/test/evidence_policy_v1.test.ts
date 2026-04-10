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

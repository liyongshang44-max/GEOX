import test from "node:test";
import assert from "node:assert/strict";
import { projectProgramTimelineFromFacts, type ProgramTimelineEventV1 } from "../src/projections/program_timeline_v1";

type FactRow = { fact_id: string; occurred_at: string; record_json: any };

function fact(type: string, payload: any, occurred_at: string, fact_id: string): FactRow {
  return { fact_id, occurred_at, record_json: { type, payload } };
}

test("projects full program timeline chain and required event types", () => {
  const rows: FactRow[] = [
    fact("field_program_v1", { program_id: "prg_1", field_id: "f_1", season_id: "s_1", status: "ACTIVE", crop_code: "rice", created_ts: 1000 }, "2026-03-20T10:00:00.000Z", "fp1"),
    fact("decision_recommendation_v1", { program_id: "prg_1", recommendation_id: "rec_1", created_ts: 2000, status: "PROPOSED" }, "2026-03-20T10:01:00.000Z", "r1"),
    fact("operation_plan_v1", { program_id: "prg_1", operation_plan_id: "op_1", recommendation_id: "rec_1", created_ts: 3000, status: "CREATED" }, "2026-03-20T10:02:00.000Z", "op1"),
    fact("ao_act_task_v0", { program_id: "prg_1", act_task_id: "task_1", operation_plan_id: "op_1", created_ts: 4000, action_type: "IRRIGATE" }, "2026-03-20T10:03:00.000Z", "t1"),
    fact("ao_act_receipt_v1", { act_task_id: "task_1", receipt_id: "rcp_1", created_ts: 5000, result_status: "OK" }, "2026-03-20T10:04:00.000Z", "rc1"),
    fact("acceptance_result_v1", { program_id: "prg_1", act_task_id: "task_1", result: "FAILED", evaluated_at_ts: 6000, score: 0.4, metrics: { in_field_ratio: 0.5, track_point_count: 10, track_points_in_field: 5 } }, "2026-03-20T10:05:00.000Z", "ac1")
  ];

  const out = projectProgramTimelineFromFacts({ program_id: "prg_1", rows });
  const types = new Set(out.map((x: ProgramTimelineEventV1) => x.type));
  assert.equal(types.has("program_created"), true);
  assert.equal(types.has("recommendation_created"), true);
  assert.equal(types.has("operation_plan_created"), true);
  assert.equal(types.has("task_dispatched"), true);
  assert.equal(types.has("receipt_received"), true);
  assert.equal(types.has("acceptance_evaluated"), true);
  assert.equal(types.has("spatial_acceptance_updated"), true);
  assert.equal(types.has("next_action_hint_updated"), true);

  const hintEvt = out.find((x) => x.type === "next_action_hint_updated");
  assert.equal(hintEvt?.payload?.kind, "CHECK_DEVICE_PATH_OR_BINDING");
});

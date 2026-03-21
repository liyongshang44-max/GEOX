import test from "node:test";
import assert from "node:assert/strict";
import { projectProgramPortfolioFromFacts, type ProgramPortfolioItemV1 } from "../src/projections/program_portfolio_v1";
import type { ProgramStateProjectionFactRow } from "../src/projections/program_state_v1";

function fact(type: string, payload: any, occurred_at: string, fact_id: string): ProgramStateProjectionFactRow {
  return { fact_id, occurred_at, record_json: { type, payload } };
}

test("projects a program portfolio list for multiple programs", () => {
  const rows: ProgramStateProjectionFactRow[] = [
    fact("field_program_v1", {
      tenant_id: "t1", project_id: "p1", group_id: "g1",
      program_id: "prg_1", field_id: "field_1", season_id: "s1", crop_code: "rice", status: "ACTIVE"
    }, "2026-03-20T10:00:00.000Z", "p1"),
    fact("operation_plan_v1", {
      tenant_id: "t1", project_id: "p1", group_id: "g1",
      program_id: "prg_1", operation_plan_id: "opl_1"
    }, "2026-03-20T10:02:00.000Z", "o1"),
    fact("ao_act_task_v0", {
      tenant_id: "t1", project_id: "p1", group_id: "g1",
      program_id: "prg_1", operation_plan_id: "opl_1", act_task_id: "task_1"
    }, "2026-03-20T10:03:00.000Z", "t1"),
    fact("acceptance_result_v1", {
      tenant_id: "t1", project_id: "p1", group_id: "g1",
      program_id: "prg_1", act_task_id: "task_1", result: "PASSED", score: 0.92,
      metrics: { in_field_ratio: 0.9, track_point_count: 10, track_points_in_field: 9 }
    }, "2026-03-20T10:04:00.000Z", "a1"),

    fact("field_program_v1", {
      tenant_id: "t1", project_id: "p1", group_id: "g1",
      program_id: "prg_2", field_id: "field_2", season_id: "s1", crop_code: "corn", status: "ACTIVE"
    }, "2026-03-20T10:01:00.000Z", "p2"),
    fact("acceptance_result_v1", {
      tenant_id: "t1", project_id: "p1", group_id: "g1",
      program_id: "prg_2", result: "FAILED", score: 0.4,
      metrics: { in_field_ratio: 0.45, track_point_count: 11, track_points_in_field: 5 }
    }, "2026-03-20T10:05:00.000Z", "a2")
  ];

  const out: ProgramPortfolioItemV1[] = projectProgramPortfolioFromFacts(rows);
  assert.equal(out.length, 2);
  assert.equal(out[0].program_id, "prg_2");
  assert.equal(out[0].latest_acceptance_result, "FAILED");
  assert.equal(out[0].execution_reliability, "AT_RISK");
  assert.equal(out[0].water_management, "OFF_TRACK");
  assert.equal(out[0].next_action_hint?.priority, "HIGH");

  const prg1 = out.find((x) => x.program_id === "prg_1");
  assert.ok(prg1);
  assert.equal(prg1?.pending_operation_plan_id, "opl_1");
  assert.equal(prg1?.pending_act_task_id, "task_1");
  assert.equal(prg1?.latest_acceptance_result, "PASSED");
});

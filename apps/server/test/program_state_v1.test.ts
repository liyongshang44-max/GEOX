import test from "node:test";
import assert from "node:assert/strict";
import { projectProgramStateFromFacts, type ProgramStateProjectionFactRow } from "../src/projections/program_state_v1";

function fact(type: string, payload: any, occurred_at: string, fact_id: string): ProgramStateProjectionFactRow {
  return { fact_id, occurred_at, record_json: { type, payload } };
}

test("projects dynamic program state with acceptance and spatial summary", () => {
  const rows: ProgramStateProjectionFactRow[] = [
    fact("field_program_v1", {
      tenant_id: "t1", project_id: "p1", group_id: "g1",
      program_id: "prg_1", field_id: "field_1", season_id: "season_1", crop_code: "tomato", status: "ACTIVE"
    }, "2026-03-20T10:00:00.000Z", "p1"),
    fact("decision_recommendation_v1", {
      tenant_id: "t1", project_id: "p1", group_id: "g1",
      program_id: "prg_1", recommendation_id: "rec_1", field_id: "field_1", season_id: "season_1"
    }, "2026-03-20T10:02:00.000Z", "r1"),
    fact("operation_plan_v1", {
      tenant_id: "t1", project_id: "p1", group_id: "g1",
      program_id: "prg_1", recommendation_id: "rec_1", operation_plan_id: "opl_1"
    }, "2026-03-20T10:03:00.000Z", "o1"),
    fact("ao_act_task_v0", {
      tenant_id: "t1", project_id: "p1", group_id: "g1",
      program_id: "prg_1", operation_plan_id: "opl_1", act_task_id: "task_1"
    }, "2026-03-20T10:04:00.000Z", "t1"),
    fact("acceptance_result_v1", {
      tenant_id: "t1", project_id: "p1", group_id: "g1",
      program_id: "prg_1", act_task_id: "task_1", result: "PASSED", score: 0.9,
      metrics: { in_field_ratio: 0.88, track_point_count: 20, track_points_in_field: 18 }
    }, "2026-03-20T10:05:00.000Z", "a1")
  ];

  const out = projectProgramStateFromFacts(rows);
  assert.equal(out.length, 1);
  assert.equal(out[0].current_stage, "EXECUTING");
  assert.equal(out[0].latest_recommendation_id, "rec_1");
  assert.equal(out[0].latest_operation_plan_id, "opl_1");
  assert.equal(out[0].latest_act_task_id, "task_1");
  assert.equal(out[0].latest_acceptance_result, "PASSED");
  assert.equal(out[0].acceptance_summary.passed, 1);
  assert.equal(out[0].spatial_summary.last_track_point_count, 20);
  assert.equal(out[0].current_goal_progress.acceptance_quality, "ON_TRACK");
});

test("provides next-action hints when pipeline is incomplete", () => {
  const rows: ProgramStateProjectionFactRow[] = [
    fact("field_program_v1", {
      tenant_id: "t1", project_id: "p1", group_id: "g1",
      program_id: "prg_2", field_id: "field_2", season_id: "season_2", crop_code: "rice", status: "ACTIVE"
    }, "2026-03-20T11:00:00.000Z", "p2")
  ];

  const out = projectProgramStateFromFacts(rows);
  assert.equal(out.length, 1);
  assert.equal(out[0].current_stage, "SETUP");
  assert.equal(out[0].next_action_hint?.kind, "GENERATE_RECOMMENDATION");
  assert.equal(out[0].next_action_hint?.priority, "MEDIUM");
});

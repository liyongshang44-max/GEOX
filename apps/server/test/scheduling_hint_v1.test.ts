import test from "node:test";
import assert from "node:assert/strict";
import { buildSchedulingHintsFromData } from "../src/domain/scheduling/scheduling_hint_v1";

test("prioritizes failed/at-risk program in device conflict and defers lower priority program", () => {
  const conflicts = [{
    kind: "DEVICE_CONFLICT",
    severity: "HIGH",
    target_ref: "dev_1",
    related_program_ids: ["prg_a", "prg_b"],
    related_act_task_ids: ["task_1", "task_2"],
    reason: "overlap"
  }];

  const portfolio = [
    {
      program_id: "prg_a", field_id: "f1", season_id: "s1", crop_code: "rice", status: "ACTIVE",
      current_stage: "EXECUTING", latest_acceptance_result: "FAILED", execution_reliability: "AT_RISK", water_management: "OFF_TRACK",
      pending_operation_plan_id: "opl_1", updated_at_ts: 10
    },
    {
      program_id: "prg_b", field_id: "f1", season_id: "s1", crop_code: "rice", status: "ACTIVE",
      current_stage: "EXECUTING", latest_acceptance_result: "PASSED", execution_reliability: "ON_TRACK", water_management: "ON_TRACK",
      updated_at_ts: 9
    }
  ];

  const hints = buildSchedulingHintsFromData(conflicts as any, portfolio as any);
  const a = hints.find((x) => x.program_id === "prg_a");
  const b = hints.find((x) => x.program_id === "prg_b");

  assert.equal(a?.kind, "PRIORITIZE_PROGRAM_ACTION");
  assert.equal(a?.priority, "HIGH");
  assert.equal(b?.kind, "DEFER_PROGRAM_ACTION");
  assert.equal(b?.priority, "LOW");
});

test("field conflict prefers current-season active program with pending plan", () => {
  const conflicts = [{
    kind: "FIELD_CONFLICT",
    severity: "HIGH",
    target_ref: "field_1",
    related_program_ids: ["prg_1", "prg_2"],
    related_act_task_ids: ["t1", "t2"],
    reason: "overlap"
  }];

  const portfolio = [
    {
      program_id: "prg_1", field_id: "field_1", season_id: "2026S", crop_code: "rice", status: "ACTIVE",
      current_stage: "EXECUTING", pending_operation_plan_id: "opl_1", updated_at_ts: 200
    },
    {
      program_id: "prg_2", field_id: "field_1", season_id: "2025S", crop_code: "rice", status: "PAUSED",
      current_stage: "PAUSED", updated_at_ts: 100
    }
  ];

  const hints = buildSchedulingHintsFromData(conflicts as any, portfolio as any);
  const keep = hints.find((x) => x.program_id === "prg_1");
  const defer = hints.find((x) => x.program_id === "prg_2");

  assert.equal(keep?.kind, "PRIORITIZE_PROGRAM_ACTION");
  assert.equal(keep?.priority, "MEDIUM");
  assert.equal(defer?.kind, "DEFER_PROGRAM_ACTION");
  assert.equal(defer?.priority, "LOW");
});

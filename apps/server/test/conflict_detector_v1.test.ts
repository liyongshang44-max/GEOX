import test from "node:test";
import assert from "node:assert/strict";
import { detectSchedulingConflictsFromData } from "../src/domain/scheduling/conflict_detector_v1";

test("detects device + field overlaps and program intent conflict", () => {
  const base = 1710000000000;
  const tasks = [
    {
      act_task_id: "task_1",
      program_id: "prg_1",
      field_id: "field_1",
      device_id: "dev_1",
      start_ts: base,
      end_ts: base + 60_000
    },
    {
      act_task_id: "task_2",
      program_id: "prg_2",
      field_id: "field_1",
      device_id: "dev_1",
      start_ts: base + 30_000,
      end_ts: base + 120_000
    }
  ];

  const portfolio = [
    {
      program_id: "prg_1",
      field_id: "field_1",
      season_id: "s1",
      crop_code: "rice",
      status: "ACTIVE",
      current_stage: "EXECUTING",
      next_action_hint: { kind: "IRRIGATE_NOW", priority: "HIGH", reason: "dry" as string },
      updated_at_ts: base
    },
    {
      program_id: "prg_2",
      field_id: "field_1",
      season_id: "s1",
      crop_code: "rice",
      status: "ACTIVE",
      current_stage: "AT_RISK",
      next_action_hint: { kind: "CHECK_DEVICE_PATH_OR_BINDING", priority: "HIGH", reason: "path anomaly" as string },
      updated_at_ts: base + 1
    }
  ];

  const out = detectSchedulingConflictsFromData(tasks as any, portfolio as any);
  assert.equal(out.some((x) => x.kind === "DEVICE_CONFLICT" && x.target_ref === "dev_1"), true);
  assert.equal(out.some((x) => x.kind === "FIELD_CONFLICT" && x.target_ref === "field_1"), true);
  assert.equal(out.some((x) => x.kind === "PROGRAM_INTENT_CONFLICT" && x.target_ref === "field_1"), true);
});

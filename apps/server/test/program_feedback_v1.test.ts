import test from "node:test";
import assert from "node:assert/strict";
import { deriveProgramFeedbackV1 } from "../src/domain/program/program_feedback_v1";

test("rule1: latest acceptance failed -> AT_RISK and REVIEW_IRRIGATION_PLAN", () => {
  const out = deriveProgramFeedbackV1({
    program: { status: "ACTIVE" },
    acceptanceResults: [{ result: "FAILED", evaluated_at_ts: 3 }],
    trajectories: [{ in_field_ratio: 0.8, ts: 3 }],
    recentTasks: []
  });
  assert.equal(out.current_goal_progress.execution_reliability, "AT_RISK");
  assert.equal(out.next_action_hint?.kind, "REVIEW_IRRIGATION_PLAN");
});

test("rule2: in-field ratio < 0.6 -> OFF_TRACK and CHECK_DEVICE_PATH_OR_BINDING", () => {
  const out = deriveProgramFeedbackV1({
    program: { status: "ACTIVE" },
    acceptanceResults: [{ result: "PASSED", evaluated_at_ts: 3 }],
    trajectories: [{ in_field_ratio: 0.4, ts: 4 }],
    recentTasks: []
  });
  assert.equal(out.current_goal_progress.water_management, "OFF_TRACK");
  assert.equal(out.next_action_hint?.kind, "CHECK_DEVICE_PATH_OR_BINDING");
});

test("rule3: latest 3 acceptance passed -> STABLE_EXECUTION and ON_TRACK", () => {
  const out = deriveProgramFeedbackV1({
    program: { status: "ACTIVE" },
    acceptanceResults: [
      { result: "PASSED", evaluated_at_ts: 10 },
      { result: "PASSED", evaluated_at_ts: 9 },
      { result: "PASSED", evaluated_at_ts: 8 }
    ],
    trajectories: [],
    recentTasks: []
  });
  assert.equal(out.current_stage, "STABLE_EXECUTION");
  assert.equal(out.current_goal_progress.execution_reliability, "ON_TRACK");
});

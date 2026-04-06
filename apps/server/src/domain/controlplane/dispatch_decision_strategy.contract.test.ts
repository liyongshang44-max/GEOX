import test from "node:test";
import assert from "node:assert/strict";

import {
  decideDispatchCandidates,
  listDispatchStrategyConfig,
  resetDispatchStrategyConfig,
  setDispatchStrategyConfig,
} from "./dispatch_decision_strategy";

test("dispatch strategy contract: default composition returns sorted candidates with explain", () => {
  resetDispatchStrategyConfig();
  const out = decideDispatchCandidates({
    scope: { tenant_id: "t1", project_id: "p1" },
    task: {
      act_task_id: "task-1",
      required_capabilities: ["spray", "night_shift"],
      location: { lat: 30.0, lon: 120.0 },
    },
    executors: [
      { executor_id: "e1", capabilities: ["spray", "night_shift"], current_load: 2, location: { lat: 30.01, lon: 120.01 } },
      { executor_id: "e2", capabilities: ["spray"], current_load: 0, location: { lat: 30.02, lon: 120.02 } },
    ],
    sla: { accept_minutes: 20 },
  });

  assert.ok(out.explain.includes("skill_match"));
  assert.ok(out.explain.includes("nearest_distance"));
  assert.ok(out.explain.includes("load_balance"));
  assert.equal(out.candidates[0]?.executor_id, "e1");
  assert.ok(out.candidates[0]?.priority > out.candidates[1]?.priority);
  assert.ok(out.candidates[0]?.reasons.some((x) => x.startsWith("skill_match")));
});

test("dispatch strategy contract: tenant/project config can override strategy set", () => {
  resetDispatchStrategyConfig();
  setDispatchStrategyConfig([
    { tenant_id: "tenant-a", project_id: "project-a", strategies: ["load_balance"] },
    { tenant_id: "*", project_id: "*", strategies: ["skill_match", "nearest_distance", "load_balance"] },
  ]);

  const rows = listDispatchStrategyConfig();
  assert.equal(rows[0]?.tenant_id, "tenant-a");

  const out = decideDispatchCandidates({
    scope: { tenant_id: "tenant-a", project_id: "project-a" },
    task: { act_task_id: "task-2", required_capabilities: ["spray"] },
    executors: [
      { executor_id: "busy", capabilities: ["spray"], current_load: 9 },
      { executor_id: "free", capabilities: [], current_load: 0 },
    ],
    sla: {},
  });

  assert.equal(out.candidates[0]?.executor_id, "free");
  assert.ok(out.explain.includes("load_balance"));
  assert.ok(!out.explain.includes("nearest_distance"));
});

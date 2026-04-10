import assert from "node:assert/strict";
import { buildSkillOverviewMetrics } from "../src/features/dashboard/sections/SkillOverview.metrics.ts";

const items = [
  { skill_id: "skill-a", status: "ACTIVE", current_version: "1.0.0", latest_version: "1.0.0" },
  { skill_id: "skill-b", status: "ACTIVE", current_version: "1.0.0", latest_version: "1.0.0" },
  { skill_id: "skill-c", status: "DISABLED", current_version: "1.0.0", latest_version: "1.0.0" },
  { skill_id: "skill-d", status: "DISABLED", current_version: "1.0.0", latest_version: "1.0.0" },
];

const runs = [
  { run_id: "run-1", skill_id: "skill-a", status: "SUCCESS" },
  { run_id: "run-2", skill_id: "skill-b", status: "FAILED" },
  { run_id: "run-3", skill_id: "skill-c", status: "RUNNING", is_abnormal: true },
  { run_id: "run-4", skill_id: "skill-b", status: "TIMEOUT" },
];

const metrics = buildSkillOverviewMetrics(items, runs);
assert.equal(metrics.length, 5);
assert.deepEqual(metrics.map((metric) => metric.label), ["已注册技能", "激活中", "成功", "失败", "异常技能"]);
assert.deepEqual(metrics.map((metric) => metric.value), [4, 2, 1, 2, 2]);

console.log("skill-overview metrics snapshot pass");

"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const {
  ACCEPTANCE_DIAGNOSTIC_FIELDS,
  evaluateChainSmokeExitCode,
} = require("../pending_acceptance_smoke_policy.cjs");

test("链路 smoke: 模拟 PENDING_ACCEPTANCE 时 exit code = 0", () => {
  const exitCode = evaluateChainSmokeExitCode("PENDING_ACCEPTANCE");
  assert.equal(exitCode, 0);
});

test("验收 smoke: 长期停留 PENDING_ACCEPTANCE 时 exit code != 0 且包含完整诊断字段", () => {
  const scriptPath = path.resolve(__dirname, "..", "ACCEPTANCE_PENDING_ACCEPTANCE_GUARD_SMOKE.cjs");
  const selftestJson = JSON.stringify({
    operation_plan_id: "op_001",
    act_task_id: "act_001",
    tenant_id: "tenantA",
    project_id: "projectA",
    group_id: "groupA",
    final_status: "PENDING_ACCEPTANCE",
    pending_since_ts: 1_000,
    observed_at_ts: 20_000,
    max_pending_ms: 5_000,
    last_receipt_fact_id: "fact_receipt_1",
    last_acceptance_fact_id: null,
  });

  const proc = spawnSync(process.execPath, [scriptPath], {
    env: { ...process.env, GEOX_PENDING_ACCEPTANCE_SELFTEST_JSON: selftestJson },
    encoding: "utf8",
  });

  assert.notEqual(proc.status, 0);
  const out = `${proc.stdout || ""}\n${proc.stderr || ""}`;
  for (const field of ACCEPTANCE_DIAGNOSTIC_FIELDS) {
    assert.match(out, new RegExp(field), `missing diagnostics field in output: ${field}`);
  }
});

#!/usr/bin/env node
"use strict";

const {
  ACCEPTANCE_DIAGNOSTIC_FIELDS,
  evaluateAcceptanceSmoke,
} = require("./pending_acceptance_smoke_policy.cjs");

function requiredEnv(name) {
  const value = String(process.env[name] ?? "").trim();
  if (!value) throw new Error(`MISSING_ENV:${name}`);
  return value;
}

function fromEnvOrSelftest() {
  const rawSelftest = String(process.env.GEOX_PENDING_ACCEPTANCE_SELFTEST_JSON ?? "").trim();
  if (rawSelftest) {
    return JSON.parse(rawSelftest);
  }
  return {
    operation_plan_id: requiredEnv("GEOX_OPERATION_PLAN_ID"),
    act_task_id: requiredEnv("GEOX_ACT_TASK_ID"),
    tenant_id: requiredEnv("GEOX_TENANT_ID"),
    project_id: requiredEnv("GEOX_PROJECT_ID"),
    group_id: requiredEnv("GEOX_GROUP_ID"),
    final_status: requiredEnv("GEOX_FINAL_STATUS"),
    pending_since_ts: Number(requiredEnv("GEOX_PENDING_SINCE_TS")),
    observed_at_ts: Number(process.env.GEOX_OBSERVED_AT_TS ?? Date.now()),
    max_pending_ms: Number(process.env.GEOX_MAX_PENDING_MS ?? 300000),
    last_receipt_fact_id: String(process.env.GEOX_LAST_RECEIPT_FACT_ID ?? "").trim() || null,
    last_acceptance_fact_id: String(process.env.GEOX_LAST_ACCEPTANCE_FACT_ID ?? "").trim() || null,
  };
}

(async () => {
  const input = fromEnvOrSelftest();
  const result = evaluateAcceptanceSmoke(input);

  if (result.exitCode === 0) {
    console.log("PASS ACCEPTANCE_PENDING_ACCEPTANCE_GUARD_SMOKE", JSON.stringify(result.diagnostics));
    return;
  }

  const missingFields = ACCEPTANCE_DIAGNOSTIC_FIELDS.filter((f) => !Object.prototype.hasOwnProperty.call(result.diagnostics, f));
  const payload = {
    code: "PENDING_ACCEPTANCE_TIMEOUT",
    message: "operation stayed in PENDING_ACCEPTANCE longer than threshold",
    diagnostics: result.diagnostics,
    missing_fields: missingFields,
  };
  console.error("FAIL ACCEPTANCE_PENDING_ACCEPTANCE_GUARD_SMOKE", JSON.stringify(payload));
  process.exit(result.exitCode);
})().catch((err) => {
  console.error("FAIL ACCEPTANCE_PENDING_ACCEPTANCE_GUARD_SMOKE", err?.message || err);
  process.exit(1);
});

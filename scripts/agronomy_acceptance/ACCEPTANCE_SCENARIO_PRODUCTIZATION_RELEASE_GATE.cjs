#!/usr/bin/env node
const { spawnSync } = require("node:child_process");
const { existsSync } = require("node:fs");
const { resolve } = require("node:path");

const checks = [
  { dir: "../agronomy_acceptance", file: "ACCEPTANCE_SCENARIO_REPORT_PROJECTION_V1.cjs" },
  { dir: "../frontend_acceptance", file: "ACCEPTANCE_CUSTOMER_FORMAL_SCENARIO_VM_V1.cjs" },
  { dir: "../frontend_acceptance", file: "ACCEPTANCE_CUSTOMER_FORMAL_SCENARIO_REPORT_V1.cjs" },
  { dir: "../frontend_acceptance", file: "ACCEPTANCE_OPERATOR_SCENARIO_REVIEW_V1.cjs" },
  { dir: "../frontend_acceptance", file: "ACCEPTANCE_UNIFIED_EVIDENCE_VIEWER_V1.cjs" },
  { dir: "../frontend_acceptance", file: "ACCEPTANCE_SCENARIO_EXPORT_SAME_SOURCE_V1.cjs" },
  { dir: "../frontend_acceptance", file: "ACCEPTANCE_CONTROLLED_PILOT_FRONTEND_AUDIT_V1.cjs" },
  { dir: "../frontend_acceptance", file: "ACCEPTANCE_FRONTEND_RUNTIME_PAGE_AUDIT_V1.cjs" },
];

const optionalChecks = [
  { dir: "../agronomy_acceptance", file: "ACCEPTANCE_P07_FINAL_AUDIT_DOC_V1.cjs" },
];

const root = resolve(__dirname);
let failed = false;

for (const check of optionalChecks) {
  const fullPath = resolve(root, check.dir, check.file);
  if (existsSync(fullPath)) checks.push(check);
}

for (const { dir, file } of checks) {
  const fullPath = resolve(root, dir, file);
  if (!existsSync(fullPath)) {
    console.error(`[scenario-productization] missing: ${fullPath}`);
    failed = true;
    continue;
  }
  console.log(`[scenario-productization] running: node ${fullPath}`);
  const ret = spawnSync("node", [fullPath], { stdio: "inherit" });
  if (ret.status !== 0) {
    console.error(`[scenario-productization] failed: ${file} (exit=${ret.status})`);
    failed = true;
  }
}

if (failed) {
  console.error("[scenario-productization] release gate failed.");
  process.exit(1);
}

console.log("[scenario-productization] release gate passed.");

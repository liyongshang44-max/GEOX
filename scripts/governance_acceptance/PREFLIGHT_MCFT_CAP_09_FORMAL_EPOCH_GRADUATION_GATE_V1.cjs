#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const AUTHORITY_PATH = path.join(
  ROOT,
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-19-ACCELERATED-GRADUATION-GATE-V1.json",
);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
function fail(code) {
  throw new Error(code);
}
function validateResult(authority, result) {
  const gate = authority.formal_epoch_creation_machine_gate;
  if (!gate || gate.human_override_authorized !== false) fail("AMENDMENT19_GRADUATION_HUMAN_OVERRIDE_MUST_BE_FALSE");
  if (gate.all_required_statuses_must_be_terminal_pass !== true) fail("AMENDMENT19_GRADUATION_ALL_PASS_REQUIRED");
  for (const [key, expected] of Object.entries(gate.required_statuses || {})) {
    if (expected !== "PASS") fail(`AMENDMENT19_GRADUATION_AUTHORITY_EXPECTED_STATUS_INVALID:${key}`);
    if (result[key] !== "PASS") fail(`AMENDMENT19_GRADUATION_STATUS_NOT_PASS:${key}:${String(result[key])}`);
  }
  if (result.static_blocker_count !== gate.static_blocker_count_required) {
    fail(`AMENDMENT19_GRADUATION_STATIC_BLOCKER_COUNT_NOT_ZERO:${String(result.static_blocker_count)}`);
  }
  if (result.human_override_used === true) fail("AMENDMENT19_GRADUATION_HUMAN_OVERRIDE_FORBIDDEN");
  if (result.accelerated_clock_replaced_production_execution_graph === true) {
    fail("AMENDMENT19_GRADUATION_ACCELERATED_GRAPH_SUBSTITUTION_FORBIDDEN");
  }
  if (result.same_canonical_core_engineering_and_production !== true) {
    fail("AMENDMENT19_GRADUATION_SAME_CANONICAL_CORE_REQUIRED");
  }
  if (result.persistent_lane_uses_production_scheduler !== true
    || result.persistent_lane_uses_production_repositories !== true
    || result.persistent_lane_uses_production_lease_fencing !== true
    || result.persistent_lane_uses_production_runner !== true) {
    fail("AMENDMENT19_GRADUATION_PRODUCTION_GRAPH_EQUIVALENCE_REQUIRED");
  }
  return {
    schema_version: "geox_mcft_cap09_formal_epoch_graduation_gate_result_v1",
    status: "PASS",
    formal_epoch_creation_gate: "OPEN",
    required_status_count: Object.keys(gate.required_statuses).length,
    static_blocker_count: result.static_blocker_count,
    same_canonical_core_engineering_and_production: true,
    accelerated_clock_replaced_production_execution_graph: false,
    human_override_used: false,
  };
}

function selftest() {
  const authority = readJson(AUTHORITY_PATH);
  const base = Object.fromEntries(
    Object.keys(authority.formal_epoch_creation_machine_gate.required_statuses).map((key) => [key, "PASS"]),
  );
  const pass = {
    ...base,
    static_blocker_count: 0,
    human_override_used: false,
    accelerated_clock_replaced_production_execution_graph: false,
    same_canonical_core_engineering_and_production: true,
    persistent_lane_uses_production_scheduler: true,
    persistent_lane_uses_production_repositories: true,
    persistent_lane_uses_production_lease_fencing: true,
    persistent_lane_uses_production_runner: true,
  };
  const passResult = validateResult(authority, pass);
  if (passResult.status !== "PASS") fail("AMENDMENT19_GRADUATION_SELFTEST_PASS_CASE_FAILED");

  const negativeCases = [
    { name: "status", value: { ...pass, MODE_B: "FAIL" }, code: "AMENDMENT19_GRADUATION_STATUS_NOT_PASS:MODE_B:FAIL" },
    { name: "blocker", value: { ...pass, static_blocker_count: 1 }, code: "AMENDMENT19_GRADUATION_STATIC_BLOCKER_COUNT_NOT_ZERO:1" },
    { name: "core", value: { ...pass, same_canonical_core_engineering_and_production: false }, code: "AMENDMENT19_GRADUATION_SAME_CANONICAL_CORE_REQUIRED" },
    { name: "graph", value: { ...pass, accelerated_clock_replaced_production_execution_graph: true }, code: "AMENDMENT19_GRADUATION_ACCELERATED_GRAPH_SUBSTITUTION_FORBIDDEN" },
    { name: "runner", value: { ...pass, persistent_lane_uses_production_runner: false }, code: "AMENDMENT19_GRADUATION_PRODUCTION_GRAPH_EQUIVALENCE_REQUIRED" },
    { name: "override", value: { ...pass, human_override_used: true }, code: "AMENDMENT19_GRADUATION_HUMAN_OVERRIDE_FORBIDDEN" },
  ];
  for (const item of negativeCases) {
    let observed = "";
    try {
      validateResult(authority, item.value);
    } catch (error) {
      observed = error instanceof Error ? error.message : String(error);
    }
    if (observed !== item.code) fail(`AMENDMENT19_GRADUATION_SELFTEST_NEGATIVE_FAILED:${item.name}:${observed}`);
  }
  console.log(JSON.stringify({
    schema_version: "geox_mcft_cap09_formal_epoch_graduation_gate_selftest_v1",
    status: "PASS",
    fail_closed_negative_case_count: negativeCases.length,
    human_override_authorized: false,
  }));
}

function main() {
  if (process.argv.includes("--selftest")) {
    selftest();
    return;
  }
  const resultPathArg = process.argv[2];
  if (!resultPathArg) fail("AMENDMENT19_GRADUATION_RESULT_PATH_REQUIRED");
  const authority = readJson(AUTHORITY_PATH);
  const resultPath = path.resolve(ROOT, resultPathArg);
  if (!fs.existsSync(resultPath)) fail(`AMENDMENT19_GRADUATION_RESULT_NOT_FOUND:${resultPathArg}`);
  const result = readJson(resultPath);
  console.log(JSON.stringify(validateResult(authority, result)));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const WORKFLOW = ".github/workflows/mcft-cap-09-t4r1-rolling-rehydration-live-proof.yml";
const RUNNER = "scripts/runtime_acceptance/RUN_MCFT_CAP_09_ROLLING_PREBOUNDARY_REHYDRATION_V1.ts";
const CAPTURE = ".github/workflows/mcft-cap-09-rolling-preboundary-capture.yml";
const OUT = path.join(ROOT, "acceptance-output/MCFT_CAP_09_T4R1_DYNAMIC_ROLLING_REHYDRATION_GOVERNANCE_RESULT.json");

function read(file) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) throw new Error(`MCFT_CAP09_T4R1_DYNAMIC_REHYDRATION_FILE_REQUIRED:${file}`);
  return fs.readFileSync(full, "utf8");
}
function req(condition, code) {
  if (!condition) throw new Error(code);
}
function hasAll(text, values, code) {
  for (const value of values) req(text.includes(value), `${code}:${value}`);
}

const workflow = read(WORKFLOW);
const runner = read(RUNNER);
const capture = read(CAPTURE);
const result = {
  schema_version: "geox_mcft_cap09_t4r1_dynamic_rolling_rehydration_governance_v1",
  status: "FAIL",
  producer_must_be_protected_main: true,
  candidate_expiry_enforced: true,
  producer_subject_from_artifact_metadata: true,
  provider_refetch_authorized: false,
  formal_database_write_authorized: false,
  formal_r2_write_authorized: false,
  scheduler_write_authorized: false,
  runtime_write_authorized: false,
};

try {
  hasAll(capture, [
    "workflow_dispatch:",
    "Require exact protected-main capture subject",
    "MCFT_CAP09_ROLLING_PREBOUNDARY_EXACT_MAIN_DRIFT",
    "producer_subject_sha: subject",
    "formal_database_write_count!==0",
    "formal_r2_prefix_write_count!==0",
    "scheduler_write_count!==0",
    "runtime_write_count!==0",
    "retention-days: 2",
  ], "MCFT_CAP09_T4R1_DYNAMIC_REHYDRATION_CAPTURE_BOUNDARY_MISSING");

  hasAll(workflow, [
    "workflow_dispatch:",
    "rolling_artifact_id:",
    "protected-main-live-rehydrate:",
    "MCFT_CAP09_T4R1_DYNAMIC_REHYDRATE_EXACT_MAIN_DRIFT",
    "/actions/artifacts/${ROLLING_ARTIFACT_ID}",
    "/actions/artifacts/${ROLLING_ARTIFACT_ID}/zip",
    "a.workflow_run?.head_branch!=='main'",
    "p.producer_subject_sha!==a.workflow_run.head_sha",
    "Date.parse(p.candidate_expires_at)<=Date.now()",
    "PROVIDER_AVAILABILITY_WATERMARK_V1",
    "RUN_MCFT_CAP_09_ROLLING_PREBOUNDARY_REHYDRATION_V1.ts run",
    "p.provider_refetch_count!==0",
    "p.private_r2_put_count!==0",
    "p.private_r2_delete_count!==0",
    "p.formal_database_write_count!==0",
    "p.formal_r2_prefix_write_count!==0",
    "p.scheduler_write_count!==0",
    "p.runtime_write_count!==0",
    "p.formal_effect!==false",
    "p.raw_values_emitted!==false",
  ], "MCFT_CAP09_T4R1_DYNAMIC_REHYDRATION_WORKFLOW_BOUNDARY_MISSING");

  for (const forbidden of [
    "FROZEN_ROLLING_ARTIFACT_ID",
    "FROZEN_ROLLING_PRODUCER_SHA",
    "FROZEN_ROLLING_TARGET_T",
    "2026-08-15T12:00:00.000Z",
    "9246513491",
    "481f46358056abc592c9e5691d3463487261dafa",
  ]) {
    req(!workflow.includes(forbidden), `MCFT_CAP09_T4R1_DYNAMIC_REHYDRATION_HISTORICAL_PIN_FORBIDDEN:${forbidden}`);
  }

  hasAll(runner, [
    "ProducerBoundReadOnlyR2RetentionV1",
    "provider_refetch_count: 0",
    "formal_database_write_count: 0",
    "formal_r2_prefix_write_count: 0",
    "scheduler_write_count: 0",
    "runtime_write_count: 0",
    "formal_effect: false",
    "raw_values_emitted: false",
  ], "MCFT_CAP09_T4R1_DYNAMIC_REHYDRATION_RUNNER_SAFETY_MISSING");

  result.status = "PASS";
} catch (error) {
  result.error_code = error instanceof Error ? error.message : String(error);
  throw error;
} finally {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result));
}

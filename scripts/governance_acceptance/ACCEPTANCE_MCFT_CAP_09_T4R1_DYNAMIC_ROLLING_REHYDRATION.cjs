#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const WORKFLOW = ".github/workflows/mcft-cap-09-t4r1-rolling-rehydration-live-proof.yml";
const RUNNER = "scripts/runtime_acceptance/RUN_MCFT_CAP_09_ROLLING_PREBOUNDARY_REHYDRATION_V1.ts";
const CAPTURE = ".github/workflows/mcft-cap-09-t4r1-rolling-preboundary-capture.yml";
const HISTORICAL_CAPTURE = ".github/workflows/mcft-cap-09-rolling-preboundary-capture.yml";
const HISTORICAL_PERSISTENT = ".github/workflows/mcft-cap-09-amendment19-persistent-24t-qualification.yml";
const ASSEMBLER = "scripts/runtime_acceptance/ASSEMBLE_MCFT_CAP_09_ROLLING_PREBOUNDARY_CANDIDATE.cjs";
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
const historicalCapture = read(HISTORICAL_CAPTURE);
const historicalPersistent = read(HISTORICAL_PERSISTENT);
const assembler = read(ASSEMBLER);
const result = {
  schema_version: "geox_mcft_cap09_t4r1_dynamic_rolling_rehydration_governance_v1",
  status: "FAIL",
  t4_capture_event_isolated_from_historical_persistent_consumer: true,
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
    "name: mcft-cap-09-t4r1-rolling-preboundary-capture",
    "workflow_dispatch:",
    "merge_group:",
    "Require exact protected-main T4R1 capture subject",
    "MCFT_CAP09_T4R1_ROLLING_CAPTURE_EXACT_MAIN_DRIFT",
    "field_id: \\\"field_kbs_mcse_t4r1\\\"",
    "zone_id: \\\"zone_kbs_mcse_t4r1_crop_formal_v1\\\"",
    "producer_subject_sha!==process.env.GITHUB_SHA",
    "formal_database_write_count!==0",
    "formal_r2_prefix_write_count!==0",
    "scheduler_write_count!==0",
    "runtime_write_count!==0",
    "mcft-cap09-t4r1-rolling-preboundary-",
    "retention-days: 2",
  ], "MCFT_CAP09_T4R1_DYNAMIC_REHYDRATION_CAPTURE_BOUNDARY_MISSING");
  req(!capture.includes("schedule:"), "MCFT_CAP09_T4R1_DYNAMIC_REHYDRATION_T4_CAPTURE_SCHEDULE_FORBIDDEN");
  req(!capture.includes("push:\n"), "MCFT_CAP09_T4R1_DYNAMIC_REHYDRATION_T4_CAPTURE_PUSH_FORBIDDEN");

  hasAll(historicalCapture, [
    "name: mcft-cap-09-rolling-preboundary-capture",
  ], "MCFT_CAP09_T4R1_DYNAMIC_REHYDRATION_HISTORICAL_CAPTURE_IDENTITY_REQUIRED");
  hasAll(historicalPersistent, [
    "workflows: ['mcft-cap-09-rolling-preboundary-capture']",
    "GEOX_MCFT_CAP09_T3R1_S6_DATABASE_URL",
  ], "MCFT_CAP09_T4R1_DYNAMIC_REHYDRATION_HISTORICAL_CONSUMER_IDENTITY_REQUIRED");
  req(!historicalPersistent.includes("mcft-cap-09-t4r1-rolling-preboundary-capture"), "MCFT_CAP09_T4R1_DYNAMIC_REHYDRATION_T4_CAPTURE_MUST_NOT_TRIGGER_HISTORICAL_PERSISTENT");

  hasAll(assembler, [
    "producer_subject_sha: subject",
    "producer_subject_sha_immutable: true",
    "producer_exact_main_capture_proof_required: true",
    "consumer_same_git_sha_required: false",
    "consumer_exact_main_successor_qualification_required: true",
    "cross_version_rehydration_required_when_consumer_subject_differs: true",
    "raw_retention_reverification_required: true",
    "semantic_hash_reverification_required: true",
  ], "MCFT_CAP09_T4R1_DYNAMIC_REHYDRATION_ASSEMBLER_BOUNDARY_MISSING");

  hasAll(workflow, [
    "workflow_dispatch:",
    "rolling_artifact_id:",
    "mcft-cap-09-t4r1-rolling-preboundary-capture",
    "protected-main-live-rehydrate:",
    "MCFT_CAP09_T4R1_DYNAMIC_REHYDRATE_EXACT_MAIN_DRIFT",
    "/actions/artifacts/${ROLLING_ARTIFACT_ID}",
    "/actions/artifacts/${ROLLING_ARTIFACT_ID}/zip",
    "startsWith('mcft-cap09-t4r1-rolling-preboundary-')",
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

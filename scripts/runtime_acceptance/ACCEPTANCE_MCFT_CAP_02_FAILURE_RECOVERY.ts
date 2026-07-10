// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_FAILURE_RECOVERY.ts
// Purpose: consolidate executable non-database Failure Recovery proof across the already merged Evidence, Dynamics, restart, and persistence acceptance surfaces.
// Boundary: acceptance orchestration only; no production Runtime implementation, database mutation, route, scheduler, Forecast success, Recommendation, Decision, or action.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE_PATH = "fixtures/mcft/water_state/negative/MCFT_CAP_02_FAILURE_RECOVERY_FIXTURES.json";
const REQUIRED_CLASSES = [
  "fault_injection",
  "stale_fencing",
  "cas_conflict",
  "missing_et0",
  "missing_rainfall",
  "duplicate_conflict",
  "invalid_config",
  "mass_balance_violation",
  "idempotent_crash_retry",
  "projection_divergence",
] as const;

type FixtureCaseV1 = {
  fixture_id: string;
  failure_class: string;
  expected_reason_code: string;
  expected_stage: string;
  expected_no_current_tick_a2_append: boolean;
  expected_no_current_tick_projection_write: boolean;
  expected_checkpoint_unchanged: boolean;
  expected_state_latest_unchanged: boolean;
  expected_forecast_result_latest_unchanged: boolean;
  expected_active_lineage_unchanged: boolean;
  optional_f_audit_allowed: boolean;
  existing_proof_source: string;
  consolidated_proof_required: string;
};

type FixtureDocumentV1 = {
  schema_version: string;
  contract_identity: string;
  delivery_slice_id: string;
  baseline_main_commit: string;
  cases: FixtureCaseV1[];
};

let pass = 0;
function ok(message: string): void {
  pass += 1;
  console.log(`PASS ${message}`);
}

function runTsxV1(relativePath: string): string {
  const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const result = spawnSync(command, ["exec", "tsx", relativePath], {
    cwd: ROOT,
    env: { ...process.env },
    encoding: "utf8",
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  assert.equal(result.status, 0, result.error?.message ?? result.stderr);
  return result.stdout;
}

const fixture = JSON.parse(
  fs.readFileSync(path.join(ROOT, FIXTURE_PATH), "utf8"),
) as FixtureDocumentV1;

assert.equal(fixture.schema_version, "geox_mcft_cap_02_failure_recovery_fixtures_v1");
assert.equal(fixture.contract_identity, "GEOX-MCFT-CAP-02-FAILURE-RECOVERY-CONTRACT-V1");
assert.equal(fixture.delivery_slice_id, "MCFT-CAP-02.FAILURE-RECOVERY-V1");
assert.equal(fixture.baseline_main_commit, "3166e9fb301f86499c82dce3590cfb6f5db15173");
assert.equal(fixture.cases.length, REQUIRED_CLASSES.length);
assert.deepEqual(
  [...new Set(fixture.cases.map((item) => item.failure_class))].sort(),
  [...REQUIRED_CLASSES].sort(),
);
ok("failure fixture freezes exactly the ten taskbook failure classes");

for (const item of fixture.cases) {
  assert.ok(item.fixture_id.trim());
  assert.ok(item.expected_reason_code.trim());
  assert.ok(item.expected_stage.trim());
  assert.equal(item.expected_no_current_tick_a2_append, true);
  assert.equal(item.expected_no_current_tick_projection_write, true);
  assert.equal(item.expected_checkpoint_unchanged, true);
  assert.equal(item.expected_state_latest_unchanged, true);
  assert.equal(item.expected_forecast_result_latest_unchanged, true);
  assert.equal(item.expected_active_lineage_unchanged, true);
  assert.equal(item.optional_f_audit_allowed, true);
  assert.ok(item.existing_proof_source.trim());
  assert.ok(item.consolidated_proof_required.trim());
}
ok("all failure fixtures freeze complete zero-partial-write preservation metadata");

const singleTickOutput = runTsxV1(
  "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_SINGLE_TICK_NEGATIVE.ts",
);
assert.match(singleTickOutput, /MISSING_EXACT_HOURLY_RAINFALL_INTERVAL/);
assert.match(singleTickOutput, /MISSING_EXACT_HOURLY_ET0_INTERVAL/);
assert.match(singleTickOutput, /CONFLICTING_DUPLICATE_EVIDENCE/);
assert.match(singleTickOutput, /CONTINUATION_RUNTIME_CONFIG_NOT_FOUND/);
assert.match(singleTickOutput, /MCFT-CAP-02 single-tick negative: 15 PASS, 0 FAIL/);
ok("missing rainfall, missing ET0, duplicate conflict, and invalid pinned config fail before persistence");

const dynamicsOutput = runTsxV1(
  "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_DYNAMICS_NEGATIVE.ts",
);
assert.match(dynamicsOutput, /MASS_BALANCE_TAMPER_REJECTED/);
assert.match(dynamicsOutput, /MCFT-CAP-02 dynamics negative: 10 PASS, 0 FAIL/);
ok("mass-balance tamper and related pure-domain invariant failures remain fail-closed");

const restartOutput = runTsxV1(
  "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_RESTART_BACKFILL_NEGATIVE.ts",
);
assert.match(restartOutput, /CHECKPOINT_PROJECTION_DIVERGENCE/);
assert.match(restartOutput, /MCFT-CAP-02 restart backfill negative: 15 PASS, 0 FAIL/);
ok("restart projection divergence is rejected with zero continuation commit");

const persistenceSource = fs.readFileSync(
  path.join(ROOT, "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_PERSISTENCE_DB.ts"),
  "utf8",
);
for (const token of [
  "FAULT:before_commit",
  "STALE_FENCING_TOKEN",
  "CHECKPOINT_CAS_CONFLICT",
  "EXISTING_IDEMPOTENT_SUCCESS",
  "IDEMPOTENCY_CONFLICT",
  "rebuildContinuationProjections",
]) {
  assert.ok(persistenceSource.includes(token), `missing existing persistence proof token: ${token}`);
}
ok("PostgreSQL fault, fencing, CAS, idempotency, and rebuild proof sources remain present for the destructive Gate");

console.log(`MCFT-CAP-02 failure recovery: ${pass} PASS, 0 FAIL`);

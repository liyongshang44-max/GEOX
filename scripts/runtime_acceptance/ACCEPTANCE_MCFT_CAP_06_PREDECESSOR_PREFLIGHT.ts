// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_PREDECESSOR_PREFLIGHT.ts
// Purpose: reproduce the completed MCFT-CAP-05 terminal chain in isolated PostgreSQL, lock the exact canonical handoff, structurally qualify canonical Residual history, and materialize the governance-only MCFT-CAP-06 S0 candidate.
// Boundary: destructive isolated-database acceptance and governance artifact generation only; no CAP-06 Runtime source, migration, Candidate/Evaluation canonical write, Model Activation, active-config switch, public route, Web, scheduler, or CAP-07 authority.

import assert from "node:assert/strict";
import cp from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import {
  type Cap05ApprovalAssertionEvidenceV1,
  type Cap05ApprovedPlanEvidenceV1,
} from "../../apps/server/src/evidence/twin_runtime/approval_plan_evidence_contracts_v1.js";
import type { Cap05ExecutionReceiptEvidenceV1 } from "../../apps/server/src/evidence/twin_runtime/execution_receipt_evidence_contract_v1.js";
import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import { Cap05ApprovalPlanBindingServiceV1 } from "../../apps/server/src/runtime/twin_runtime/approval_plan_binding_service_v1.js";
import { Cap05ActionFeedbackNormalizationServiceV1 } from "../../apps/server/src/runtime/twin_runtime/action_feedback_normalization_service_v1.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const BASELINE_MAIN = "1e66ea7efc842b8e547bccc40521d520b4370e69";
const BRANCH = "agent/mcft-cap-06-s0-authorization-predecessor-qualification-v1";
const P0 = "MCFT-CAP-06.P0.CAP-05-TERMINAL-SSOT-RECONCILIATION-AND-PROVISIONAL-SSOT-V1";
const S0 = "MCFT-CAP-06.GOV-AUTHORIZATION-PREDECESSOR-AND-DATASET-QUALIFICATION-V1";
const S1 = "MCFT-CAP-06.MCFT-01-03-11.CANONICAL-RESIDUAL-WINDOWS-V1";
const P0_PR = 2498;
const P0_EXACT_HEAD = "13957179a9547995e0a1443ba400d07c830579fc";
const P0_EXACT_HEAD_WORKFLOW = 29419324004;
const P0_MERGE_COMMIT = "a7bb8d9499560b0ef0244a1a6daeaee1eeb408bf";
const P0_POSTMERGE_PROBE_PR = 2499;
const P0_POSTMERGE_WORKFLOW = 29419841209;
const EXPECTED_LAST_LOGICAL_TIME = "2026-06-04T09:00:00.000Z";
const EXPECTED_NEXT_LOGICAL_TIME = "2026-06-04T10:00:00.000Z";
const EXPECTED_CHECKPOINT_SEQUENCE = 80;
const EXPECTED_REPRODUCED_STATE_FACT_COUNT = 33;
const HISTORICAL_S10_DECLARED_GLOBAL_STATE_COUNT = 81;
const HISTORICAL_S10_ORCHESTRATOR_CANONICAL_OBJECT_FACT_DELTA = 81;
const STATE_COUNT_RECONCILIATION = "HISTORICAL_S10_GLOBAL_STATE_COUNT_LABEL_CONFLATED_WITH_ORCHESTRATOR_CANONICAL_OBJECT_FACT_DELTA";

const EXPECTED_SCOPE = Object.freeze({
  tenant_id: "tenantA",
  project_id: "projectA",
  group_id: "groupA",
  field_id: "field_c8_demo",
  season_id: "season_2026_c8_corn",
  zone_id: "zone_mcft_c8_water_001",
});

const MAP_PATH = "docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md";
const MATRIX_PATH = "docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json";
const TASK_PATH = "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASK.md";
const P0_STATUS_PATH = "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-P0-STATUS.json";
const AUTHORIZATION_PATH = "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-AUTHORIZATION.md";
const AUTHORIZATION_STATUS_PATH = "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-AUTHORIZATION-STATUS.json";
const LOCK_PATH = "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-PREDECESSOR-LOCK.json";
const QUALIFICATION_PATH = "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DATASET-QUALIFICATION.json";
const DELIVERY_PATH = "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json";
const GATE_PATH = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_AUTHORIZATION.cjs";
const PREFLIGHT_PATH = "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_PREDECESSOR_PREFLIGHT.ts";
const CAP05_CLOSURE_PATH = "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-CLOSURE-RECORD.json";
const CAP05_MAIN_PATH = "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-MAIN-VERIFICATION.json";
const TEMP_WORKFLOW_PATH = ".github/workflows/mcft-cap-06-s0-materialize.yml";
const TEMP_RUNNER_INPUT_PATH = "acceptance-output/MCFT_CAP_06_S0_RUNNER_INPUT.json";

const EXACT_CHANGED_FILES = Object.freeze([
  MAP_PATH,
  MATRIX_PATH,
  TASK_PATH,
  P0_STATUS_PATH,
  AUTHORIZATION_PATH,
  AUTHORIZATION_STATUS_PATH,
  LOCK_PATH,
  QUALIFICATION_PATH,
  DELIVERY_PATH,
  GATE_PATH,
  PREFLIGHT_PATH,
].sort());

const PREFLIGHT_ALLOWED_FILES = Object.freeze([...EXACT_CHANGED_FILES, TEMP_WORKFLOW_PATH].sort());

const PRESERVED_NONCLAIMS = Object.freeze([
  "NO_CAP_06_RUNTIME_SOURCE_AUTHORIZATION_BEFORE_EFFECTIVENESS",
  "NO_RESIDUAL_CREATED_BY_S0",
  "NO_CALIBRATION_CANDIDATE",
  "NO_SHADOW_EVALUATION",
  "NO_MODEL_ACTIVATION",
  "NO_ACTIVE_CONFIG_SWITCH",
  "NO_ACTIVE_CONFIG_INDEX_CREATION",
  "NO_AUTOMATIC_PARAMETER_UPDATE",
  "NO_STATE_MUTATION_BY_S0",
  "NO_CHECKPOINT_MUTATION_BY_S0",
  "NO_PUBLIC_ROUTE",
  "NO_WEB",
  "NO_SCHEDULER",
  "NO_SHADOW_ONLINE_CLAIM",
  "NO_FIELD_CALIBRATION_CLAIM",
  "NO_MCFT_CAP_07_AUTHORIZATION",
]);

let pass = 0;

function ok(message: string): void {
  pass += 1;
  console.log(`PASS ${message}`);
}

function fail(code: string, details = ""): never {
  throw new Error(details ? `${code}:${details}` : code);
}

function run(executable: string, args: string[], options: { env?: NodeJS.ProcessEnv } = {}): string {
  const result = cp.spawnSync(executable, args, {
    cwd: ROOT,
    env: { ...process.env, ...(options.env ?? {}) },
    encoding: "utf8",
    stdio: "pipe",
    shell: false,
    maxBuffer: 256 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`COMMAND_FAILED:${executable} ${args.join(" ")}\n${result.stdout ?? ""}\n${result.stderr ?? ""}`);
  }
  return String(result.stdout ?? "");
}

function git(args: string[]): string {
  return run(process.platform === "win32" ? "git.exe" : "git", args).trim();
}

function absolute(relativePath: string): string {
  return path.join(ROOT, relativePath);
}

function readText(relativePath: string): string {
  return fs.readFileSync(absolute(relativePath), "utf8");
}

function readJson<T = any>(relativePath: string): T {
  return JSON.parse(readText(relativePath)) as T;
}

function writeText(relativePath: string, value: string): void {
  fs.mkdirSync(path.dirname(absolute(relativePath)), { recursive: true });
  fs.writeFileSync(absolute(relativePath), `${value.replace(/\r\n/g, "\n").trimEnd()}\n`, "utf8");
}

function writeJson(relativePath: string, value: unknown): void {
  writeText(relativePath, JSON.stringify(value, null, 2));
}

function semanticHash(value: unknown): string {
  const canonical = JSON.stringify(value, Object.keys(value as object).sort());
  return `sha256:${crypto.createHash("sha256").update(canonical).digest("hex")}`;
}

function resolveDatabaseName(databaseUrl: string): string {
  const name = decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\//, ""));
  if (!name) fail("DATABASE_NAME_REQUIRED");
  if (!/(mcft|cap.*06|s0|acceptance|test)/i.test(name)) fail("ISOLATED_ACCEPTANCE_DATABASE_REQUIRED", name);
  return name;
}

function assertRepositoryBoundary(): void {
  assert.equal(git(["branch", "--show-current"]), BRANCH, "S0_BRANCH_REQUIRED");
  assert.equal(git(["rev-parse", "refs/remotes/origin/main"]), BASELINE_MAIN, "ORIGIN_MAIN_HEAD_MISMATCH");
  run(process.platform === "win32" ? "git.exe" : "git", ["merge-base", "--is-ancestor", BASELINE_MAIN, "HEAD"]);
  const tracked = git(["diff", "--name-only", BASELINE_MAIN]).split(/\r?\n/).filter(Boolean);
  const untracked = git(["ls-files", "--others", "--exclude-standard"]).split(/\r?\n/).filter(Boolean);
  const changed = [...new Set([...tracked, ...untracked])].sort();
  const forbidden = changed.filter((file) => !PREFLIGHT_ALLOWED_FILES.includes(file));
  assert.deepEqual(forbidden, [], `S0_CHANGED_FILE_BOUNDARY_VIOLATION:${forbidden.join(",")}`);
  ok("branch, P0 merged-main baseline, ancestry, and governance-only preflight boundary are exact");
}

function scopeValues(): string[] {
  return [
    EXPECTED_SCOPE.tenant_id,
    EXPECTED_SCOPE.project_id,
    EXPECTED_SCOPE.group_id,
    EXPECTED_SCOPE.field_id,
    EXPECTED_SCOPE.season_id,
    EXPECTED_SCOPE.zone_id,
  ];
}

function factEnvelope(recordJson: unknown): any {
  const parsed = typeof recordJson === "string" ? JSON.parse(recordJson) : recordJson;
  assert.ok(parsed && typeof parsed === "object" && parsed.payload && typeof parsed.payload === "object", "CANONICAL_FACT_ENVELOPE_INVALID");
  return parsed.payload;
}

async function readCanonicalObject(pool: Pool, objectId: string, objectType: string): Promise<any> {
  const result = await pool.query(
    "SELECT record_json FROM facts WHERE record_json->'payload'->>'object_id'=$1 AND record_json->>'type'=$2",
    [objectId, objectType],
  );
  assert.equal(result.rows.length, 1, `CANONICAL_OBJECT_CARDINALITY:${objectType}:${objectId}`);
  const object = factEnvelope(result.rows[0].record_json);
  assert.equal(object.object_id, objectId, `CANONICAL_OBJECT_ID_MISMATCH:${objectType}`);
  assert.equal(object.object_type, objectType, `CANONICAL_OBJECT_TYPE_MISMATCH:${objectType}`);
  return object;
}

async function seedEvidence(pool: Pool, record: Record<string, unknown>): Promise<void> {
  const identity = String(record.evidence_identity_key ?? record.source_record_id);
  const digest = crypto.createHash("sha256").update(identity).digest("hex").slice(0, 32);
  await pool.query(
    `INSERT INTO facts (fact_id,occurred_at,source,record_json)
     VALUES ($1,$2::timestamptz,'mcft_cap06_s0_replay_evidence_v1',$3::jsonb)
     ON CONFLICT (fact_id) DO NOTHING`,
    [`fact_mcft06_s0_${digest}`, record.available_to_runtime_at, JSON.stringify({ type: record.record_type, payload: record })],
  );
}

async function establishStandardFeedbackPath(pool: Pool): Promise<void> {
  const fixtureRoot = absolute("fixtures/mcft/water_state/feedback_v1");
  const readOne = <T>(file: string): T => JSON.parse(fs.readFileSync(path.join(fixtureRoot, file), "utf8").trim()) as T;
  const assertion = readOne<Cap05ApprovalAssertionEvidenceV1>("approval_assertions.jsonl");
  const plan = readOne<Cap05ApprovedPlanEvidenceV1>("approved_plans.jsonl");
  const dispatch = readOne<Record<string, unknown>>("external_dispatch.jsonl");
  const receipt = readOne<Cap05ExecutionReceiptEvidenceV1>("execution_receipts.jsonl");
  const planService = new Cap05ApprovalPlanBindingServiceV1(pool);
  const feedbackService = new Cap05ActionFeedbackNormalizationServiceV1(pool);

  await seedEvidence(pool, dispatch);
  const planBinding = await planService.commitApprovalPlanBinding({
    scope: EXPECTED_SCOPE,
    approval_assertion: assertion,
    approved_plan: plan,
    dispatch: {
      disposition: "EXTERNALLY_RECORDED",
      evidence_ref: String(dispatch.source_record_id),
      evidence_hash: String(dispatch.source_record_hash),
    },
  });
  assert.ok(["INSERTED", "EXISTING_IDEMPOTENT_SUCCESS"].includes(planBinding.approved_plan_status), "APPROVED_PLAN_BINDING_REQUIRED");

  await seedEvidence(pool, receipt as unknown as Record<string, unknown>);
  const feedback = await feedbackService.commitActionFeedback({
    scope: EXPECTED_SCOPE,
    receipt_evidence_ref: receipt.source_record_id,
    receipt_evidence_hash: receipt.source_record_hash,
  });
  assert.ok(["INSERTED", "EXISTING_IDEMPOTENT_SUCCESS"].includes(feedback.persistence_status), "STANDARD_ACTION_FEEDBACK_REQUIRED");
  assert.equal(feedback.action_feedback.payload.eligible_for_state_input, true, "STANDARD_ACTION_FEEDBACK_MUST_BE_STATE_ELIGIBLE");
  assert.equal(feedback.action_feedback.payload.source_quality, "PASS", "STANDARD_ACTION_FEEDBACK_QUALITY_PASS_REQUIRED");
  ok("canonical G Decision predecessor is extended with exactly one standard Plan binding and one State-eligible H Action Feedback");
}

function walkReplayFilesV1(directory: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkReplayFilesV1(absolutePath));
    else files.push(absolutePath);
  }
  return files;
}

function buildS0HAuthoritativeReplayViewV1(): string {
  const source = absolute("fixtures/mcft/water_state/replay_v1");
  const target = path.join(os.tmpdir(), "mcft_cap06_s0_h_authoritative_replay_v1");
  fs.rmSync(target, { recursive: true, force: true });
  fs.cpSync(source, target, { recursive: true });

  let removedLegacyIrrigation = 0;
  let normalizedObservation = 0;
  for (const file of walkReplayFilesV1(target).filter((candidate) => candidate.endsWith(".jsonl"))) {
    const records = fs.readFileSync(file, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, any>);
    const output: string[] = [];
    for (const record of records) {
      if (record.record_type === "irrigation_execution_evidence_v1") {
        removedLegacyIrrigation += 1;
        continue;
      }
      if (record.record_type === "soil_moisture_observation_v1") {
        record.canonical_payload = { ...record.canonical_payload };
        record.source_payload = { ...record.source_payload };
        if (record.canonical_payload.quantity_kind === undefined) {
          assert.equal(typeof record.quantity_kind, "string", "S0_TEMP_REPLAY_QUANTITY_KIND_REQUIRED");
          record.canonical_payload.quantity_kind = record.quantity_kind;
          normalizedObservation += 1;
        }
        if (record.source_payload.source_version === undefined) {
          assert.equal(typeof record.source_version, "string", "S0_TEMP_REPLAY_SOURCE_VERSION_REQUIRED");
          record.source_payload.source_version = record.source_version;
        }
        const semantic = structuredClone(record);
        delete semantic.source_record_hash;
        delete semantic.materialized_file_location;
        record.source_record_hash = semanticHashV1(semantic);
      }
      output.push(JSON.stringify(record));
    }
    fs.writeFileSync(file, `${output.join("\n")}\n`, "utf8");
  }
  assert.ok(removedLegacyIrrigation >= 1, "S0_LEGACY_IRRIGATION_EXCLUSION_NOT_PROVEN");
  assert.ok(normalizedObservation >= 1, "S0_LEGACY_OBSERVATION_NORMALIZATION_NOT_PROVEN");

  const outcomePath = absolute("fixtures/mcft/water_state/feedback_v1/soil_observations.jsonl");
  const outcomeRecords = fs.readFileSync(outcomePath, "utf8")
    .split(String.fromCharCode(10))
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, any>);
  assert.equal(outcomeRecords.length, 1, "S0_OUTCOME_OBSERVATION_CARDINALITY");
  const outcome = structuredClone(outcomeRecords[0]);
  assert.equal(outcome.record_type, "soil_moisture_observation_v1");
  assert.equal(outcome.role_time.observed_at, "2026-06-04T03:00:00.000Z");
  outcome.canonical_payload = {
    ...outcome.canonical_payload,
    quantity_kind: "VOLUMETRIC_WATER_CONTENT",
  };
  outcome.source_payload = {
    ...outcome.source_payload,
    source_version: String(outcome.source_version ?? "1"),
  };
  const semantic = structuredClone(outcome);
  delete semantic.source_record_hash;
  delete semantic.materialized_file_location;
  outcome.source_record_hash = semanticHashV1(semantic);
  fs.appendFileSync(
    path.join(target, "soil_moisture", "2026-06-04.jsonl"),
    `${JSON.stringify(outcome)}\n`,
    "utf8",
  );
  return target;
}

async function executeCap05TerminalChain(databaseUrl: string): Promise<void> {
  const decisionOutput = run(process.platform === "win32" ? "pnpm.cmd" : "pnpm", [
    "-w", "exec", "tsx", "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_HUMAN_DECISION_G_DB.ts",
  ], {
    env: {
      DATABASE_URL: databaseUrl,
      MCFT_CAP_05_S4_DESTRUCTIVE_ACCEPTANCE: "1",
    },
  });
  assert.ok(decisionOutput.includes("0 FAIL"), "CAP05_DECISION_PREDECESSOR_REPRODUCTION_REQUIRED");

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    await establishStandardFeedbackPath(pool);
    const expiredPredecessorLease = await pool.query(
      `UPDATE twin_runtime_lease_v1
          SET expires_at=transaction_timestamp()-interval '1 second'
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3
          AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
      scopeValues(),
    );
    assert.equal(expiredPredecessorLease.rowCount, 1, "S0_PREDECESSOR_LEASE_CARDINALITY");
    ok("expired inherited predecessor lease permits fenced S0 owner takeover without weakening mutual exclusion");
  } finally {
    await pool.end();
  }

  const replayRoot = buildS0HAuthoritativeReplayViewV1();
  fs.mkdirSync(absolute("acceptance-output"), { recursive: true });
  const runnerInput = {
    database_url: databaseUrl,
    replay_root: replayRoot,
    source_matrix_path: "docs/digital_twin/mcft/GEOX-MCFT-00-SOURCE-BINDING-MATRIX.json",
    scope: EXPECTED_SCOPE,
    authorized_future_forcing_binding_ids: ["weather_assumption_c8_replay_v1", "et0_future_assumption_c8_v1"],
    crop_stage_context: readJson("fixtures/mcft/water_state/replay_v1/configuration_context.json"),
    lease_owner: "mcft-cap06-s0-predecessor-lock",
    lease_duration_seconds: 300,
  };
  writeJson(TEMP_RUNNER_INPUT_PATH, runnerInput);
  const runnerOutput = run(process.platform === "win32" ? "pnpm.cmd" : "pnpm", [
    "-w", "exec", "tsx", "apps/server/scripts/mcft/MCFT_CAP_05_HUMAN_DECISION_FEEDBACK_RUNNER.ts",
    "--input", TEMP_RUNNER_INPUT_PATH,
  ], { env: { DATABASE_URL: databaseUrl } });
  const runnerLine = runnerOutput.trim().split(/\r?\n/).find((line) => line.startsWith("{"));
  assert.ok(runnerLine, "CAP05_TERMINAL_RUNNER_RESULT_REQUIRED");
  const runnerResult = JSON.parse(runnerLine) as any;
  assert.equal(runnerResult.ok, true, "CAP05_TERMINAL_RUNNER_MUST_SUCCEED");
  assert.equal(runnerResult.result.final_committed_sequence, EXPECTED_CHECKPOINT_SEQUENCE, "CAP05_TERMINAL_SEQUENCE_MISMATCH");
  assert.equal(runnerResult.result.final_next_logical_tick_time, EXPECTED_NEXT_LOGICAL_TIME, "CAP05_TERMINAL_NEXT_TIME_MISMATCH");
  assert.equal(runnerResult.result.established_tick_count, 8, "CAP05_TERMINAL_TICK_COUNT_MISMATCH");
  assert.equal(runnerResult.result.successful_forecast_run_count, 8, "CAP05_TERMINAL_FORECAST_COUNT_MISMATCH");
  assert.equal(runnerResult.result.scenario_set_count, 8, "CAP05_TERMINAL_SCENARIO_COUNT_MISMATCH");
  fs.rmSync(absolute(TEMP_RUNNER_INPUT_PATH), { force: true });
  fs.rmSync(replayRoot, { recursive: true, force: true });
  ok("completed MCFT-CAP-05 bounded eight-tick terminal chain is reproduced in isolated PostgreSQL");
}

async function extractIdentity(pool: Pool): Promise<any> {
  const values = scopeValues();
  const active = await pool.query("SELECT active_lineage_ref FROM twin_active_lineage_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6", values);
  const stateLatest = await pool.query("SELECT state_object_id FROM twin_state_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6", values);
  const checkpointLatest = await pool.query("SELECT checkpoint_object_id FROM twin_runtime_checkpoint_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6", values);
  const forecastLatest = await pool.query("SELECT forecast_object_id,forecast_status FROM twin_forecast_result_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6", values);
  const successfulLatest = await pool.query("SELECT forecast_object_id FROM twin_forecast_success_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6", values);
  const scenarioLatest = await pool.query("SELECT scenario_set_id,source_forecast_ref,source_forecast_hash FROM twin_scenario_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6", values);

  for (const [name, rows] of [["ACTIVE_LINEAGE", active.rows], ["STATE", stateLatest.rows], ["CHECKPOINT", checkpointLatest.rows], ["FORECAST", forecastLatest.rows], ["SUCCESSFUL_FORECAST", successfulLatest.rows], ["SCENARIO", scenarioLatest.rows]] as const) {
    assert.equal(rows.length, 1, `${name}_POINTER_CARDINALITY`);
  }

  const lineage = await readCanonicalObject(pool, active.rows[0].active_lineage_ref, "twin_runtime_lineage_v1");
  const state = await readCanonicalObject(pool, stateLatest.rows[0].state_object_id, "twin_state_estimate_v1");
  const checkpoint = await readCanonicalObject(pool, checkpointLatest.rows[0].checkpoint_object_id, "twin_runtime_checkpoint_v1");
  const forecast = await readCanonicalObject(pool, forecastLatest.rows[0].forecast_object_id, "twin_forecast_run_v1");
  const successfulForecast = await readCanonicalObject(pool, successfulLatest.rows[0].forecast_object_id, "twin_forecast_run_v1");
  const scenario = await readCanonicalObject(pool, scenarioLatest.rows[0].scenario_set_id, "twin_scenario_set_v1");
  const runtimeConfig = await readCanonicalObject(pool, state.runtime_config_ref, "twin_runtime_config_v1");

  for (const object of [state, checkpoint, forecast, successfulForecast, scenario]) {
    assert.equal(object.lineage_id, lineage.lineage_id, `${object.object_type}:LINEAGE_ID_MISMATCH`);
    assert.equal(object.revision_id, lineage.revision_id, `${object.object_type}:REVISION_ID_MISMATCH`);
    assert.equal(object.logical_time, EXPECTED_LAST_LOGICAL_TIME, `${object.object_type}:FINAL_LOGICAL_TIME_MISMATCH`);
  }

  assert.equal(checkpoint.payload.tick_sequence, EXPECTED_CHECKPOINT_SEQUENCE, "CHECKPOINT_SEQUENCE_MISMATCH");
  assert.equal(checkpoint.payload.next_tick_logical_time, EXPECTED_NEXT_LOGICAL_TIME, "CHECKPOINT_NEXT_TIME_MISMATCH");
  assert.equal(checkpoint.payload.last_posterior_state_ref, state.object_id, "CHECKPOINT_STATE_REF_MISMATCH");
  assert.equal(checkpoint.payload.forecast_result_ref, forecast.object_id, "CHECKPOINT_FORECAST_REF_MISMATCH");
  assert.equal(forecast.object_id, successfulForecast.object_id, "LATEST_AND_SUCCESSFUL_FORECAST_MUST_MATCH");
  assert.equal(forecastLatest.rows[0].forecast_status, "COMPLETED", "FORECAST_PROJECTION_STATUS_MISMATCH");
  assert.equal(forecast.payload.status, "COMPLETED", "FORECAST_STATUS_MISMATCH");
  assert.equal(forecast.payload.points.length, 72, "FORECAST_POINTS_MUST_EQUAL_72");
  assert.equal(scenario.payload.source_forecast_ref, forecast.object_id, "SCENARIO_PAYLOAD_FORECAST_REF_MISMATCH");
  assert.equal(scenario.payload.source_forecast_hash, forecast.determinism_hash, "SCENARIO_PAYLOAD_FORECAST_HASH_MISMATCH");
  assert.equal(scenario.payload.options.length, 3, "SCENARIO_OPTIONS_MUST_EQUAL_3");
  assert.equal(state.runtime_config_ref, runtimeConfig.object_id, "STATE_RUNTIME_CONFIG_REF_MISMATCH");
  assert.equal(state.runtime_config_hash, runtimeConfig.determinism_hash, "STATE_RUNTIME_CONFIG_HASH_MISMATCH");

  const stateCount = await pool.query("SELECT count(*)::int AS count FROM facts WHERE record_json->>'type'='twin_state_estimate_v1'");
  assert.equal(
    stateCount.rows[0].count,
    EXPECTED_REPRODUCED_STATE_FACT_COUNT,
    "REPRODUCED_STATE_FACT_COUNT_MISMATCH",
  );
  const activeConfigTables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name ILIKE '%active%config%'");
  assert.equal(activeConfigTables.rows.length, 0, "ACTIVE_CONFIG_INDEX_MUST_NOT_BE_ESTABLISHED");

  ok("PostgreSQL canonical lineage, State, checkpoint, successful Forecast, Scenario, explicit State-bound Config, and terminal counts are mutually consistent");

  return {
    extraction_source: "ISOLATED_POSTGRESQL_CANONICAL_READ_PATH",
    scope: EXPECTED_SCOPE,
    active_lineage_ref: lineage.object_id,
    active_lineage_hash: lineage.determinism_hash,
    lineage_id: lineage.lineage_id,
    revision_id: lineage.revision_id,
    latest_posterior_state_ref: state.object_id,
    latest_posterior_state_hash: state.determinism_hash,
    latest_checkpoint_ref: checkpoint.object_id,
    latest_checkpoint_hash: checkpoint.determinism_hash,
    latest_successful_forecast_ref: successfulForecast.object_id,
    latest_successful_forecast_hash: successfulForecast.determinism_hash,
    latest_scenario_set_ref: scenario.object_id,
    latest_scenario_set_hash: scenario.determinism_hash,
    state_bound_runtime_config_ref: runtimeConfig.object_id,
    state_bound_runtime_config_hash: runtimeConfig.determinism_hash,
    config_authority_mode: "EXPLICIT_REPLAY_PIN",
    active_binding_status: "NOT_ESTABLISHED",
    active_binding_ref: null,
    active_binding_hash: null,
    checkpoint_sequence: checkpoint.payload.tick_sequence,
    reproduced_state_fact_count: stateCount.rows[0].count,
    historical_s10_declared_global_state_count: HISTORICAL_S10_DECLARED_GLOBAL_STATE_COUNT,
    historical_s10_orchestrator_canonical_object_fact_delta: HISTORICAL_S10_ORCHESTRATOR_CANONICAL_OBJECT_FACT_DELTA,
    state_count_reconciliation: STATE_COUNT_RECONCILIATION,
    latest_logical_time: state.logical_time,
    next_tick_logical_time: checkpoint.payload.next_tick_logical_time,
  };
}

async function qualifyResidualHistory(pool: Pool, identity: any): Promise<any> {
  const result = await pool.query("SELECT record_json FROM facts WHERE record_json->>'type'='twin_forecast_residual_v1' ORDER BY (record_json->'payload'->>'logical_time')::timestamptz, record_json->'payload'->>'object_id'");
  const residuals = result.rows.map((row) => factEnvelope(row.record_json));
  const eligible: any[] = [];

  for (const residual of residuals) {
    const payload = residual.payload;
    const sameScope = Object.entries(EXPECTED_SCOPE).every(([key, value]) => residual[key] === value);
    const targetMatches = payload.forecast_target_time === payload.actual_observation_observed_at;
    const issuedBeforeAvailable = Date.parse(payload.forecast_issued_at) < Date.parse(payload.observation_available_to_runtime_at);
    const passQuality = payload.actual_observation_quality === "PASS";
    const unitCorrect = payload.actual_observation_unit === "fraction" && payload.residual_unit === "fraction";
    const contextMatches = residual.context_lineage_ref === identity.lineage_id && residual.context_revision_ref === identity.revision_id;
    if (sameScope && targetMatches && issuedBeforeAvailable && passQuality && unitCorrect && contextMatches) eligible.push(residual);
  }

  const forecastRefs = [...new Set(eligible.map((residual) => residual.payload.forecast_run_ref))];
  const observationRefs = [...new Set(eligible.map((residual) => residual.payload.actual_observation_ref))];
  const configRefs = [...new Set(eligible.map((residual) => residual.payload.runtime_config_ref))];
  const configPayloads: any[] = [];
  for (const configRef of configRefs) configPayloads.push((await readCanonicalObject(pool, configRef, "twin_runtime_config_v1")).payload);

  const modelHashes = new Set(configPayloads.map((payload) => semanticHash(payload.model_component_refs ?? payload.dynamics_model ?? {})));
  const bundleHashes = new Set(configPayloads.map((payload) => semanticHash({ soil: payload.soil_hydraulic_snapshot, dynamics: payload.dynamics_parameters })));
  const operatorHashes = new Set(eligible.map((residual) => semanticHash({
    id: residual.payload.observation_operator_id,
    version: residual.payload.observation_operator_version,
    h: residual.payload.observation_operator_h,
    representativeness_variance: residual.payload.representativeness_variance,
  })));
  const geometryHashes = new Set(eligible.map((residual) => residual.payload.root_zone_geometry_hash));
  const numericHashes = new Set(configPayloads.map((payload) => semanticHash({ rounding: payload.rounding, dynamics_parameters: payload.dynamics_parameters })));

  const status = eligible.length >= 24 ? "READY_FOR_CALIBRATION_ASSESSMENT" : "INSUFFICIENT_MATCHED_PAIRS";
  const qualification = {
    schema_version: "geox_mcft_cap_06_dataset_qualification_v1",
    qualification_id: `mcft_cap06_qualification_${crypto.createHash("sha256").update(eligible.map((item) => item.object_id).join("|")).digest("hex").slice(0, 24)}`,
    source_scope: EXPECTED_SCOPE,
    qualification_track: "REPOSITORY_HISTORY_QUALIFICATION_TRACK",
    extraction_source: "ISOLATED_POSTGRESQL_CANONICAL_READ_PATH",
    eligible_forecast_count: forecastRefs.length,
    eligible_observation_count: observationRefs.length,
    eligible_matched_pair_count: eligible.length,
    eligible_residual_count: eligible.length,
    eligible_calibration_count: eligible.length >= 24 ? 16 : 0,
    eligible_holdout_count: eligible.length >= 24 ? 8 : 0,
    calibration_window_refs: eligible.length >= 24 ? eligible.slice(0, 16).map((item) => item.object_id) : [],
    holdout_window_refs: eligible.length >= 24 ? eligible.slice(16, 24).map((item) => item.object_id) : [],
    model_component_hash_count: modelHashes.size,
    effective_parameter_bundle_hash_count: bundleHashes.size,
    observation_operator_hash_count: operatorHashes.size,
    geometry_hash_count: geometryHashes.size,
    runtime_replay_numeric_policy_hash_count: numericHashes.size,
    case_graph_validation_status: eligible.length === residuals.length ? "PASS" : "FAIL",
    dataset_qualification_status: status,
    qualification_limitations: status === "INSUFFICIENT_MATCHED_PAIRS"
      ? [
          "CURRENT_CANONICAL_HISTORY_CONTAINS_FEWER_THAN_24_ELIGIBLE_MATCHED_RESIDUAL_CASES",
          "NO_CALIBRATION_GRID_SEARCH_EXECUTED_BY_S0",
          "NO_CANDIDATE_OR_EVALUATION_CANONICALIZED",
        ]
      : ["STRUCTURAL_QUALIFICATION_ONLY_NO_PARAMETER_REPLAY_BY_S0"],
    eligible_residual_refs: eligible.map((item) => item.object_id),
    eligible_residual_hashes: eligible.map((item) => item.determinism_hash),
    sensitive_case_count: null,
    excited_case_count: null,
    objective_surface_status: null,
    selected_parameter: null,
  };

  assert.equal(qualification.case_graph_validation_status, "PASS", "ELIGIBLE_RESIDUAL_GRAPH_VALIDATION_REQUIRED");
  assert.equal(qualification.dataset_qualification_status, "INSUFFICIENT_MATCHED_PAIRS", "CURRENT_REPOSITORY_HISTORY_EXPECTED_INSUFFICIENT");
  assert.equal(qualification.eligible_residual_count, 1, "CAP05_TERMINAL_HISTORY_EXPECTS_ONE_CANONICAL_RESIDUAL");
  ok("repository-history structural qualification reports one eligible canonical Residual and INSUFFICIENT_MATCHED_PAIRS without grid search");
  return qualification;
}

function replaceMarkedSection(text: string, begin: string, end: string, section: string): string {
  if (text.includes(begin) && text.includes(end)) {
    const prefix = text.split(begin, 1)[0].trimEnd();
    const suffix = text.split(end, 2)[1].replace(/^\n+/, "");
    return `${prefix}${section}${suffix ? `\n${suffix}` : ""}`;
  }
  return `${text.trimEnd()}${section}`;
}

function materializeGovernance(identity: any, qualification: any): void {
  const p0Evidence = {
    pr_number: P0_PR,
    exact_head_commit: P0_EXACT_HEAD,
    exact_head_ci_run: P0_EXACT_HEAD_WORKFLOW,
    merge_commit: P0_MERGE_COMMIT,
    postmerge_probe_pr_number: P0_POSTMERGE_PROBE_PR,
    postmerge_workflow_run: P0_POSTMERGE_WORKFLOW,
    postmerge_gate: "PASS",
    head_to_merge_file_delta_count: 0,
    tree_equivalence: "PASS",
    effectiveness_condition_satisfied: true,
  };

  const p0Status = readJson(P0_STATUS_PATH);
  p0Status.status = "MERGED_EFFECTIVE";
  p0Status.effectiveness = {
    ...p0Status.effectiveness,
    effective: true,
    implementation_pr_number: P0_PR,
    exact_head_commit: P0_EXACT_HEAD,
    exact_head_ci_run: P0_EXACT_HEAD_WORKFLOW,
    merge_commit: P0_MERGE_COMMIT,
    head_to_merge_file_delta_count: 0,
    tree_equivalence: "PASS",
    postmerge_probe_pr_number: P0_POSTMERGE_PROBE_PR,
    postmerge_workflow_run: P0_POSTMERGE_WORKFLOW,
    postmerge_gate: "PASS",
    postmerge_probe_closed_without_merge: true,
  };
  writeJson(P0_STATUS_PATH, p0Status);

  writeJson(LOCK_PATH, {
    schema_version: "geox_mcft_cap_06_predecessor_lock_v1",
    capability_line_id: "MCFT-CAP-06",
    predecessor_capability_line_id: "MCFT-CAP-05",
    status: "COMPLETE",
    baseline_main_commit: BASELINE_MAIN,
    p0_effectiveness: p0Evidence,
    predecessor_closure_record_ref: CAP05_CLOSURE_PATH,
    predecessor_main_verification_ref: CAP05_MAIN_PATH,
    identity_extraction_source: identity.extraction_source,
    expected_scope: EXPECTED_SCOPE,
    expected_checkpoint: {
      checkpoint_sequence: EXPECTED_CHECKPOINT_SEQUENCE,
      reproduced_state_fact_count: EXPECTED_REPRODUCED_STATE_FACT_COUNT,
      historical_s10_declared_global_state_count: HISTORICAL_S10_DECLARED_GLOBAL_STATE_COUNT,
      historical_s10_orchestrator_canonical_object_fact_delta: HISTORICAL_S10_ORCHESTRATOR_CANONICAL_OBJECT_FACT_DELTA,
      state_count_reconciliation: STATE_COUNT_RECONCILIATION,
      last_logical_time: EXPECTED_LAST_LOGICAL_TIME,
      next_tick_logical_time: EXPECTED_NEXT_LOGICAL_TIME,
    },
    canonical_identity: identity,
    dataset_qualification_ref: QUALIFICATION_PATH,
    validated_relations: [
      "active_lineage_ref_resolves_exactly_one_canonical_lineage",
      "lineage_and_revision_consistent_across_terminal_objects",
      "checkpoint_last_posterior_state_ref_matches_latest_state",
      "checkpoint_forecast_result_ref_matches_latest_completed_forecast",
      "latest_forecast_equals_latest_successful_forecast",
      "latest_scenario_source_forecast_ref_hash_matches_latest_successful_forecast",
      "state_runtime_config_ref_hash_matches_exact_canonical_runtime_config",
      "config_authority_mode_is_explicit_replay_pin",
      "active_binding_status_is_not_established_with_null_refs",
      "checkpoint_sequence_equals_80",
      "reproduced_state_fact_count_equals_33",
      "historical_s10_declared_global_state_count_81_preserved_without_reuse_as_state_count",
      "historical_s10_orchestrator_canonical_object_fact_delta_equals_81",
      "state_count_semantic_reconciliation_is_explicit",
      "latest_logical_time_equals_2026_06_04T09_00_00Z",
      "next_tick_logical_time_equals_2026_06_04T10_00_00Z",
    ],
    failure_policy: {
      canonical_value_mismatch: "FAIL_CLOSED",
      missing_projection_or_canonical_object: "FAIL_CLOSED",
      latest_and_successful_forecast_divergence: "FAIL_CLOSED",
      scenario_forecast_binding_mismatch: "FAIL_CLOSED",
      active_binding_substitution: "FORBIDDEN",
      fixture_object_id_substitution: "FORBIDDEN",
      predecessor_fact_mutation: "FORBIDDEN",
      manual_alternate_start: "FORBIDDEN",
    },
    preserved_nonclaims: [...PRESERVED_NONCLAIMS],
    effectiveness_condition: "POSTGRESQL_IDENTITY_AND_QUALIFICATION_EXTRACTED_AND_S0_PR_MERGED_AND_MERGED_MAIN_AUTHORIZATION_GATE_PASS",
  });

  writeJson(QUALIFICATION_PATH, qualification);

  writeJson(AUTHORIZATION_STATUS_PATH, {
    schema_version: "geox_mcft_cap_06_authorization_status_v1",
    authorization_id: "MCFT-CAP-06-AUTHORIZATION-V1",
    capability_line_id: "MCFT-CAP-06",
    display_alias: "MCFT-6",
    name: "Calibration Candidate and Shadow Evaluation",
    runtime_mode: "REPLAY",
    target_completion_level: "Level A — Deterministic Replay Twin",
    status: "READY_FOR_MERGE",
    design_status: "CONDITIONAL_FROZEN_AFTER_P_MINUS_1",
    implementation_status: "S0_CANDIDATE",
    authorization_effective: false,
    runtime_source_authorized: false,
    authorization_effectiveness_condition: "S0_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_AUTHORIZATION_GATE_PASS",
    baseline_main_commit: BASELINE_MAIN,
    branch: BRANCH,
    active_delivery_slice_id: null,
    task_ref: TASK_PATH,
    authorization_document_ref: AUTHORIZATION_PATH,
    delivery_status_ref: DELIVERY_PATH,
    predecessor_lock_ref: LOCK_PATH,
    dataset_qualification_ref: QUALIFICATION_PATH,
    predecessor: {
      capability_line_id: "MCFT-CAP-05",
      status: "COMPLETE",
      closure_effective: true,
      capability_complete: true,
      checkpoint_sequence: identity.checkpoint_sequence,
      reproduced_state_fact_count: identity.reproduced_state_fact_count,
      historical_s10_declared_global_state_count: identity.historical_s10_declared_global_state_count,
      historical_s10_orchestrator_canonical_object_fact_delta: identity.historical_s10_orchestrator_canonical_object_fact_delta,
      state_count_reconciliation: identity.state_count_reconciliation,
      latest_logical_time: identity.latest_logical_time,
      next_tick_logical_time: identity.next_tick_logical_time,
      latest_successful_forecast_ref: identity.latest_successful_forecast_ref,
      latest_scenario_set_ref: identity.latest_scenario_set_ref,
      state_bound_runtime_config_ref: identity.state_bound_runtime_config_ref,
      config_authority_mode: identity.config_authority_mode,
      active_binding_status: identity.active_binding_status,
    },
    p0_effectiveness: p0Evidence,
    dataset_qualification_status: qualification.dataset_qualification_status,
    current_blockers: ["MCFT_CAP_06_S0_PR_MERGED", "MCFT_CAP_06_S0_MERGED_MAIN_AUTHORIZATION_GATE_PASS"],
    next_authorized_slice_id_after_effectiveness: S1,
    preserved_nonclaims: [...PRESERVED_NONCLAIMS],
    repository_write_scope: "S0_GOVERNANCE_AND_READ_ONLY_POSTGRESQL_QUALIFICATION",
    exact_changed_file_boundary: [...EXACT_CHANGED_FILES],
    successor_capability_line_id: "MCFT-CAP-07",
    successor_authorized: false,
  });

  writeJson(DELIVERY_PATH, {
    schema_version: "geox_mcft_cap_06_delivery_slice_status_v1",
    capability_line_id: "MCFT-CAP-06",
    status: "S0_READY_FOR_MERGE",
    design_status: "CONDITIONAL_FROZEN_AFTER_P_MINUS_1",
    implementation_status: "S0_CANDIDATE",
    baseline_main_commit: BASELINE_MAIN,
    branch: BRANCH,
    authorization_effective: false,
    runtime_source_authorized: false,
    active_delivery_slice_id: null,
    completed_or_effective_slices: [
      { delivery_slice_id: "MCFT-CAP-06.P-1.DT02-CALIBRATION-SHADOW-ADJUDICATION-V1", status: "MERGED_EFFECTIVE", merge_commit: "79cd7814eff06ad86f86cdcb379c6f71a77f1ab8", postmerge_probe_pr_number: 2497, postmerge_workflow_run: 29418272690 },
      { delivery_slice_id: P0, status: "MERGED_EFFECTIVE", merge_commit: P0_MERGE_COMMIT, postmerge_probe_pr_number: P0_POSTMERGE_PROBE_PR, postmerge_workflow_run: P0_POSTMERGE_WORKFLOW },
    ],
    candidate_slices: [{ delivery_slice_id: S0, status: "READY_FOR_MERGE" }],
    blocked_slices: [
      S1,
      "MCFT-CAP-06.MCFT-02-06-07-09-11-12.CALIBRATION-SHADOW-CONTRACTS-MATH-V1",
      "MCFT-CAP-06.MCFT-03-12.D-GOVERNANCE-PERSISTENCE-RECOVERY-V1",
      "MCFT-CAP-06.MCFT-06-09-11-12.CALIBRATION-CANDIDATE-COMPUTE-COMMIT-V1",
      "MCFT-CAP-06.MCFT-06-09-11-12.PAIRED-HISTORICAL-SHADOW-COMPUTE-V1",
      "MCFT-CAP-06.MCFT-03-12.SHADOW-EVALUATION-COMMIT-V1",
    ],
    omitted_conditional_slices: [
      "MCFT-CAP-06.P-1A.DT02-ARCHITECTURE-AMENDMENT-V1",
      "MCFT-CAP-06.MCFT-02-12.CALIBRATION-GOVERNANCE-CONFIG-V1",
    ],
    predecessor_lock_ref: LOCK_PATH,
    dataset_qualification_ref: QUALIFICATION_PATH,
    next_authorized_slice_ids: [],
    next_authorized_slice_id_after_merge_and_postmerge_gate: S1,
    successor_capability_line_id: "MCFT-CAP-07",
    successor_authorized: false,
  });

  const authorization = `<!-- ${AUTHORIZATION_PATH} -->
# GEOX MCFT-CAP-06 Authorization, Predecessor Lock and Structural Qualification

## Authority

\`\`\`text
authorization_id:
MCFT-CAP-06-AUTHORIZATION-V1

delivery_slice_id:
${S0}

baseline_main_commit:
${BASELINE_MAIN}

authorization_status:
READY_FOR_MERGE

authorization_effective:
false

runtime_source_authorized:
false

active_delivery_slice_id:
null

effectiveness_condition:
S0_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_AUTHORIZATION_GATE_PASS
\`\`\`

## P0 effectiveness

\`\`\`text
P0 PR: #${P0_PR}
P0 exact head: ${P0_EXACT_HEAD}
P0 exact-head workflow: ${P0_EXACT_HEAD_WORKFLOW} SUCCESS
P0 merge commit: ${P0_MERGE_COMMIT}
P0 head-to-merge file delta: 0
P0 postmerge probe PR: #${P0_POSTMERGE_PROBE_PR} CLOSED_WITHOUT_MERGE
P0 postmerge workflow: ${P0_POSTMERGE_WORKFLOW} SUCCESS
P0 postmerge Gate: PASS
\`\`\`

## PostgreSQL predecessor proof

\`\`\`text
active_lineage_ref: ${identity.active_lineage_ref}
lineage_id: ${identity.lineage_id}
revision_id: ${identity.revision_id}
latest_posterior_state_ref: ${identity.latest_posterior_state_ref}
latest_checkpoint_ref: ${identity.latest_checkpoint_ref}
latest_successful_forecast_ref: ${identity.latest_successful_forecast_ref}
latest_scenario_set_ref: ${identity.latest_scenario_set_ref}
state_bound_runtime_config_ref: ${identity.state_bound_runtime_config_ref}
config_authority_mode: ${identity.config_authority_mode}
active_binding_status: ${identity.active_binding_status}
checkpoint_sequence: ${identity.checkpoint_sequence}
reproduced_state_fact_count: ${identity.reproduced_state_fact_count}
historical_s10_declared_global_state_count: ${identity.historical_s10_declared_global_state_count}
historical_s10_orchestrator_canonical_object_fact_delta: ${identity.historical_s10_orchestrator_canonical_object_fact_delta}
state_count_reconciliation: ${identity.state_count_reconciliation}
latest_logical_time: ${identity.latest_logical_time}
next_tick_logical_time: ${identity.next_tick_logical_time}
\`\`\`

## Structural dataset qualification

\`\`\`text
status: ${qualification.dataset_qualification_status}
eligible Forecast count: ${qualification.eligible_forecast_count}
eligible Observation count: ${qualification.eligible_observation_count}
eligible matched pair count: ${qualification.eligible_matched_pair_count}
eligible Residual count: ${qualification.eligible_residual_count}
eligible calibration count: ${qualification.eligible_calibration_count}
eligible holdout count: ${qualification.eligible_holdout_count}
case graph validation: ${qualification.case_graph_validation_status}
\`\`\`

S0 performs structural qualification only. It executes no parameter replay, sensitivity analysis, objective-surface analysis, Candidate creation, Evaluation creation, Model Activation, or active-config change.

## Delivery authority

Before S0 merge and merged-main Authorization Gate:

\`\`\`text
authorization_effective: false
runtime_source_authorized: false
active_delivery_slice_id: null
next_authorized_slice_ids: []
\`\`\`

After S0 merge and merged-main Authorization Gate, only the following slice becomes eligible:

\`\`\`text
${S1}
\`\`\`

## Exact changed-file boundary

${EXACT_CHANGED_FILES.map((file) => `- \`${file}\``).join("\n")}

## Preserved nonclaims

\`\`\`text
${PRESERVED_NONCLAIMS.join("\n")}
\`\`\`
`;
  writeText(AUTHORIZATION_PATH, authorization);

  const matrix = readJson(MATRIX_PATH);
  const cap05 = matrix.capability_lines.find((line: any) => line.capability_line_id === "MCFT-CAP-05");
  const cap06 = matrix.capability_lines.find((line: any) => line.capability_line_id === "MCFT-CAP-06");
  assert.equal(cap05?.status, "COMPLETE", "CAP05_MATRIX_COMPLETE_REQUIRED");
  assert.equal(cap05?.active_delivery_slice_id, null, "CAP05_MATRIX_ACTIVE_SLICE_MUST_BE_NULL");
  assert.ok(cap06, "CAP06_MATRIX_ENTRY_REQUIRED");
  Object.assign(cap06, {
    status: "NOT_AUTHORIZED",
    design_status: "CONDITIONAL_FROZEN_AFTER_P_MINUS_1",
    implementation_status: "S0_CANDIDATE",
    authorization_id: "MCFT-CAP-06-AUTHORIZATION-V1",
    authorization_status: "READY_FOR_MERGE",
    authorization_effective: false,
    runtime_source_authorized: false,
    predecessor_capability_line_id: "MCFT-CAP-05",
    predecessor_main_commit: BASELINE_MAIN,
    predecessor_lock_ref: LOCK_PATH,
    dataset_qualification_ref: QUALIFICATION_PATH,
    dataset_qualification_status: qualification.dataset_qualification_status,
    authorization_document_ref: AUTHORIZATION_PATH,
    authorization_status_ref: AUTHORIZATION_STATUS_PATH,
    delivery_status_ref: DELIVERY_PATH,
    active_delivery_slice_id: null,
    next_delivery_slice_id: S1,
    next_delivery_slice_authorized: false,
    next_authorized_slice_ids: [],
    next_authorized_slice_id_after_merge_and_postmerge_gate: S1,
    successor_capability_line_id: "MCFT-CAP-07",
    successor_authorized: false,
    effectiveness_condition: "S0_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_AUTHORIZATION_GATE_PASS",
    effectiveness_condition_satisfied: false,
  });
  matrix.latest_governance_update = S0;
  matrix.baseline = {
    branch: "main",
    commit: BASELINE_MAIN,
    meaning: "MCFT-CAP-06 P0 merged-main effective; S0 authorization, CAP-05 predecessor lock and structural dataset qualification candidate only",
  };
  writeJson(MATRIX_PATH, matrix);

  const taskBefore = readText(TASK_PATH);
  const begin = "<!-- MCFT-CAP-06-S0-CURRENT-STATE-BEGIN -->";
  const end = "<!-- MCFT-CAP-06-S0-CURRENT-STATE-END -->";
  const taskSection = `

${begin}
# 50. S0 authorization / predecessor lock / structural qualification candidate

\`\`\`text
baseline_main_commit:
${BASELINE_MAIN}

P0 status:
MERGED_EFFECTIVE

S0 status:
READY_FOR_MERGE

authorization_effective:
false

runtime_source_authorized:
false

active_delivery_slice_id:
null

predecessor checkpoint sequence:
${identity.checkpoint_sequence}

predecessor reproduced State fact count:
${identity.reproduced_state_fact_count}

historical S10 declared global State count:
${identity.historical_s10_declared_global_state_count}

historical S10 orchestrator canonical object fact delta:
${identity.historical_s10_orchestrator_canonical_object_fact_delta}

State-count reconciliation:
${identity.state_count_reconciliation}

predecessor latest logical time:
${identity.latest_logical_time}

predecessor next logical tick:
${identity.next_tick_logical_time}

config authority mode:
${identity.config_authority_mode}

active binding status:
${identity.active_binding_status}

dataset qualification status:
${qualification.dataset_qualification_status}

eligible canonical Residual count:
${qualification.eligible_residual_count}

S1 authorized:
false

next eligible after S0 effectiveness:
${S1}
\`\`\`

S0 only reads and structurally qualifies the reconstructed canonical history. It does not create Residual, Candidate, Evaluation, Model Activation, State, checkpoint or active-config authority.
${end}
`;
  let task = replaceMarkedSection(taskBefore, begin, end, taskSection);
  task = task.replace("implementation_status:\nP_MINUS_1_COMPLETE", "implementation_status:\nS0_CANDIDATE");
  task = task.replace("first_permitted_repository_action:\nnull", `first_permitted_repository_action:\n${S0}`);
  writeText(TASK_PATH, task);

  const mapBegin = "<!-- MCFT-CAP-06-S0-CURRENT-STATE-BEGIN -->";
  const mapEnd = "<!-- MCFT-CAP-06-S0-CURRENT-STATE-END -->";
  const mapSection = `

${mapBegin}
## MCFT-CAP-06 S0 authorization and predecessor qualification candidate

\`\`\`text
baseline merged main: ${BASELINE_MAIN}
P0 status: MERGED_EFFECTIVE
S0 status: READY_FOR_MERGE
authorization effective: false
runtime source authorized: false
active delivery slice: null
checkpoint sequence: ${identity.checkpoint_sequence}
reproduced State fact count: ${identity.reproduced_state_fact_count}
historical S10 declared global State count: ${identity.historical_s10_declared_global_state_count}
historical S10 orchestrator canonical object fact delta: ${identity.historical_s10_orchestrator_canonical_object_fact_delta}
State-count reconciliation: ${identity.state_count_reconciliation}
latest logical time: ${identity.latest_logical_time}
next logical tick: ${identity.next_tick_logical_time}
config authority mode: ${identity.config_authority_mode}
active binding status: ${identity.active_binding_status}
dataset qualification: ${qualification.dataset_qualification_status}
eligible canonical Residuals: ${qualification.eligible_residual_count}
next eligible after merged-main S0 Gate: ${S1}
successor MCFT-CAP-07 authorized: false
\`\`\`

The S0 candidate contains governance artifacts and isolated PostgreSQL readback/qualification only. Runtime source remains forbidden until S0 merges and its merged-main Authorization Gate passes.
${mapEnd}
`;
  writeText(MAP_PATH, replaceMarkedSection(readText(MAP_PATH), mapBegin, mapEnd, mapSection));
}

async function main(): Promise<void> {
  if (process.env.MCFT_CAP_06_S0_DESTRUCTIVE_ACCEPTANCE !== "1") fail("SET_MCFT_CAP_06_S0_DESTRUCTIVE_ACCEPTANCE_1");
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) fail("DATABASE_URL_REQUIRED");
  ok(`database name is explicitly isolated for acceptance: ${resolveDatabaseName(databaseUrl)}`);
  assertRepositoryBoundary();

  const p0Status = readJson(P0_STATUS_PATH);
  const cap05Closure = readJson(CAP05_CLOSURE_PATH);
  const cap05Main = readJson(CAP05_MAIN_PATH);
  assert.equal(p0Status.status, "PROVISIONAL_SSOT_CANDIDATE", "P0_CANDIDATE_STATUS_REQUIRED_BEFORE_S0_MATERIALIZATION");
  assert.equal(cap05Closure.capability_complete, true, "CAP05_CLOSURE_COMPLETE_REQUIRED");
  assert.equal(cap05Main.capability_complete, true, "CAP05_MAIN_COMPLETE_REQUIRED");
  ok("P0 evidence and CAP-05 terminal governance authority are exact");

  await executeCap05TerminalChain(databaseUrl);
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const identity = await extractIdentity(pool);
    const qualification = await qualifyResidualHistory(pool, identity);
    materializeGovernance(identity, qualification);
    ok("predecessor lock, structural qualification, authorization, delivery status, task state, matrix and implementation map are materialized");
  } finally {
    await pool.end();
  }

  fs.rmSync(absolute("acceptance-output"), { recursive: true, force: true });
  run(process.platform === "win32" ? "git.exe" : "git", ["diff", "--check", BASELINE_MAIN]);
  ok("S0 working-tree diff check PASS");
  console.log(`MCFT-CAP-06 predecessor preflight: ${pass} PASS, 0 FAIL`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

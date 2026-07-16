// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S0_V2_EXACT_QUALIFICATION.ts
// Purpose: reproduce the completed MCFT-CAP-05 terminal chain in isolated PostgreSQL, extract the exact predecessor handoff, and qualify canonical Residual history through full graph traversal.
// Boundary: destructive isolated-database acceptance and read-only qualification only; no CAP-06 Runtime source, migration, Residual/Candidate/Evaluation canonical write, Model Activation, active-config switch, public route, Web, scheduler, or CAP-07 authority.

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
const BASELINE_MAIN = "ca819ba51bdf3017dbefa96015f76bd3b66a647c";
const BRANCH = "agent/mcft-cap-06-s0-v2-exact-qualification";
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
const PREFLIGHT_PATH = "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S0_V2_EXACT_QUALIFICATION.ts";
const CAP05_CLOSURE_PATH = "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-CLOSURE-RECORD.json";
const CAP05_MAIN_PATH = "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-MAIN-VERIFICATION.json";
const TEMP_WORKFLOW_PATH = ".github/workflows/mcft-cap-06-s0-v2-materialize.yml";
const TEMP_RUNNER_INPUT_PATH = "acceptance-output/MCFT_CAP_06_S0_RUNNER_INPUT.json";
const CI_WRAPPER_PATH = "scripts/runtime_acceptance/RUN_MCFT_CAP_06_S0_V2_HONEST_QUALIFICATION.cjs";
const ACCEPTANCE_RUNNER_PATH = "scripts/acceptance/run_acceptance.cjs";

const EXACT_CHANGED_FILES = Object.freeze([
  MAP_PATH,
  MATRIX_PATH,
  TASK_PATH,
  AUTHORIZATION_PATH,
  AUTHORIZATION_STATUS_PATH,
  LOCK_PATH,
  QUALIFICATION_PATH,
  DELIVERY_PATH,
  GATE_PATH,
  PREFLIGHT_PATH,
  CI_WRAPPER_PATH,
  ACCEPTANCE_RUNNER_PATH,
].sort());

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


function resolveDatabaseName(databaseUrl: string): string {
  const name = decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\//, ""));
  if (!name) fail("DATABASE_NAME_REQUIRED");
  if (!/(mcft|cap.*06|s0|acceptance|test)/i.test(name)) fail("ISOLATED_ACCEPTANCE_DATABASE_REQUIRED", name);
  return name;
}

function assertRepositoryBoundary(): void {
  const executionRef = process.env.GITHUB_HEAD_REF
    || process.env.GITHUB_REF_NAME
    || git(["branch", "--show-current"]);
  const candidateMode = executionRef === BRANCH;
  const mainOrSuccessorMode = executionRef === "main"
    || executionRef.startsWith("agent/mcft-cap-06-");
  assert.equal(candidateMode || mainOrSuccessorMode, true, `S0_EXECUTION_REF_FORBIDDEN:${executionRef}`);

  const originMain = git(["rev-parse", "refs/remotes/origin/main"]);
  if (candidateMode) assert.equal(originMain, BASELINE_MAIN, "ORIGIN_MAIN_HEAD_MISMATCH");
  run(process.platform === "win32" ? "git.exe" : "git", ["merge-base", "--is-ancestor", BASELINE_MAIN, "HEAD"]);

  if (candidateMode) {
    const committed = git(["diff", "--name-only", BASELINE_MAIN, "HEAD"]).split(/\r?\n/).filter(Boolean);
    const workingTracked = git(["diff", "--name-only", "HEAD"]).split(/\r?\n/).filter(Boolean);
    const untracked = git(["ls-files", "--others", "--exclude-standard"]).split(/\r?\n/).filter(Boolean);
    const generatedRuntimeArtifact = (file: string): boolean =>
      file === ".env.ci"
      || file === "docs/audit/CONTROLLED_PILOT_READINESS_REPORT.md"
      || file === "docs/audit/FRONTEND_RUNTIME_PAGE_AUDIT_REPORT.md"
      || file.startsWith("docs/audit/frontend-runtime-page-audit/")
      || file.startsWith("acceptance-output/");
    const changed = [...new Set([
      ...committed,
      ...workingTracked.filter((file) => !generatedRuntimeArtifact(file)),
      ...untracked.filter((file) => !generatedRuntimeArtifact(file)),
    ])].sort();
    const forbidden = changed.filter((file) => !EXACT_CHANGED_FILES.includes(file));
    assert.deepEqual(forbidden, [], `S0_CHANGED_FILE_BOUNDARY_VIOLATION:${forbidden.join(",")}`);
  } else {
    for (const relativePath of EXACT_CHANGED_FILES) {
      assert.equal(fs.existsSync(absolute(relativePath)), true, `S0_PERMANENT_FILE_MISSING:${relativePath}`);
    }
  }
  ok(candidateMode
    ? "branch, reconciled main baseline, ancestry, and exact S0 candidate boundary are exact"
    : "post-S0 ancestry and permanent qualification files are present");
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

function canonicalObjectHashV1(object: Record<string, unknown>): string {
  const semantic: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(object)) {
    if (key === "determinism_hash" || key === "created_at" || key === "fact_id" || key === "persisted_at") continue;
    semantic[key] = value;
  }
  return semanticHashV1(semantic);
}

function assertRecursiveCanonicalHashAuthority(): void {
  const base = {
    soil: { field_capacity_fraction: 0.3, saturation_fraction: 0.45 },
    dynamics: { drainage_coefficient_per_hour: 0.03, runoff_fraction: 0.05 },
  };
  const reordered = {
    dynamics: { runoff_fraction: 0.05, drainage_coefficient_per_hour: 0.03 },
    soil: { saturation_fraction: 0.45, field_capacity_fraction: 0.3 },
  };
  const soilChanged = {
    soil: { field_capacity_fraction: 0.31, saturation_fraction: 0.45 },
    dynamics: { drainage_coefficient_per_hour: 0.03, runoff_fraction: 0.05 },
  };
  const dynamicsChanged = {
    soil: { field_capacity_fraction: 0.3, saturation_fraction: 0.45 },
    dynamics: { drainage_coefficient_per_hour: 0.031, runoff_fraction: 0.05 },
  };
  assert.equal(semanticHashV1(base), semanticHashV1(reordered), "CANONICAL_HASH_KEY_ORDER_INVARIANCE_REQUIRED");
  assert.notEqual(semanticHashV1(base), semanticHashV1(soilChanged), "CANONICAL_HASH_NESTED_SOIL_CHANGE_MUST_DIFFER");
  assert.notEqual(semanticHashV1(base), semanticHashV1(dynamicsChanged), "CANONICAL_HASH_NESTED_DYNAMICS_CHANGE_MUST_DIFFER");
  ok("repository recursive canonical hash authority distinguishes nested semantics and ignores key order");
}

function sameScope(object: Record<string, unknown>): boolean {
  return Object.entries(EXPECTED_SCOPE).every(([key, value]) => object[key] === value);
}

function sameStringSet(left: readonly string[], right: readonly string[]): boolean {
  return JSON.stringify([...new Set(left)].sort()) === JSON.stringify([...new Set(right)].sort());
}

function maxIso(values: readonly string[]): string | null {
  if (values.length === 0) return null;
  const milliseconds = values.map((value) => Date.parse(value));
  if (milliseconds.some((value) => !Number.isFinite(value))) return null;
  return new Date(Math.max(...milliseconds)).toISOString();
}

async function qualifyResidualHistory(pool: Pool, identity: any): Promise<any> {
  assertRecursiveCanonicalHashAuthority();
  const result = await pool.query(
    "SELECT record_json FROM facts WHERE record_json->>'type'='twin_forecast_residual_v1' ORDER BY (record_json->'payload'->>'logical_time')::timestamptz, record_json->'payload'->>'object_id'",
  );
  const residuals = result.rows.map((row) => factEnvelope(row.record_json));
  const eligibleCases: any[] = [];
  const excludedCases: any[] = [];
  const invalidGraphCases: any[] = [];
  const availabilityInvalidCases: any[] = [];
  const seenTargets = new Map<string, string>();
  const seenSemanticCases = new Map<string, string>();

  for (const residual of residuals) {
    const exclusionReasons: string[] = [];
    const graphErrors: string[] = [];
    const availabilityErrors: string[] = [];
    const payload = residual.payload ?? {};
    const residualRef = String(residual.object_id ?? "");

    const resolveCanonical = async (ref: unknown, objectType: string, label: string): Promise<any | null> => {
      if (typeof ref !== "string" || !ref) {
        graphErrors.push(`${label}_REF_REQUIRED`);
        return null;
      }
      try {
        const object = await readCanonicalObject(pool, ref, objectType);
        if (canonicalObjectHashV1(object) !== object.determinism_hash) graphErrors.push(`${label}_CANONICAL_HASH_MISMATCH`);
        return object;
      } catch (error) {
        graphErrors.push(`${label}_READBACK_FAILED:${error instanceof Error ? error.message : String(error)}`);
        return null;
      }
    };

    const canonicalResidual = await resolveCanonical(residualRef, "twin_forecast_residual_v1", "RESIDUAL");
    if (canonicalResidual && canonicalResidual.determinism_hash !== residual.determinism_hash) graphErrors.push("RESIDUAL_READBACK_HASH_MISMATCH");
    if (!sameScope(residual)) exclusionReasons.push("SCOPE_MISMATCH");
    if (residual.context_lineage_ref !== identity.lineage_id) exclusionReasons.push("LINEAGE_CONTEXT_MISMATCH");
    if (residual.context_revision_ref !== identity.revision_id) exclusionReasons.push("REVISION_CONTEXT_MISMATCH");
    if (payload.match_status !== "MATCHED") exclusionReasons.push("RESIDUAL_NOT_MATCHED");
    if (payload.forecast_horizon_hour !== 1) exclusionReasons.push("FORECAST_HORIZON_NOT_H1");
    if (payload.actual_observation_quality !== "PASS") exclusionReasons.push("OBSERVATION_QUALITY_NOT_PASS");
    if (payload.actual_observation_unit !== "fraction" || payload.residual_unit !== "fraction" || payload.predicted_observation_unit !== "fraction") exclusionReasons.push("VWC_FRACTION_UNIT_REQUIRED");
    if (payload.forecast_target_time !== payload.actual_observation_observed_at) exclusionReasons.push("TARGET_OBSERVATION_TIME_MISMATCH");
    if (payload.equivalence_claimed !== false || payload.equivalence_proof_ref !== null) exclusionReasons.push("FORECAST_ASSIMILATION_EQUIVALENCE_FORBIDDEN");

    const forecast = await resolveCanonical(payload.forecast_run_ref, "twin_forecast_run_v1", "FORECAST");
    const assimilation = await resolveCanonical(payload.assimilation_update_ref, "twin_assimilation_update_v1", "ASSIMILATION_UPDATE");
    const residualConfig = await resolveCanonical(payload.runtime_config_ref, "twin_runtime_config_v1", "RESIDUAL_RUNTIME_CONFIG");

    let forecastPoint: any | null = null;
    let sourcePosterior: any | null = null;
    let forecastConfig: any | null = null;
    let sourceEvidenceWindow: any | null = null;
    let observationEvidenceWindow: any | null = null;
    let observationRecord: any | null = null;
    let forecastEvidenceCutoff: string | null = null;

    if (forecast) {
      if (!sameScope(forecast)) graphErrors.push("FORECAST_SCOPE_MISMATCH");
      if (forecast.lineage_id !== identity.lineage_id || forecast.revision_id !== identity.revision_id) graphErrors.push("FORECAST_CONTEXT_MISMATCH");
      if (forecast.determinism_hash !== payload.forecast_run_hash) graphErrors.push("FORECAST_HASH_REF_MISMATCH");
      if (forecast.payload?.status !== "COMPLETED") exclusionReasons.push("FORECAST_NOT_COMPLETED");
      if (forecast.payload?.issued_at !== payload.forecast_issued_at) graphErrors.push("FORECAST_ISSUED_AT_MISMATCH");
      if (forecast.as_of !== forecast.payload?.issued_at) graphErrors.push("FORECAST_AS_OF_ISSUED_AT_MISMATCH");
      if (forecast.runtime_config_ref !== forecast.payload?.runtime_config_ref || forecast.runtime_config_hash !== forecast.payload?.runtime_config_hash) graphErrors.push("FORECAST_CONFIG_ENVELOPE_PAYLOAD_MISMATCH");

      const points = Array.isArray(forecast.payload?.points) ? forecast.payload.points : [];
      const matches = points.filter((point: any) => point.horizon_hour === 1 && point.target_time === payload.forecast_target_time);
      if (matches.length !== 1) graphErrors.push(`FORECAST_H1_POINT_CARDINALITY:${matches.length}`);
      else {
        forecastPoint = matches[0];
        if (payload.forecast_point_ref !== `${forecast.object_id}#/points/1`) graphErrors.push("FORECAST_POINT_REF_MISMATCH");
        if (payload.forecast_point_member_ref_policy_id !== "GEOX_FORECAST_POINT_SEMANTIC_MEMBER_REF_V1") graphErrors.push("FORECAST_POINT_REF_POLICY_MISMATCH");
        if (forecastPoint.determinism_hash !== payload.forecast_point_hash) graphErrors.push("FORECAST_POINT_HASH_MISMATCH");
        if (String(forecastPoint.storage_mean_mm) !== String(payload.predicted_storage_mean_mm)) graphErrors.push("FORECAST_POINT_STORAGE_MEAN_MISMATCH");
        if (`${Number(forecastPoint.storage_variance_mm2).toFixed(12)}` !== String(payload.predicted_storage_variance_mm2)) graphErrors.push("FORECAST_POINT_STORAGE_VARIANCE_MISMATCH");
      }

      sourcePosterior = await resolveCanonical(forecast.payload?.source_posterior_ref, "twin_state_estimate_v1", "SOURCE_POSTERIOR");
      forecastConfig = await resolveCanonical(forecast.payload?.runtime_config_ref, "twin_runtime_config_v1", "FORECAST_RUNTIME_CONFIG");
      if (sourcePosterior) {
        if (sourcePosterior.determinism_hash !== forecast.payload?.source_posterior_hash) graphErrors.push("SOURCE_POSTERIOR_HASH_MISMATCH");
        if (!sameScope(sourcePosterior)) graphErrors.push("SOURCE_POSTERIOR_SCOPE_MISMATCH");
        if (sourcePosterior.lineage_id !== identity.lineage_id || sourcePosterior.revision_id !== identity.revision_id) graphErrors.push("SOURCE_POSTERIOR_CONTEXT_MISMATCH");
        if (sourcePosterior.payload?.state_kind !== "POSTERIOR") graphErrors.push("SOURCE_POSTERIOR_KIND_MISMATCH");
        if (sourcePosterior.runtime_config_ref !== forecast.payload?.runtime_config_ref || sourcePosterior.runtime_config_hash !== forecast.payload?.runtime_config_hash) graphErrors.push("SOURCE_POSTERIOR_CONFIG_MISMATCH");
        sourceEvidenceWindow = await resolveCanonical(sourcePosterior.payload?.evidence_window_ref, "twin_evidence_window_v1", "SOURCE_EVIDENCE_WINDOW");
      }
      if (forecastConfig) {
        if (forecastConfig.determinism_hash !== forecast.payload?.runtime_config_hash) graphErrors.push("FORECAST_RUNTIME_CONFIG_HASH_MISMATCH");
        if (!sameScope(forecastConfig)) graphErrors.push("FORECAST_RUNTIME_CONFIG_SCOPE_MISMATCH");
        if (forecastConfig.payload?.effective_logical_time !== forecast.logical_time) graphErrors.push("FORECAST_RUNTIME_CONFIG_EFFECTIVE_TIME_MISMATCH");
      }
      if (sourceEvidenceWindow) {
        if (!sameScope(sourceEvidenceWindow)) graphErrors.push("SOURCE_EVIDENCE_WINDOW_SCOPE_MISMATCH");
        if (sourceEvidenceWindow.lineage_id !== identity.lineage_id || sourceEvidenceWindow.revision_id !== identity.revision_id) graphErrors.push("SOURCE_EVIDENCE_WINDOW_CONTEXT_MISMATCH");
        if (sourceEvidenceWindow.runtime_config_ref !== forecast.payload?.runtime_config_ref || sourceEvidenceWindow.runtime_config_hash !== forecast.payload?.runtime_config_hash) graphErrors.push("SOURCE_EVIDENCE_WINDOW_CONFIG_MISMATCH");
        if (sourceEvidenceWindow.payload?.frozen !== true || sourceEvidenceWindow.payload?.base_continuation_window?.frozen !== true) graphErrors.push("SOURCE_EVIDENCE_WINDOW_NOT_FROZEN");
        if (sourceEvidenceWindow.payload?.evidence_window_contract_id !== "MCFT_CAP_03_ASSIMILATED_CONTINUATION_EVIDENCE_WINDOW_V2") graphErrors.push("SOURCE_EVIDENCE_WINDOW_CONTRACT_MISMATCH");
        const selectedRecords = sourceEvidenceWindow.payload?.base_continuation_window?.selected_records;
        if (!Array.isArray(selectedRecords) || selectedRecords.length === 0) graphErrors.push("SOURCE_EVIDENCE_WINDOW_SELECTED_RECORDS_REQUIRED");
        else {
          const selectedRefs = selectedRecords.map((record: any) => String(record.source_record_id ?? "")).filter(Boolean);
          const declaredSelectedRefs = sourceEvidenceWindow.payload?.base_continuation_window?.selected_evidence_refs ?? [];
          if (!sameStringSet(selectedRefs, declaredSelectedRefs)) graphErrors.push("SOURCE_EVIDENCE_WINDOW_SELECTED_REF_SET_MISMATCH");
          if (!sameStringSet(selectedRefs, sourceEvidenceWindow.evidence_refs ?? [])) graphErrors.push("SOURCE_EVIDENCE_WINDOW_ENVELOPE_REF_SET_MISMATCH");
          forecastEvidenceCutoff = maxIso(selectedRecords.map((record: any) => String(record.available_to_runtime_at ?? "")));
          if (!forecastEvidenceCutoff) graphErrors.push("FORECAST_EVIDENCE_CUTOFF_UNRESOLVED");
          else {
            if (Date.parse(forecastEvidenceCutoff) > Date.parse(String(sourceEvidenceWindow.as_of))) availabilityErrors.push("FORECAST_EVIDENCE_CUTOFF_AFTER_WINDOW_AS_OF");
            if (Date.parse(forecastEvidenceCutoff) > Date.parse(String(forecast.as_of))) availabilityErrors.push("FORECAST_EVIDENCE_CUTOFF_AFTER_FORECAST_AS_OF");
          }
        }
        if (sourceEvidenceWindow.logical_time !== forecast.logical_time || sourceEvidenceWindow.as_of !== forecast.as_of) graphErrors.push("SOURCE_EVIDENCE_WINDOW_FORECAST_TIME_MISMATCH");
        const sourceRefs = sourceEvidenceWindow.evidence_refs ?? [];
        if (!sourceRefs.every((ref: string) => (forecast.evidence_refs ?? []).includes(ref))) graphErrors.push("FORECAST_MISSING_SOURCE_WINDOW_EVIDENCE_REF");
      }

      const forcing = forecast.payload?.forcing_window_authority;
      if (!forcing || typeof forcing !== "object") graphErrors.push("FORCING_WINDOW_AUTHORITY_REQUIRED");
      else {
        if (forcing.forcing_cycle_key !== forecast.payload?.forcing_cycle_key) graphErrors.push("FORCING_CYCLE_KEY_MISMATCH");
        if (forcing.forcing_window_hash !== forecast.payload?.forcing_window_hash) graphErrors.push("FORCING_WINDOW_HASH_MISMATCH");
        if (forcing.runtime_config_ref !== forecast.payload?.runtime_config_ref || forcing.runtime_config_hash !== forecast.payload?.runtime_config_hash) graphErrors.push("FORCING_RUNTIME_CONFIG_MISMATCH");
        if (forcing.weather_snapshot_ref !== forecast.payload?.weather_snapshot_ref || forcing.weather_snapshot_hash !== forecast.payload?.weather_snapshot_hash) graphErrors.push("WEATHER_SNAPSHOT_AUTHORITY_MISMATCH");
        if (forcing.et0_snapshot_ref !== forecast.payload?.et0_snapshot_ref || forcing.et0_snapshot_hash !== forecast.payload?.et0_snapshot_hash) graphErrors.push("ET0_SNAPSHOT_AUTHORITY_MISMATCH");
        if (forcing.crop_stage_context_ref !== forecast.payload?.crop_stage_context_ref || forcing.crop_stage_context_hash !== forecast.payload?.crop_stage_context_hash) graphErrors.push("CROP_STAGE_CONTEXT_AUTHORITY_MISMATCH");
        const forcingEvidenceRefs = forcing.evidence_refs ?? [];
        if (!sameStringSet(forcingEvidenceRefs, [forecast.payload?.weather_snapshot_ref, forecast.payload?.et0_snapshot_ref].filter(Boolean))) graphErrors.push("FORCING_EVIDENCE_REF_SET_MISMATCH");
        if (!forcingEvidenceRefs.every((ref: string) => (forecast.evidence_refs ?? []).includes(ref))) graphErrors.push("FORECAST_MISSING_FORCING_EVIDENCE_REF");
        const forcingPoints = Array.isArray(forcing.points) ? forcing.points.filter((point: any) => point.horizon_hour === 1 && point.target_time === payload.forecast_target_time) : [];
        if (forcingPoints.length !== 1) graphErrors.push(`FORCING_H1_POINT_CARDINALITY:${forcingPoints.length}`);
        else {
          const point = forcingPoints[0];
          if (point.runtime_config_ref !== forecast.payload?.runtime_config_ref || point.runtime_config_hash !== forecast.payload?.runtime_config_hash) graphErrors.push("FORCING_H1_CONFIG_MISMATCH");
          if (point.precipitation_snapshot_ref !== forecast.payload?.weather_snapshot_ref || point.precipitation_snapshot_hash !== forecast.payload?.weather_snapshot_hash) graphErrors.push("FORCING_H1_WEATHER_MISMATCH");
          if (point.et0_snapshot_ref !== forecast.payload?.et0_snapshot_ref || point.et0_snapshot_hash !== forecast.payload?.et0_snapshot_hash) graphErrors.push("FORCING_H1_ET0_MISMATCH");
          if (point.crop_stage_context_ref !== forecast.payload?.crop_stage_context_ref || point.crop_stage_context_hash !== forecast.payload?.crop_stage_context_hash) graphErrors.push("FORCING_H1_CROP_STAGE_MISMATCH");
          if (Date.parse(String(point.et0_available_to_runtime_at)) > Date.parse(String(forecast.as_of))) availabilityErrors.push("ET0_AVAILABLE_AFTER_FORECAST_AS_OF");
          if (Date.parse(String(point.precipitation_available_to_runtime_at)) > Date.parse(String(forecast.as_of))) availabilityErrors.push("WEATHER_AVAILABLE_AFTER_FORECAST_AS_OF");
        }
      }
    }

    if (residualConfig) {
      if (residualConfig.determinism_hash !== payload.runtime_config_hash) graphErrors.push("RESIDUAL_RUNTIME_CONFIG_HASH_MISMATCH");
      if (!sameScope(residualConfig)) graphErrors.push("RESIDUAL_RUNTIME_CONFIG_SCOPE_MISMATCH");
      if (residual.runtime_config_ref !== payload.runtime_config_ref || residual.runtime_config_hash !== payload.runtime_config_hash) graphErrors.push("RESIDUAL_CONFIG_ENVELOPE_PAYLOAD_MISMATCH");
    }

    if (assimilation) {
      if (assimilation.determinism_hash !== payload.assimilation_update_hash) graphErrors.push("ASSIMILATION_UPDATE_HASH_MISMATCH");
      if (!sameScope(assimilation)) graphErrors.push("ASSIMILATION_UPDATE_SCOPE_MISMATCH");
      if (assimilation.lineage_id !== identity.lineage_id || assimilation.revision_id !== identity.revision_id) graphErrors.push("ASSIMILATION_UPDATE_CONTEXT_MISMATCH");
      if (assimilation.runtime_config_ref !== payload.runtime_config_ref || assimilation.runtime_config_hash !== payload.runtime_config_hash) graphErrors.push("ASSIMILATION_UPDATE_CONFIG_MISMATCH");
      if (assimilation.payload?.status !== "APPLIED" || assimilation.payload?.disposition !== "ACCEPTED") graphErrors.push("ASSIMILATION_UPDATE_NOT_APPLIED");
      if (assimilation.payload?.selected_observation_ref !== payload.actual_observation_ref) graphErrors.push("ASSIMILATION_SELECTED_OBSERVATION_MISMATCH");
      if (!(assimilation.payload?.applied_observation_refs ?? []).includes(payload.actual_observation_ref)) graphErrors.push("ASSIMILATION_APPLIED_OBSERVATION_REF_MISSING");
      if (assimilation.payload?.model_parameter_change_applied !== false) graphErrors.push("ASSIMILATION_MODEL_PARAMETER_CHANGE_FORBIDDEN");
      if (String(Number(assimilation.payload?.actual_observation).toFixed(6)) !== String(payload.actual_observation_value)) graphErrors.push("ASSIMILATION_OBSERVATION_VALUE_MISMATCH");
      if (assimilation.payload?.observation_operator?.id !== payload.observation_operator_id || String(assimilation.payload?.observation_operator?.h?.toFixed?.(6) ?? assimilation.payload?.observation_operator?.h) !== String(payload.observation_operator_h)) graphErrors.push("ASSIMILATION_OBSERVATION_OPERATOR_MISMATCH");
    }

    const observationWindowRows = await pool.query(
      "SELECT record_json FROM facts WHERE record_json->>'type'='twin_evidence_window_v1' AND record_json->'payload'->>'logical_time'=$1 AND record_json->'payload'->>'runtime_config_ref'=$2",
      [payload.observation_available_to_runtime_at, payload.runtime_config_ref],
    );
    if (observationWindowRows.rows.length !== 1) graphErrors.push(`OBSERVATION_EVIDENCE_WINDOW_CARDINALITY:${observationWindowRows.rows.length}`);
    else {
      observationEvidenceWindow = factEnvelope(observationWindowRows.rows[0].record_json);
      if (canonicalObjectHashV1(observationEvidenceWindow) !== observationEvidenceWindow.determinism_hash) graphErrors.push("OBSERVATION_EVIDENCE_WINDOW_CANONICAL_HASH_MISMATCH");
      const candidates = observationEvidenceWindow.payload?.observation_selection?.candidates ?? [];
      const matches = candidates.filter((candidate: any) => candidate.observation_ref === payload.actual_observation_ref && candidate.source_record_id === payload.actual_observation_ref);
      if (matches.length !== 1) graphErrors.push(`ACTUAL_OBSERVATION_RECORD_CARDINALITY:${matches.length}`);
      else {
        observationRecord = matches[0];
        if (observationRecord.candidate_assessment !== "SELECTED") graphErrors.push("ACTUAL_OBSERVATION_NOT_SELECTED");
        if (observationEvidenceWindow.payload?.observation_selection?.selected_observation_ref !== payload.actual_observation_ref) graphErrors.push("OBSERVATION_WINDOW_SELECTED_REF_MISMATCH");
        if (observationRecord.source_record_hash !== payload.actual_observation_hash) graphErrors.push("ACTUAL_OBSERVATION_HASH_MISMATCH");
        if (observationRecord.observed_at !== payload.actual_observation_observed_at) graphErrors.push("ACTUAL_OBSERVATION_TIME_MISMATCH");
        if (observationRecord.available_to_runtime_at !== payload.observation_available_to_runtime_at) graphErrors.push("ACTUAL_OBSERVATION_AVAILABILITY_MISMATCH");
        if (observationRecord.quality_status !== payload.actual_observation_quality) graphErrors.push("ACTUAL_OBSERVATION_QUALITY_MISMATCH");
        if (observationRecord.canonical_unit !== payload.actual_observation_unit) graphErrors.push("ACTUAL_OBSERVATION_UNIT_MISMATCH");
        if (String(Number(observationRecord.canonical_value).toFixed(6)) !== String(payload.actual_observation_value)) graphErrors.push("ACTUAL_OBSERVATION_VALUE_MISMATCH");
        if (!(observationEvidenceWindow.payload?.assimilation_applied_evidence_refs ?? []).includes(payload.actual_observation_ref)) graphErrors.push("OBSERVATION_WINDOW_APPLIED_REF_MISSING");
      }
    }

    if (forecast && forecastConfig) {
      const operator = forecastConfig.payload?.observation_assimilation?.observation_operator;
      if (operator?.id !== payload.observation_operator_id || String(operator?.h?.toFixed?.(6) ?? operator?.h) !== String(payload.observation_operator_h)) graphErrors.push("FORECAST_CONFIG_OBSERVATION_OPERATOR_MISMATCH");
      if (forecastConfig.payload?.reality_binding_ref !== payload.root_zone_geometry_ref || forecastConfig.payload?.reality_binding_hash !== payload.root_zone_geometry_hash) graphErrors.push("FORECAST_CONFIG_GEOMETRY_MISMATCH");
      if (!(forecast.source_refs ?? []).includes(payload.root_zone_geometry_ref)) graphErrors.push("FORECAST_GEOMETRY_SOURCE_REF_MISSING");
      if (forecastConfig.payload?.crop_stage_context?.context_ref !== forecast.payload?.crop_stage_context_ref || forecastConfig.payload?.crop_stage_context?.context_hash !== forecast.payload?.crop_stage_context_hash) graphErrors.push("FORECAST_CONFIG_CROP_STAGE_CONTEXT_MISMATCH");
    }

    if (forecast) {
      if (Date.parse(String(payload.forecast_issued_at)) >= Date.parse(String(payload.observation_available_to_runtime_at))) availabilityErrors.push("FORECAST_ISSUED_NOT_BEFORE_OBSERVATION_AVAILABILITY");
      if (Date.parse(String(forecast.as_of)) >= Date.parse(String(payload.observation_available_to_runtime_at))) availabilityErrors.push("FORECAST_AS_OF_NOT_BEFORE_OBSERVATION_AVAILABILITY");
    }

    const duplicateTargetOwner = seenTargets.get(String(payload.forecast_target_time));
    if (duplicateTargetOwner && duplicateTargetOwner !== residualRef) graphErrors.push(`DUPLICATE_TARGET_TIME_WITH:${duplicateTargetOwner}`);
    else if (payload.forecast_target_time) seenTargets.set(String(payload.forecast_target_time), residualRef);
    const semanticCaseHash = semanticHashV1({
      forecast_run_ref: payload.forecast_run_ref,
      forecast_point_ref: payload.forecast_point_ref,
      actual_observation_ref: payload.actual_observation_ref,
      target_time: payload.forecast_target_time,
    });
    const semanticOwner = seenSemanticCases.get(semanticCaseHash);
    if (semanticOwner && semanticOwner !== residualRef) graphErrors.push(`CONFLICTING_SEMANTIC_DUPLICATE_WITH:${semanticOwner}`);
    else seenSemanticCases.set(semanticCaseHash, residualRef);

    const baseCase = {
      residual_ref: residualRef,
      residual_hash: residual.determinism_hash,
      forecast_run_ref: forecast?.object_id ?? payload.forecast_run_ref,
      forecast_run_hash: forecast?.determinism_hash ?? payload.forecast_run_hash,
      forecast_point_ref: payload.forecast_point_ref,
      forecast_point_hash: payload.forecast_point_hash,
      forecast_target_time: payload.forecast_target_time,
      forecast_issued_at: payload.forecast_issued_at,
      forecast_as_of: forecast?.as_of ?? null,
      forecast_evidence_window_ref: sourceEvidenceWindow?.object_id ?? null,
      forecast_evidence_window_hash: sourceEvidenceWindow?.determinism_hash ?? null,
      forecast_evidence_cutoff: forecastEvidenceCutoff,
      source_posterior_ref: sourcePosterior?.object_id ?? forecast?.payload?.source_posterior_ref ?? null,
      source_posterior_hash: sourcePosterior?.determinism_hash ?? forecast?.payload?.source_posterior_hash ?? null,
      source_runtime_config_ref: forecastConfig?.object_id ?? forecast?.payload?.runtime_config_ref ?? null,
      source_runtime_config_hash: forecastConfig?.determinism_hash ?? forecast?.payload?.runtime_config_hash ?? null,
      residual_runtime_config_ref: residualConfig?.object_id ?? payload.runtime_config_ref,
      residual_runtime_config_hash: residualConfig?.determinism_hash ?? payload.runtime_config_hash,
      assimilation_update_ref: assimilation?.object_id ?? payload.assimilation_update_ref,
      assimilation_update_hash: assimilation?.determinism_hash ?? payload.assimilation_update_hash,
      observation_evidence_window_ref: observationEvidenceWindow?.object_id ?? null,
      observation_evidence_window_hash: observationEvidenceWindow?.determinism_hash ?? null,
      actual_observation_ref: payload.actual_observation_ref,
      actual_observation_hash: payload.actual_observation_hash,
      actual_observation_observed_at: payload.actual_observation_observed_at,
      observation_available_to_runtime_at: payload.observation_available_to_runtime_at,
      forcing_cycle_key: forecast?.payload?.forcing_cycle_key ?? null,
      forcing_window_hash: forecast?.payload?.forcing_window_hash ?? null,
      weather_snapshot_ref: forecast?.payload?.weather_snapshot_ref ?? null,
      weather_snapshot_hash: forecast?.payload?.weather_snapshot_hash ?? null,
      et0_snapshot_ref: forecast?.payload?.et0_snapshot_ref ?? null,
      et0_snapshot_hash: forecast?.payload?.et0_snapshot_hash ?? null,
      crop_stage_context_ref: forecast?.payload?.crop_stage_context_ref ?? null,
      crop_stage_context_hash: forecast?.payload?.crop_stage_context_hash ?? null,
      root_zone_geometry_ref: payload.root_zone_geometry_ref,
      root_zone_geometry_hash: payload.root_zone_geometry_hash,
      graph_errors: [...new Set(graphErrors)].sort(),
      availability_errors: [...new Set(availabilityErrors)].sort(),
      exclusion_reasons: [...new Set(exclusionReasons)].sort(),
    };

    if (graphErrors.length > 0) invalidGraphCases.push(baseCase);
    else if (availabilityErrors.length > 0) availabilityInvalidCases.push(baseCase);
    else if (exclusionReasons.length > 0) excludedCases.push(baseCase);
    else if (forecastConfig) {
      const observationAssimilation = forecastConfig.payload?.observation_assimilation ?? {};
      const representativenessPolicy = {
        point_to_zone_representativeness_stddev_fraction: observationAssimilation.point_to_zone_representativeness_stddev_fraction,
        direct_state_equivalence: observationAssimilation.observation_operator?.direct_state_equivalence,
        observation_binding_id: observationAssimilation.observation_binding_id,
      };
      eligibleCases.push({
        ...baseCase,
        model_component_hash: semanticHashV1({
          dynamics_model: forecastConfig.payload?.dynamics_model,
          model_component_refs: [...(forecastConfig.payload?.model_component_refs ?? [])].sort(),
          forecast_method_id: forecastConfig.payload?.forecast_method_id,
          forecast_method_version: forecastConfig.payload?.forecast_method_version,
        }),
        effective_parameter_bundle_hash: semanticHashV1({
          soil_hydraulic_snapshot: forecastConfig.payload?.soil_hydraulic_snapshot,
          dynamics_parameters: forecastConfig.payload?.dynamics_parameters,
        }),
        observation_operator_hash: semanticHashV1({
          operator_id: payload.observation_operator_id,
          operator_version: payload.observation_operator_version,
          operator_h: payload.observation_operator_h,
          representativeness_policy: representativenessPolicy,
        }),
        geometry_hash: payload.root_zone_geometry_hash,
        runtime_replay_numeric_policy_hash: semanticHashV1({
          runtime_replay_numeric_policy_id: "EXISTING_MCFT_FIXED_POINT_WATER_RUNTIME_POLICY_V1",
          rounding: forecastConfig.payload?.rounding,
          decimal_scale_policy_id: forecastConfig.payload?.decimal_scale_policy_id,
          rounding_policy_id: forecastConfig.payload?.rounding_policy_id,
          physical_bound_policy_id: forecastConfig.payload?.physical_bound_policy_id,
          forecast_interval_method_id: forecastConfig.payload?.forecast_interval_method_id,
          forecast_observation_variance_method_id: forecastConfig.payload?.forecast_observation_variance_method_id,
          forecast_observation_projection_method_id: forecastConfig.payload?.forecast_observation_projection_method_id,
          forecast_observation_projection_version: forecastConfig.payload?.forecast_observation_projection_version,
          uncertainty_propagation_method_id: forecastConfig.payload?.uncertainty_propagation_method_id,
        }),
      });
    }
  }

  eligibleCases.sort((a, b) =>
    Date.parse(a.forecast_target_time) - Date.parse(b.forecast_target_time)
    || Date.parse(a.observation_available_to_runtime_at) - Date.parse(b.observation_available_to_runtime_at)
    || a.residual_ref.localeCompare(b.residual_ref),
  );

  const modelHashes = new Set(eligibleCases.map((item) => item.model_component_hash));
  const bundleHashes = new Set(eligibleCases.map((item) => item.effective_parameter_bundle_hash));
  const operatorHashes = new Set(eligibleCases.map((item) => item.observation_operator_hash));
  const geometryHashes = new Set(eligibleCases.map((item) => item.geometry_hash));
  const numericHashes = new Set(eligibleCases.map((item) => item.runtime_replay_numeric_policy_hash));
  const heterogeneity = eligibleCases.length > 0 && [modelHashes, bundleHashes, operatorHashes, geometryHashes, numericHashes].some((set) => set.size !== 1);

  let calibrationWindow: any[] = [];
  let holdoutWindow: any[] = [];
  let splitValid = true;
  if (eligibleCases.length >= 24) {
    calibrationWindow = eligibleCases.slice(0, 16);
    holdoutWindow = eligibleCases.slice(16, 24);
    const maxCalibrationTarget = Math.max(...calibrationWindow.map((item) => Date.parse(item.forecast_target_time)));
    const minHoldoutTarget = Math.min(...holdoutWindow.map((item) => Date.parse(item.forecast_target_time)));
    const maxCalibrationAvailability = Math.max(...calibrationWindow.map((item) => Date.parse(item.observation_available_to_runtime_at)));
    const minHoldoutAvailability = Math.min(...holdoutWindow.map((item) => Date.parse(item.observation_available_to_runtime_at)));
    splitValid = maxCalibrationTarget < minHoldoutTarget && maxCalibrationAvailability < minHoldoutAvailability;
  }

  let status: string;
  if (invalidGraphCases.length > 0) status = "INVALID_CASE_GRAPH";
  else if (availabilityInvalidCases.length > 0 || !splitValid) status = "AVAILABILITY_ORDER_INVALID";
  else if (heterogeneity) status = "CONFIG_OR_MODEL_HETEROGENEITY";
  else if (eligibleCases.length < 24) status = "INSUFFICIENT_MATCHED_PAIRS";
  else status = "READY_FOR_CALIBRATION_ASSESSMENT";

  const qualification = {
    schema_version: "geox_mcft_cap_06_dataset_qualification_v2",
    qualification_id: `mcft_cap06_s0_v2_${semanticHashV1(eligibleCases.map((item) => [item.residual_ref, item.residual_hash])).slice(7, 31)}`,
    source_scope: EXPECTED_SCOPE,
    qualification_track: "REPOSITORY_HISTORY_QUALIFICATION_TRACK",
    case_input_authority: "CANONICAL_FORECAST_POINT_TRACE_WITH_GRAPH_VALIDATION_V1",
    extraction_source: "ISOLATED_POSTGRESQL_CANONICAL_READ_PATH",
    canonical_residual_count: residuals.length,
    eligible_forecast_count: new Set(eligibleCases.map((item) => item.forecast_run_ref)).size,
    eligible_observation_count: new Set(eligibleCases.map((item) => item.actual_observation_ref)).size,
    eligible_matched_pair_count: eligibleCases.length,
    eligible_residual_count: eligibleCases.length,
    excluded_case_count: excludedCases.length,
    invalid_graph_case_count: invalidGraphCases.length,
    availability_invalid_case_count: availabilityInvalidCases.length,
    eligible_calibration_count: calibrationWindow.length,
    eligible_holdout_count: holdoutWindow.length,
    calibration_window_refs: calibrationWindow.map((item) => item.residual_ref),
    holdout_window_refs: holdoutWindow.map((item) => item.residual_ref),
    unselected_eligible_refs: eligibleCases.slice(24).map((item) => item.residual_ref),
    model_component_hash_count: modelHashes.size,
    effective_parameter_bundle_hash_count: bundleHashes.size,
    observation_operator_hash_count: operatorHashes.size,
    geometry_hash_count: geometryHashes.size,
    runtime_replay_numeric_policy_hash_count: numericHashes.size,
    case_graph_validation_status: invalidGraphCases.length === 0 ? "PASS" : "FAIL",
    availability_order_validation_status: availabilityInvalidCases.length === 0 && splitValid ? "PASS" : "FAIL",
    homogeneity_validation_status: heterogeneity ? "FAIL" : "PASS",
    dataset_qualification_status: status,
    eligible_cases: eligibleCases,
    excluded_cases: excludedCases,
    invalid_graph_cases: invalidGraphCases,
    availability_invalid_cases: availabilityInvalidCases,
    qualification_limitations: status === "INSUFFICIENT_MATCHED_PAIRS"
      ? [
          "CURRENT_CANONICAL_HISTORY_CONTAINS_FEWER_THAN_24_ELIGIBLE_MATCHED_RESIDUAL_CASES",
          "NO_CALIBRATION_GRID_SEARCH_EXECUTED_BY_S0",
          "NO_CANDIDATE_OR_EVALUATION_CANONICALIZED",
        ]
      : ["STRUCTURAL_QUALIFICATION_ONLY_NO_PARAMETER_REPLAY_BY_S0"],
    prohibited_output_fields_absent: [
      "sensitive_case_count",
      "excited_case_count",
      "objective_surface_status",
      "best_vs_second_margin",
      "selected_parameter",
    ],
  };

  const allowedQualificationStatuses = new Set([
    "READY_FOR_CALIBRATION_ASSESSMENT",
    "INSUFFICIENT_MATCHED_PAIRS",
    "CONFIG_OR_MODEL_HETEROGENEITY",
    "AVAILABILITY_ORDER_INVALID",
    "INVALID_CASE_GRAPH",
  ]);
  assert.ok(allowedQualificationStatuses.has(qualification.dataset_qualification_status), `UNFROZEN_DATASET_QUALIFICATION_STATUS:${qualification.dataset_qualification_status}`);
  assert.equal(qualification.case_graph_validation_status, qualification.invalid_graph_case_count === 0 ? "PASS" : "FAIL", "CASE_GRAPH_STATUS_COUNT_MISMATCH");
  assert.equal(qualification.availability_order_validation_status, qualification.availability_invalid_case_count === 0 && splitValid ? "PASS" : "FAIL", "AVAILABILITY_STATUS_COUNT_MISMATCH");
  assert.equal(qualification.homogeneity_validation_status, heterogeneity ? "FAIL" : "PASS", "HOMOGENEITY_STATUS_COUNT_MISMATCH");
  assert.equal(qualification.canonical_residual_count, qualification.eligible_residual_count + qualification.excluded_case_count + qualification.invalid_graph_case_count + qualification.availability_invalid_case_count, "RESIDUAL_CLASSIFICATION_PARTITION_MISMATCH");
  ok(`exact canonical case graph qualification completed honestly with status ${qualification.dataset_qualification_status}`);
  return qualification;
}

async function main(): Promise<void> {
  if (process.env.MCFT_CAP_06_S0_DESTRUCTIVE_ACCEPTANCE !== "1") fail("SET_MCFT_CAP_06_S0_DESTRUCTIVE_ACCEPTANCE_1");
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) fail("DATABASE_URL_REQUIRED");
  ok(`database name is explicitly isolated for acceptance: ${resolveDatabaseName(databaseUrl)}`);
  assertRepositoryBoundary();

  const p0Status = readJson(P0_STATUS_PATH);
  const currentState = readJson("docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-STATE-RECONCILIATION.json");
  const delivery = readJson(DELIVERY_PATH);
  const cap05Closure = readJson(CAP05_CLOSURE_PATH);
  const cap05Main = readJson(CAP05_MAIN_PATH);
  assert.equal(p0Status.status, "MERGED_EFFECTIVE", "P0_MERGED_EFFECTIVE_REQUIRED");
  assert.equal(p0Status.effectiveness?.effective, true, "P0_EFFECTIVENESS_REQUIRED");
  assert.equal(currentState.status, "MERGED_EFFECTIVE", "CURRENT_STATE_RECONCILIATION_EFFECTIVE_REQUIRED");
  assert.equal(currentState.reconciliation_effective, true, "CURRENT_STATE_RECONCILIATION_EFFECTIVE_REQUIRED");
  assert.equal(currentState.current_state?.s0, "MERGED_EFFECTIVE", "S0_MERGED_EFFECTIVE_REQUIRED");
  assert.equal(currentState.current_state?.capability_line_authorization_effective, true, "CAP06_AUTHORIZATION_EFFECTIVE_REQUIRED");
  assert.equal(currentState.current_state?.runtime_source_authorized, true, "CAP06_RUNTIME_SOURCE_AUTHORIZATION_REQUIRED");
  assert.equal(currentState.current_state?.active_delivery_slice_id, "MCFT-CAP-06.MCFT-01-03-11.CANONICAL-RESIDUAL-WINDOWS-V1", "S1_ACTIVE_DELIVERY_SLICE_REQUIRED");
  assert.equal(delivery.s0_qualification_authorized, true, "S0_QUALIFICATION_AUTHORIZATION_REQUIRED");
  assert.equal(delivery.s0_effective, true, "S0_EFFECTIVENESS_REQUIRED");
  assert.equal(delivery.runtime_source_authorized, true, "CAP06_RUNTIME_SOURCE_AUTHORIZATION_REQUIRED");
  assert.equal(delivery.active_delivery_slice_id, "MCFT-CAP-06.MCFT-01-03-11.CANONICAL-RESIDUAL-WINDOWS-V1", "S1_ACTIVE_DELIVERY_SLICE_REQUIRED");
  assert.equal(cap05Closure.capability_complete, true, "CAP05_CLOSURE_COMPLETE_REQUIRED");
  assert.equal(cap05Main.capability_complete, true, "CAP05_MAIN_COMPLETE_REQUIRED");
  ok("merged-effective current-state and CAP-05 predecessor authority are exact");

  await executeCap05TerminalChain(databaseUrl);
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const identity = await extractIdentity(pool);
    const qualification = await qualifyResidualHistory(pool, identity);
    console.log(`S0_V2_RESULT_JSON:${JSON.stringify({ identity, qualification })}`);
  } finally {
    await pool.end();
  }

  fs.rmSync(absolute(TEMP_RUNNER_INPUT_PATH), { force: true });
  run(process.platform === "win32" ? "git.exe" : "git", ["diff", "--check", BASELINE_MAIN, "--", ...EXACT_CHANGED_FILES]);
  ok("S0 v2 read-only qualification working-tree diff check PASS");
  console.log(`MCFT-CAP-06 S0 v2 exact qualification: ${pass} PASS, 0 FAIL`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

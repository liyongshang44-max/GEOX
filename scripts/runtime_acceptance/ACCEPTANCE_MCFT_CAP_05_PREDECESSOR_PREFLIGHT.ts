// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_PREDECESSOR_PREFLIGHT.ts
// Purpose: reproduce the completed MCFT-CAP-04 terminal chain in isolated PostgreSQL, lock its canonical handoff, and materialize the governance-only MCFT-CAP-05 S0 candidate.
// Boundary: destructive isolated-database acceptance and governance artifact generation only; no CAP-05 Runtime source, migration, canonical Decision/Feedback/Residual write, route, web, AO-ACT, scheduler, or CAP-06 authorization.

import assert from "node:assert/strict";
import cp from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const BASELINE_MAIN = "2d4d00aec8cd1e925687ee67e5de429c324cc1b2";
const BRANCH = "agent/mcft-cap-05-s0-authorization-predecessor-lock-v1";
const P0 = "MCFT-CAP-05.P0.CAP-04-SETTLEMENT-AND-CAP-05-PROVISIONAL-SSOT-V1";
const S0 = "MCFT-CAP-05.GOV-AUTHORIZATION-AND-PREDECESSOR-LOCK-V1";
const S1 = "MCFT-CAP-05.MCFT-01-13-15.CONTROLLED-FEEDBACK-REPLAY-DATASET-V1";
const P0_PR = 2432;
const P0_EXACT_HEAD = "75a270fc2fd044fd57858227b7d1d91b1386cf8a";
const P0_EXACT_HEAD_WORKFLOW = 29305410797;
const P0_POSTMERGE_PROBE_PR = 2434;
const P0_POSTMERGE_WORKFLOW = 29305450785;
const EXPECTED_LAST_LOGICAL_TIME = "2026-06-04T01:00:00.000Z";
const EXPECTED_NEXT_LOGICAL_TIME = "2026-06-04T02:00:00.000Z";
const EXPECTED_CHECKPOINT_SEQUENCE = 72;

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
const TASK_PATH = "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-TASK.md";
const P0_STATUS_PATH = "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-P0-STATUS.json";
const AUTHORIZATION_PATH = "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-AUTHORIZATION.md";
const AUTHORIZATION_STATUS_PATH = "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-AUTHORIZATION-STATUS.json";
const LOCK_PATH = "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-PREDECESSOR-LOCK.json";
const DELIVERY_PATH = "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-DELIVERY-SLICE-STATUS.json";
const ALIGNMENT_PATH = "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S0-ALIGNMENT-REVIEW.md";
const GATE_PATH = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_AUTHORIZATION.cjs";
const PREFLIGHT_PATH = "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_PREDECESSOR_PREFLIGHT.ts";
const CAP04_CLOSURE_PATH = "docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-CLOSURE-RECORD.json";
const CAP04_MAIN_PATH = "docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-MAIN-VERIFICATION.json";
const EVIDENCE_PATH = "acceptance-output/MCFT_CAP_05_PREDECESSOR_IDENTITY.json";
const TEMP_WORKFLOW_PATH = ".github/workflows/mcft-cap-05-s0-materialize.yml";

const EXACT_CHANGED_FILES = Object.freeze([
  MAP_PATH,
  MATRIX_PATH,
  TASK_PATH,
  AUTHORIZATION_PATH,
  AUTHORIZATION_STATUS_PATH,
  LOCK_PATH,
  DELIVERY_PATH,
  ALIGNMENT_PATH,
  GATE_PATH,
  PREFLIGHT_PATH,
].sort());

const PREFLIGHT_ALLOWED_FILES = Object.freeze([...EXACT_CHANGED_FILES, TEMP_WORKFLOW_PATH].sort());

const PRESERVED_NONCLAIMS = Object.freeze([
  "NO_MCFT_CAP_05_RUNTIME_SOURCE_AUTHORIZATION",
  "NO_CONTROLLED_REPLAY_DATASET_CREATED_BY_S0",
  "NO_HUMAN_DECISION_CANONICAL_WRITE",
  "NO_APPROVAL_ASSERTION_EVIDENCE_WRITE",
  "NO_APPROVED_PLAN_EVIDENCE_WRITE",
  "NO_ACTION_FEEDBACK_CANONICAL_WRITE",
  "NO_FORECAST_RESIDUAL_CANONICAL_WRITE",
  "NO_RECEIPT_CONSUMING_STATE_TICK",
  "NO_MIGRATION",
  "NO_ROUTE",
  "NO_WEB",
  "NO_AO_ACT_CHANGE",
  "NO_RECOMMENDATION",
  "NO_POLICY_EVALUATION",
  "NO_CALIBRATION_CANDIDATE",
  "NO_MODEL_ACTIVATION",
  "NO_CONTINUOUS_RUNTIME",
  "NO_LIVE_FIELD_CLAIM",
  "NO_CAP_06_AUTHORIZATION",
  "NO_MCFT_GATE_A_CLOSURE",
  "NO_MINIMUM_COMPLETE_FIELD_TWIN_CLAIM",
]);

const DOWNSTREAM_SLICES = Object.freeze([
  [S1, "MCFT-01", [S0]],
  ["MCFT-CAP-05.MCFT-02-06-11-13-15.CONTRACTS-PROJECTION-MATH-CONFIG-V1", "MCFT-02", [S1]],
  ["MCFT-CAP-05.MCFT-03.PERSISTENCE-IDEMPOTENCY-RECOVERY-V1", "MCFT-03", ["MCFT-CAP-05.MCFT-02-06-11-13-15.CONTRACTS-PROJECTION-MATH-CONFIG-V1"]],
  ["MCFT-CAP-05.MCFT-13.HUMAN-DECISION-G-COMMIT-V1", "MCFT-13", ["MCFT-CAP-05.MCFT-03.PERSISTENCE-IDEMPOTENCY-RECOVERY-V1"]],
  ["MCFT-CAP-05.MCFT-01-13.APPROVAL-PLAN-EVIDENCE-BINDING-V1", "MCFT-13", ["MCFT-CAP-05.MCFT-13.HUMAN-DECISION-G-COMMIT-V1"]],
  ["MCFT-CAP-05.MCFT-15.ACTION-FEEDBACK-H-COMMIT-ADAPTER-V1", "MCFT-15", ["MCFT-CAP-05.MCFT-01-13.APPROVAL-PLAN-EVIDENCE-BINDING-V1"]],
  ["MCFT-CAP-05.MCFT-04-06-07-08-09-10.RECEIPT-CONSUMING-TICK-V1", "MCFT-16", ["MCFT-CAP-05.MCFT-15.ACTION-FEEDBACK-H-COMMIT-ADAPTER-V1"]],
  ["MCFT-CAP-05.MCFT-07-11.FORECAST-OBSERVATION-RESIDUAL-C-COMMIT-V1", "MCFT-11", ["MCFT-CAP-05.MCFT-04-06-07-08-09-10.RECEIPT-CONSUMING-TICK-V1"]],
  ["MCFT-CAP-05.MCFT-03-04.RESTART-LATE-RECEIPT-REBUILD-V1", "MCFT-04", ["MCFT-CAP-05.MCFT-07-11.FORECAST-OBSERVATION-RESIDUAL-C-COMMIT-V1"]],
  ["MCFT-CAP-05.MCFT-04-16.BOUNDED-EIGHT-TICK-FEEDBACK-CHAIN-V1", "MCFT-16", ["MCFT-CAP-05.MCFT-03-04.RESTART-LATE-RECEIPT-REBUILD-V1"]],
  ["MCFT-CAP-05.CLOSURE-AND-FINALIZATION-V1", "MCFT-16", ["MCFT-CAP-05.MCFT-04-16.BOUNDED-EIGHT-TICK-FEEDBACK-CHAIN-V1"]],
] as const);

let pass = 0;
function ok(message: string): void { pass += 1; console.log(`PASS ${message}`); }
function fail(code: string, details = ""): never { throw new Error(details ? `${code}:${details}` : code); }

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
  if (result.status !== 0) throw new Error(`COMMAND_FAILED:${executable} ${args.join(" ")}\n${result.stdout ?? ""}\n${result.stderr ?? ""}`);
  return String(result.stdout ?? "");
}

function git(args: string[]): string { return run(process.platform === "win32" ? "git.exe" : "git", args).trim(); }
function absolute(relativePath: string): string { return path.join(ROOT, relativePath); }
function readText(relativePath: string): string { return fs.readFileSync(absolute(relativePath), "utf8"); }
function readJson(relativePath: string): any { return JSON.parse(readText(relativePath)); }
function writeText(relativePath: string, value: string): void {
  fs.mkdirSync(path.dirname(absolute(relativePath)), { recursive: true });
  fs.writeFileSync(absolute(relativePath), `${value.replace(/\r\n/g, "\n").trimEnd()}\n`, "utf8");
}
function writeJson(relativePath: string, value: unknown): void { writeText(relativePath, JSON.stringify(value, null, 2)); }
function sha256Text(value: string): string { return crypto.createHash("sha256").update(value).digest("hex"); }

function resolveDatabaseName(databaseUrl: string): string {
  const name = decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\//, ""));
  if (!name) fail("DATABASE_NAME_REQUIRED");
  if (!/(mcft|cap.*05|s0|acceptance|test)/i.test(name)) fail("ISOLATED_ACCEPTANCE_DATABASE_REQUIRED", name);
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
  return [EXPECTED_SCOPE.tenant_id, EXPECTED_SCOPE.project_id, EXPECTED_SCOPE.group_id, EXPECTED_SCOPE.field_id, EXPECTED_SCOPE.season_id, EXPECTED_SCOPE.zone_id];
}

function factEnvelope(recordJson: unknown): any {
  const parsed = typeof recordJson === "string" ? JSON.parse(recordJson) : recordJson;
  assert.ok(parsed && typeof parsed === "object" && parsed.payload && typeof parsed.payload === "object", "CANONICAL_FACT_ENVELOPE_INVALID");
  return parsed.payload;
}

async function readCanonicalObject(pool: Pool, objectId: string, objectType: string): Promise<any> {
  const result = await pool.query("SELECT record_json FROM facts WHERE record_json->'payload'->>'object_id'=$1 AND record_json->>'type'=$2", [objectId, objectType]);
  assert.equal(result.rows.length, 1, `CANONICAL_OBJECT_CARDINALITY:${objectType}:${objectId}`);
  const object = factEnvelope(result.rows[0].record_json);
  assert.equal(object.object_id, objectId, `CANONICAL_OBJECT_ID_MISMATCH:${objectType}`);
  assert.equal(object.object_type, objectType, `CANONICAL_OBJECT_TYPE_MISMATCH:${objectType}`);
  return object;
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
  if (checkpoint.payload.successful_forecast_ref !== undefined) assert.equal(checkpoint.payload.successful_forecast_ref, successfulForecast.object_id, "CHECKPOINT_SUCCESSFUL_FORECAST_REF_MISMATCH");
  assert.equal(forecast.object_id, successfulForecast.object_id, "LATEST_AND_SUCCESSFUL_FORECAST_MUST_MATCH");
  assert.equal(forecastLatest.rows[0].forecast_status, "COMPLETED", "FORECAST_PROJECTION_STATUS_MISMATCH");
  assert.equal(forecast.payload.status, "COMPLETED", "FORECAST_STATUS_MISMATCH");
  assert.ok(Array.isArray(forecast.payload.points) && forecast.payload.points.length === 72, "FORECAST_POINTS_MUST_EQUAL_72");
  assert.equal(scenarioLatest.rows[0].source_forecast_ref, forecast.object_id, "SCENARIO_SOURCE_FORECAST_REF_MISMATCH");
  assert.equal(scenarioLatest.rows[0].source_forecast_hash, forecast.determinism_hash, "SCENARIO_SOURCE_FORECAST_HASH_MISMATCH");
  assert.equal(scenario.payload.source_forecast_ref, forecast.object_id, "SCENARIO_PAYLOAD_FORECAST_REF_MISMATCH");
  assert.equal(scenario.payload.source_forecast_hash, forecast.determinism_hash, "SCENARIO_PAYLOAD_FORECAST_HASH_MISMATCH");
  assert.ok(Array.isArray(scenario.payload.options) && scenario.payload.options.length === 3, "SCENARIO_OPTIONS_MUST_EQUAL_3");
  assert.equal(state.runtime_config_ref, runtimeConfig.object_id, "STATE_RUNTIME_CONFIG_REF_MISMATCH");
  assert.equal(state.runtime_config_hash, runtimeConfig.determinism_hash, "STATE_RUNTIME_CONFIG_HASH_MISMATCH");

  const realityBindingRef = runtimeConfig.payload.reality_binding_ref;
  const realityBindingHash = runtimeConfig.payload.reality_binding_hash;
  const binding = await pool.query("SELECT authority_ref,determinism_hash,semantic_payload FROM twin_runtime_authority_snapshot_v1 WHERE authority_kind='REALITY_BINDING' AND authority_ref=$1", [realityBindingRef]);
  assert.equal(binding.rows.length, 1, "REALITY_BINDING_SNAPSHOT_CARDINALITY");
  assert.equal(binding.rows[0].determinism_hash, realityBindingHash, "REALITY_BINDING_HASH_MISMATCH");

  ok("PostgreSQL canonical lineage, State, checkpoint, successful Forecast, Scenario, State-bound Runtime Config, and Reality Binding are mutually consistent");

  return {
    schema_version: "geox_mcft_cap_05_predecessor_identity_evidence_v1",
    extraction_source: "ISOLATED_POSTGRESQL_CANONICAL_READ_PATH",
    baseline_main_commit: BASELINE_MAIN,
    scope: EXPECTED_SCOPE,
    active_lineage_ref: lineage.object_id,
    lineage_hash: lineage.determinism_hash,
    lineage_id: lineage.lineage_id,
    revision_id: lineage.revision_id,
    latest_posterior_state_ref: state.object_id,
    latest_posterior_state_hash: state.determinism_hash,
    latest_posterior_state_logical_time: state.logical_time,
    latest_checkpoint_ref: checkpoint.object_id,
    latest_checkpoint_hash: checkpoint.determinism_hash,
    latest_forecast_result_ref: forecast.object_id,
    latest_forecast_result_hash: forecast.determinism_hash,
    latest_forecast_status: forecast.payload.status,
    latest_successful_forecast_ref: successfulForecast.object_id,
    latest_successful_forecast_hash: successfulForecast.determinism_hash,
    latest_scenario_set_ref: scenario.object_id,
    latest_scenario_set_hash: scenario.determinism_hash,
    predecessor_state_runtime_config_ref: runtimeConfig.object_id,
    predecessor_state_runtime_config_hash: runtimeConfig.determinism_hash,
    reality_binding_ref: realityBindingRef,
    reality_binding_hash: realityBindingHash,
    checkpoint_sequence: checkpoint.payload.tick_sequence,
    next_tick_logical_time: checkpoint.payload.next_tick_logical_time,
    validated_relations: [
      "active_lineage_ref_resolves_exactly_one_canonical_lineage",
      "lineage_and_revision_consistent_across_terminal_objects",
      "checkpoint_last_posterior_state_ref_matches_latest_state",
      "checkpoint_forecast_result_ref_matches_latest_completed_forecast",
      "latest_forecast_equals_latest_successful_forecast",
      "latest_scenario_source_forecast_ref_hash_matches_latest_successful_forecast",
      "state_runtime_config_ref_hash_matches_exact_canonical_runtime_config",
      "runtime_config_reality_binding_ref_hash_matches_persisted_authority_snapshot",
      "checkpoint_sequence_equals_72",
      "latest_logical_time_equals_2026_06_04T01_00_00Z",
      "next_tick_logical_time_equals_2026_06_04T02_00_00Z",
    ],
  };
}

function blockedSlice([delivery_slice_id, primary_owner_work_package_id, depends_on_delivery_slice_ids]: readonly [string, string, readonly string[]]): any {
  return {
    delivery_slice_id,
    primary_owner_work_package_id,
    depends_on_delivery_slice_ids,
    baseline_main_commit: null,
    branch: null,
    status: "BLOCKED",
    runtime_source_authorized: false,
    allowed_claims: [],
    preserved_nonclaims: [...PRESERVED_NONCLAIMS],
    exact_changed_file_boundary: [],
    effectiveness_condition: "PREDECESSOR_SLICE_MERGED_AND_MERGED_MAIN_GATE_PASS_AND_EXPLICIT_SLICE_ACTIVATION",
    effectiveness_condition_satisfied: false,
  };
}

function materializeGovernance(identity: any): void {
  fs.mkdirSync(absolute("acceptance-output"), { recursive: true });
  writeJson(EVIDENCE_PATH, identity);
  const taskBefore = readText(TASK_PATH);
  const taskHash = sha256Text(taskBefore);
  const p0Evidence = {
    pr_number: P0_PR,
    exact_head_commit: P0_EXACT_HEAD,
    exact_head_ci_run: P0_EXACT_HEAD_WORKFLOW,
    merge_commit: BASELINE_MAIN,
    postmerge_probe_pr_number: P0_POSTMERGE_PROBE_PR,
    postmerge_workflow_run: P0_POSTMERGE_WORKFLOW,
    postmerge_gate: "PASS",
    head_to_merge_file_delta_count: 0,
    tree_equivalence: "PASS",
    effectiveness_condition_satisfied: true,
  };

  writeJson(LOCK_PATH, {
    schema_version: "geox_mcft_cap_05_predecessor_lock_v1",
    capability_line_id: "MCFT-CAP-05",
    predecessor_capability_line_id: "MCFT-CAP-04",
    status: "COMPLETE",
    baseline_main_commit: BASELINE_MAIN,
    p0_effectiveness: p0Evidence,
    predecessor_closure_record_ref: CAP04_CLOSURE_PATH,
    predecessor_main_verification_ref: CAP04_MAIN_PATH,
    identity_extraction_source: identity.extraction_source,
    identity_evidence_ref: EVIDENCE_PATH,
    expected_scope: EXPECTED_SCOPE,
    expected_checkpoint: {
      checkpoint_sequence: EXPECTED_CHECKPOINT_SEQUENCE,
      last_logical_time: EXPECTED_LAST_LOGICAL_TIME,
      next_tick_logical_time: EXPECTED_NEXT_LOGICAL_TIME,
    },
    canonical_identity: {
      active_lineage_ref: identity.active_lineage_ref,
      active_lineage_hash: identity.lineage_hash,
      lineage_id: identity.lineage_id,
      revision_id: identity.revision_id,
      latest_posterior_state_ref: identity.latest_posterior_state_ref,
      latest_posterior_state_hash: identity.latest_posterior_state_hash,
      latest_checkpoint_ref: identity.latest_checkpoint_ref,
      latest_checkpoint_hash: identity.latest_checkpoint_hash,
      latest_forecast_result_ref: identity.latest_forecast_result_ref,
      latest_forecast_result_hash: identity.latest_forecast_result_hash,
      latest_successful_forecast_ref: identity.latest_successful_forecast_ref,
      latest_successful_forecast_hash: identity.latest_successful_forecast_hash,
      latest_scenario_set_ref: identity.latest_scenario_set_ref,
      latest_scenario_set_hash: identity.latest_scenario_set_hash,
      predecessor_state_runtime_config_ref: identity.predecessor_state_runtime_config_ref,
      predecessor_state_runtime_config_hash: identity.predecessor_state_runtime_config_hash,
      reality_binding_ref: identity.reality_binding_ref,
      reality_binding_hash: identity.reality_binding_hash,
    },
    validated_relations: [...identity.validated_relations],
    lock_claims: [
      "MCFT_CAP_04_MERGED_MAIN_COMPLETE_VERIFIED",
      "MCFT_CAP_05_P0_MERGED_MAIN_EFFECTIVE",
      "MCFT_CAP_05_PREDECESSOR_CANONICAL_IDENTITY_EXTRACTED_FROM_POSTGRESQL",
      "MCFT_CAP_05_PREDECESSOR_LINEAGE_STATE_CHECKPOINT_FORECAST_SCENARIO_CONFIG_BINDING_LOCKED",
      "MCFT_CAP_05_PREDECESSOR_NEXT_LOGICAL_TICK_LOCKED",
    ],
    failure_policy: {
      canonical_value_mismatch: "FAIL_CLOSED",
      missing_projection_or_canonical_object: "FAIL_CLOSED",
      latest_and_successful_forecast_divergence: "FAIL_CLOSED",
      scenario_forecast_binding_mismatch: "FAIL_CLOSED",
      active_config_pointer_substitution: "FORBIDDEN",
      fixture_object_id_substitution: "FORBIDDEN",
      predecessor_fact_mutation: "FORBIDDEN",
      manual_alternate_start: "FORBIDDEN",
    },
    preserved_nonclaims: [...PRESERVED_NONCLAIMS],
    effectiveness_condition: "POSTGRESQL_IDENTITY_EXTRACTED_AND_S0_PR_MERGED_AND_MERGED_MAIN_AUTHORIZATION_GATE_PASS",
  });

  const pMinus1Slice = {
    delivery_slice_id: "MCFT-CAP-05.P-1.DT02-OBJECT-TRANSACTION-ADJUDICATION-V1",
    slice_kind: "ARCHITECTURE_GOVERNANCE_ONLY",
    status: "MERGED_EFFECTIVE",
    baseline_main_commit: "3eba797307388bd652dc5c65e91d634375e1b8c2",
    merge_commit: "5391a3a8f811fc166fa187d7da70342ee36ab5fa",
    postmerge_workflow_run: 29305092038,
    adjudication_result: "REUSE_WITHOUT_AMENDMENT",
    runtime_source_authorized: false,
  };
  const p0Slice = {
    delivery_slice_id: P0,
    slice_kind: "GOVERNANCE_SSOT_SETTLEMENT_ONLY",
    status: "MERGED_EFFECTIVE",
    baseline_main_commit: "5391a3a8f811fc166fa187d7da70342ee36ab5fa",
    runtime_source_authorized: false,
    exact_changed_file_boundary: [MAP_PATH, MATRIX_PATH, TASK_PATH, P0_STATUS_PATH, "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_P0_SETTLEMENT_SSOT.cjs"].sort(),
    effectiveness_condition: "P0_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_P0_GATE_PASS",
    ...p0Evidence,
  };
  const s0Slice = {
    delivery_slice_id: S0,
    slice_kind: "GOVERNANCE_ONLY",
    primary_owner_work_package_id: "MCFT-16",
    contributing_owner_work_package_ids: ["MCFT-00", "MCFT-02", "MCFT-03", "MCFT-04", "MCFT-09", "MCFT-10", "MCFT-11", "MCFT-13", "MCFT-15"],
    depends_on_delivery_slice_ids: [P0],
    baseline_main_commit: BASELINE_MAIN,
    branch: BRANCH,
    status: "READY_FOR_MERGE",
    runtime_source_authorized: false,
    allowed_claims: [
      "MCFT_CAP_05_P0_EFFECTIVE_VERIFIED",
      "MCFT_CAP_04_PREDECESSOR_CANONICAL_IDENTITY_LOCKED",
      "MCFT_CAP_05_DELIVERY_GRAPH_FROZEN",
      "MCFT_CAP_05_OWNER_BOUNDARY_FROZEN",
      "MCFT_CAP_05_TASK_V0_4_AUTHORITY_PRESERVED",
    ],
    preserved_nonclaims: [...PRESERVED_NONCLAIMS],
    exact_changed_file_boundary: [...EXACT_CHANGED_FILES],
    effectiveness_condition: "S0_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_AUTHORIZATION_GATE_PASS",
    effectiveness_condition_satisfied: false,
  };
  const slices = [pMinus1Slice, p0Slice, s0Slice, ...DOWNSTREAM_SLICES.map((definition) => blockedSlice(definition))];

  writeJson(DELIVERY_PATH, {
    schema_version: "geox_mcft_cap_05_delivery_slice_status_v1",
    capability_line_id: "MCFT-CAP-05",
    display_alias: "MCFT-5",
    name: "Human Decision and Execution-Receipt Feedback",
    runtime_mode: "REPLAY",
    target_completion_level: "Level A — Deterministic Replay Twin",
    status: "S0_READY_FOR_MERGE",
    baseline_main_commit: BASELINE_MAIN,
    branch: BRANCH,
    active_delivery_slice_id: S0,
    runtime_source_authorized: false,
    authorization_effective: false,
    predecessor_lock_ref: LOCK_PATH,
    task_ref: TASK_PATH,
    p0_effectiveness: p0Evidence,
    slices,
    next_authorized_slice_ids: [],
    next_authorized_slice_id_after_merge_and_postmerge_gate: S1,
    successor_capability_line_id: "MCFT-CAP-06",
    successor_authorized: false,
  });

  writeJson(AUTHORIZATION_STATUS_PATH, {
    schema_version: "geox_mcft_cap_05_authorization_status_v1",
    authorization_id: "MCFT-CAP-05-AUTHORIZATION-V1",
    capability_line_id: "MCFT-CAP-05",
    display_alias: "MCFT-5",
    name: "Human Decision and Execution-Receipt Feedback",
    runtime_mode: "REPLAY",
    target_completion_level: "Level A — Deterministic Replay Twin",
    status: "READY_FOR_MERGE",
    design_status: "DESIGN_FROZEN_CANDIDATE_V0_4",
    implementation_status: "NOT_AUTHORIZED",
    authorization_effective: false,
    runtime_source_authorized: false,
    authorization_effectiveness_condition: "S0_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_AUTHORIZATION_GATE_PASS",
    baseline_main_commit: BASELINE_MAIN,
    branch: BRANCH,
    active_delivery_slice_id: S0,
    task_ref: TASK_PATH,
    task_sha256_before_s0_materialization: taskHash,
    authorization_document_ref: AUTHORIZATION_PATH,
    delivery_status_ref: DELIVERY_PATH,
    predecessor: {
      capability_line_id: "MCFT-CAP-04",
      status: "COMPLETE",
      closure_effective: true,
      capability_complete: true,
      closure_record_ref: CAP04_CLOSURE_PATH,
      main_verification_ref: CAP04_MAIN_PATH,
      predecessor_lock_ref: LOCK_PATH,
      postgresql_canonical_lock_status: "COMPLETE",
      checkpoint_sequence: EXPECTED_CHECKPOINT_SEQUENCE,
      latest_logical_time: EXPECTED_LAST_LOGICAL_TIME,
      next_tick_logical_time: EXPECTED_NEXT_LOGICAL_TIME,
      latest_successful_forecast_ref: identity.latest_successful_forecast_ref,
      latest_scenario_set_ref: identity.latest_scenario_set_ref,
    },
    p0_effectiveness: p0Evidence,
    current_blockers: ["MCFT_CAP_05_S0_PR_MERGED", "MCFT_CAP_05_S0_MERGED_MAIN_AUTHORIZATION_GATE_PASS"],
    premerge_satisfied_conditions: [
      "MCFT_CAP_05_P0_MERGED_MAIN_EFFECTIVE",
      "MCFT_CAP_04_COMPLETE_ON_CANONICAL_MAIN",
      "MCFT_CAP_05_TASK_V0_4_INTEGRITY_VERIFIED",
      "MCFT_CAP_05_PREDECESSOR_CANONICAL_IDENTITY_LOCK_COMPLETE",
      "MCFT_CAP_05_DELIVERY_GRAPH_FROZEN",
      "MCFT_CAP_05_OWNER_BOUNDARY_FROZEN",
      "MCFT_CAP_05_MATRIX_AND_IMPLEMENTATION_MAP_UPDATED",
      "MCFT_CAP_05_AUTHORIZATION_GATE_IMPLEMENTED",
      "MCFT_CAP_05_POSTGRESQL_PREFLIGHT_IMPLEMENTED",
    ],
    allowed_claims_after_merge_and_postmerge_gate: [
      "MCFT_CAP_05_AUTHORIZATION_V1_ESTABLISHED",
      "MCFT_CAP_05_DESIGN_FROZEN",
      "MCFT_CAP_05_READY_FOR_IMPLEMENTATION",
      "MCFT_CAP_05_DELIVERY_GRAPH_FROZEN",
      "MCFT_CAP_05_OWNER_BOUNDARY_FROZEN",
      "MCFT_CAP_05_PREDECESSOR_IDENTITY_LOCKED",
    ],
    preserved_nonclaims: [...PRESERVED_NONCLAIMS],
    repository_write_scope: "S0_GOVERNANCE_ONLY",
    exact_changed_file_boundary: [...EXACT_CHANGED_FILES],
    next_authorized_slice_id_after_effectiveness: S1,
    successor_capability_line_id: "MCFT-CAP-06",
    successor_authorized: false,
  });

  const authorization = `<!-- ${AUTHORIZATION_PATH} -->
# GEOX MCFT-CAP-05 Authorization and Predecessor Lock

## Authority

\`\`\`text
authorization_id:
MCFT-CAP-05-AUTHORIZATION-V1

delivery_slice_id:
${S0}

baseline_main_commit:
${BASELINE_MAIN}

task:
${TASK_PATH}

authorization_status:
READY_FOR_MERGE

authorization_effective:
false

runtime_source_authorized:
false

effectiveness_condition:
S0_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_AUTHORIZATION_GATE_PASS
\`\`\`

## P0 effectiveness

\`\`\`text
P0 PR: #${P0_PR}
P0 exact head: ${P0_EXACT_HEAD}
P0 exact-head workflow: ${P0_EXACT_HEAD_WORKFLOW} SUCCESS
P0 merge commit: ${BASELINE_MAIN}
P0 postmerge probe PR: #${P0_POSTMERGE_PROBE_PR}
P0 postmerge workflow: ${P0_POSTMERGE_WORKFLOW} SUCCESS
P0 postmerge Gate: PASS
\`\`\`

## PostgreSQL predecessor proof

The isolated PostgreSQL canonical read path established:

\`\`\`text
active_lineage_ref: ${identity.active_lineage_ref}
lineage_id: ${identity.lineage_id}
revision_id: ${identity.revision_id}
latest_posterior_state_ref: ${identity.latest_posterior_state_ref}
latest_checkpoint_ref: ${identity.latest_checkpoint_ref}
latest_forecast_result_ref: ${identity.latest_forecast_result_ref}
latest_successful_forecast_ref: ${identity.latest_successful_forecast_ref}
latest_scenario_set_ref: ${identity.latest_scenario_set_ref}
predecessor_state_runtime_config_ref: ${identity.predecessor_state_runtime_config_ref}
reality_binding_ref: ${identity.reality_binding_ref}
checkpoint_sequence: ${identity.checkpoint_sequence}
latest_logical_time: ${EXPECTED_LAST_LOGICAL_TIME}
next_tick_logical_time: ${identity.next_tick_logical_time}
\`\`\`

All hashes and cross-reference relations are frozen in ${LOCK_PATH}. Replay Runtime Config authority is the exact State-bound Runtime Config ref/hash, not an active-config pointer.

## Delivery authority

Before S0 merge and merged-main Authorization Gate:

\`\`\`text
design_status: DESIGN_FROZEN_CANDIDATE_V0_4
implementation_status: NOT_AUTHORIZED
runtime_source_authorized: false
active_delivery_slice_id: ${S0}
next_authorized_slice_ids: []
\`\`\`

After S0 merge and merged-main Authorization Gate, only this slice becomes eligible for explicit activation:

\`\`\`text
${S1}
\`\`\`

## Exact changed-file boundary

${EXACT_CHANGED_FILES.map((file) => `- \`${file}\``).join("\n")}

No Runtime source, migration, canonical Decision/Feedback/Residual write, route, web, AO-ACT, scheduler, or CAP-06 authorization is included.

## Preserved nonclaims

\`\`\`text
${PRESERVED_NONCLAIMS.join("\n")}
\`\`\`
`;
  writeText(AUTHORIZATION_PATH, authorization);

  const alignment = `<!-- ${ALIGNMENT_PATH} -->
# GEOX MCFT-CAP-05 S0 Alignment Review

## Three-way alignment

\`\`\`text
task authority: PASS
P-1 merged-main effectiveness: PASS
P0 merged-main effectiveness: PASS
CAP-04 terminal authority: PASS
PostgreSQL canonical predecessor lock: PASS
Capability Matrix alignment: PASS
Implementation Map alignment: PASS
S0 changed-file boundary: PASS
Runtime source exclusion: PASS
\`\`\`

## Locked handoff

\`\`\`text
baseline_main_commit: ${BASELINE_MAIN}
checkpoint_sequence: ${identity.checkpoint_sequence}
latest logical time: ${EXPECTED_LAST_LOGICAL_TIME}
next logical tick: ${identity.next_tick_logical_time}
active lineage ref: ${identity.active_lineage_ref}
semantic lineage id: ${identity.lineage_id}
revision id: ${identity.revision_id}
posterior State ref: ${identity.latest_posterior_state_ref}
checkpoint ref: ${identity.latest_checkpoint_ref}
latest Forecast ref: ${identity.latest_forecast_result_ref}
latest successful Forecast ref: ${identity.latest_successful_forecast_ref}
latest Scenario Set ref: ${identity.latest_scenario_set_ref}
State-bound Runtime Config ref: ${identity.predecessor_state_runtime_config_ref}
Reality Binding ref: ${identity.reality_binding_ref}
\`\`\`

## Current state

\`\`\`text
S0 status: READY_FOR_MERGE
authorization effective: false
design status: DESIGN_FROZEN_CANDIDATE_V0_4
implementation status: NOT_AUTHORIZED
runtime source authorized: false
active delivery slice: ${S0}
next eligible after effectiveness: ${S1}
successor MCFT-CAP-06 authorized: false
\`\`\`

Only PR merge and the merged-main Authorization Gate remain. No Runtime capability claim is active.
`;
  writeText(ALIGNMENT_PATH, alignment);

  const matrix = readJson(MATRIX_PATH);
  const cap04 = matrix.capability_lines.find((line: any) => line.capability_line_id === "MCFT-CAP-04");
  const cap05 = matrix.capability_lines.find((line: any) => line.capability_line_id === "MCFT-CAP-05");
  assert.equal(cap04?.status, "COMPLETE", "CAP04_MATRIX_COMPLETE_REQUIRED");
  assert.equal(cap04?.implementation_status, "COMPLETE", "CAP04_MATRIX_IMPLEMENTATION_COMPLETE_REQUIRED");
  assert.equal(cap04?.active_delivery_slice_id, null, "CAP04_MATRIX_ACTIVE_SLICE_MUST_BE_NULL");
  assert.ok(cap05, "CAP05_MATRIX_ENTRY_REQUIRED");
  Object.assign(cap05, {
    status: "NOT_AUTHORIZED",
    design_status: "DESIGN_FROZEN_CANDIDATE_V0_4",
    implementation_status: "NOT_AUTHORIZED",
    authorization_id: "MCFT-CAP-05-AUTHORIZATION-V1",
    authorization_status: "READY_FOR_MERGE",
    authorization_effective: false,
    runtime_source_authorized: false,
    predecessor_capability_line_id: "MCFT-CAP-04",
    predecessor_main_commit: BASELINE_MAIN,
    predecessor_lock_ref: LOCK_PATH,
    authorization_document_ref: AUTHORIZATION_PATH,
    authorization_status_ref: AUTHORIZATION_STATUS_PATH,
    delivery_status_ref: DELIVERY_PATH,
    active_delivery_slice_id: S0,
    next_delivery_slice_id: S1,
    next_delivery_slice_authorized: false,
    delivery_slices: slices,
    pending_completion_claims: [],
    effective_completion_claims: [],
    completion_claims: [],
    preserved_nonclaims: [...PRESERVED_NONCLAIMS],
    next_authorized_slice_ids: [],
    next_authorized_slice_id_after_merge_and_postmerge_gate: S1,
    successor_capability_line_id: "MCFT-CAP-06",
    successor_authorized: false,
    effectiveness_condition: "S0_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_AUTHORIZATION_GATE_PASS",
    effectiveness_condition_satisfied: false,
  });
  matrix.latest_governance_update = S0;
  matrix.baseline = { branch: "main", commit: BASELINE_MAIN, meaning: "MCFT-CAP-05 P0 merged-main effective; S0 authorization and CAP-04 predecessor lock candidate only" };
  matrix.global_rules = [...new Set([
    ...(matrix.global_rules ?? []),
    "MCFT-CAP-05 predecessor identity is authoritative only from isolated PostgreSQL canonical readback",
    "MCFT-CAP-05 Replay Runtime Config authority is the predecessor State-bound ref and hash, not an active-config pointer",
    "MCFT-CAP-05 Runtime source remains forbidden until S0 merges and the merged-main Authorization Gate passes",
    "MCFT-CAP-05 S0 authorization does not authorize MCFT-CAP-06",
  ])];
  writeJson(MATRIX_PATH, matrix);

  const currentBlock = /当前状态：\n\n```text\narchitecture_direction:\n.*?\nfirst_permitted_repository_action:\n.*?\n```/s;
  const replacement = `当前状态：\n\n\`\`\`text\narchitecture_direction:\nCONFORMANT\n\ndesign_status:\nDESIGN_FROZEN_CANDIDATE_V0_4\n\nimplementation_status:\nNOT_AUTHORIZED\n\nruntime_source_authorized:\nfalse\n\nactive_delivery_slice_id:\n${S0}\n\ndt02_architecture_amendment_status:\nNOT_REQUIRED_MERGED_EFFECTIVE\n\nfirst_permitted_repository_action:\n${S0}\n\`\`\``;
  let task = taskBefore.replace(currentBlock, replacement);
  if (task === taskBefore) fail("TASK_CURRENT_STATE_BLOCK_NOT_REPLACED");
  const s0Marker = "# 24. S0 — Authorization and Predecessor Lock";
  const s0Evidence = `\n\nS0 candidate identity：\n\n\`\`\`text\nbaseline_main_commit:\n${BASELINE_MAIN}\n\nP0 exact head:\n${P0_EXACT_HEAD}\n\nP0 merge commit:\n${BASELINE_MAIN}\n\nP0 merged-main Gate workflow:\n${P0_POSTMERGE_WORKFLOW} SUCCESS\n\nS0 status:\nREADY_FOR_MERGE\n\nauthorization effective:\nfalse\n\nruntime source authorized:\nfalse\n\npredecessor checkpoint sequence:\n${identity.checkpoint_sequence}\n\npredecessor latest logical time:\n${EXPECTED_LAST_LOGICAL_TIME}\n\ncanonical next logical tick:\n${identity.next_tick_logical_time}\n\npredecessor lock:\n${LOCK_PATH}\n\nS1 authorized:\nfalse\n\`\`\`\n`;
  if (!task.includes("S0 candidate identity：")) task = task.replace(s0Marker, `${s0Marker}${s0Evidence}`);
  writeText(TASK_PATH, task);

  const marker = "<!-- MCFT-CAP-05-S0-AUTHORIZATION-START -->";
  let implementationMap = readText(MAP_PATH).replace(/\r\n/g, "\n");
  if (!implementationMap.includes(marker)) {
    implementationMap += `\n\n${marker}\n\n## MCFT-CAP-05 S0 authorization readiness\n\n\`\`\`text\ncapability: MCFT-CAP-05 — Human Decision and Execution-Receipt Feedback\nP0 merge commit: ${BASELINE_MAIN}\nP0 postmerge Gate: ${P0_POSTMERGE_WORKFLOW} PASS\nS0 authorization: READY_FOR_MERGE\nauthorization effective: false\ndesign status: DESIGN_FROZEN_CANDIDATE_V0_4\nimplementation status: NOT_AUTHORIZED\nruntime source authorized: false\nactive delivery slice: ${S0}\npredecessor checkpoint sequence: ${identity.checkpoint_sequence}\npredecessor latest logical time: ${EXPECTED_LAST_LOGICAL_TIME}\ncanonical next logical tick: ${identity.next_tick_logical_time}\nlatest successful Forecast: ${identity.latest_successful_forecast_ref}\nlatest Scenario Set: ${identity.latest_scenario_set_ref}\npredecessor lock: ${LOCK_PATH}\nnext eligible slice after merge and merged-main Gate: ${S1}\nsuccessor MCFT-CAP-06 authorized: false\n\`\`\`\n\nThe S0 branch contains governance artifacts and isolated PostgreSQL predecessor proof only. Runtime implementation remains forbidden until S0 merges and its merged-main Authorization Gate passes.\n\n<!-- MCFT-CAP-05-S0-AUTHORIZATION-END -->\n`;
  }
  writeText(MAP_PATH, implementationMap);
}

async function main(): Promise<void> {
  if (process.env.MCFT_CAP_05_PREFLIGHT_DESTRUCTIVE_ACCEPTANCE !== "1") fail("SET_MCFT_CAP_05_PREFLIGHT_DESTRUCTIVE_ACCEPTANCE_1");
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) fail("DATABASE_URL_REQUIRED");
  ok(`database name is explicitly isolated for acceptance: ${resolveDatabaseName(databaseUrl)}`);
  assertRepositoryBoundary();

  const task = readText(TASK_PATH);
  assert.ok(task.includes("完整任务线 v0.4"), "TASK_V0_4_REQUIRED");
  assert.ok(task.includes("# 24. S0 — Authorization and Predecessor Lock"), "TASK_S0_AUTHORITY_REQUIRED");
  assert.ok(task.includes("S0 — Authorization and Predecessor Lock"), "TASK_S0_SECTION_AUTHORITY_REQUIRED");
  const p0Status = readJson(P0_STATUS_PATH);
  const cap04Closure = readJson(CAP04_CLOSURE_PATH);
  const cap04Main = readJson(CAP04_MAIN_PATH);
  assert.equal(p0Status.status, "READY_FOR_MERGE", "P0_STATUS_RECORD_REQUIRED");
  assert.equal(p0Status.p_minus_1_effectiveness.effective, true, "P_MINUS_1_EFFECTIVE_REQUIRED");
  assert.equal(cap04Closure.capability_complete, true, "CAP04_CLOSURE_COMPLETE_REQUIRED");
  assert.equal(cap04Main.capability_complete, true, "CAP04_MAIN_COMPLETE_REQUIRED");
  ok("P0 evidence, complete v0.4 task authority, and CAP-04 terminal governance authority are exact");

  const dbOutput = run(process.platform === "win32" ? "pnpm.cmd" : "pnpm", ["-w", "exec", "tsx", "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_TWENTY_FOUR_TICK_RANGE_DB.ts"], {
    env: { DATABASE_URL: databaseUrl, MCFT_CAP_04_RANGE_DESTRUCTIVE_ACCEPTANCE: "1" },
  });
  process.stdout.write(dbOutput);
  assert.ok(dbOutput.includes("0 FAIL"), "CAP04_24_TICK_DB_GATE_MUST_PASS");
  ok("completed MCFT-CAP-04 terminal chain is reproduced in isolated PostgreSQL");

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const identity = await extractIdentity(pool);
    materializeGovernance(identity);
    ok("predecessor lock, authorization, delivery graph, task state, matrix, implementation map, and alignment review are materialized");
  } finally {
    await pool.end();
  }

  run(process.platform === "win32" ? "git.exe" : "git", ["diff", "--check", BASELINE_MAIN]);
  ok("S0 working-tree diff check PASS");
  console.log(`MCFT-CAP-05 predecessor preflight: ${pass} PASS, 0 FAIL`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

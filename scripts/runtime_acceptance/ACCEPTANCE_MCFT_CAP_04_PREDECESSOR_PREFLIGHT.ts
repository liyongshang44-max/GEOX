// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_PREDECESSOR_PREFLIGHT.ts
// Purpose: reproduce the completed MCFT-CAP-03 chain in isolated PostgreSQL, read the canonical terminal handoff, and materialize the governance-only MCFT-CAP-04 S0 artifacts.
// Boundary: destructive isolated-database acceptance and governance artifact generation only; no CAP-04 Runtime source, migration, route, scheduler, web, Forecast write, Scenario write, Recommendation, Decision, or AO-ACT.

import assert from "node:assert/strict";
import cp from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const BASELINE_MAIN = "30fdd839aa675656dd3dc9d1def57b06f63f86ec";
const BRANCH = "agent/mcft-cap-04-s0-authorization-predecessor-lock-v1";
const P0 = "MCFT-CAP-04.P0.CAP-03-GLOBAL-SSOT-RECONCILIATION-V1";
const S0 = "MCFT-CAP-04.GOV-AUTHORIZATION-AND-PREDECESSOR-LOCK-V1";
const S1 = "MCFT-CAP-04.MCFT-02-07-09-10.FORECAST-SCENARIO-CONTRACTS-CONFIG-V1";
const TASK_SHA256 = "ea63e92a64b760b84c49428b1d3a245ce5cd94bb08daa9c6b971a53861b90a63";
const P0_POSTMERGE_WORKFLOW_RUN = 29206218494;
const EXPECTED_LAST_LOGICAL_TIME = "2026-06-03T01:00:00.000Z";
const EXPECTED_NEXT_LOGICAL_TIME = "2026-06-03T02:00:00.000Z";
const EXPECTED_CHECKPOINT_SEQUENCE = 48;

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
const TASK_PATH = "docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-TASK.md";
const P0_STATUS_PATH = "docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-P0-STATUS.json";
const AUTHORIZATION_PATH = "docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-AUTHORIZATION.md";
const AUTHORIZATION_STATUS_PATH = "docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-AUTHORIZATION-STATUS.json";
const LOCK_PATH = "docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-PREDECESSOR-LOCK.json";
const DELIVERY_PATH = "docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-DELIVERY-SLICE-STATUS.json";
const ALIGNMENT_PATH = "docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S0-ALIGNMENT-REVIEW.md";
const GATE_PATH = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_04_AUTHORIZATION.cjs";
const PREFLIGHT_PATH = "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_PREDECESSOR_PREFLIGHT.ts";
const CAP03_MAIN_PATH = "docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-MAIN-VERIFICATION.json";
const CAP03_R4_PATH = "docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-R4-FINAL-VERIFICATION.json";
const EVIDENCE_PATH = "acceptance-output/MCFT_CAP_04_PREDECESSOR_IDENTITY.json";
const TEMP_WORKFLOW_PATH = ".github/workflows/mcft-cap-04-s0-materialize.yml";

const EXACT_CHANGED_FILES = Object.freeze([
  MAP_PATH,
  MATRIX_PATH,
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
  "NO_MCFT_CAP_04_RUNTIME_SOURCE_AUTHORIZATION",
  "NO_SUCCESSFUL_FORECAST_CREATED_BY_CAP_04",
  "NO_72_HOUR_FORECAST_CREATED_BY_CAP_04",
  "NO_SCENARIO_CREATED_BY_CAP_04",
  "NO_FORECAST_RESIDUAL",
  "NO_RECOMMENDATION",
  "NO_POLICY_EVALUATION",
  "NO_DECISION",
  "NO_AO_ACT",
  "NO_CALIBRATION_CANDIDATE",
  "NO_SHADOW_EVALUATION",
  "NO_MODEL_ACTIVATION",
  "NO_ACTIVE_MODEL_PARAMETER_CHANGE",
  "NO_LATE_EVIDENCE_REVISION",
  "NO_CONTINUOUS_RUNTIME",
  "NO_CONTINUOUS_SCHEDULER",
  "NO_LIVE_FIELD_CLAIM",
  "NO_MCFT_GATE_A_CLOSURE",
  "NO_MINIMUM_COMPLETE_FIELD_TWIN_CLAIM",
]);

const DOWNSTREAM_SLICES = Object.freeze([
  [S1, "MCFT-02", [S0]],
  ["MCFT-CAP-04.MCFT-05-09.FUTURE-FORCING-WINDOW-V1", "MCFT-05", [S1]],
  ["MCFT-CAP-04.MCFT-06-09.PURE-72H-FORECAST-MATH-V1", "MCFT-06", ["MCFT-CAP-04.MCFT-05-09.FUTURE-FORCING-WINDOW-V1"]],
  ["MCFT-CAP-04.MCFT-06-10.PURE-THREE-SCENARIO-MATH-V1", "MCFT-06", ["MCFT-CAP-04.MCFT-06-09.PURE-72H-FORECAST-MATH-V1"]],
  ["MCFT-CAP-04.MCFT-02-07-08-09.A1-A2-RECORD-SET-BUILDERS-V1", "MCFT-02", ["MCFT-CAP-04.MCFT-06-10.PURE-THREE-SCENARIO-MATH-V1"]],
  ["MCFT-CAP-04.MCFT-03-09-10.A1-A2-B-PERSISTENCE-UNIQUENESS-RECOVERY-V1", "MCFT-03", ["MCFT-CAP-04.MCFT-02-07-08-09.A1-A2-RECORD-SET-BUILDERS-V1"]],
  ["MCFT-CAP-04.MCFT-04-05-06-07-08-09-10.SINGLE-TICK-FORECAST-SCENARIO-INTEGRATION-V1", "MCFT-04", ["MCFT-CAP-04.MCFT-03-09-10.A1-A2-B-PERSISTENCE-UNIQUENESS-RECOVERY-V1"]],
  ["MCFT-CAP-04.MCFT-04-07-09-10.TWENTY-FOUR-TICK-FORECAST-SCENARIO-RANGE-V1", "MCFT-04", ["MCFT-CAP-04.MCFT-04-05-06-07-08-09-10.SINGLE-TICK-FORECAST-SCENARIO-INTEGRATION-V1"]],
  ["MCFT-CAP-04.MCFT-03-04-07-09-10.RESTART-BACKFILL-FAILURE-RECOVERY-V1", "MCFT-04", ["MCFT-CAP-04.MCFT-04-07-09-10.TWENTY-FOUR-TICK-FORECAST-SCENARIO-RANGE-V1"]],
  ["MCFT-CAP-04.CLOSURE-CANDIDATE-V1", "MCFT-09", ["MCFT-CAP-04.MCFT-03-04-07-09-10.RESTART-BACKFILL-FAILURE-RECOVERY-V1"]],
  ["MCFT-CAP-04.FINALIZATION-MAIN-VERIFICATION-V1", "MCFT-09", ["MCFT-CAP-04.CLOSURE-CANDIDATE-V1"]],
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
    maxBuffer: 128 * 1024 * 1024,
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

function readJson(relativePath: string): any {
  return JSON.parse(readText(relativePath));
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
  if (!/(mcft|cap.*04|s0|acceptance|test)/i.test(name)) fail("ISOLATED_ACCEPTANCE_DATABASE_REQUIRED", name);
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
  ok("branch, merged P0 baseline, ancestry, and governance-only preflight boundary are exact");
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

async function extractIdentity(pool: Pool): Promise<any> {
  const values = scopeValues();
  const active = await pool.query("SELECT active_lineage_ref FROM twin_active_lineage_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6", values);
  const stateLatest = await pool.query("SELECT state_object_id FROM twin_state_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6", values);
  const checkpointLatest = await pool.query("SELECT checkpoint_object_id FROM twin_runtime_checkpoint_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6", values);
  const forecastLatest = await pool.query("SELECT forecast_object_id,forecast_status FROM twin_forecast_result_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6", values);
  const successfulLatest = await pool.query("SELECT forecast_object_id FROM twin_forecast_success_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6", values);

  assert.equal(active.rows.length, 1, "ACTIVE_LINEAGE_POINTER_CARDINALITY");
  assert.equal(stateLatest.rows.length, 1, "STATE_POINTER_CARDINALITY");
  assert.equal(checkpointLatest.rows.length, 1, "CHECKPOINT_POINTER_CARDINALITY");
  assert.equal(forecastLatest.rows.length, 1, "FORECAST_POINTER_CARDINALITY");
  assert.equal(successfulLatest.rows.length, 0, "SUCCESSFUL_FORECAST_POINTER_MUST_BE_ABSENT");

  const lineage = await readCanonicalObject(pool, active.rows[0].active_lineage_ref, "twin_runtime_lineage_v1");
  const state = await readCanonicalObject(pool, stateLatest.rows[0].state_object_id, "twin_state_estimate_v1");
  const checkpoint = await readCanonicalObject(pool, checkpointLatest.rows[0].checkpoint_object_id, "twin_runtime_checkpoint_v1");
  const forecast = await readCanonicalObject(pool, forecastLatest.rows[0].forecast_object_id, "twin_forecast_run_v1");
  const runtimeConfig = await readCanonicalObject(pool, state.runtime_config_ref, "twin_runtime_config_v1");

  for (const object of [state, checkpoint, forecast]) {
    assert.equal(object.lineage_id, lineage.lineage_id, `${object.object_type}:LINEAGE_ID_MISMATCH`);
    assert.equal(object.revision_id, lineage.revision_id, `${object.object_type}:REVISION_ID_MISMATCH`);
    assert.equal(object.logical_time, EXPECTED_LAST_LOGICAL_TIME, `${object.object_type}:FINAL_LOGICAL_TIME_MISMATCH`);
  }

  assert.equal(checkpoint.payload.tick_sequence, EXPECTED_CHECKPOINT_SEQUENCE, "CHECKPOINT_SEQUENCE_MISMATCH");
  assert.equal(checkpoint.payload.next_tick_logical_time, EXPECTED_NEXT_LOGICAL_TIME, "CHECKPOINT_NEXT_TIME_MISMATCH");
  assert.equal(checkpoint.payload.last_posterior_state_ref, state.object_id, "CHECKPOINT_STATE_REF_MISMATCH");
  assert.equal(checkpoint.payload.forecast_result_ref, forecast.object_id, "CHECKPOINT_FORECAST_REF_MISMATCH");
  assert.equal(state.runtime_config_ref, runtimeConfig.object_id, "STATE_RUNTIME_CONFIG_REF_MISMATCH");
  assert.equal(state.runtime_config_hash, runtimeConfig.determinism_hash, "STATE_RUNTIME_CONFIG_HASH_MISMATCH");
  assert.equal(forecastLatest.rows[0].forecast_status, "BLOCKED", "FORECAST_PROJECTION_STATUS_MISMATCH");
  assert.equal(forecast.payload.status, "BLOCKED", "FORECAST_STATUS_MISMATCH");
  assert.ok(Array.isArray(forecast.payload.points) && forecast.payload.points.length === 0, "FORECAST_POINTS_MUST_BE_EMPTY");
  assert.equal(forecast.payload.successful_forecast_ref ?? null, null, "FORECAST_SUCCESS_POINTER_MUST_BE_NULL");

  const realityBindingRef = runtimeConfig.payload.reality_binding_ref;
  const realityBindingHash = runtimeConfig.payload.reality_binding_hash;
  assert.equal(typeof realityBindingRef, "string", "RUNTIME_CONFIG_REALITY_BINDING_REF_REQUIRED");
  assert.equal(typeof realityBindingHash, "string", "RUNTIME_CONFIG_REALITY_BINDING_HASH_REQUIRED");
  const binding = await pool.query(
    "SELECT authority_ref,determinism_hash,semantic_payload FROM twin_runtime_authority_snapshot_v1 WHERE authority_kind='REALITY_BINDING' AND authority_ref=$1",
    [realityBindingRef],
  );
  assert.equal(binding.rows.length, 1, "REALITY_BINDING_SNAPSHOT_CARDINALITY");
  assert.equal(binding.rows[0].authority_ref, realityBindingRef, "REALITY_BINDING_REF_MISMATCH");
  assert.equal(binding.rows[0].determinism_hash, realityBindingHash, "REALITY_BINDING_HASH_MISMATCH");
  const bindingPayload = typeof binding.rows[0].semantic_payload === "string"
    ? JSON.parse(binding.rows[0].semantic_payload)
    : binding.rows[0].semantic_payload;
  assert.equal(bindingPayload.binding_id, realityBindingRef, "REALITY_BINDING_PAYLOAD_REF_MISMATCH");
  assert.equal(bindingPayload.determinism_hash, realityBindingHash, "REALITY_BINDING_PAYLOAD_HASH_MISMATCH");

  ok("PostgreSQL canonical lineage, posterior State, checkpoint, BLOCKED Forecast, State-bound Runtime Config, and Reality Binding are mutually consistent");

  return {
    schema_version: "geox_mcft_cap_04_predecessor_identity_evidence_v1",
    extraction_source: "ISOLATED_POSTGRESQL_CANONICAL_READ_PATH",
    baseline_main_commit: BASELINE_MAIN,
    scope: EXPECTED_SCOPE,
    active_lineage_ref: lineage.object_id,
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
    latest_successful_forecast_ref: null,
    predecessor_state_runtime_config_ref: runtimeConfig.object_id,
    predecessor_state_runtime_config_hash: runtimeConfig.determinism_hash,
    reality_binding_ref: realityBindingRef,
    reality_binding_hash: realityBindingHash,
    checkpoint_sequence: checkpoint.payload.tick_sequence,
    next_tick_logical_time: checkpoint.payload.next_tick_logical_time,
    validated_relations: [
      "active_lineage_ref_resolves_exactly_one_canonical_lineage",
      "lineage_id_consistent_across_lineage_state_checkpoint_forecast",
      "revision_id_consistent_across_lineage_state_checkpoint_forecast",
      "checkpoint_last_posterior_state_ref_equals_latest_posterior_state_ref",
      "checkpoint_forecast_result_ref_equals_latest_forecast_result_ref",
      "state_runtime_config_ref_hash_matches_exact_canonical_runtime_config",
      "runtime_config_reality_binding_ref_hash_matches_persisted_authority_snapshot",
      "latest_successful_forecast_ref_is_null",
      "checkpoint_sequence_equals_48",
      "next_tick_logical_time_equals_2026_06_03T02_00_00Z",
    ],
  };
}

function downstreamSlice([delivery_slice_id, primary_owner_work_package_id, depends_on_delivery_slice_ids]: readonly [string, string, readonly string[]]): any {
  return {
    delivery_slice_id,
    primary_owner_work_package_id,
    depends_on_delivery_slice_ids,
    baseline_main_commit: null,
    branch: null,
    status: "BLOCKED",
    activation_fields_status: "TO_BE_FROZEN_AT_SLICE_ACTIVATION",
    runtime_source_authorized: false,
    allowed_claims: [],
    preserved_nonclaims: [...PRESERVED_NONCLAIMS],
    exact_changed_file_boundary: [],
    effectiveness_condition: "PREDECESSOR_SLICE_MERGED_AND_MERGED_MAIN_GATE_PASS_AND_EXPLICIT_SLICE_ACTIVATION",
    effectiveness_condition_satisfied: false,
    ...(delivery_slice_id === "MCFT-CAP-04.FINALIZATION-MAIN-VERIFICATION-V1"
      ? { mandatory_lifecycle_stages: ["S10A_CANDIDATE", "S10B_MAIN_VERIFICATION", "S10C_POSTMERGE_EFFECTIVENESS_RECONCILIATION"] }
      : {}),
  };
}

function materializeGovernance(identity: any): void {
  fs.mkdirSync(absolute("acceptance-output"), { recursive: true });
  writeJson(EVIDENCE_PATH, identity);

  const p0Evidence = {
    pr_number: 2379,
    exact_head_commit: "ead23d9ebc37ad9dda83e8b6b9c8af651e177fd6",
    exact_head_ci_run: 29205852229,
    merge_commit: BASELINE_MAIN,
    postmerge_probe_pr_number: 2380,
    postmerge_workflow_run: P0_POSTMERGE_WORKFLOW_RUN,
    postmerge_gate: "PASS",
    effectiveness_condition_satisfied: true,
  };

  writeJson(LOCK_PATH, {
    schema_version: "geox_mcft_cap_04_predecessor_lock_v1",
    capability_line_id: "MCFT-CAP-04",
    predecessor_capability_line_id: "MCFT-CAP-03",
    status: "COMPLETE",
    baseline_main_commit: BASELINE_MAIN,
    p0_effectiveness: p0Evidence,
    predecessor_main_verification_ref: CAP03_MAIN_PATH,
    predecessor_r4_final_verification_ref: CAP03_R4_PATH,
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
      lineage_id: identity.lineage_id,
      revision_id: identity.revision_id,
      latest_posterior_state_ref: identity.latest_posterior_state_ref,
      latest_posterior_state_hash: identity.latest_posterior_state_hash,
      latest_checkpoint_ref: identity.latest_checkpoint_ref,
      latest_checkpoint_hash: identity.latest_checkpoint_hash,
      latest_forecast_result_ref: identity.latest_forecast_result_ref,
      latest_forecast_result_hash: identity.latest_forecast_result_hash,
      latest_successful_forecast_ref: null,
      predecessor_state_runtime_config_ref: identity.predecessor_state_runtime_config_ref,
      predecessor_state_runtime_config_hash: identity.predecessor_state_runtime_config_hash,
      reality_binding_ref: identity.reality_binding_ref,
      reality_binding_hash: identity.reality_binding_hash,
    },
    validated_relations: [...identity.validated_relations],
    lock_claims: [
      "MCFT_CAP_03_MERGED_MAIN_COMPLETE_VERIFIED",
      "MCFT_CAP_04_P0_MERGED_MAIN_EFFECTIVE",
      "MCFT_CAP_04_PREDECESSOR_CANONICAL_IDENTITY_EXTRACTED_FROM_POSTGRESQL",
      "MCFT_CAP_04_PREDECESSOR_LINEAGE_REVISION_STATE_CHECKPOINT_FORECAST_CONFIG_BINDING_LOCKED",
      "MCFT_CAP_04_PREDECESSOR_NEXT_LOGICAL_TICK_LOCKED",
    ],
    failure_policy: {
      canonical_value_mismatch: "FAIL_CLOSED",
      missing_projection_or_canonical_object: "FAIL_CLOSED",
      missing_reality_binding_snapshot: "FAIL_CLOSED",
      active_config_pointer_substitution: "FORBIDDEN",
      fixture_object_id_substitution: "FORBIDDEN",
      predecessor_fact_mutation: "FORBIDDEN",
      manual_alternate_start: "FORBIDDEN",
    },
    preserved_nonclaims: [...PRESERVED_NONCLAIMS],
    effectiveness_condition: "POSTGRESQL_IDENTITY_EXTRACTED_AND_S0_PR_MERGED_AND_MERGED_MAIN_AUTHORIZATION_GATE_PASS",
  });

  const s0Slice = {
    delivery_slice_id: S0,
    slice_kind: "GOVERNANCE_ONLY",
    primary_owner_work_package_id: "MCFT-09",
    contributing_owner_work_package_ids: ["MCFT-02", "MCFT-03", "MCFT-04", "MCFT-05", "MCFT-06", "MCFT-07", "MCFT-08", "MCFT-10"],
    depends_on_delivery_slice_ids: [P0],
    baseline_main_commit: BASELINE_MAIN,
    branch: BRANCH,
    status: "READY_FOR_MERGE",
    runtime_source_authorized: false,
    allowed_claims: [
      "MCFT_CAP_04_P0_EFFECTIVE_VERIFIED",
      "MCFT_CAP_03_PREDECESSOR_CANONICAL_IDENTITY_LOCKED",
      "MCFT_CAP_04_DELIVERY_GRAPH_FROZEN",
      "MCFT_CAP_04_OWNER_BOUNDARY_FROZEN",
      "MCFT_CAP_04_TASK_V0_5_AUTHORITY_PRESERVED",
    ],
    preserved_nonclaims: [...PRESERVED_NONCLAIMS],
    exact_changed_file_boundary: [...EXACT_CHANGED_FILES],
    effectiveness_condition: "S0_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_AUTHORIZATION_GATE_PASS",
    effectiveness_condition_satisfied: false,
  };

  const slices = [
    {
      delivery_slice_id: P0,
      slice_kind: "GOVERNANCE_ONLY",
      status: "MERGED_EFFECTIVE",
      baseline_main_commit: "eca0d053045db59982ad20a6e0421f72ae16f804",
      branch: "agent/mcft-cap-04-p0-ssot-v1",
      runtime_source_authorized: false,
      exact_changed_file_boundary: [
        MAP_PATH,
        MATRIX_PATH,
        P0_STATUS_PATH,
        TASK_PATH,
        "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_04_P0_PREDECESSOR_SSOT.cjs",
      ].sort(),
      effectiveness_condition: "P0_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_P0_GATE_PASS",
      effectiveness_condition_satisfied: true,
      ...p0Evidence,
    },
    s0Slice,
    ...DOWNSTREAM_SLICES.map((definition) => downstreamSlice(definition as readonly [string, string, readonly string[]])),
  ];

  writeJson(DELIVERY_PATH, {
    schema_version: "geox_mcft_cap_04_delivery_slice_status_v1",
    capability_line_id: "MCFT-CAP-04",
    display_alias: "MCFT-4",
    name: "72-Hour Forecast and Three Scenarios",
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
    successor_capability_line_id: "MCFT-CAP-05",
    successor_authorized: false,
  });

  writeJson(AUTHORIZATION_STATUS_PATH, {
    schema_version: "geox_mcft_cap_04_authorization_status_v1",
    authorization_id: "MCFT-CAP-04-AUTHORIZATION-V1",
    capability_line_id: "MCFT-CAP-04",
    display_alias: "MCFT-4",
    name: "72-Hour Forecast and Three Scenarios",
    runtime_mode: "REPLAY",
    target_completion_level: "Level A — Deterministic Replay Twin",
    status: "READY_FOR_MERGE",
    design_status: "FINAL_FROZEN_CANDIDATE_V0_5",
    implementation_status: "NOT_AUTHORIZED",
    authorization_effective: false,
    runtime_source_authorized: false,
    authorization_effectiveness_condition: "S0_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_AUTHORIZATION_GATE_PASS",
    baseline_main_commit: BASELINE_MAIN,
    branch: BRANCH,
    active_delivery_slice_id: S0,
    task_ref: TASK_PATH,
    authorization_document_ref: AUTHORIZATION_PATH,
    delivery_status_ref: DELIVERY_PATH,
    predecessor: {
      capability_line_id: "MCFT-CAP-03",
      status: "COMPLETE",
      closure_effective: true,
      main_verification_ref: CAP03_MAIN_PATH,
      r4_final_verification_ref: CAP03_R4_PATH,
      predecessor_lock_ref: LOCK_PATH,
      postgresql_canonical_lock_status: "COMPLETE",
      checkpoint_sequence: EXPECTED_CHECKPOINT_SEQUENCE,
      next_tick_logical_time: EXPECTED_NEXT_LOGICAL_TIME,
      latest_successful_forecast_ref: null,
    },
    p0_effectiveness: p0Evidence,
    current_blockers: ["MCFT_CAP_04_S0_PR_MERGED", "MCFT_CAP_04_S0_MERGED_MAIN_AUTHORIZATION_GATE_PASS"],
    premerge_satisfied_conditions: [
      "MCFT_CAP_04_P0_MERGED_MAIN_EFFECTIVE",
      "MCFT_CAP_03_COMPLETE_ON_CANONICAL_MAIN",
      "MCFT_CAP_04_TASK_V0_5_INTEGRITY_VERIFIED",
      "MCFT_CAP_04_PREDECESSOR_CANONICAL_IDENTITY_LOCK_COMPLETE",
      "MCFT_CAP_04_DELIVERY_GRAPH_FROZEN",
      "MCFT_CAP_04_OWNER_BOUNDARY_FROZEN",
      "MCFT_CAP_04_MATRIX_AND_IMPLEMENTATION_MAP_UPDATED",
      "MCFT_CAP_04_AUTHORIZATION_GATE_IMPLEMENTED",
      "MCFT_CAP_04_POSTGRESQL_PREFLIGHT_IMPLEMENTED",
    ],
    allowed_claims_after_merge_and_postmerge_gate: [
      "MCFT_CAP_04_AUTHORIZATION_V1_ESTABLISHED",
      "MCFT_CAP_04_DESIGN_FROZEN",
      "MCFT_CAP_04_READY_FOR_IMPLEMENTATION",
      "MCFT_CAP_04_DELIVERY_GRAPH_FROZEN",
      "MCFT_CAP_04_OWNER_BOUNDARY_FROZEN",
      "MCFT_CAP_04_PREDECESSOR_IDENTITY_LOCKED",
    ],
    preserved_nonclaims: [...PRESERVED_NONCLAIMS],
    repository_write_scope: "S0_GOVERNANCE_ONLY",
    exact_changed_file_boundary: [...EXACT_CHANGED_FILES],
    next_authorized_slice_id_after_effectiveness: S1,
    successor_capability_line_id: "MCFT-CAP-05",
    successor_authorized: false,
  });

  const authorization = `<!-- ${AUTHORIZATION_PATH} -->
# GEOX MCFT-CAP-04 Authorization and Predecessor Lock

## Authority

\`\`\`text
authorization_id:
MCFT-CAP-04-AUTHORIZATION-V1

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
P0 PR: #2379
P0 exact head: ead23d9ebc37ad9dda83e8b6b9c8af651e177fd6
P0 merge commit: ${BASELINE_MAIN}
P0 postmerge workflow: ${P0_POSTMERGE_WORKFLOW_RUN}
P0 postmerge Gate: PASS
\`\`\`

## PostgreSQL predecessor proof

The isolated PostgreSQL canonical read path established:

\`\`\`text
active_lineage_ref:
${identity.active_lineage_ref}

lineage_id:
${identity.lineage_id}

revision_id:
${identity.revision_id}

latest_posterior_state_ref:
${identity.latest_posterior_state_ref}

latest_checkpoint_ref:
${identity.latest_checkpoint_ref}

latest_forecast_result_ref:
${identity.latest_forecast_result_ref}

latest_successful_forecast_ref:
null

predecessor_state_runtime_config_ref:
${identity.predecessor_state_runtime_config_ref}

reality_binding_ref:
${identity.reality_binding_ref}

checkpoint_sequence:
${identity.checkpoint_sequence}

next_tick_logical_time:
${identity.next_tick_logical_time}
\`\`\`

All corresponding hashes and cross-reference relations are frozen in ${LOCK_PATH}. Replay Runtime Config authority is the exact State-bound Runtime Config ref/hash, not an active-config pointer.

## Delivery authority

Before S0 merge and merged-main Authorization Gate:

\`\`\`text
design_status: FINAL_FROZEN_CANDIDATE_V0_5
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

No Runtime source, migration, route, scheduler, web, Forecast write, Scenario write, Recommendation, Decision, or AO-ACT is included.

## Preserved nonclaims

\`\`\`text
${PRESERVED_NONCLAIMS.join("\n")}
\`\`\`
`;
  writeText(AUTHORIZATION_PATH, authorization);

  const alignment = `<!-- ${ALIGNMENT_PATH} -->
# GEOX MCFT-CAP-04 S0 Alignment Review

## Three-way alignment

\`\`\`text
task authority: PASS
P0 merged-main effectiveness: PASS
CAP-03 terminal authority: PASS
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
latest successful Forecast: null
active lineage ref: ${identity.active_lineage_ref}
semantic lineage id: ${identity.lineage_id}
revision id: ${identity.revision_id}
posterior State ref: ${identity.latest_posterior_state_ref}
checkpoint ref: ${identity.latest_checkpoint_ref}
Forecast result ref: ${identity.latest_forecast_result_ref}
State-bound Runtime Config ref: ${identity.predecessor_state_runtime_config_ref}
Reality Binding ref: ${identity.reality_binding_ref}
\`\`\`

## Current state

\`\`\`text
S0 status: READY_FOR_MERGE
authorization effective: false
design status: FINAL_FROZEN_CANDIDATE_V0_5
implementation status: NOT_AUTHORIZED
runtime source authorized: false
active delivery slice: ${S0}
next eligible after effectiveness: ${S1}
successor MCFT-CAP-05 authorized: false
\`\`\`

Only PR merge and the merged-main Authorization Gate remain. No Runtime capability claim is active.
`;
  writeText(ALIGNMENT_PATH, alignment);

  const matrix = readJson(MATRIX_PATH);
  const cap03 = matrix.capability_lines.find((line: any) => line.capability_line_id === "MCFT-CAP-03");
  const cap04 = matrix.capability_lines.find((line: any) => line.capability_line_id === "MCFT-CAP-04");
  assert.equal(cap03?.status, "COMPLETE", "CAP03_MATRIX_COMPLETE_REQUIRED");
  assert.equal(cap03?.implementation_status, "COMPLETE", "CAP03_MATRIX_IMPLEMENTATION_COMPLETE_REQUIRED");
  assert.equal(cap03?.active_delivery_slice_id, null, "CAP03_MATRIX_ACTIVE_SLICE_MUST_BE_NULL");
  assert.ok(cap04, "CAP04_MATRIX_ENTRY_REQUIRED");

  Object.assign(cap04, {
    status: "NOT_AUTHORIZED",
    design_status: "FINAL_FROZEN_CANDIDATE_V0_5",
    implementation_status: "NOT_AUTHORIZED",
    authorization_status: "READY_FOR_MERGE",
    authorization_effective: false,
    runtime_source_authorized: false,
    predecessor_capability_line_id: "MCFT-CAP-03",
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
    successor_capability_line_id: "MCFT-CAP-05",
    successor_authorized: false,
    effectiveness_condition: "S0_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_AUTHORIZATION_GATE_PASS",
  });
  matrix.latest_governance_update = S0;
  matrix.baseline = {
    branch: "main",
    commit: BASELINE_MAIN,
    meaning: "MCFT-CAP-04 P0 merged-main effective; S0 authorization and predecessor lock candidate only",
  };
  matrix.global_rules = [...new Set([
    ...(matrix.global_rules ?? []),
    "MCFT-CAP-04 predecessor identity is authoritative only from isolated PostgreSQL canonical readback",
    "MCFT-CAP-04 Replay Runtime Config authority is the predecessor State-bound ref and hash, not an active-config pointer",
    "MCFT-CAP-04 Runtime source remains forbidden until S0 merges and the merged-main Authorization Gate passes",
    "MCFT-CAP-04 S0 authorization does not authorize MCFT-CAP-05",
  ])];
  writeJson(MATRIX_PATH, matrix);

  const marker = "## MCFT-CAP-04 S0 authorization readiness";
  let implementationMap = readText(MAP_PATH).replace(/\r\n/g, "\n");
  if (implementationMap.includes(marker)) implementationMap = implementationMap.slice(0, implementationMap.indexOf(marker)).trimEnd();
  implementationMap += `

${marker}

\`\`\`text
capability: MCFT-CAP-04 — 72-Hour Forecast and Three Scenarios
P0 merge commit: ${BASELINE_MAIN}
P0 postmerge Gate: PASS
S0 authorization: READY_FOR_MERGE
authorization effective: false
design status: FINAL_FROZEN_CANDIDATE_V0_5
implementation status: NOT_AUTHORIZED
runtime source authorized: false
active delivery slice: ${S0}
predecessor checkpoint sequence: ${identity.checkpoint_sequence}
predecessor latest logical time: ${EXPECTED_LAST_LOGICAL_TIME}
canonical next logical tick: ${identity.next_tick_logical_time}
latest successful Forecast: null
predecessor lock: ${LOCK_PATH}
next eligible slice after merge and merged-main Gate: ${S1}
successor MCFT-CAP-05 authorized: false
\`\`\`

The S0 branch contains governance artifacts and isolated PostgreSQL predecessor proof only. Runtime implementation remains forbidden until S0 merges and its merged-main Authorization Gate passes.
`;
  writeText(MAP_PATH, implementationMap);
}

async function main(): Promise<void> {
  if (process.env.MCFT_CAP_04_PREFLIGHT_DESTRUCTIVE_ACCEPTANCE !== "1") fail("SET_MCFT_CAP_04_PREFLIGHT_DESTRUCTIVE_ACCEPTANCE_1");
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) fail("DATABASE_URL_REQUIRED");
  ok(`database name is explicitly isolated for acceptance: ${resolveDatabaseName(databaseUrl)}`);

  assertRepositoryBoundary();

  const task = readText(TASK_PATH);
  assert.equal(Buffer.byteLength(task, "utf8"), 77603, "TASK_BYTE_LENGTH_MISMATCH");
  assert.equal(crypto.createHash("sha256").update(task).digest("hex"), TASK_SHA256, "TASK_SHA256_MISMATCH");
  assert.ok(task.includes(S0) && task.includes(S1), "TASK_S0_S1_AUTHORITY_REQUIRED");
  ok("complete MCFT-CAP-04 v0.5 task authority is exact");

  const p0Status = readJson(P0_STATUS_PATH);
  const cap03Main = readJson(CAP03_MAIN_PATH);
  const cap03R4 = readJson(CAP03_R4_PATH);
  assert.equal(p0Status.baseline_main_commit, "eca0d053045db59982ad20a6e0421f72ae16f804", "P0_BASELINE_MISMATCH");
  assert.equal(cap03Main.status, "VERIFIED_ON_MAIN", "CAP03_MAIN_VERIFICATION_REQUIRED");
  assert.equal(cap03Main.capability_complete, true, "CAP03_COMPLETE_REQUIRED");
  assert.equal(cap03R4.status, "VERIFIED_ON_MAIN", "CAP03_R4_VERIFICATION_REQUIRED");
  assert.equal(cap03R4.effectiveness_condition_satisfied, true, "CAP03_R4_EFFECTIVENESS_REQUIRED");
  ok("P0 baseline and effective MCFT-CAP-03 terminal authority are exact");

  const dbOutput = run(process.platform === "win32" ? "pnpm.cmd" : "pnpm", [
    "-w",
    "exec",
    "tsx",
    "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_TWENTY_FOUR_OBSERVATION_AWARE_TICK_RANGE_DB.ts",
  ], {
    env: {
      DATABASE_URL: databaseUrl,
      MCFT_CAP_03_S5_DESTRUCTIVE_ACCEPTANCE: "1",
    },
  });
  process.stdout.write(dbOutput);
  assert.ok(dbOutput.includes("MCFT-CAP-03 twenty-four observation-aware tick range DB:"), "CAP03_24_TICK_DB_GATE_REQUIRED");
  assert.ok(dbOutput.includes("0 FAIL"), "CAP03_24_TICK_DB_GATE_MUST_PASS");
  ok("completed MCFT-CAP-03 terminal chain is reproduced in isolated PostgreSQL");

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const identity = await extractIdentity(pool);
    materializeGovernance(identity);
    ok("predecessor lock, authorization, delivery graph, matrix, implementation map, and alignment review are materialized");
  } finally {
    await pool.end();
  }

  run(process.platform === "win32" ? "git.exe" : "git", ["diff", "--check", BASELINE_MAIN]);
  ok("S0 working-tree diff check PASS");
  console.log(`MCFT-CAP-04 predecessor preflight: ${pass} PASS, 0 FAIL`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

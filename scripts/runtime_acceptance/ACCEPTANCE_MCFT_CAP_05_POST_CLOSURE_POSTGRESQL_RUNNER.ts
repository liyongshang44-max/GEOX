// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_POST_CLOSURE_POSTGRESQL_RUNNER.ts
// Purpose: prove the CAP-05 post-closure execution-view remediation through the formal PostgreSQL runner from predecessor checkpoint 72 to terminal checkpoint 80, canonical CAP-05 Config pin persistence, restart recovery, zero-write replay, and inherited CAP-04 A/B failure semantics.
// Boundary: destructive isolated-database acceptance only; creates and drops one dedicated acceptance database, writes no production database, changes no repository fixture, creates no active Config binding, performs no Model Activation or calibration, grants no CAP-06 Runtime/migration authority, and makes no merged-main effectiveness claim.

import assert from "node:assert/strict";
import cp from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import {
  validateCanonicalObjectV1,
  type CanonicalObjectEnvelopeV1,
} from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import { computeMemberDeterminismHashV1, semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import { validateCap04ForecastRunPayloadV1 } from "../../apps/server/src/domain/twin_runtime/forecast_scenario_contracts_v1.js";
import {
  CAP05_RUNTIME_CONFIG_PURPOSE_V1,
  validateCap05RuntimeConfigPayloadV1,
} from "../../apps/server/src/domain/twin_runtime/feedback_runtime_config_v1.js";
import {
  type Cap05ApprovalAssertionEvidenceV1,
  type Cap05ApprovedPlanEvidenceV1,
} from "../../apps/server/src/evidence/twin_runtime/approval_plan_evidence_contracts_v1.js";
import type { Cap05ExecutionReceiptEvidenceV1 } from "../../apps/server/src/evidence/twin_runtime/execution_receipt_evidence_contract_v1.js";
import { Cap05ApprovalPlanBindingServiceV1 } from "../../apps/server/src/runtime/twin_runtime/approval_plan_binding_service_v1.js";
import { Cap05ActionFeedbackNormalizationServiceV1 } from "../../apps/server/src/runtime/twin_runtime/action_feedback_normalization_service_v1.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ISOLATED_DATABASE = "mcft_cap05_post_closure_acceptance";
const START_LOGICAL_TIME = "2026-06-04T02:00:00.000Z";
const LAST_LOGICAL_TIME = "2026-06-04T09:00:00.000Z";
const NEXT_LOGICAL_TIME = "2026-06-04T10:00:00.000Z";
const EXPECTED_SCOPE = Object.freeze({
  tenant_id: "tenantA",
  project_id: "projectA",
  group_id: "groupA",
  field_id: "field_c8_demo",
  season_id: "season_2026_c8_corn",
  zone_id: "zone_mcft_c8_water_001",
});

let pass = 0;
function ok(message: string): void {
  pass += 1;
  process.stdout.write(`PASS ${message}\n`);
}

function run(
  executable: string,
  args: string[],
  env: NodeJS.ProcessEnv = {},
): string {
  const result = cp.spawnSync(executable, args, {
    cwd: ROOT,
    env: { ...process.env, ...env },
    encoding: "utf8",
    stdio: "pipe",
    shell: false,
    maxBuffer: 256 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `COMMAND_FAILED:${executable} ${args.join(" ")}\n${result.stdout ?? ""}\n${result.stderr ?? ""}`,
    );
  }
  if (result.stdout) process.stdout.write(String(result.stdout));
  if (result.stderr) process.stderr.write(String(result.stderr));
  return String(result.stdout ?? "");
}

function pnpmExecutable(): string {
  return process.platform === "win32" ? "pnpm.cmd" : "pnpm";
}

function databaseUrlFor(baseUrl: string, databaseName: string): string {
  const parsed = new URL(baseUrl);
  parsed.pathname = `/${databaseName}`;
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

async function recreateIsolatedDatabase(baseUrl: string): Promise<string> {
  const adminUrl = databaseUrlFor(baseUrl, "postgres");
  const admin = new Pool({ connectionString: adminUrl });
  try {
    await admin.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()",
      [ISOLATED_DATABASE],
    );
    await admin.query(`DROP DATABASE IF EXISTS ${ISOLATED_DATABASE}`);
    await admin.query(`CREATE DATABASE ${ISOLATED_DATABASE}`);
  } finally {
    await admin.end();
  }
  return databaseUrlFor(baseUrl, ISOLATED_DATABASE);
}

async function dropIsolatedDatabase(baseUrl: string): Promise<void> {
  const adminUrl = databaseUrlFor(baseUrl, "postgres");
  const admin = new Pool({ connectionString: adminUrl });
  try {
    await admin.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()",
      [ISOLATED_DATABASE],
    );
    await admin.query(`DROP DATABASE IF EXISTS ${ISOLATED_DATABASE}`);
  } finally {
    await admin.end();
  }
}

function walkFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(absolute));
    else files.push(absolute);
  }
  return files;
}

function buildHAuthoritativeReplayViewV1(): string {
  const source = path.join(ROOT, "fixtures/mcft/water_state/replay_v1");
  const target = path.join(os.tmpdir(), "mcft_cap05_h_authoritative_current_contract_replay_v1");
  fs.rmSync(target, { recursive: true, force: true });
  fs.cpSync(source, target, { recursive: true });

  let removedLegacyIrrigation = 0;
  let normalizedObservation = 0;
  for (const file of walkFiles(target).filter((candidate) => candidate.endsWith(".jsonl"))) {
    const records = fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line) as Record<string, any>);
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
          assert.equal(typeof record.quantity_kind, "string", "TEMP_REPLAY_QUANTITY_KIND_REQUIRED");
          record.canonical_payload.quantity_kind = record.quantity_kind;
          normalizedObservation += 1;
        }
        if (record.source_payload.source_version === undefined) {
          assert.equal(typeof record.source_version, "string", "TEMP_REPLAY_SOURCE_VERSION_REQUIRED");
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
  assert.ok(removedLegacyIrrigation >= 1, "LEGACY_IRRIGATION_EXCLUSION_NOT_PROVEN");
  assert.ok(normalizedObservation >= 1, "LEGACY_OBSERVATION_NORMALIZATION_NOT_PROVEN");

  const outcomeObservationPath = path.join(
    ROOT,
    "fixtures/mcft/water_state/feedback_v1/soil_observations.jsonl",
  );
  const outcomeRecords = fs.readFileSync(outcomeObservationPath, "utf8")
    .split(String.fromCharCode(10))
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, any>);
  assert.equal(outcomeRecords.length, 1, "CAP05_OUTCOME_OBSERVATION_CARDINALITY");
  const outcomeObservation = structuredClone(outcomeRecords[0]);
  assert.equal(outcomeObservation.record_type, "soil_moisture_observation_v1");
  assert.equal(outcomeObservation.role_time.observed_at, "2026-06-04T03:00:00.000Z");
  assert.equal(outcomeObservation.available_to_runtime_at, "2026-06-04T03:00:00.000Z");
  outcomeObservation.canonical_payload = {
    ...outcomeObservation.canonical_payload,
    quantity_kind: "VOLUMETRIC_WATER_CONTENT",
  };
  outcomeObservation.source_payload = {
    ...outcomeObservation.source_payload,
    source_version: String(outcomeObservation.source_version ?? "1"),
  };
  const outcomeSemantic = structuredClone(outcomeObservation);
  delete outcomeSemantic.source_record_hash;
  delete outcomeSemantic.materialized_file_location;
  outcomeObservation.source_record_hash = semanticHashV1(outcomeSemantic);
  const outcomeTarget = path.join(target, "soil_moisture", "2026-06-04.jsonl");
  fs.appendFileSync(outcomeTarget, `${JSON.stringify(outcomeObservation)}\n`, "utf8");
  return target;
}

function evidenceEnvelopeV1<T>(input: {
  source_record_id: string;
  source_record_hash: string;
  evidence: T;
}): T & { source_record_id: string; source_record_hash: string } {
  return {
    ...(input.evidence as Record<string, unknown>),
    source_record_id: input.source_record_id,
    source_record_hash: input.source_record_hash,
  } as T & { source_record_id: string; source_record_hash: string };
}

async function seedReplayEvidenceV1(
  pool: Pool,
  record: Record<string, unknown>,
): Promise<void> {
  const identity = String(record.evidence_identity_key ?? record.source_record_id);
  const digest = semanticHashV1(identity).replace(/^sha256:/, "").slice(0, 32);
  await pool.query(
    `INSERT INTO facts (fact_id,occurred_at,source,record_json)
     VALUES ($1,$2::timestamptz,'mcft_cap05_post_closure_replay_evidence_v1',$3::jsonb)
     ON CONFLICT (fact_id) DO NOTHING`,
    [
      `fact_mcft_cap05_post_closure_${digest}`,
      record.available_to_runtime_at,
      JSON.stringify({ type: record.record_type, payload: record }),
    ],
  );
}

async function establishStandardFeedbackPathV1(pool: Pool): Promise<void> {
  const feedbackRoot = path.join(ROOT, "fixtures/mcft/water_state/feedback_v1");
  const readSingleEvidenceV1 = <T>(filename: string): T => {
    const records = fs.readFileSync(path.join(feedbackRoot, filename), "utf8")
      .split(String.fromCharCode(10))
      .filter(Boolean)
      .map((line) => JSON.parse(line) as T);
    assert.equal(records.length, 1, `STANDARD_FEEDBACK_FIXTURE_CARDINALITY:${filename}`);
    return records[0];
  };

  const assertion = readSingleEvidenceV1<Cap05ApprovalAssertionEvidenceV1>("approval_assertions.jsonl");
  const plan = readSingleEvidenceV1<Cap05ApprovedPlanEvidenceV1>("approved_plans.jsonl");
  const dispatch = readSingleEvidenceV1<Record<string, unknown>>("external_dispatch.jsonl");
  const receipt = readSingleEvidenceV1<Cap05ExecutionReceiptEvidenceV1>("execution_receipts.jsonl");
  const planService = new Cap05ApprovalPlanBindingServiceV1(pool);
  const feedbackService = new Cap05ActionFeedbackNormalizationServiceV1(pool);

  await seedReplayEvidenceV1(pool, dispatch);
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
  assert.ok(
    ["INSERTED", "EXISTING_IDEMPOTENT_SUCCESS"].includes(planBinding.approved_plan_status),
    "APPROVED_PLAN_BINDING_REQUIRED",
  );

  await seedReplayEvidenceV1(pool, receipt as unknown as Record<string, unknown>);
  const feedback = await feedbackService.commitActionFeedback({
    scope: EXPECTED_SCOPE,
    receipt_evidence_ref: receipt.source_record_id,
    receipt_evidence_hash: receipt.source_record_hash,
  });
  assert.ok(
    ["INSERTED", "EXISTING_IDEMPOTENT_SUCCESS"].includes(feedback.persistence_status),
    "STANDARD_ACTION_FEEDBACK_REQUIRED",
  );
  assert.equal(feedback.action_feedback.payload.eligible_for_state_input, true);
  assert.equal(feedback.action_feedback.payload.source_quality, "PASS");
}

function parseRunnerOutputV1(output: string): any {
  const line = output.trim().split(/\r?\n/).reverse().find((candidate) => candidate.startsWith("{"));
  assert.ok(line, "FORMAL_RUNNER_JSON_RESULT_REQUIRED");
  const parsed = JSON.parse(line);
  assert.equal(parsed.ok, true, "FORMAL_RUNNER_MUST_SUCCEED");
  return parsed.result;
}

async function factObjectsV1(
  pool: Pool,
  objectType: string,
  start = START_LOGICAL_TIME,
  end = LAST_LOGICAL_TIME,
): Promise<CanonicalObjectEnvelopeV1[]> {
  const result = await pool.query(
    `SELECT record_json->'payload' AS object
       FROM facts
      WHERE record_json->>'type'=$1
        AND (record_json->'payload'->>'logical_time')::timestamptz BETWEEN $2::timestamptz AND $3::timestamptz
      ORDER BY (record_json->'payload'->>'logical_time')::timestamptz, record_json->'payload'->>'object_id'`,
    [objectType, start, end],
  );
  return result.rows.map((row) => row.object as CanonicalObjectEnvelopeV1);
}

async function readConfigV1(pool: Pool, objectId: string): Promise<CanonicalObjectEnvelopeV1> {
  const result = await pool.query(
    "SELECT record_json->'payload' AS object FROM facts WHERE record_json->>'type'='twin_runtime_config_v1' AND record_json->'payload'->>'object_id'=$1",
    [objectId],
  );
  assert.equal(result.rows.length, 1, `RUNTIME_CONFIG_CARDINALITY:${objectId}`);
  return result.rows[0].object as CanonicalObjectEnvelopeV1;
}

async function snapshotV1(pool: Pool): Promise<Record<string, unknown>> {
  const scalar = async (query: string): Promise<number> => Number((await pool.query(query)).rows[0].count);
  const values = Object.values(EXPECTED_SCOPE);
  const latest = async (table: string, column: string): Promise<string | null> => {
    const result = await pool.query(
      `SELECT ${column} AS value FROM ${table} WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
      values,
    );
    return result.rows.length === 1 ? String(result.rows[0].value) : null;
  };
  return {
    facts: await scalar("SELECT count(*)::int AS count FROM facts"),
    forecast_points: await scalar("SELECT count(*)::int AS count FROM twin_forecast_point_projection_v1"),
    scenario_points: await scalar("SELECT count(*)::int AS count FROM twin_scenario_point_projection_v1"),
    state_latest: await latest("twin_state_latest_index_v1", "state_object_id"),
    checkpoint_latest: await latest("twin_runtime_checkpoint_latest_index_v1", "checkpoint_object_id"),
    forecast_latest: await latest("twin_forecast_result_latest_index_v1", "forecast_object_id"),
    scenario_latest: await latest("twin_scenario_latest_index_v1", "scenario_set_id"),
  };
}

async function validateTerminalChainV1(pool: Pool): Promise<void> {
  const configs = await factObjectsV1(pool, "twin_runtime_config_v1");
  const states = await factObjectsV1(pool, "twin_state_estimate_v1");
  const checkpoints = await factObjectsV1(pool, "twin_runtime_checkpoint_v1");
  const forecasts = await factObjectsV1(pool, "twin_forecast_run_v1");
  const scenarios = await factObjectsV1(pool, "twin_scenario_set_v1");
  const residuals = await factObjectsV1(pool, "twin_forecast_residual_v1", START_LOGICAL_TIME, NEXT_LOGICAL_TIME);

  assert.equal(configs.length, 8, "CAP05_RUNTIME_CONFIG_COUNT_MISMATCH");
  assert.equal(states.length, 8, "CAP05_POSTERIOR_STATE_COUNT_MISMATCH");
  assert.equal(checkpoints.length, 8, "CAP05_CHECKPOINT_COUNT_MISMATCH");
  assert.equal(forecasts.length, 8, "CAP05_FORECAST_COUNT_MISMATCH");
  assert.equal(scenarios.length, 8, "CAP05_SCENARIO_COUNT_MISMATCH");
  assert.equal(residuals.length, 1, "CAP05_RESIDUAL_COUNT_MISMATCH");

  const configById = new Map<string, CanonicalObjectEnvelopeV1>();
  for (const config of configs) {
    validateCanonicalObjectV1(config);
    validateCap05RuntimeConfigPayloadV1(config.payload);
    assert.equal(config.payload.config_purpose, CAP05_RUNTIME_CONFIG_PURPOSE_V1);
    configById.set(config.object_id, config);
  }

  for (const object of [...states, ...checkpoints, ...forecasts]) {
    assert.equal(
      computeMemberDeterminismHashV1(object as unknown as Record<string, unknown>),
      object.determinism_hash,
      `${object.object_type}:SEMANTIC_HASH_MISMATCH`,
    );
    assert.equal(typeof object.runtime_config_ref, "string", `${object.object_type}:RUNTIME_CONFIG_REF_REQUIRED`);
    assert.equal(typeof object.runtime_config_hash, "string", `${object.object_type}:RUNTIME_CONFIG_HASH_REQUIRED`);
    const config = configById.get(String(object.runtime_config_ref)) ?? await readConfigV1(pool, String(object.runtime_config_ref));
    validateCanonicalObjectV1(config);
    validateCap05RuntimeConfigPayloadV1(config.payload);
    assert.equal(object.runtime_config_hash, config.determinism_hash, `${object.object_type}:RUNTIME_CONFIG_HASH_MISMATCH`);
    assert.equal(config.payload.config_purpose, CAP05_RUNTIME_CONFIG_PURPOSE_V1);
  }

  for (const forecast of forecasts) {
    validateCap04ForecastRunPayloadV1(forecast.payload as any);
    assert.equal(forecast.payload.status, "COMPLETED");
    assert.equal(forecast.payload.runtime_config_ref, forecast.runtime_config_ref);
    assert.equal(forecast.payload.runtime_config_hash, forecast.runtime_config_hash);
  }

  const finalCheckpoint = checkpoints[checkpoints.length - 1];
  assert.equal(finalCheckpoint.payload.tick_sequence, 80);
  assert.equal(finalCheckpoint.payload.next_tick_logical_time, NEXT_LOGICAL_TIME);
  const activeConfigTables = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name ILIKE '%active%config%'",
  );
  assert.equal(activeConfigTables.rows.length, 0, "ACTIVE_CONFIG_INDEX_MUST_NOT_EXIST");
}

async function main(): Promise<void> {
  const baseUrl = process.env.DATABASE_URL;
  if (!baseUrl) throw new Error("DATABASE_URL_REQUIRED");
  const targetUrl = await recreateIsolatedDatabase(baseUrl);
  const pnpm = pnpmExecutable();
  const targetPool = new Pool({ connectionString: targetUrl });
  const replayRoot = buildHAuthoritativeReplayViewV1();
  const runnerInputPath = path.join(os.tmpdir(), "MCFT_CAP_05_POST_CLOSURE_RUNNER_INPUT.json");

  try {
    const negative = run(pnpm, ["-w", "exec", "tsx", "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_SINGLE_TICK_INTEGRATION_NEGATIVE.ts"]);
    assert.match(negative, /0 FAIL/);
    assert.match(negative, /A1 failure leaves predecessor handoff unchanged and never starts B/);
    ok("failure before A commit leaves predecessor checkpoint unchanged");

    const cap04Db = run(
      pnpm,
      ["-w", "exec", "tsx", "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_SINGLE_TICK_INTEGRATION_DB.ts"],
      {
        DATABASE_URL: targetUrl,
        MCFT_CAP_04_SINGLE_TICK_DESTRUCTIVE_ACCEPTANCE: "1",
      },
    );
    assert.match(cap04Db, /pending B recovery consumes canonical Forecast authority with zero forcing reselection/);
    assert.match(cap04Db, /0 FAIL/);
    ok("failure between A and B preserves pending-Scenario recovery semantics");

    const predecessor = run(
      pnpm,
      ["-w", "exec", "tsx", "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_HUMAN_DECISION_G_DB.ts"],
      {
        DATABASE_URL: targetUrl,
        MCFT_CAP_05_S4_DESTRUCTIVE_ACCEPTANCE: "1",
      },
    );
    assert.match(predecessor, /0 FAIL/);
    await establishStandardFeedbackPathV1(targetPool);
    ok("checkpoint 72 plus canonical G, one approved Plan binding and one State-eligible H are reproduced");

    const expiredPredecessorLease = await targetPool.query(
      `UPDATE twin_runtime_lease_v1
          SET expires_at=transaction_timestamp()-interval '1 second'
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3
          AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
      [
        EXPECTED_SCOPE.tenant_id,
        EXPECTED_SCOPE.project_id,
        EXPECTED_SCOPE.group_id,
        EXPECTED_SCOPE.field_id,
        EXPECTED_SCOPE.season_id,
        EXPECTED_SCOPE.zone_id,
      ],
    );
    assert.equal(expiredPredecessorLease.rowCount, 1, "PREDECESSOR_LEASE_CARDINALITY");
    ok("expired predecessor lease permits fenced owner takeover without weakening mutual exclusion");

    fs.writeFileSync(
      runnerInputPath,
      `${JSON.stringify({
        database_url: targetUrl,
        replay_root: replayRoot,
        source_matrix_path: "docs/digital_twin/mcft/GEOX-MCFT-00-SOURCE-BINDING-MATRIX.json",
        scope: EXPECTED_SCOPE,
        authorized_future_forcing_binding_ids: ["weather_assumption_c8_replay_v1", "et0_future_assumption_c8_v1"],
        crop_stage_context: JSON.parse(fs.readFileSync(path.join(ROOT, "fixtures/mcft/water_state/replay_v1/configuration_context.json"), "utf8")),
        lease_owner: "mcft-cap05-post-closure-regression",
        lease_duration_seconds: 300,
      })}\n`,
      "utf8",
    );

    const firstProcess = cp.spawnSync(
      pnpm,
      ["-w", "exec", "tsx", "apps/server/scripts/mcft/MCFT_CAP_05_HUMAN_DECISION_FEEDBACK_RUNNER.ts", "--input", runnerInputPath],
      {
        cwd: ROOT,
        env: { ...process.env, DATABASE_URL: targetUrl },
        encoding: "utf8",
        stdio: "pipe",
        shell: false,
        maxBuffer: 256 * 1024 * 1024,
      },
    );
    const firstOutput = String(firstProcess.stdout ?? "");
    const firstError = String(firstProcess.stderr ?? "");
    if (firstOutput) process.stdout.write(firstOutput);
    if (firstError) process.stderr.write(firstError);
    if (firstProcess.status !== 0) {
      const blockedFacts = await targetPool.query(
        `SELECT record_json->>'type' AS object_type,
                record_json->'payload'->'payload' AS payload,
                record_json->'payload'->'evidence_refs' AS evidence_refs,
                record_json->'payload'->'limitations' AS limitations
           FROM facts
          WHERE record_json->>'type' IN (
                  'twin_evidence_window_v1',
                  'twin_state_transition_v1',
                  'twin_assimilation_update_v1',
                  'twin_state_estimate_v1',
                  'twin_forecast_run_v1',
                  'twin_runtime_tick_v1',
                  'twin_runtime_checkpoint_v1',
                  'twin_runtime_health_v1'
                )
            AND record_json->'payload'->>'logical_time'=$1
          ORDER BY record_json->>'type'`,
        [START_LOGICAL_TIME],
      );
      throw new Error(
        `FORMAL_CAP05_RUNNER_FAILED_WITH_CANONICAL_DIAGNOSTICS:${JSON.stringify(blockedFacts.rows)}
${firstOutput}
${firstError}`,
      );
    }
    const first = parseRunnerOutputV1(firstOutput);
    assert.equal(first.status, "COMPLETED");
    assert.equal(first.initial_completed_tick_count, 0);
    assert.equal(first.executed_tick_count_this_call, 8);
    assert.equal(first.established_tick_count, 8);
    assert.equal(first.runtime_config_count, 8);
    assert.equal(first.final_committed_sequence, 80);
    assert.equal(first.final_next_logical_tick_time, NEXT_LOGICAL_TIME);
    assert.equal(first.successful_forecast_run_count, 8);
    assert.equal(first.scenario_set_count, 8);
    assert.equal(first.residual_status, "INSERTED");
    ok("formal CAP-05 runner advances checkpoint 72 to 80 with eight completed ticks and one Residual");

    await validateTerminalChainV1(targetPool);
    ok("eight Configs, States, checkpoints, Forecasts and Scenarios retain canonical CAP-05 Config refs/hashes");

    const beforeReplay = await snapshotV1(targetPool);
    const secondOutput = run(
      pnpm,
      ["-w", "exec", "tsx", "apps/server/scripts/mcft/MCFT_CAP_05_HUMAN_DECISION_FEEDBACK_RUNNER.ts", "--input", runnerInputPath],
      { DATABASE_URL: targetUrl },
    );
    const second = parseRunnerOutputV1(secondOutput);
    assert.equal(second.status, "ALREADY_COMPLETE");
    assert.equal(second.initial_completed_tick_count, 8);
    assert.equal(second.executed_tick_count_this_call, 0);
    assert.equal(second.final_committed_sequence, 80);
    assert.equal(second.final_next_logical_tick_time, NEXT_LOGICAL_TIME);
    const afterReplay = await snapshotV1(targetPool);
    assert.deepEqual(afterReplay, beforeReplay);
    ok("second formal runner process recovers terminal state with zero canonical writes or projection divergence");

    assert.equal(pass, 7);
    process.stdout.write(`SUMMARY ${pass} PASS / 0 FAIL\n`);
  } finally {
    await targetPool.end();
    fs.rmSync(replayRoot, { recursive: true, force: true });
    fs.rmSync(runnerInputPath, { force: true });
    await dropIsolatedDatabase(baseUrl);
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});

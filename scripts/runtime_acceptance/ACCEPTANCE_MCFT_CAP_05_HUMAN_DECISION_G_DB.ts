// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_HUMAN_DECISION_G_DB.ts
// Purpose: prove the MCFT-CAP-05 internal Human Decision service resolves current canonical Scenario authority and commits exactly one immutable Decision through G in isolated PostgreSQL.
// Boundary: destructive isolated-database acceptance only; no public route, approval, Plan, Task, dispatch, State/checkpoint mutation, Recommendation, AO-ACT, calibration or model activation.

import assert from "node:assert/strict";
import cp from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import { buildCap05ScenarioOptionMemberRefV1 } from "../../apps/server/src/domain/twin_runtime/feedback_canonical_contracts_v1.js";
import { PostgresForecastScenarioRecoveryRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_forecast_scenario_recovery_repository_v1.js";
import { Cap05HumanDecisionServiceV1 } from "../../apps/server/src/runtime/twin_runtime/human_decision_service_v1.js";

if (process.env.MCFT_CAP_05_S4_DESTRUCTIVE_ACCEPTANCE !== "1") throw new Error("SET_MCFT_CAP_05_S4_DESTRUCTIVE_ACCEPTANCE_1");
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL_REQUIRED");
const databaseName = new URL(databaseUrl).pathname.replace(/^\//, "").toLowerCase();
if (!/(mcft|cap05|s4|acceptance|test)/.test(databaseName)) throw new Error("ISOLATED_ACCEPTANCE_DATABASE_REQUIRED");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const LOCK = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-PREDECESSOR-LOCK.json"), "utf8"));
const DECISION_FIXTURE_PATH = path.join(ROOT, "fixtures/mcft/water_state/feedback_v1/decision_requests.jsonl");
const pool = new Pool({ connectionString: databaseUrl });
const scenarioRepository = new PostgresForecastScenarioRecoveryRepositoryV1(pool);
const service = new Cap05HumanDecisionServiceV1(pool);
let pass = 0;

function ok(label: string): void {
  pass += 1;
  console.log(`PASS ${label}`);
}

function run(executable: string, args: string[], env: NodeJS.ProcessEnv): string {
  const result = cp.spawnSync(executable, args, {
    cwd: ROOT,
    env,
    encoding: "utf8",
    stdio: "pipe",
    maxBuffer: 256 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`COMMAND_FAILED:${executable} ${args.join(" ")}\n${result.stdout}\n${result.stderr}`);
  return String(result.stdout ?? "");
}

function readDecisionFixture(): any {
  return JSON.parse(fs.readFileSync(DECISION_FIXTURE_PATH, "utf8").trim());
}

async function insertEvidence(record: any): Promise<void> {
  await pool.query(
    `INSERT INTO facts (fact_id,occurred_at,source,record_json)
     VALUES ($1,$2::timestamptz,'mcft_cap05_replay_evidence_v1',$3::jsonb)`,
    [`fact_${record.source_record_id}`, record.available_to_runtime_at, JSON.stringify({ type: record.record_type, payload: record })],
  );
}

async function cloneEvidence(input: {
  suffix: string;
  mutate: (record: any, scenario: any) => void;
  scenario: any;
}): Promise<any> {
  const record = structuredClone(readDecisionFixture());
  record.source_record_id = `${record.source_record_id}_${input.suffix}`;
  record.source_record_hash = `sha256:acceptance-${input.suffix}`;
  record.evidence_identity_key = `${record.evidence_identity_key}_${input.suffix}`;
  record.idempotency_key = `sha256:acceptance-idempotency-${input.suffix}`;
  input.mutate(record, input.scenario);
  await insertEvidence(record);
  return record;
}

async function main(): Promise<void> {
  const cap04Output = run(process.platform === "win32" ? "pnpm.cmd" : "pnpm", [
    "-w", "exec", "tsx", "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_TWENTY_FOUR_TICK_RANGE_DB.ts",
  ], {
    ...process.env,
    DATABASE_URL: databaseUrl,
    MCFT_CAP_04_RANGE_DESTRUCTIVE_ACCEPTANCE: "1",
  });
  assert.ok(cap04Output.includes("0 FAIL"), "CAP04_PREDECESSOR_REPRODUCTION_REQUIRED");
  await pool.query(fs.readFileSync(path.join(ROOT, "apps/server/db/migrations/2026_07_14_mcft_cap_05_feedback_persistence.sql"), "utf8"));
  ok("completed CAP-04 predecessor and S3 persistence schema are reproduced");

  const fixture = readDecisionFixture();
  await insertEvidence(fixture);
  const scope = LOCK.expected_scope;
  const result = await service.commitHumanDecision({
    scope,
    decision_request_evidence_ref: fixture.source_record_id,
    decision_request_evidence_hash: fixture.source_record_hash,
    decided_at: "2026-06-04T01:10:00.000Z",
  });
  assert.equal(result.status, "INSERTED");
  assert.equal(result.object.object_type, "twin_decision_record_v1");
  assert.equal(result.object.payload.actor_class, "HUMAN");
  assert.equal(result.object.payload.actor_ref, fixture.canonical_payload.actor_ref);
  assert.equal(result.object.payload.scenario_set_ref, fixture.canonical_payload.scenario_set_ref);
  assert.equal(result.object.payload.selected_option_ref, fixture.canonical_payload.selected_option_ref);
  assert.equal(result.object.payload.selected_option_hash, fixture.canonical_payload.selected_option_hash);
  assert.equal(result.object.logical_time, "2026-06-04T01:00:00.000Z");
  assert.equal(result.object.as_of, "2026-06-04T01:10:00.000Z");
  ok("current canonical Scenario, exact option member identity and Human actor produce one G Decision");

  const retry = await service.commitHumanDecision({
    scope,
    decision_request_evidence_ref: fixture.source_record_id,
    decision_request_evidence_hash: fixture.source_record_hash,
    decided_at: "2026-06-04T01:10:00.000Z",
  });
  assert.equal(retry.status, "EXISTING_IDEMPOTENT_SUCCESS");
  assert.equal(retry.object.object_id, result.object.object_id);
  assert.equal(retry.object.determinism_hash, result.object.determinism_hash);
  ok("response-loss retry returns the exact existing canonical Decision");

  const counts = await pool.query(`
    SELECT
      (SELECT count(*)::int FROM facts WHERE record_json->>'type'='twin_decision_record_v1') AS decision_facts,
      (SELECT count(*)::int FROM twin_decision_record_projection_v1) AS decision_rows,
      (SELECT count(*)::int FROM facts WHERE record_json->>'type' IN ('approval_assertion_evidence_v1','approved_irrigation_plan_snapshot_v1','twin_action_feedback_v1')) AS downstream_facts
  `);
  assert.deepEqual(counts.rows[0], { decision_facts: 1, decision_rows: 1, downstream_facts: 0 });
  ok("G commit infers no Approval, Plan, Task, Action Feedback, State or checkpoint write");

  await assert.rejects(service.commitHumanDecision({
    scope,
    decision_request_evidence_ref: fixture.source_record_id,
    decision_request_evidence_hash: "sha256:forged-evidence-hash",
    decided_at: "2026-06-04T01:10:00.000Z",
  }), /CAP05_DECISION_REQUEST_EVIDENCE_IDENTITY_MISMATCH/);
  ok("forged Decision-request Evidence hash fails closed");

  const scenarioRecord = await scenarioRepository.readScenarioSet(fixture.canonical_payload.scenario_set_ref);
  assert.ok(scenarioRecord);
  const scenario = scenarioRecord.scenario_set;
  const forgedOption = await cloneEvidence({
    suffix: "forged_option",
    scenario,
    mutate(record) {
      record.canonical_payload.selected_option_hash = "sha256:forged-option-hash";
    },
  });
  await assert.rejects(service.commitHumanDecision({
    scope,
    decision_request_evidence_ref: forgedOption.source_record_id,
    decision_request_evidence_hash: forgedOption.source_record_hash,
    decided_at: "2026-06-04T01:11:00.000Z",
  }), /CAP05_DECISION_REQUEST_OPTION_IDENTITY_MISMATCH/);
  ok("forged selected-option hash fails closed against canonical Scenario readback");

  const staleScenario = await cloneEvidence({
    suffix: "stale_scenario",
    scenario,
    mutate(record) {
      record.canonical_payload.scenario_set_ref = "twin_scenario_set_stale";
      record.canonical_payload.scenario_set_hash = "sha256:stale-scenario";
    },
  });
  await assert.rejects(service.commitHumanDecision({
    scope,
    decision_request_evidence_ref: staleScenario.source_record_id,
    decision_request_evidence_hash: staleScenario.source_record_hash,
    decided_at: "2026-06-04T01:11:00.000Z",
  }), /CAP05_DECISION_REQUEST_NON_CURRENT_SCENARIO/);
  ok("non-current Scenario request fails closed");

  const lateEvidence = await cloneEvidence({
    suffix: "late",
    scenario,
    mutate(record) {
      record.available_to_runtime_at = "2026-06-04T01:12:00.000Z";
      record.role_time.available_to_runtime_at = record.available_to_runtime_at;
    },
  });
  await assert.rejects(service.commitHumanDecision({
    scope,
    decision_request_evidence_ref: lateEvidence.source_record_id,
    decision_request_evidence_hash: lateEvidence.source_record_hash,
    decided_at: "2026-06-04T01:11:00.000Z",
  }), /CAP05_DECISION_REQUEST_NOT_AVAILABLE_AT_DECISION_TIME/);
  ok("Decision Evidence unavailable at decided_at fails closed");

  const nonHuman = await cloneEvidence({
    suffix: "non_human",
    scenario,
    mutate(record) {
      record.canonical_payload.actor_class = "DEVICE";
    },
  });
  await assert.rejects(service.commitHumanDecision({
    scope,
    decision_request_evidence_ref: nonHuman.source_record_id,
    decision_request_evidence_hash: nonHuman.source_record_hash,
    decided_at: "2026-06-04T01:11:00.000Z",
  }), /CAP05_DECISION_REQUEST_HUMAN_ACTOR_REQUIRED/);
  ok("non-Human actor request fails closed");

  const noActionOption = scenario.payload.options.find((option: any) => option.option_id === "NO_ACTION");
  assert.ok(noActionOption);
  const conflicting = await cloneEvidence({
    suffix: "conflicting_second_decision",
    scenario,
    mutate(record) {
      record.canonical_payload.selected_option_id = "NO_ACTION";
      record.canonical_payload.selected_option_ref = buildCap05ScenarioOptionMemberRefV1(scenario.object_id, "NO_ACTION");
      record.canonical_payload.selected_option_hash = semanticHashV1(noActionOption);
    },
  });
  await assert.rejects(service.commitHumanDecision({
    scope,
    decision_request_evidence_ref: conflicting.source_record_id,
    decision_request_evidence_hash: conflicting.source_record_hash,
    decided_at: "2026-06-04T01:12:00.000Z",
  }), /CAP05_DECISION_IMMUTABLE_CONFLICT/);
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM facts WHERE record_json->>'type'='twin_decision_record_v1'")).rows[0].count, 1);
  ok("second Decision with different selected option conflicts and creates no second canonical fact");

  const wrongScope = structuredClone(scope);
  wrongScope.zone_id = "zone_wrong";
  await assert.rejects(service.commitHumanDecision({
    scope: wrongScope,
    decision_request_evidence_ref: fixture.source_record_id,
    decision_request_evidence_hash: fixture.source_record_hash,
    decided_at: "2026-06-04T01:10:00.000Z",
  }), /CAP05_DECISION_REQUEST_SCOPE_MISMATCH:zone_id/);
  ok("wrong Reality scope fails before Scenario resolution");

  console.log(`SUMMARY ${pass} PASS / 0 FAIL`);
}

main().finally(async () => pool.end());

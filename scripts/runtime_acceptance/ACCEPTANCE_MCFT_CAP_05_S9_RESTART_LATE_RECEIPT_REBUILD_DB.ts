// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_S9_RESTART_LATE_RECEIPT_REBUILD_DB.ts
// Purpose: prove G/H/C unknown-outcome retry, canonical-facts support rebuild, canonical divergence fail-closed, late receipt no-shift, cross-hour rejection and same-hour multi-event rejection for MCFT-CAP-05 S9.
// Boundary: destructive isolated-database acceptance only; no production database, public route, scheduler, automatic history rewrite, Recommendation, AO-ACT, calibration, model activation or CAP-06 authority.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import {
  buildCap05DecisionV1,
  type Cap05DecisionEnvelopeV1,
} from "../../apps/server/src/domain/twin_runtime/feedback_canonical_contracts_v1.js";
import type { Cap04ScenarioSetEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/forecast_scenario_contracts_v1.js";
import {
  PostgresFeedbackPersistenceRepositoryV1,
  type Cap05PersistedObjectV1,
} from "../../apps/server/src/persistence/twin_runtime/postgres_feedback_persistence_repository_v1.js";
import {
  Cap05RestartLateReceiptRebuildServiceV1,
  classifyCap05ReceiptCutoffV1,
  selectCap05SingleReceiptForTargetTickV1,
  type Cap05ReceiptRecoveryCandidateV1,
} from "../../apps/server/src/runtime/twin_runtime/restart_late_receipt_rebuild_service_v1.js";
import { buildCap05S8ForecastResidualFixtureV1 } from "./mcft_cap_05_s8_forecast_residual_fixture_v1.js";

if (process.env.MCFT_CAP_05_S9_DESTRUCTIVE_ACCEPTANCE !== "1") {
  throw new Error("SET_MCFT_CAP_05_S9_DESTRUCTIVE_ACCEPTANCE_1");
}
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL_REQUIRED");
const databaseName = new URL(databaseUrl).pathname.replace(/^\//, "").toLowerCase();
if (!/(mcft|cap05|s9|recovery|acceptance|test)/.test(databaseName)) {
  throw new Error("ISOLATED_ACCEPTANCE_DATABASE_REQUIRED");
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const pool = new Pool({ connectionString: databaseUrl });
const repository = new PostgresFeedbackPersistenceRepositoryV1(pool);
const recovery = new Cap05RestartLateReceiptRebuildServiceV1(pool);
let pass = 0;

function ok(label: string): void {
  pass += 1;
  console.log(`PASS ${label}`);
}

function readSqlV1(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

async function initializeSchemaV1(): Promise<void> {
  await pool.query(readSqlV1("docker/postgres/init/001_schema.sql"));
  await pool.query(readSqlV1("apps/server/db/migrations/2026_07_09_mcft_cap_01_a0_persistence.sql"));
  await pool.query(readSqlV1("apps/server/db/migrations/2026_07_10_mcft_cap_02_continuation_persistence.sql"));
  await pool.query(readSqlV1("apps/server/db/migrations/2026_07_13_mcft_cap_04_forecast_scenario_persistence.sql"));
  await pool.query(readSqlV1("apps/server/db/migrations/2026_07_14_mcft_cap_05_feedback_persistence.sql"));
}

async function countV1(fromClause: string, values: unknown[] = []): Promise<number> {
  const result = await pool.query(`SELECT count(*)::int AS count FROM ${fromClause}`, values);
  return result.rows[0].count as number;
}

async function commitThenLoseResponseV1(object: Cap05PersistedObjectV1): Promise<never> {
  await repository.commitCanonicalObject({ object });
  throw new Error(`SIMULATED_RESPONSE_LOSS:${object.object_type}`);
}

function receiptCandidateV1(overrides: Partial<Cap05ReceiptRecoveryCandidateV1> = {}): Cap05ReceiptRecoveryCandidateV1 {
  return {
    scope: {
      tenant_id: "tenant_s9",
      project_id: "project_s9",
      group_id: "group_s9",
      field_id: "field_s9",
      season_id: "season_s9",
      zone_id: "zone_s9",
    },
    receipt_ref: "receipt_s9_a",
    receipt_hash: "sha256:receipt-s9-a",
    event_id: "event_s9_a",
    execution_start: "2026-06-04T01:30:00.000Z",
    execution_end: "2026-06-04T01:50:00.000Z",
    available_to_runtime_at: "2026-06-04T01:55:00.000Z",
    ...overrides,
  };
}

async function main(): Promise<void> {
  await initializeSchemaV1();
  const fixture = await buildCap05S8ForecastResidualFixtureV1();
  const scenario = fixture.post_receipt_tick.b_record?.scenario_set as Cap04ScenarioSetEnvelopeV1 | undefined;
  if (!scenario) throw new Error("CAP05_S9_SCENARIO_SET_REQUIRED");
  const decisionTime = new Date(Date.parse(scenario.logical_time) + 5 * 60 * 1000).toISOString();
  const decision: Cap05DecisionEnvelopeV1 = buildCap05DecisionV1({
    scope: fixture.scope,
    scenario_set: scenario,
    selected_option_id: "IRRIGATE_NOW_15MM",
    decision_request_evidence_ref: "decision_request_cap05_s9",
    decision_request_evidence_hash: "sha256:decision-request-cap05-s9",
    actor_ref: "human:cap05-s9-operator",
    decided_at: decisionTime,
    context_lineage_ref: fixture.action_feedback.context_lineage_ref,
    context_revision_ref: fixture.action_feedback.context_revision_ref,
    created_at: decisionTime,
  });
  const residualResult = await fixture.service.executeOneTickAndCommitResidual(fixture.input);
  const objects: Cap05PersistedObjectV1[] = [decision, fixture.action_feedback, residualResult.residual];

  for (const object of objects) {
    await assert.rejects(commitThenLoseResponseV1(object), /SIMULATED_RESPONSE_LOSS/);
    const retry = await recovery.recoverUnknownCanonicalCommitOutcome(object);
    assert.equal(retry.status, "EXISTING_IDEMPOTENT_SUCCESS");
    assert.equal(retry.object.object_id, object.object_id);
    assert.equal(retry.object.determinism_hash, object.determinism_hash);
  }
  assert.equal(await countV1("facts WHERE record_json->>'type' IN ('twin_decision_record_v1','twin_action_feedback_v1','twin_forecast_residual_v1')"), 3);
  ok("G/H/C response-loss retry resolves from idempotency and canonical facts without duplicate writes");

  const directRebuild = await recovery.rebuildSupportStateFailClosed();
  assert.equal(directRebuild.canonical_fact_delta, 0);
  assert.equal(directRebuild.summary.canonical_objects_scanned, 3);
  assert.equal(directRebuild.summary.decision_projections_rebuilt, 1);
  assert.equal(directRebuild.summary.action_feedback_projections_rebuilt, 1);
  assert.equal(directRebuild.summary.forecast_residual_projections_rebuilt, 1);
  ok("complete CAP-05 support state rebuilds from canonical facts with zero canonical delta");

  await pool.query("DELETE FROM twin_action_feedback_cycle_projection_v1");
  await pool.query("DELETE FROM twin_action_feedback_evidence_index_v1");
  await pool.query("DELETE FROM twin_action_feedback_projection_v1");
  await pool.query("DELETE FROM twin_decision_record_projection_v1");
  await pool.query("DELETE FROM twin_forecast_residual_projection_v1");
  await pool.query("DELETE FROM twin_approved_plan_binding_projection_v1");
  await pool.query("DELETE FROM twin_object_idempotency_index_v1 WHERE identity_kind IN ('G_DECISION_RECORD','H_ACTION_FEEDBACK','C_FORECAST_RESIDUAL')");
  const missingStateRecovery = await recovery.rebuildSupportStateFailClosed();
  assert.equal(missingStateRecovery.canonical_fact_delta, 0);
  assert.equal(await countV1("twin_decision_record_projection_v1"), 1);
  assert.equal(await countV1("twin_action_feedback_projection_v1"), 1);
  assert.equal(await countV1("twin_forecast_residual_projection_v1"), 1);
  assert.equal(await countV1("twin_object_idempotency_index_v1 WHERE identity_kind IN ('G_DECISION_RECORD','H_ACTION_FEEDBACK','C_FORECAST_RESIDUAL')"), 3);
  ok("missing projections and guards rebuild deterministically without a second canonical store");

  await pool.query(
    "UPDATE twin_decision_record_projection_v1 SET determinism_hash='sha256:forged-cap05-s9' WHERE decision_object_id=$1",
    [decision.object_id],
  );
  await assert.rejects(
    recovery.rebuildSupportStateFailClosed(),
    /CAP05_S9_DECISION_PROJECTION_DIVERGENCE/,
  );
  assert.equal(await countV1("facts WHERE record_json->>'type' IN ('twin_decision_record_v1','twin_action_feedback_v1','twin_forecast_residual_v1')"), 3);
  ok("projection divergence fails closed before destructive rebuild and preserves canonical facts");

  await pool.query("DELETE FROM twin_decision_record_projection_v1 WHERE decision_object_id=$1", [decision.object_id]);
  const repaired = await recovery.rebuildSupportStateFailClosed();
  assert.equal(repaired.canonical_fact_delta, 0);
  assert.equal(await countV1("twin_decision_record_projection_v1 WHERE decision_object_id=$1", [decision.object_id]), 1);
  ok("explicit deletion of divergent support state permits canonical rebuild");

  const duplicate = receiptCandidateV1();
  const selected = selectCap05SingleReceiptForTargetTickV1({
    target_logical_time: "2026-06-04T02:00:00.000Z",
    candidates: [duplicate, structuredClone(duplicate)],
  });
  assert.equal(selected.identical_duplicate_count, 1);
  assert.equal(selected.selected.event_id, duplicate.event_id);
  ok("identical same-hour duplicate receipt candidates collapse deterministically");

  await assert.rejects(
    async () => selectCap05SingleReceiptForTargetTickV1({
      target_logical_time: "2026-06-04T02:00:00.000Z",
      candidates: [
        duplicate,
        receiptCandidateV1({ receipt_ref: "receipt_s9_b", receipt_hash: "sha256:receipt-s9-b", event_id: "event_s9_b" }),
      ],
    }),
    /CAP05_S9_MULTIPLE_DISTINCT_EXECUTION_EVENTS/,
  );
  ok("multiple distinct execution events in one exact scope/hour fail closed");

  await assert.rejects(
    async () => selectCap05SingleReceiptForTargetTickV1({
      target_logical_time: "2026-06-04T02:00:00.000Z",
      candidates: [duplicate, receiptCandidateV1({ receipt_hash: "sha256:conflicting-duplicate" })],
    }),
    /CAP05_S9_CONFLICTING_DUPLICATE_EXECUTION_EVENT/,
  );
  ok("same event identity with different receipt semantics fails closed");

  await assert.rejects(
    async () => selectCap05SingleReceiptForTargetTickV1({
      target_logical_time: "2026-06-04T03:00:00.000Z",
      candidates: [receiptCandidateV1({
        execution_start: "2026-06-04T01:50:00.000Z",
        execution_end: "2026-06-04T02:20:00.000Z",
      })],
    }),
    /CAP05_S9_CROSS_HOUR_EXECUTION_REQUIRES_INTERVAL_SPLIT/,
  );
  ok("cross-hour execution is rejected rather than silently split or shifted");

  const lateAfterCutoff = classifyCap05ReceiptCutoffV1({
    candidate: receiptCandidateV1({ available_to_runtime_at: "2026-06-04T02:05:00.000Z" }),
    target_logical_time: "2026-06-04T02:00:00.000Z",
    evidence_window_frozen: false,
    frozen_action_feedback_refs: [],
    action_feedback_ref: fixture.action_feedback.object_id,
    terminal_tick_committed: false,
  });
  assert.equal(lateAfterCutoff.eligible_for_state_input, false);
  assert.equal(lateAfterCutoff.reason_code, "REVISION_REQUIRED_LATE_AFTER_CUTOFF");
  assert.equal(lateAfterCutoff.logical_time_shifted, false);
  assert.equal(lateAfterCutoff.shifted_to_logical_time, null);
  ok("late-after-cutoff receipt remains canonical context but is never shifted to the next tick");

  const lateAfterCommit = classifyCap05ReceiptCutoffV1({
    candidate: receiptCandidateV1(),
    target_logical_time: "2026-06-04T02:00:00.000Z",
    evidence_window_frozen: true,
    frozen_action_feedback_refs: [fixture.action_feedback.object_id],
    action_feedback_ref: fixture.action_feedback.object_id,
    terminal_tick_committed: true,
  });
  assert.equal(lateAfterCommit.eligible_for_state_input, false);
  assert.equal(lateAfterCommit.reason_code, "REVISION_REQUIRED_LATE_AFTER_COMMIT");
  assert.equal(lateAfterCommit.automatic_history_rewrite, false);
  ok("late-after-commit receipt requires a separate revision and triggers no automatic history rewrite");

  const onTime = classifyCap05ReceiptCutoffV1({
    candidate: receiptCandidateV1(),
    target_logical_time: "2026-06-04T02:00:00.000Z",
    evidence_window_frozen: true,
    frozen_action_feedback_refs: [fixture.action_feedback.object_id],
    action_feedback_ref: fixture.action_feedback.object_id,
    terminal_tick_committed: false,
  });
  assert.equal(onTime.eligible_for_state_input, true);
  assert.equal(onTime.reason_code, null);
  assert.equal(onTime.logical_time_shifted, false);
  ok("on-time receipt is eligible only when present in the frozen Evidence Window");

  assert.equal(await countV1("twin_state_latest_index_v1"), 0);
  assert.equal(await countV1("twin_runtime_checkpoint_latest_index_v1"), 0);
  ok("S9 G/H/C recovery does not mutate State or checkpoint authority");

  assert.equal(pass, 13);
  console.log(`MCFT-CAP-05 S9 restart/late/rebuild PostgreSQL path: ${pass} PASS / 0 FAIL`);
}

main().finally(async () => pool.end());

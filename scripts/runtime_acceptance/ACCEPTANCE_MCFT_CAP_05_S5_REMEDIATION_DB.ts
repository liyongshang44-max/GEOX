// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_S5_REMEDIATION_DB.ts
// Purpose: prove S5 recovery revalidates immutable Evidence hashes, Approval Assertion semantics, canonical Decision linkage, fixed-point amounts, validity and supersession before rebuilding Plan projections.
// Boundary: destructive isolated-database acceptance only; no production fact mutation, approval exercise, dispatch creation, canonical Twin append, route, State/checkpoint, Forecast, Residual, Recommendation, AO-ACT, calibration or activation authority.

import assert from "node:assert/strict";
import cp from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import {
  computeCap05ReplayEvidenceSourceRecordHashV1,
  type Cap05ApprovalAssertionEvidenceV1,
  type Cap05ApprovedPlanEvidenceV1,
} from "../../apps/server/src/evidence/twin_runtime/approval_plan_evidence_contracts_v1.js";
import { PostgresFeedbackPersistenceRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_feedback_persistence_repository_v1.js";

if (process.env.MCFT_CAP_05_S5_REMEDIATION_DESTRUCTIVE_ACCEPTANCE !== "1") {
  throw new Error("SET_MCFT_CAP_05_S5_REMEDIATION_DESTRUCTIVE_ACCEPTANCE_1");
}
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL_REQUIRED");
const databaseName = new URL(databaseUrl).pathname.replace(/^\//, "").toLowerCase();
if (!/(mcft|cap05|s5|remediation|acceptance|test)/.test(databaseName)) throw new Error("ISOLATED_ACCEPTANCE_DATABASE_REQUIRED");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE_ROOT = path.join(ROOT, "fixtures/mcft/water_state/feedback_v1");
const pool = new Pool({ connectionString: databaseUrl });
const repository = new PostgresFeedbackPersistenceRepositoryV1(pool);
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

function readOne<T>(file: string): T {
  return JSON.parse(fs.readFileSync(path.join(FIXTURE_ROOT, file), "utf8").trim()) as T;
}

function evidenceFactIdV1(evidenceIdentityKey: string): string {
  const digest = crypto.createHash("sha256").update(evidenceIdentityKey, "utf8").digest("hex").slice(0, 32);
  return `fact_mcft05_remediation_${digest}`;
}

function rehashEvidenceV1<T extends Record<string, unknown>>(record: T): T {
  record.source_record_hash = computeCap05ReplayEvidenceSourceRecordHashV1(record);
  return record;
}

function cloneAssertionV1(suffix: string, source: Cap05ApprovalAssertionEvidenceV1): Cap05ApprovalAssertionEvidenceV1 {
  const record = structuredClone(source);
  record.source_record_id = `${source.source_record_id}_${suffix}`;
  record.evidence_identity_key = `${source.evidence_identity_key}_${suffix}`;
  record.idempotency_key = `sha256:remediation-assertion-${suffix}`;
  return record;
}

function clonePlanV1(suffix: string, source: Cap05ApprovedPlanEvidenceV1): Cap05ApprovedPlanEvidenceV1 {
  const record = structuredClone(source);
  record.source_record_id = `${source.source_record_id}_${suffix}`;
  record.evidence_identity_key = `${source.evidence_identity_key}_${suffix}`;
  record.idempotency_key = `sha256:remediation-plan-${suffix}`;
  record.binding_id = `${source.binding_id}_${suffix}`;
  record.available_to_runtime_at = "2026-06-04T01:30:00.000Z";
  record.role_time.created_at = "2026-06-04T01:27:00.000Z";
  record.role_time.approved_at = "2026-06-04T01:28:00.000Z";
  record.role_time.ingested_at = "2026-06-04T01:30:00.000Z";
  record.role_time.available_to_runtime_at = "2026-06-04T01:30:00.000Z";
  record.role_time.plan_effective_from = "2026-06-04T01:35:00.000Z";
  return record;
}

async function insertEvidenceV1(record: Record<string, unknown>): Promise<string> {
  const factId = evidenceFactIdV1(String(record.evidence_identity_key));
  await pool.query(
    `INSERT INTO facts (fact_id,occurred_at,source,record_json)
     VALUES ($1,$2::timestamptz,'mcft_cap05_replay_evidence_v1',$3::jsonb)`,
    [factId, record.available_to_runtime_at, JSON.stringify({ type: record.record_type, payload: record })],
  );
  return factId;
}

async function assertRecoveryRejectsV1(input: {
  records: Record<string, unknown>[];
  error: RegExp;
  label: string;
}): Promise<void> {
  const factIds: string[] = [];
  try {
    for (const record of input.records) factIds.push(await insertEvidenceV1(record));
    await assert.rejects(repository.rebuildAllSupportState(), input.error);
    const active = await pool.query(
      `SELECT count(*)::int AS count FROM twin_approved_plan_binding_projection_v1 WHERE active_for_decision=true`,
    );
    assert.equal(active.rows[0].count, 1, "failed recovery must roll back projection deletion and preserve prior active Plan");
    ok(input.label);
  } finally {
    if (factIds.length > 0) await pool.query("DELETE FROM facts WHERE fact_id = ANY($1::text[])", [factIds]);
  }
  const recovered = await repository.rebuildAllSupportState();
  assert.equal(recovered.approved_plan_bindings_rebuilt, 2);
}

async function main(): Promise<void> {
  const predecessor = run(process.platform === "win32" ? "pnpm.cmd" : "pnpm", [
    "-w", "exec", "tsx", "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_APPROVAL_PLAN_BINDING_DB.ts",
  ], {
    ...process.env,
    DATABASE_URL: databaseUrl,
    MCFT_CAP_05_S5_DESTRUCTIVE_ACCEPTANCE: "1",
  });
  assert.ok(predecessor.includes("0 FAIL"), "S5_PREDECESSOR_ACCEPTANCE_REQUIRED");
  ok("merged S5 forward path, idempotency, supersession and baseline rebuild remain green");

  const initialRecovery = await repository.rebuildAllSupportState();
  assert.equal(initialRecovery.approved_plan_bindings_rebuilt, 2);
  const normalized = await pool.query(
    `SELECT scenario_amount_mm,approved_amount_mm,active_for_decision
     FROM twin_approved_plan_binding_projection_v1
     ORDER BY active_for_decision,approved_plan_evidence_ref`,
  );
  assert.deepEqual(
    normalized.rows.map((row) => [row.scenario_amount_mm, row.approved_amount_mm]),
    [["15.000000", "14.000000"], ["15.000000", "13.000000"]],
  );
  ok("forward validation and recovery projection use the same scale-6 fixed-point authority");

  const baseAssertion = readOne<Cap05ApprovalAssertionEvidenceV1>("approval_assertions.jsonl");
  const basePlan = readOne<Cap05ApprovedPlanEvidenceV1>("approved_plans.jsonl");
  const activeResult = await pool.query(
    `SELECT approved_plan_evidence_ref,approved_plan_evidence_hash
     FROM twin_approved_plan_binding_projection_v1
     WHERE active_for_decision=true`,
  );
  assert.equal(activeResult.rows.length, 1);
  const activeRef = String(activeResult.rows[0].approved_plan_evidence_ref);
  const activeHash = String(activeResult.rows[0].approved_plan_evidence_hash);

  const badHashPlan = clonePlanV1("bad_source_hash", basePlan);
  badHashPlan.source_record_hash = "sha256:forged-source-record-hash";
  await assertRecoveryRejectsV1({
    records: [badHashPlan as unknown as Record<string, unknown>],
    error: /CAP05_REPLAY_EVIDENCE_SOURCE_RECORD_HASH_MISMATCH/,
    label: "recovery rejects a Plan fact whose stored source_record_hash does not match the frozen S1 record basis",
  });

  const wrongDecisionPlan = clonePlanV1("wrong_decision_link", basePlan);
  wrongDecisionPlan.canonical_payload.decision_request_hash = "sha256:wrong-decision-request";
  wrongDecisionPlan.source_payload.decision_request_hash = "sha256:wrong-decision-request";
  wrongDecisionPlan.canonical_payload.supersedes_plan_evidence_ref = activeRef;
  wrongDecisionPlan.source_payload.supersedes_plan_evidence_ref = activeRef;
  wrongDecisionPlan.canonical_payload.supersedes_plan_evidence_hash = activeHash;
  wrongDecisionPlan.source_payload.supersedes_plan_evidence_hash = activeHash;
  rehashEvidenceV1(wrongDecisionPlan as unknown as Record<string, unknown>);
  await assertRecoveryRejectsV1({
    records: [wrongDecisionPlan as unknown as Record<string, unknown>],
    error: /CAP05_PLAN_DECISION_BINDING_MISMATCH/,
    label: "recovery rejects a correctly hashed Plan fact with forged canonical Decision linkage",
  });

  const wrongAmountPlan = clonePlanV1("wrong_scenario_amount", basePlan);
  wrongAmountPlan.canonical_payload.scenario_amount_mm = "16.000000";
  wrongAmountPlan.source_payload.scenario_amount_mm = "16.000000";
  wrongAmountPlan.canonical_payload.amount_difference_mm = "-2.000000";
  wrongAmountPlan.source_payload.amount_difference_mm = "-2.000000";
  wrongAmountPlan.canonical_payload.supersedes_plan_evidence_ref = activeRef;
  wrongAmountPlan.source_payload.supersedes_plan_evidence_ref = activeRef;
  wrongAmountPlan.canonical_payload.supersedes_plan_evidence_hash = activeHash;
  wrongAmountPlan.source_payload.supersedes_plan_evidence_hash = activeHash;
  rehashEvidenceV1(wrongAmountPlan as unknown as Record<string, unknown>);
  await assertRecoveryRejectsV1({
    records: [wrongAmountPlan as unknown as Record<string, unknown>],
    error: /CAP05_PLAN_SCENARIO_AMOUNT_NOT_FROM_SELECTED_OPTION/,
    label: "recovery rejects a correctly hashed Plan fact whose scenario amount does not match the selected option",
  });

  const invalidWindowPlan = clonePlanV1("invalid_validity_window", basePlan);
  invalidWindowPlan.role_time.plan_effective_from = "2026-06-04T02:05:00.000Z";
  invalidWindowPlan.role_time.plan_effective_to = "2026-06-04T02:00:00.000Z";
  invalidWindowPlan.canonical_payload.supersedes_plan_evidence_ref = activeRef;
  invalidWindowPlan.source_payload.supersedes_plan_evidence_ref = activeRef;
  invalidWindowPlan.canonical_payload.supersedes_plan_evidence_hash = activeHash;
  invalidWindowPlan.source_payload.supersedes_plan_evidence_hash = activeHash;
  rehashEvidenceV1(invalidWindowPlan as unknown as Record<string, unknown>);
  await assertRecoveryRejectsV1({
    records: [invalidWindowPlan as unknown as Record<string, unknown>],
    error: /CAP05_PLAN_ROLE_TIME_ORDER_INVALID/,
    label: "recovery rejects a correctly hashed Plan fact with an invalid effective interval",
  });

  const invalidAssertion = cloneAssertionV1("non_human", baseAssertion);
  (invalidAssertion.canonical_payload as Record<string, unknown>).approver_class = "DEVICE";
  (invalidAssertion.source_payload as Record<string, unknown>).approver_class = "DEVICE";
  rehashEvidenceV1(invalidAssertion as unknown as Record<string, unknown>);
  const invalidAssertionPlan = clonePlanV1("non_human_assertion", basePlan);
  invalidAssertionPlan.canonical_payload.approval_assertion_ref = invalidAssertion.source_record_id;
  invalidAssertionPlan.source_payload.approval_assertion_ref = invalidAssertion.source_record_id;
  invalidAssertionPlan.canonical_payload.approval_assertion_hash = invalidAssertion.source_record_hash;
  invalidAssertionPlan.source_payload.approval_assertion_hash = invalidAssertion.source_record_hash;
  invalidAssertionPlan.canonical_payload.supersedes_plan_evidence_ref = activeRef;
  invalidAssertionPlan.source_payload.supersedes_plan_evidence_ref = activeRef;
  invalidAssertionPlan.canonical_payload.supersedes_plan_evidence_hash = activeHash;
  invalidAssertionPlan.source_payload.supersedes_plan_evidence_hash = activeHash;
  rehashEvidenceV1(invalidAssertionPlan as unknown as Record<string, unknown>);
  await assertRecoveryRejectsV1({
    records: [
      invalidAssertion as unknown as Record<string, unknown>,
      invalidAssertionPlan as unknown as Record<string, unknown>,
    ],
    error: /CAP05_APPROVER_HUMAN_REQUIRED/,
    label: "recovery revalidates Approval Assertion semantics instead of trusting Plan payload links",
  });

  const finalRecovery = await repository.rebuildAllSupportState();
  assert.equal(finalRecovery.approved_plan_bindings_rebuilt, 2);
  const finalActive = await pool.query(
    `SELECT approved_plan_evidence_ref,active_for_decision
     FROM twin_approved_plan_binding_projection_v1 ORDER BY approved_plan_evidence_ref`,
  );
  assert.equal(finalActive.rows.filter((row) => row.active_for_decision).length, 1);
  ok("valid historical Plan Evidence and explicit supersession rebuild to exactly one active Plan");

  console.log(`SUMMARY ${pass} PASS / 0 FAIL`);
}

main().finally(async () => pool.end());

// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_APPROVAL_PLAN_BINDING_DB.ts
// Purpose: prove Approval Assertion and Approved Plan Replay Evidence bind to the unique canonical G Decision, remain idempotent append-only facts, support explicit dispatch context and rebuild supersession state.
// Boundary: destructive isolated-database acceptance only; no public route, GEOX approval/dispatch exercise, Recommendation, Task, Action Feedback, State/checkpoint, Forecast, Residual, calibration or model activation.

import assert from "node:assert/strict";
import cp from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import type {
  Cap05ApprovalAssertionEvidenceV1,
  Cap05ApprovedPlanEvidenceV1,
} from "../../apps/server/src/evidence/twin_runtime/approval_plan_evidence_contracts_v1.js";
import { PostgresFeedbackPersistenceRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_feedback_persistence_repository_v1.js";
import { Cap05ApprovalPlanBindingServiceV1 } from "../../apps/server/src/runtime/twin_runtime/approval_plan_binding_service_v1.js";

if (process.env.MCFT_CAP_05_S5_DESTRUCTIVE_ACCEPTANCE !== "1") throw new Error("SET_MCFT_CAP_05_S5_DESTRUCTIVE_ACCEPTANCE_1");
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL_REQUIRED");
const databaseName = new URL(databaseUrl).pathname.replace(/^\//, "").toLowerCase();
if (!/(mcft|cap05|s5|approval|acceptance|test)/.test(databaseName)) throw new Error("ISOLATED_ACCEPTANCE_DATABASE_REQUIRED");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE_ROOT = path.join(ROOT, "fixtures/mcft/water_state/feedback_v1");
const pool = new Pool({ connectionString: databaseUrl });
const service = new Cap05ApprovalPlanBindingServiceV1(pool);
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

function evidenceFactId(evidenceIdentityKey: string): string {
  const digest = crypto.createHash("sha256").update(evidenceIdentityKey, "utf8").digest("hex").slice(0, 32);
  return `fact_mcft05_evidence_${digest}`;
}

async function seedReplayEvidence(record: any): Promise<void> {
  await pool.query(
    `INSERT INTO facts (fact_id,occurred_at,source,record_json)
     VALUES ($1,$2::timestamptz,'mcft_cap05_replay_evidence_v1',$3::jsonb)`,
    [evidenceFactId(record.evidence_identity_key), record.available_to_runtime_at, JSON.stringify({ type: record.record_type, payload: record })],
  );
}

function cloneAssertion(suffix: string, source: Cap05ApprovalAssertionEvidenceV1): Cap05ApprovalAssertionEvidenceV1 {
  const record = structuredClone(source);
  record.source_record_id = `${source.source_record_id}_${suffix}`;
  record.source_record_hash = `sha256:acceptance-assertion-${suffix}`;
  record.evidence_identity_key = `${source.evidence_identity_key}_${suffix}`;
  record.idempotency_key = `sha256:acceptance-assertion-idempotency-${suffix}`;
  return record;
}

function clonePlan(suffix: string, source: Cap05ApprovedPlanEvidenceV1): Cap05ApprovedPlanEvidenceV1 {
  const record = structuredClone(source);
  record.source_record_id = `${source.source_record_id}_${suffix}`;
  record.source_record_hash = `sha256:acceptance-plan-${suffix}`;
  record.evidence_identity_key = `${source.evidence_identity_key}_${suffix}`;
  record.idempotency_key = `sha256:acceptance-plan-idempotency-${suffix}`;
  record.binding_id = `${source.binding_id}_${suffix}`;
  return record;
}

async function countType(type: string): Promise<number> {
  const result = await pool.query("SELECT count(*)::int AS count FROM facts WHERE record_json->>'type'=$1", [type]);
  return result.rows[0].count;
}

async function main(): Promise<void> {
  const s4Output = run(process.platform === "win32" ? "pnpm.cmd" : "pnpm", [
    "-w", "exec", "tsx", "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_HUMAN_DECISION_G_DB.ts",
  ], {
    ...process.env,
    DATABASE_URL: databaseUrl,
    MCFT_CAP_05_S4_DESTRUCTIVE_ACCEPTANCE: "1",
  });
  assert.ok(s4Output.includes("0 FAIL"), "S4_PREDECESSOR_REPRODUCTION_REQUIRED");
  ok("S4 canonical Human Decision predecessor is reproduced");

  const assertion = readOne<Cap05ApprovalAssertionEvidenceV1>("approval_assertions.jsonl");
  const plan = readOne<Cap05ApprovedPlanEvidenceV1>("approved_plans.jsonl");
  const dispatch = readOne<any>("external_dispatch.jsonl");
  await seedReplayEvidence(dispatch);

  const standard = await service.commitApprovalPlanBinding({
    scope: {
      tenant_id: assertion.tenant_id,
      project_id: assertion.project_id,
      group_id: assertion.group_id,
      field_id: assertion.field_id,
      season_id: assertion.season_id,
      zone_id: assertion.zone_id,
    },
    approval_assertion: assertion,
    approved_plan: plan,
    dispatch: {
      disposition: "EXTERNALLY_RECORDED",
      evidence_ref: dispatch.source_record_id,
      evidence_hash: dispatch.source_record_hash,
    },
  });
  assert.equal(standard.approval_assertion_status, "INSERTED");
  assert.equal(standard.approved_plan_status, "INSERTED");
  assert.equal(standard.scenario_amount_mm, "15.000000");
  assert.equal(standard.approved_amount_mm, "14.000000");
  assert.equal(standard.amount_difference_mm, "-1.000000");
  assert.equal(standard.geox_approval_authority_exercised, false);
  assert.equal(standard.geox_dispatch_created, false);
  ok("Assertion and Plan bind to the unique G Decision with separate scenario and approved amounts");

  const replay = await service.commitApprovalPlanBinding({
    scope: {
      tenant_id: assertion.tenant_id,
      project_id: assertion.project_id,
      group_id: assertion.group_id,
      field_id: assertion.field_id,
      season_id: assertion.season_id,
      zone_id: assertion.zone_id,
    },
    approval_assertion: assertion,
    approved_plan: plan,
    dispatch: {
      disposition: "EXTERNALLY_RECORDED",
      evidence_ref: dispatch.source_record_id,
      evidence_hash: dispatch.source_record_hash,
    },
  });
  assert.equal(replay.approval_assertion_status, "EXISTING_IDEMPOTENT_SUCCESS");
  assert.equal(replay.approved_plan_status, "EXISTING_IDEMPOTENT_SUCCESS");
  assert.equal(await countType("approval_assertion_evidence_v1"), 1);
  assert.equal(await countType("approved_irrigation_plan_snapshot_v1"), 1);
  ok("same Approval and Plan Evidence replay returns existing success without duplicate facts");

  const activeStandard = await pool.query(
    `SELECT approved_plan_evidence_ref,scenario_amount_mm,approved_amount_mm,active_for_decision
     FROM twin_approved_plan_binding_projection_v1 WHERE active_for_decision=true`,
  );
  assert.deepEqual(activeStandard.rows, [{
    approved_plan_evidence_ref: plan.source_record_id,
    scenario_amount_mm: "15.000000",
    approved_amount_mm: "14.000000",
    active_for_decision: true,
  }]);
  ok("one active Plan projection preserves amount separation");

  const forgedAssertion = structuredClone(assertion);
  forgedAssertion.source_record_hash = "sha256:forged-assertion-hash";
  await assert.rejects(service.commitApprovalPlanBinding({
    scope: assertion,
    approval_assertion: forgedAssertion,
    approved_plan: plan,
    dispatch: { disposition: "NOT_OBSERVED", evidence_ref: null, evidence_hash: null },
  }), /CAP05_PLAN_ASSERTION_BINDING_MISMATCH/);
  ok("forged Assertion identity fails before persistence");

  const wrongScenarioAmount = clonePlan("wrong_scenario_amount", plan);
  wrongScenarioAmount.canonical_payload.scenario_amount_mm = 16;
  wrongScenarioAmount.source_payload.scenario_amount_mm = 16;
  wrongScenarioAmount.canonical_payload.amount_difference_mm = -2;
  wrongScenarioAmount.source_payload.amount_difference_mm = -2;
  await assert.rejects(service.commitApprovalPlanBinding({
    scope: assertion,
    approval_assertion: assertion,
    approved_plan: wrongScenarioAmount,
    dispatch: { disposition: "NOT_OBSERVED", evidence_ref: null, evidence_hash: null },
  }), /CAP05_PLAN_SCENARIO_AMOUNT_NOT_FROM_SELECTED_OPTION/);
  ok("Plan scenario amount not sourced from selected canonical option fails closed");

  const noReason = clonePlan("no_reason", plan);
  noReason.canonical_payload.amount_difference_reason_codes = [];
  noReason.source_payload.amount_difference_reason_codes = [];
  await assert.rejects(service.commitApprovalPlanBinding({
    scope: assertion,
    approval_assertion: assertion,
    approved_plan: noReason,
    dispatch: { disposition: "NOT_OBSERVED", evidence_ref: null, evidence_hash: null },
  }), /CAP05_PLAN_AMOUNT_DIFFERENCE_REASON_REQUIRED/);
  ok("nonzero amount difference without reason code fails closed");

  const wrongDispatch = structuredClone(dispatch);
  wrongDispatch.source_record_id = `${dispatch.source_record_id}_wrong_plan`;
  wrongDispatch.source_record_hash = "sha256:acceptance-dispatch-wrong-plan";
  wrongDispatch.evidence_identity_key = `${dispatch.evidence_identity_key}_wrong_plan`;
  wrongDispatch.idempotency_key = "sha256:acceptance-dispatch-idempotency-wrong-plan";
  wrongDispatch.canonical_payload.approved_plan_hash = "sha256:wrong-plan-hash";
  wrongDispatch.source_payload.approved_plan_hash = "sha256:wrong-plan-hash";
  await seedReplayEvidence(wrongDispatch);
  await assert.rejects(service.commitApprovalPlanBinding({
    scope: assertion,
    approval_assertion: assertion,
    approved_plan: plan,
    dispatch: { disposition: "EXTERNALLY_RECORDED", evidence_ref: wrongDispatch.source_record_id, evidence_hash: wrongDispatch.source_record_hash },
  }), /CAP05_DISPATCH_EVIDENCE_PLAN_BINDING_MISMATCH/);
  ok("external Dispatch Evidence with wrong Plan hash fails closed");

  const parallelPlan = clonePlan("parallel_without_supersession", plan);
  parallelPlan.canonical_payload.approved_amount_mm = 13;
  parallelPlan.source_payload.approved_amount_mm = 13;
  parallelPlan.canonical_payload.amount_difference_mm = -2;
  parallelPlan.source_payload.amount_difference_mm = -2;
  await assert.rejects(service.commitApprovalPlanBinding({
    scope: assertion,
    approval_assertion: assertion,
    approved_plan: parallelPlan,
    dispatch: { disposition: "NOT_OBSERVED", evidence_ref: null, evidence_hash: null },
  }), /CAP05_ACTIVE_PLAN_SUPERSESSION_REQUIRED/);
  assert.equal(await countType("approved_irrigation_plan_snapshot_v1"), 1);
  ok("second active Plan without explicit supersession rejects atomically");

  const supersedingPlan = clonePlan("superseding", plan);
  supersedingPlan.available_to_runtime_at = "2026-06-04T01:18:00.000Z";
  supersedingPlan.role_time.created_at = "2026-06-04T01:16:00.000Z";
  supersedingPlan.role_time.approved_at = "2026-06-04T01:17:00.000Z";
  supersedingPlan.role_time.ingested_at = "2026-06-04T01:18:00.000Z";
  supersedingPlan.role_time.available_to_runtime_at = "2026-06-04T01:18:00.000Z";
  supersedingPlan.role_time.plan_effective_from = "2026-06-04T01:25:00.000Z";
  supersedingPlan.canonical_payload.approved_amount_mm = 13;
  supersedingPlan.source_payload.approved_amount_mm = 13;
  supersedingPlan.canonical_payload.amount_difference_mm = -2;
  supersedingPlan.source_payload.amount_difference_mm = -2;
  supersedingPlan.canonical_payload.supersedes_plan_evidence_ref = plan.source_record_id;
  supersedingPlan.source_payload.supersedes_plan_evidence_ref = plan.source_record_id;
  supersedingPlan.canonical_payload.supersedes_plan_evidence_hash = plan.source_record_hash;
  supersedingPlan.source_payload.supersedes_plan_evidence_hash = plan.source_record_hash;

  const superseded = await service.commitApprovalPlanBinding({
    scope: assertion,
    approval_assertion: assertion,
    approved_plan: supersedingPlan,
    dispatch: { disposition: "NOT_OBSERVED", evidence_ref: null, evidence_hash: null },
  });
  assert.equal(superseded.approved_plan_status, "INSERTED");
  const planRows = await pool.query(
    `SELECT approved_plan_evidence_ref,active_for_decision FROM twin_approved_plan_binding_projection_v1 ORDER BY approved_plan_evidence_ref`,
  );
  assert.deepEqual(planRows.rows, [
    { approved_plan_evidence_ref: plan.source_record_id, active_for_decision: false },
    { approved_plan_evidence_ref: supersedingPlan.source_record_id, active_for_decision: true },
  ].sort((a, b) => a.approved_plan_evidence_ref.localeCompare(b.approved_plan_evidence_ref)));
  ok("explicit supersession preserves old Evidence and switches only the active projection");

  const historicalReplay = await service.commitApprovalPlanBinding({
    scope: assertion,
    approval_assertion: assertion,
    approved_plan: plan,
    dispatch: {
      disposition: "EXTERNALLY_RECORDED",
      evidence_ref: dispatch.source_record_id,
      evidence_hash: dispatch.source_record_hash,
    },
  });
  assert.equal(historicalReplay.approved_plan_status, "EXISTING_IDEMPOTENT_SUCCESS");
  assert.equal((await pool.query(
    `SELECT count(*)::int AS count FROM twin_approved_plan_binding_projection_v1
     WHERE approved_plan_evidence_ref=$1 AND active_for_decision=false`,
    [plan.source_record_id],
  )).rows[0].count, 1);
  ok("replay of superseded historical Plan remains idempotent and does not reactivate it");

  await pool.query("DELETE FROM twin_approved_plan_binding_projection_v1");
  const recovery = await new PostgresFeedbackPersistenceRepositoryV1(pool).rebuildAllSupportState();
  assert.equal(recovery.approved_plan_bindings_rebuilt, 2);
  const rebuilt = await pool.query(
    `SELECT approved_plan_evidence_ref,active_for_decision FROM twin_approved_plan_binding_projection_v1 ORDER BY approved_plan_evidence_ref`,
  );
  assert.deepEqual(rebuilt.rows, planRows.rows);
  ok("facts-based rebuild reapplies supersession and restores the exact active Plan state");

  assert.equal(await countType("twin_decision_record_v1"), 1);
  assert.equal(await countType("approval_assertion_evidence_v1"), 1);
  assert.equal(await countType("approved_irrigation_plan_snapshot_v1"), 2);
  assert.equal(await countType("twin_action_feedback_v1"), 0);
  ok("S5 adds Replay Evidence only and creates no new canonical Twin object or downstream feedback");

  console.log(`SUMMARY ${pass} PASS / 0 FAIL`);
}

main().finally(async () => pool.end());

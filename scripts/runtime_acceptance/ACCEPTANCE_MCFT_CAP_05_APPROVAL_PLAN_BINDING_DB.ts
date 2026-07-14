// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_APPROVAL_PLAN_BINDING_DB.ts
// Purpose: prove MCFT-CAP-05 Decision → Approval Assertion → Approved Plan binding, amount separation, validity, explicit dispatch disposition, supersession and projection rebuild in isolated PostgreSQL.
// Boundary: destructive isolated-database acceptance only; no production database, Evidence creation authority, approval exercise, canonical Twin append, Action Feedback, State mutation, route, Recommendation, AO-ACT, calibration or model activation.

import assert from "node:assert/strict";
import cp from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { Cap05ApprovedPlanBindingServiceV1 } from "../../apps/server/src/runtime/twin_runtime/approved_plan_binding_service_v1.js";

if (process.env.MCFT_CAP_05_S5_DESTRUCTIVE_ACCEPTANCE !== "1") throw new Error("SET_MCFT_CAP_05_S5_DESTRUCTIVE_ACCEPTANCE_1");
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL_REQUIRED");
const databaseName = new URL(databaseUrl).pathname.replace(/^\//, "").toLowerCase();
if (!/(mcft|cap05|s5|acceptance|test)/.test(databaseName)) throw new Error("ISOLATED_ACCEPTANCE_DATABASE_REQUIRED");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE_ROOT = path.join(ROOT, "fixtures/mcft/water_state/feedback_v1");
const pool = new Pool({ connectionString: databaseUrl });
const service = new Cap05ApprovedPlanBindingServiceV1(pool);
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

function readOne(name: string): any {
  return JSON.parse(fs.readFileSync(path.join(FIXTURE_ROOT, name), "utf8").trim());
}

async function insertEvidence(record: any): Promise<string> {
  const factId = `fact_${record.source_record_id}`;
  await pool.query(
    `INSERT INTO facts (fact_id,occurred_at,source,record_json)
     VALUES ($1,$2::timestamptz,'mcft_cap05_replay_evidence_v1',$3::jsonb)`,
    [factId, record.available_to_runtime_at, JSON.stringify({ type: record.record_type, payload: record })],
  );
  return factId;
}

function cloneEvidence<T>(source: T, suffix: string, mutation: (record: any) => void): T {
  const record: any = structuredClone(source);
  record.source_record_id = `${record.source_record_id}_${suffix}`;
  record.source_record_hash = `sha256:acceptance-${suffix}`;
  record.evidence_identity_key = `${record.evidence_identity_key}_${suffix}`;
  record.idempotency_key = `sha256:acceptance-idempotency-${suffix}`;
  mutation(record);
  return record;
}

async function decisionIdentity(): Promise<{ ref: string; hash: string }> {
  const result = await pool.query(
    `SELECT record_json->'payload'->>'object_id' AS ref,
            record_json->'payload'->>'determinism_hash' AS hash
     FROM facts WHERE record_json->>'type'='twin_decision_record_v1'`,
  );
  assert.equal(result.rows.length, 1);
  return result.rows[0];
}

async function bindingInput(decision: { ref: string; hash: string }, assertion: any, plan: any, asOf = plan.available_to_runtime_at) {
  return {
    decision_ref: decision.ref,
    decision_hash: decision.hash,
    approval_assertion_ref: assertion.source_record_id,
    approval_assertion_hash: assertion.source_record_hash,
    approved_plan_ref: plan.source_record_id,
    approved_plan_hash: plan.source_record_hash,
    as_of: asOf,
  };
}

async function canonicalTwinCount(): Promise<number> {
  const result = await pool.query(
    `SELECT count(*)::int AS count FROM facts
     WHERE record_json->>'type' IN ('twin_decision_record_v1','twin_action_feedback_v1','twin_forecast_residual_v1')`,
  );
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

  const assertion = readOne("approval_assertions.jsonl");
  const plan = readOne("approved_plans.jsonl");
  await insertEvidence(assertion);
  await insertEvidence(plan);
  const decision = await decisionIdentity();
  const canonicalBefore = await canonicalTwinCount();

  const first = await service.bindApprovedPlan(await bindingInput(decision, assertion, plan));
  assert.equal(first.status, "INSERTED");
  assert.equal(first.binding.decision_ref, decision.ref);
  assert.equal(first.binding.approval_assertion_ref, assertion.source_record_id);
  assert.equal(first.binding.approved_plan_ref, plan.source_record_id);
  assert.equal(first.binding.scenario_amount_mm, "15.000000");
  assert.equal(first.binding.approved_amount_mm, "14.000000");
  assert.equal(first.binding.amount_difference_mm, "-1.000000");
  assert.deepEqual(first.binding.amount_difference_reason_codes, ["WATER_AVAILABILITY_LIMIT"]);
  assert.equal(first.binding.dispatch_disposition, "NOT_OBSERVED");
  assert.equal(first.binding.supersession.status, "NO_PREDECESSOR");
  assert.equal(first.binding.geox_approval_authority_exercised, false);
  assert.equal(first.binding.projection_is_canonical_history, false);
  assert.equal(await canonicalTwinCount(), canonicalBefore);
  ok("separate Assertion and Plan Evidence bind to canonical Decision without canonical fact append");

  const retry = await service.bindApprovedPlan(await bindingInput(decision, assertion, plan));
  assert.equal(retry.status, "EXISTING_IDEMPOTENT_SUCCESS");
  assert.equal(retry.binding.determinism_hash, first.binding.determinism_hash);
  ok("same Plan identity and hash returns the existing binding projection");

  const projection = await pool.query(
    `SELECT scenario_amount_mm,approved_amount_mm,active_for_decision,canonical_evidence
     FROM twin_approved_plan_binding_projection_v1 WHERE approved_plan_evidence_ref=$1`,
    [plan.source_record_id],
  );
  assert.equal(projection.rows.length, 1);
  assert.equal(projection.rows[0].scenario_amount_mm, "15.000000");
  assert.equal(projection.rows[0].approved_amount_mm, "14.000000");
  assert.equal(projection.rows[0].active_for_decision, true);
  assert.equal(projection.rows[0].canonical_evidence.validated_binding.decision_ref, decision.ref);
  assert.equal(projection.rows[0].canonical_evidence.validated_binding.dispatch_disposition, "NOT_OBSERVED");
  ok("projection preserves Decision trace, amount separation, validity and explicit dispatch disposition");

  const negativeFactIds: string[] = [];
  const missingAssertionPlan = cloneEvidence(plan, "missing_assertion", (record) => {
    record.canonical_payload.approval_assertion_ref = "missing_assertion_ref";
    record.canonical_payload.approval_assertion_hash = "sha256:missing-assertion";
  });
  negativeFactIds.push(await insertEvidence(missingAssertionPlan));
  await assert.rejects(
    service.bindApprovedPlan(await bindingInput(decision, { ...assertion, source_record_id: "missing_assertion_ref", source_record_hash: "sha256:missing-assertion" }, missingAssertionPlan)),
    /CAP05_PLAN_BINDING_EVIDENCE_CARDINALITY/,
  );
  ok("missing Approval Assertion fails closed");

  const assertionMismatchPlan = cloneEvidence(plan, "assertion_mismatch", (record) => {
    record.canonical_payload.approval_assertion_hash = "sha256:forged-assertion";
  });
  negativeFactIds.push(await insertEvidence(assertionMismatchPlan));
  await assert.rejects(
    service.bindApprovedPlan(await bindingInput(decision, assertion, assertionMismatchPlan)),
    /CAP05_PLAN_ASSERTION_HASH_MISMATCH/,
  );
  ok("Plan → Assertion hash mismatch fails closed");

  const inactiveAssertion = cloneEvidence(assertion, "inactive_assertion", (record) => {
    record.canonical_payload.approval_status = "REJECTED";
  });
  const inactiveAssertionPlan = cloneEvidence(plan, "inactive_assertion_plan", (record) => {
    record.canonical_payload.approval_assertion_ref = inactiveAssertion.source_record_id;
    record.canonical_payload.approval_assertion_hash = inactiveAssertion.source_record_hash;
  });
  negativeFactIds.push(await insertEvidence(inactiveAssertion), await insertEvidence(inactiveAssertionPlan));
  await assert.rejects(
    service.bindApprovedPlan(await bindingInput(decision, inactiveAssertion, inactiveAssertionPlan)),
    /CAP05_APPROVAL_ASSERTION_NOT_ACTIVE_APPROVED/,
  );
  ok("non-approved Assertion fails closed");

  const wrongScopePlan = cloneEvidence(plan, "wrong_scope", (record) => {
    record.zone_id = "zone_wrong";
    record.canonical_payload.target_scope.zone_id = "zone_wrong";
  });
  negativeFactIds.push(await insertEvidence(wrongScopePlan));
  await assert.rejects(
    service.bindApprovedPlan(await bindingInput(decision, assertion, wrongScopePlan)),
    /CAP05_APPROVED_PLAN_SCOPE_MISMATCH:zone_id/,
  );
  ok("wrong Plan Reality scope fails closed");

  const amountMismatchPlan = cloneEvidence(plan, "amount_mismatch", (record) => {
    record.canonical_payload.amount_difference_mm = -2;
  });
  negativeFactIds.push(await insertEvidence(amountMismatchPlan));
  await assert.rejects(
    service.bindApprovedPlan(await bindingInput(decision, assertion, amountMismatchPlan)),
    /CAP05_PLAN_AMOUNT_DIFFERENCE_MISMATCH/,
  );
  ok("approved-versus-Scenario amount difference must be exact");

  const invalidValidityPlan = cloneEvidence(plan, "invalid_validity", (record) => {
    record.role_time.plan_effective_to = record.role_time.plan_effective_from;
  });
  negativeFactIds.push(await insertEvidence(invalidValidityPlan));
  await assert.rejects(
    service.bindApprovedPlan(await bindingInput(decision, assertion, invalidValidityPlan)),
    /CAP05_PLAN_VALIDITY_WINDOW_INVALID/,
  );
  ok("invalid Plan validity window fails closed");

  const inactivePlan = cloneEvidence(plan, "inactive_plan", (record) => {
    record.canonical_payload.active_for_decision = false;
  });
  negativeFactIds.push(await insertEvidence(inactivePlan));
  await assert.rejects(
    service.bindApprovedPlan(await bindingInput(decision, assertion, inactivePlan)),
    /CAP05_APPROVED_PLAN_NOT_ACTIVE_APPROVED/,
  );
  ok("inactive Plan Snapshot fails closed");

  const supersedingPlan = cloneEvidence(plan, "superseding", (record) => {
    record.binding_id = "mcft_cap05_approved_plan_superseding_v1";
    record.available_to_runtime_at = "2026-06-04T01:15:00.000Z";
    record.role_time.created_at = "2026-06-04T01:13:00.000Z";
    record.role_time.approved_at = "2026-06-04T01:14:00.000Z";
    record.role_time.available_to_runtime_at = record.available_to_runtime_at;
    record.role_time.ingested_at = record.available_to_runtime_at;
    record.role_time.plan_effective_from = "2026-06-04T01:30:00.000Z";
    record.canonical_payload.approved_amount_mm = 13;
    record.canonical_payload.amount_difference_mm = -2;
    record.canonical_payload.amount_difference_reason_codes = ["WATER_AVAILABILITY_LIMIT"];
    record.canonical_payload.supersedes_plan_ref = plan.source_record_id;
    record.canonical_payload.supersedes_plan_hash = plan.source_record_hash;
  });
  await insertEvidence(supersedingPlan);
  const superseded = await service.bindApprovedPlan(await bindingInput(decision, assertion, supersedingPlan));
  assert.equal(superseded.status, "SUPERSEDED_PREVIOUS");
  assert.equal(superseded.binding.supersession.status, "SUPERSEDES_ACTIVE_PLAN");
  const activeRows = await pool.query(
    `SELECT approved_plan_evidence_ref,active_for_decision FROM twin_approved_plan_binding_projection_v1 ORDER BY approved_plan_evidence_ref`,
  );
  assert.deepEqual(activeRows.rows, [
    { approved_plan_evidence_ref: plan.source_record_id, active_for_decision: false },
    { approved_plan_evidence_ref: supersedingPlan.source_record_id, active_for_decision: true },
  ].sort((left, right) => left.approved_plan_evidence_ref.localeCompare(right.approved_plan_evidence_ref)));
  ok("explicit Plan ref/hash supersession deactivates exactly one previous projection");

  const forgedSupersession = cloneEvidence(plan, "forged_supersession", (record) => {
    record.binding_id = "mcft_cap05_approved_plan_forged_supersession_v1";
    record.available_to_runtime_at = "2026-06-04T01:16:00.000Z";
    record.role_time.created_at = "2026-06-04T01:14:00.000Z";
    record.role_time.approved_at = "2026-06-04T01:15:00.000Z";
    record.role_time.available_to_runtime_at = record.available_to_runtime_at;
    record.role_time.ingested_at = record.available_to_runtime_at;
    record.role_time.plan_effective_from = "2026-06-04T01:35:00.000Z";
    record.canonical_payload.supersedes_plan_ref = supersedingPlan.source_record_id;
    record.canonical_payload.supersedes_plan_hash = "sha256:forged-supersedes-hash";
  });
  negativeFactIds.push(await insertEvidence(forgedSupersession));
  await assert.rejects(
    service.bindApprovedPlan(await bindingInput(decision, assertion, forgedSupersession)),
    /CAP05_PLAN_SUPERSESSION_PREDECESSOR_MISMATCH/,
  );
  ok("forged supersession predecessor hash fails closed");

  if (negativeFactIds.length) await pool.query("DELETE FROM facts WHERE fact_id = ANY($1::text[])", [negativeFactIds]);
  await pool.query("DELETE FROM twin_approved_plan_binding_projection_v1");
  const recovery = await service.rebuildBindings();
  assert.deepEqual(recovery, {
    approved_plan_facts_scanned: 2,
    bindings_rebuilt: 2,
    supersessions_rebuilt: 1,
  });
  const rebuiltRows = await pool.query(
    `SELECT approved_plan_evidence_ref,active_for_decision,canonical_evidence->'validated_binding'->>'decision_ref' AS decision_ref
     FROM twin_approved_plan_binding_projection_v1 ORDER BY approved_plan_evidence_ref`,
  );
  assert.equal(rebuiltRows.rows.length, 2);
  assert.equal(rebuiltRows.rows.filter((row) => row.active_for_decision).length, 1);
  assert.ok(rebuiltRows.rows.every((row) => row.decision_ref === decision.ref));
  assert.equal(await canonicalTwinCount(), canonicalBefore);
  ok("projection deletion rebuilds validated bindings and supersession from facts without canonical append");

  console.log(`SUMMARY ${pass} PASS / 0 FAIL`);
}

main().finally(async () => pool.end());

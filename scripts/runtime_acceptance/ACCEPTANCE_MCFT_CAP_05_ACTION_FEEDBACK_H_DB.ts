// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_ACTION_FEEDBACK_H_DB.ts
// Purpose: prove one controlled irrigation Receipt becomes canonical H Action Feedback and the existing executed-irrigation adapter applies coverage exactly once while preserving integrity, time and status semantics.
// Boundary: destructive isolated-database acceptance only; no public route, approval/dispatch creation, State/checkpoint mutation, Forecast, Residual, calibration, model activation or CAP-06 authorization.

import assert from "node:assert/strict";
import cp from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import {
  mapCap05ActionFeedbackQualityV1,
  requireSingleEligibleCap05ExecutionEventV1,
} from "../../apps/server/src/domain/twin_runtime/action_feedback_to_executed_irrigation_v1.js";
import { aggregateExecutedIrrigationV1 } from "../../apps/server/src/domain/soil_water/executed_irrigation_input_v1.js";
import {
  mapCap05ReceiptExecutionStatusV1,
  mapCap05ReceiptValidationStatusV1,
  type Cap05ExecutionReceiptEvidenceV1,
} from "../../apps/server/src/evidence/twin_runtime/execution_receipt_evidence_contract_v1.js";
import {
  computeCap05ReplayEvidenceSourceRecordHashV1,
  type Cap05ApprovalAssertionEvidenceV1,
  type Cap05ApprovedPlanEvidenceV1,
} from "../../apps/server/src/evidence/twin_runtime/approval_plan_evidence_contracts_v1.js";
import { Cap05ApprovalPlanBindingServiceV1 } from "../../apps/server/src/runtime/twin_runtime/approval_plan_binding_service_v1.js";
import { Cap05ActionFeedbackNormalizationServiceV1 } from "../../apps/server/src/runtime/twin_runtime/action_feedback_normalization_service_v1.js";

if (process.env.MCFT_CAP_05_S6_DESTRUCTIVE_ACCEPTANCE !== "1") throw new Error("SET_MCFT_CAP_05_S6_DESTRUCTIVE_ACCEPTANCE_1");
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL_REQUIRED");
const databaseName = new URL(databaseUrl).pathname.replace(/^\//, "").toLowerCase();
if (!/(mcft|cap05|s6|feedback|acceptance|test)/.test(databaseName)) throw new Error("ISOLATED_ACCEPTANCE_DATABASE_REQUIRED");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE_ROOT = path.join(ROOT, "fixtures/mcft/water_state/feedback_v1");
const pool = new Pool({ connectionString: databaseUrl });
const planService = new Cap05ApprovalPlanBindingServiceV1(pool);
const feedbackService = new Cap05ActionFeedbackNormalizationServiceV1(pool);
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

async function seedReplayEvidence(record: Record<string, unknown>): Promise<void> {
  await pool.query(
    `INSERT INTO facts (fact_id,occurred_at,source,record_json)
     VALUES ($1,$2::timestamptz,'mcft_cap05_replay_evidence_v1',$3::jsonb)`,
    [evidenceFactId(String(record.evidence_identity_key)), record.available_to_runtime_at, JSON.stringify({ type: record.record_type, payload: record })],
  );
}

function cloneReceipt(
  suffix: string,
  source: Cap05ExecutionReceiptEvidenceV1,
  mutate?: (record: Cap05ExecutionReceiptEvidenceV1) => void,
): Cap05ExecutionReceiptEvidenceV1 {
  const record = structuredClone(source);
  record.source_record_id = `${source.source_record_id}_${suffix}`;
  record.evidence_identity_key = `${source.evidence_identity_key}_${suffix}`;
  record.idempotency_key = `sha256:acceptance-receipt-idempotency-${suffix}`;
  record.binding_id = `${source.binding_id}_${suffix}`;
  record.canonical_payload.event_id = `${source.canonical_payload.event_id}_${suffix}`;
  record.source_payload.event_id = record.canonical_payload.event_id;
  mutate?.(record);
  record.source_record_hash = computeCap05ReplayEvidenceSourceRecordHashV1(record as unknown as Record<string, unknown>);
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
  const dispatch = readOne<Record<string, unknown>>("external_dispatch.jsonl");
  const receipt = readOne<Cap05ExecutionReceiptEvidenceV1>("execution_receipts.jsonl");
  const scope = {
    tenant_id: receipt.tenant_id,
    project_id: receipt.project_id,
    group_id: receipt.group_id,
    field_id: receipt.field_id,
    season_id: receipt.season_id,
    zone_id: receipt.zone_id,
  };

  await seedReplayEvidence(dispatch);
  const planBinding = await planService.commitApprovalPlanBinding({
    scope,
    approval_assertion: assertion,
    approved_plan: plan,
    dispatch: {
      disposition: "EXTERNALLY_RECORDED",
      evidence_ref: String(dispatch.source_record_id),
      evidence_hash: String(dispatch.source_record_hash),
    },
  });
  assert.equal(planBinding.approved_plan_status, "INSERTED");
  ok("S5 remediated active Approved Plan predecessor is established without supersession");

  await seedReplayEvidence(receipt as unknown as Record<string, unknown>);
  const standard = await feedbackService.commitActionFeedback({
    scope,
    receipt_evidence_ref: receipt.source_record_id,
    receipt_evidence_hash: receipt.source_record_hash,
  });
  assert.equal(standard.persistence_status, "INSERTED");
  assert.equal(standard.action_feedback.object_type, "twin_action_feedback_v1");
  assert.equal(standard.action_feedback.payload.transaction_variant, "H_ACTION_FEEDBACK_COMMIT");
  assert.equal(standard.action_feedback.payload.execution_status, "PARTIALLY_EXECUTED");
  assert.equal(standard.action_feedback.payload.validation_status, "VALIDATED");
  assert.equal(standard.action_feedback.payload.source_quality, "PASS");
  assert.equal(standard.action_feedback.payload.eligible_for_state_input, true);
  assert.equal(standard.action_feedback.payload.actual_amount_mm, "13.600000");
  assert.equal(standard.action_feedback.payload.spatial_coverage_fraction, "0.910000");
  assert.equal(standard.action_feedback.payload.target_scope_equivalent_irrigation_mm, "12.376000");
  assert.equal(standard.action_feedback.logical_time, "2026-06-04T01:50:00.000Z");
  assert.equal(standard.action_feedback.as_of, "2026-06-04T01:55:00.000Z");
  assert.equal(standard.dispatch_disposition, "EXTERNALLY_RECORDED");
  assert.ok(standard.adapter_result);
  assert.equal(standard.adapter_result.candidate.executed_amount_mm, "13.600000");
  assert.equal(standard.adapter_result.candidate.coverage_fraction, "0.910000");
  assert.equal(standard.coverage_applied_by_adapter, false);
  assert.equal(standard.volume_conversion_performed, false);
  ok("Receipt maps to canonical H Action Feedback with exact status, time, amount, coverage and binding fields");

  const aggregation = aggregateExecutedIrrigationV1({
    candidates: [standard.adapter_result.candidate],
    interval_start_exclusive: "2026-06-04T01:00:00.000Z",
    interval_end_inclusive: "2026-06-04T02:00:00.000Z",
  });
  assert.equal(aggregation.effective_irrigation_mm, "12.376000");
  assert.equal(aggregation.selected_events[0].executed_amount_mm, "13.600000");
  assert.equal(aggregation.selected_events[0].coverage_fraction, "0.910000");
  ok("adapter preserves raw executed amount and coverage so the existing aggregator applies coverage exactly once");

  const retry = await feedbackService.commitActionFeedback({
    scope,
    receipt_evidence_ref: receipt.source_record_id,
    receipt_evidence_hash: receipt.source_record_hash,
  });
  assert.equal(retry.persistence_status, "EXISTING_IDEMPOTENT_SUCCESS");
  assert.equal(retry.action_feedback.object_id, standard.action_feedback.object_id);
  assert.equal(retry.action_feedback.determinism_hash, standard.action_feedback.determinism_hash);
  assert.equal(await countType("twin_action_feedback_v1"), 1);
  ok("H response-loss retry returns the exact existing canonical Action Feedback");

  assert.equal(mapCap05ReceiptExecutionStatusV1("FULL"), "EXECUTED");
  assert.equal(mapCap05ReceiptExecutionStatusV1("PARTIAL"), "PARTIALLY_EXECUTED");
  assert.equal(mapCap05ReceiptExecutionStatusV1("UNKNOWN"), "EXECUTION_UNCERTAIN");
  assert.equal(mapCap05ReceiptExecutionStatusV1("NONE"), "NOT_EXECUTED");
  assert.equal(mapCap05ReceiptValidationStatusV1("PASSED"), "VALIDATED");
  assert.equal(mapCap05ReceiptValidationStatusV1("PASSED_WITH_LIMITATIONS"), "VALIDATED_WITH_LIMITATIONS");
  assert.equal(mapCap05ReceiptValidationStatusV1("FAILED"), "REJECTED");
  assert.equal(mapCap05ReceiptValidationStatusV1("PENDING"), "NOT_YET_VALIDATED");
  assert.equal(mapCap05ActionFeedbackQualityV1("PASS"), "USABLE");
  assert.equal(mapCap05ActionFeedbackQualityV1("LIMITED"), "USABLE");
  assert.equal(mapCap05ActionFeedbackQualityV1("FAIL"), "UNUSABLE");
  ok("execution, validation and quality status mappings are explicit and independent");

  const forgedSourceHash = cloneReceipt("forged_source_hash", receipt, (record) => {
    record.role_time.execution_start = "2026-06-04T01:23:00.000Z";
    record.role_time.execution_end = "2026-06-04T01:24:00.000Z";
    record.role_time.ingested_at = "2026-06-04T01:57:00.000Z";
    record.role_time.available_to_runtime_at = "2026-06-04T01:57:00.000Z";
    record.available_to_runtime_at = record.role_time.available_to_runtime_at;
  });
  forgedSourceHash.source_record_hash = "sha256:forged-receipt-source-record-hash";
  await seedReplayEvidence(forgedSourceHash as unknown as Record<string, unknown>);
  await assert.rejects(feedbackService.commitActionFeedback({
    scope,
    receipt_evidence_ref: forgedSourceHash.source_record_id,
    receipt_evidence_hash: forgedSourceHash.source_record_hash,
  }), /CAP05_REPLAY_EVIDENCE_SOURCE_RECORD_HASH_MISMATCH/);
  ok("forged Receipt source-record hash fails closed before canonical H construction");

  const pending = cloneReceipt("pending_validation", receipt, (record) => {
    record.canonical_payload.execution_status = "FULL";
    record.source_payload.execution_status = "FULL";
    record.canonical_payload.validation_status = "PENDING";
    record.source_payload.validation_status = "PENDING";
    record.canonical_payload.eligible_for_state_input = true;
    record.source_payload.eligible_for_state_input = true;
    record.role_time.execution_start = "2026-06-04T01:21:00.000Z";
    record.role_time.execution_end = "2026-06-04T01:22:00.000Z";
    record.role_time.ingested_at = "2026-06-04T01:56:00.000Z";
    record.role_time.available_to_runtime_at = "2026-06-04T01:56:00.000Z";
    record.available_to_runtime_at = record.role_time.available_to_runtime_at;
  });
  await seedReplayEvidence(pending as unknown as Record<string, unknown>);
  const pendingResult = await feedbackService.commitActionFeedback({
    scope,
    receipt_evidence_ref: pending.source_record_id,
    receipt_evidence_hash: pending.source_record_hash,
  });
  assert.equal(pendingResult.action_feedback.payload.execution_status, "EXECUTED");
  assert.equal(pendingResult.action_feedback.payload.validation_status, "NOT_YET_VALIDATED");
  assert.equal(pendingResult.action_feedback.payload.eligible_for_state_input, false);
  assert.equal(pendingResult.adapter_result, null);
  ok("execution status remains EXECUTED while pending validation independently blocks State eligibility");

  const late = cloneReceipt("late_no_shift", receipt, (record) => {
    record.role_time.execution_start = "2026-06-04T01:40:00.000Z";
    record.role_time.execution_end = "2026-06-04T01:45:00.000Z";
    record.role_time.ingested_at = "2026-06-04T03:05:00.000Z";
    record.role_time.available_to_runtime_at = "2026-06-04T03:05:00.000Z";
    record.available_to_runtime_at = record.role_time.available_to_runtime_at;
  });
  await seedReplayEvidence(late as unknown as Record<string, unknown>);
  const lateResult = await feedbackService.commitActionFeedback({
    scope,
    receipt_evidence_ref: late.source_record_id,
    receipt_evidence_hash: late.source_record_hash,
  });
  assert.equal(lateResult.action_feedback.logical_time, "2026-06-04T01:45:00.000Z");
  assert.equal(lateResult.action_feedback.as_of, "2026-06-04T03:05:00.000Z");
  assert.equal(lateResult.adapter_result?.candidate.executed_at, "2026-06-04T01:45:00.000Z");
  assert.equal(lateResult.logical_time_shifted, false);
  ok("late Receipt preserves execution logical time and does not shift into its availability hour");

  assert.throws(
    () => requireSingleEligibleCap05ExecutionEventV1([standard.adapter_result!, lateResult.adapter_result!]),
    /CAP05_MULTIPLE_EXECUTION_EVENTS_FORBIDDEN_V1/,
  );
  ok("single-event guard rejects multiple eligible execution events for one tick");

  const crossHour = cloneReceipt("cross_hour", receipt, (record) => {
    record.role_time.execution_start = "2026-06-04T01:50:00.000Z";
    record.role_time.execution_end = "2026-06-04T02:05:00.000Z";
    record.role_time.ingested_at = "2026-06-04T02:06:00.000Z";
    record.role_time.available_to_runtime_at = "2026-06-04T02:06:00.000Z";
    record.available_to_runtime_at = record.role_time.available_to_runtime_at;
  });
  await seedReplayEvidence(crossHour as unknown as Record<string, unknown>);
  await assert.rejects(feedbackService.commitActionFeedback({
    scope,
    receipt_evidence_ref: crossHour.source_record_id,
    receipt_evidence_hash: crossHour.source_record_hash,
  }), /CAP05_RECEIPT_CROSS_HOUR_EXECUTION_FORBIDDEN/);
  ok("cross-hour execution Receipt fails closed");

  const volume = cloneReceipt("volume_unit", receipt, (record) => {
    (record.canonical_payload as { unit: string }).unit = "m3";
    (record.source_payload as { unit: string }).unit = "m3";
  });
  await seedReplayEvidence(volume as unknown as Record<string, unknown>);
  await assert.rejects(feedbackService.commitActionFeedback({
    scope,
    receipt_evidence_ref: volume.source_record_id,
    receipt_evidence_hash: volume.source_record_hash,
  }), /CAP05_RECEIPT_DEPTH_MM_ONLY_NO_VOLUME_CONVERSION/);
  ok("volume unit is rejected instead of converted to irrigation depth");

  const wrongCoveredAmount = cloneReceipt("wrong_covered_amount", receipt, (record) => {
    record.canonical_payload.target_scope_equivalent_irrigation_mm = 13.6;
    record.source_payload.target_scope_equivalent_irrigation_mm = 13.6;
  });
  await seedReplayEvidence(wrongCoveredAmount as unknown as Record<string, unknown>);
  await assert.rejects(feedbackService.commitActionFeedback({
    scope,
    receipt_evidence_ref: wrongCoveredAmount.source_record_id,
    receipt_evidence_hash: wrongCoveredAmount.source_record_hash,
  }), /CAP05_RECEIPT_TARGET_EQUIVALENT_MISMATCH/);
  ok("forged covered-footprint amount fails closed");

  const projection = await pool.query(
    `SELECT execution_status,validation_status,source_quality,eligible_for_state_input,actual_amount_mm,
            spatial_coverage_fraction,target_scope_equivalent_irrigation_mm,logical_time,as_of
     FROM twin_action_feedback_projection_v1 WHERE action_feedback_object_id=$1`,
    [standard.action_feedback.object_id],
  );
  assert.deepEqual(projection.rows, [{
    execution_status: "PARTIALLY_EXECUTED",
    validation_status: "VALIDATED",
    source_quality: "PASS",
    eligible_for_state_input: true,
    actual_amount_mm: "13.600000",
    spatial_coverage_fraction: "0.910000",
    target_scope_equivalent_irrigation_mm: "12.376000",
    logical_time: new Date("2026-06-04T01:50:00.000Z"),
    as_of: new Date("2026-06-04T01:55:00.000Z"),
  }]);
  const evidenceIndex = await pool.query(
    `SELECT evidence_kind,evidence_ref FROM twin_action_feedback_evidence_index_v1
     WHERE action_feedback_object_id=$1 ORDER BY evidence_kind`,
    [standard.action_feedback.object_id],
  );
  assert.deepEqual(evidenceIndex.rows.map((row) => row.evidence_kind), ["APPROVED_PLAN", "DECISION", "RECEIPT"]);
  ok("H persistence writes canonical fact, Action Feedback projection and exact Decision/Plan/Receipt evidence index");

  assert.equal(await countType("twin_decision_record_v1"), 1);
  assert.equal(await countType("twin_action_feedback_v1"), 3);
  assert.equal(await countType("twin_forecast_residual_v1"), 0);
  ok("S6 adds bounded H Action Feedback only and creates no State, Forecast or Residual object");

  assert.equal(pass, 15);
  console.log(`SUMMARY ${pass} PASS / 0 FAIL`);
}

main().finally(async () => pool.end());

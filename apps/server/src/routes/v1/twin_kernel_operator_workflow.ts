// apps/server/src/routes/v1/twin_kernel_operator_workflow.ts
// Purpose: expose TK14 operator workflow routes for explicit human review and explicit formalization actions.
// Boundary: these routes do not create recommendations, approvals, operation plans, AO-ACT tasks, receipts, acceptance records, automatic downstream actions, production Field Memory policy, or model updates.

import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

type Row = Record<string, unknown>;

type OperatorWorkflowBody = {
  decision_cycle_id?: unknown;
  decisionCycleId?: unknown;
  operator_session_id?: unknown;
  operatorSessionId?: unknown;
  operator_review_id?: unknown;
  operatorReviewId?: unknown;
  operator_id?: unknown;
  operatorId?: unknown;
  opened_at?: unknown;
  openedAt?: unknown;
  reviewed_by?: unknown;
  reviewedBy?: unknown;
  reviewed_at?: unknown;
  reviewedAt?: unknown;
  review_status?: unknown;
  reviewStatus?: unknown;
  review_notes?: unknown;
  reviewNotes?: unknown;
  formalized_by?: unknown;
  formalizedBy?: unknown;
  formalized_at?: unknown;
  formalizedAt?: unknown;
  roi_summary?: unknown;
  roiSummary?: unknown;
  memory_statement?: unknown;
  memoryStatement?: unknown;
  evidence_refs?: unknown;
  evidenceRefs?: unknown;
};

const STAGE_ORDER = [
  "OBSERVED",
  "STATE_ESTIMATED",
  "FORECASTED",
  "SCENARIO_COMPARED",
  "RECOMMENDATION_CANDIDATE_CREATED",
  "APPROVAL_REQUIRED",
  "APPROVED",
  "TASK_CREATED",
  "DISPATCHED",
  "RECEIPT_RECEIVED",
  "ACCEPTED",
  "ROI_FORMALIZED",
  "MEMORY_CANDIDATE_CREATED",
  "FORMAL_MEMORY_WRITTEN",
  "CALIBRATED",
];

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function recordArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? (value.filter((item) => item && typeof item === "object") as Array<Record<string, unknown>>) : [];
}

function iso(value: unknown): unknown {
  return value instanceof Date ? value.toISOString() : value;
}

function canonical(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    const input = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(input).sort()) output[key] = canonical(input[key]);
    return output;
  }
  return value;
}

function hashPayload(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

function body(req: any): OperatorWorkflowBody {
  return req?.body && typeof req.body === "object" ? (req.body as OperatorWorkflowBody) : {};
}

function bodyText(input: OperatorWorkflowBody, snake: keyof OperatorWorkflowBody, camel: keyof OperatorWorkflowBody): string {
  return text(input[snake] ?? input[camel]);
}

function queryText(req: any, key: string): string {
  return text(req?.query?.[key] ?? req?.query?.[key.replace(/_([a-z])/g, (_match: string, letter: string) => letter.toUpperCase())]);
}

function parseTs(value: string, errorCode: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error(errorCode);
  return date.toISOString();
}

function evidenceRefs(input: unknown): Array<Record<string, string>> {
  return recordArray(input).map((item) => ({ kind: text(item.kind), ref_id: text(item.ref_id) })).filter((item) => item.kind && item.ref_id);
}

function boundaryFlags(): Record<string, boolean> {
  return {
    model_updated: false,
    automatic_roi_created: false,
    automatic_task_created: false,
    automatic_receipt_created: false,
    automatic_approval_created: false,
    automatic_acceptance_created: false,
    automatic_field_memory_created: false,
    automatic_recommendation_created: false,
    trace_read_only_preserved: true,
  };
}

function missingFormalization(row: Row): string[] {
  const refs = record(row.external_refs_json);
  const missing: string[] = [];
  if (!text(refs.roi_entry_id)) missing.push("ROI_FORMALIZATION_MISSING");
  if (!text(refs.field_memory_id)) missing.push("FORMAL_FIELD_MEMORY_MISSING");
  return missing;
}

async function queryOne(pool: Pool, sql: string, values: unknown[]): Promise<Row | null> {
  const result = await pool.query(sql, values);
  return (result.rows[0] as Row | undefined) ?? null;
}

async function readDecisionCycle(pool: Pool, decisionCycleId: string): Promise<Row | null> {
  return queryOne(pool, "SELECT * FROM decision_cycle_v1 WHERE decision_cycle_id = $1 LIMIT 1", [decisionCycleId]);
}

async function readSession(pool: Pool, sessionId: string): Promise<Row | null> {
  return queryOne(pool, "SELECT * FROM operator_session_v0 WHERE operator_session_id = $1 LIMIT 1", [sessionId]);
}

async function readReview(pool: Pool, reviewId: string): Promise<Row | null> {
  return queryOne(pool, "SELECT * FROM operator_decision_review_v0 WHERE operator_review_id = $1 LIMIT 1", [reviewId]);
}

async function readFieldLearningCandidate(pool: Pool, candidateId: string): Promise<Row | null> {
  return queryOne(pool, "SELECT * FROM field_learning_candidate_v1 WHERE field_learning_candidate_id = $1 LIMIT 1", [candidateId]);
}

async function readRoiEntry(pool: Pool, roiEntryId: string): Promise<Row | null> {
  return queryOne(pool, "SELECT * FROM roi_entry_v1 WHERE roi_entry_id = $1 LIMIT 1", [roiEntryId]);
}

async function readFieldMemory(pool: Pool, fieldMemoryId: string): Promise<Row | null> {
  return queryOne(pool, "SELECT * FROM field_memory_v1 WHERE memory_id = $1 OR field_memory_id = $1 LIMIT 1", [fieldMemoryId]);
}

function exposeDecisionCycle(row: Row): Row {
  return { decision_cycle_id: row.decision_cycle_id, current_stage: row.current_stage, external_refs_json: row.external_refs_json, state_machine_json: row.state_machine_json, boundary_flags_json: row.boundary_flags_json, missing_formalization: missingFormalization(row) };
}

function exposeDecisionCycleQueueRow(row: Row): Row {
  return { decision_cycle_id: row.decision_cycle_id, tenant_id: row.tenant_id, project_id: row.project_id, group_id: row.group_id, field_id: row.field_id, as_of_ts: iso(row.as_of_ts), current_stage: row.current_stage, missing_formalization: missingFormalization(row), pointer_refs: row.external_refs_json, created_at: iso(row.created_at) };
}

function exposeSession(row: Row): Row {
  return { operator_session_id: row.operator_session_id, decision_cycle_id: row.decision_cycle_id, tenant_id: row.tenant_id, project_id: row.project_id, group_id: row.group_id, field_id: row.field_id, as_of_ts: iso(row.as_of_ts), operator_id: row.operator_id, session_status: row.session_status, opened_at: iso(row.opened_at), closed_at: iso(row.closed_at), trace_ref_json: row.trace_ref_json, boundary_flags_json: row.boundary_flags_json, created_at: iso(row.created_at) };
}

function exposeReview(row: Row): Row {
  return { operator_review_id: row.operator_review_id, operator_session_id: row.operator_session_id, decision_cycle_id: row.decision_cycle_id, reviewed_by: row.reviewed_by, reviewed_at: iso(row.reviewed_at), review_status: row.review_status, review_notes_json: row.review_notes_json, decision_snapshot_json: row.decision_snapshot_json, boundary_flags_json: row.boundary_flags_json, created_at: iso(row.created_at) };
}

function exposeAction(row: Row): Row {
  return { operator_action_id: row.operator_action_id, operator_session_id: row.operator_session_id, operator_review_id: row.operator_review_id, decision_cycle_id: row.decision_cycle_id, action_type: row.action_type, requested_by: row.requested_by, requested_at: iso(row.requested_at), target_object_type: row.target_object_type, target_object_id: row.target_object_id, action_payload_json: row.action_payload_json, evidence_refs_json: row.evidence_refs_json, boundary_flags_json: row.boundary_flags_json, created_at: iso(row.created_at) };
}

function exposeRoiEntry(row: Row): Row {
  return { roi_entry_id: row.roi_entry_id, decision_cycle_id: row.decision_cycle_id, tenant_id: row.tenant_id, project_id: row.project_id, group_id: row.group_id, field_id: row.field_id, as_of_ts: iso(row.as_of_ts), roi_status: row.roi_status, formalized_by: row.formalized_by, formalized_at: iso(row.formalized_at), roi_summary_json: row.roi_summary_json, evidence_refs_json: row.evidence_refs_json, source_object_refs_json: row.source_object_refs_json, created_at: iso(row.created_at) };
}

function exposeFieldMemory(row: Row): Row {
  return { field_memory_id: row.field_memory_id ?? row.memory_id, memory_id: row.memory_id ?? row.field_memory_id, decision_cycle_id: row.decision_cycle_id, field_learning_candidate_id: row.field_learning_candidate_id, tenant_id: row.tenant_id, project_id: row.project_id, group_id: row.group_id, field_id: row.field_id, as_of_ts: iso(row.as_of_ts), memory_status: row.memory_status, formalized_by: row.formalized_by, formalized_at: iso(row.formalized_at), memory_statement_json: row.memory_statement_json, evidence_refs_json: row.evidence_refs_json, source_object_refs_json: row.source_object_refs_json, model_update_created: row.model_update_created, created_at: iso(row.created_at) };
}

function nextStateMachine(row: Row, completedStages: string[]): Array<Record<string, unknown>> {
  const existing = recordArray(row.state_machine_json);
  const byStage = new Map(existing.map((item) => [text(item.stage), item]));
  const completed = new Set(completedStages);
  return STAGE_ORDER.map((stage) => {
    const current = record(byStage.get(stage));
    return { ...current, stage, complete: current.complete === true || completed.has(stage) };
  });
}

function lastContiguousStage(stateMachine: Array<Record<string, unknown>>): string {
  let last = "NOT_STARTED";
  for (const item of stateMachine) {
    if (item.complete !== true) return last;
    last = text(item.stage);
  }
  return "CALIBRATED";
}

async function updateDecisionCycleFormalRefs(pool: Pool, decisionCycleId: string, refs: Record<string, string>, completedStages: string[]): Promise<Row> {
  const row = await readDecisionCycle(pool, decisionCycleId);
  if (!row) throw new Error("DECISION_CYCLE_NOT_FOUND");
  const externalRefs = { ...record(row.external_refs_json), ...refs };
  const stateMachine = nextStateMachine(row, completedStages);
  const currentStage = lastContiguousStage(stateMachine);
  const result = await pool.query(
    `UPDATE decision_cycle_v1
     SET external_refs_json = $2::jsonb,
         state_machine_json = $3::jsonb,
         current_stage = $4
     WHERE decision_cycle_id = $1
     RETURNING *`,
    [decisionCycleId, JSON.stringify(externalRefs), JSON.stringify(stateMachine), currentStage],
  );
  const updated = result.rows[0] as Row | undefined;
  if (!updated) throw new Error("DECISION_CYCLE_FORMAL_REF_UPDATE_FAILED");
  return updated;
}

function assertSessionReviewMatch(session: Row, review: Row): string | null {
  if (text(review.operator_session_id) !== text(session.operator_session_id)) return "OPERATOR_REVIEW_SESSION_MISMATCH";
  if (text(review.decision_cycle_id) !== text(session.decision_cycle_id)) return "OPERATOR_REVIEW_DECISION_CYCLE_MISMATCH";
  return null;
}

async function insertOperatorAction(pool: Pool, input: { actionType: string; targetObjectType: string; targetObjectId: string; session: Row; review: Row; requestedBy: string; requestedAt: string; payload: Record<string, unknown>; refs: Array<Record<string, string>> }): Promise<Row> {
  const operatorActionId = `op_action_${hashPayload({ object_type: "operator_formalization_action_v0", action_type: input.actionType, operator_session_id: input.session.operator_session_id, operator_review_id: input.review.operator_review_id, decision_cycle_id: input.session.decision_cycle_id }).slice(0, 24)}`;
  const result = await pool.query(
    `INSERT INTO operator_formalization_action_v0 (operator_action_id,operator_session_id,operator_review_id,decision_cycle_id,action_type,requested_by,requested_at,target_object_type,target_object_id,action_payload_json,evidence_refs_json,boundary_flags_json)
     VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb)
     ON CONFLICT (operator_action_id) DO NOTHING
     RETURNING *`,
    [operatorActionId, input.session.operator_session_id, input.review.operator_review_id, input.session.decision_cycle_id, input.actionType, input.requestedBy, input.requestedAt, input.targetObjectType, input.targetObjectId, JSON.stringify(input.payload), JSON.stringify(input.refs), JSON.stringify(boundaryFlags())],
  );
  const action = (result.rows[0] as Row | undefined) ?? await queryOne(pool, "SELECT * FROM operator_formalization_action_v0 WHERE operator_action_id = $1 LIMIT 1", [operatorActionId]);
  if (!action) throw new Error("OPERATOR_ACTION_WRITE_FAILED");
  return action;
}

async function formalizeRoi(pool: Pool, decisionCycle: Row, formalizedBy: string, formalizedAt: string, roiSummary: Record<string, unknown>, refs: Array<Record<string, string>>): Promise<{ roi: Row; decision: Row }> {
  const decisionCycleId = text(decisionCycle.decision_cycle_id);
  const roiEntryId = `roi_${hashPayload({ object_type: "roi_entry_v1", decision_cycle_id: decisionCycleId }).slice(0, 24)}`;
  const sourceRefs = { decision_cycle_id: decisionCycleId, acceptance_id: record(decisionCycle.external_refs_json).acceptance_id ?? null, post_irrigation_verification_id: record(decisionCycle.external_refs_json).post_irrigation_verification_id ?? null, operator_workflow_v0: true };
  const inserted = await pool.query(
    `INSERT INTO roi_entry_v1 (roi_entry_id,decision_cycle_id,tenant_id,project_id,group_id,field_id,as_of_ts,roi_status,formalized_by,formalized_at,roi_summary_json,evidence_refs_json,source_object_refs_json)
     VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz,$8,$9,$10::timestamptz,$11::jsonb,$12::jsonb,$13::jsonb)
     ON CONFLICT (roi_entry_id) DO NOTHING
     RETURNING *`,
    [roiEntryId, decisionCycleId, decisionCycle.tenant_id, decisionCycle.project_id, decisionCycle.group_id, decisionCycle.field_id, decisionCycle.as_of_ts, "ROI_FORMALIZED", formalizedBy, formalizedAt, JSON.stringify(roiSummary), JSON.stringify(refs), JSON.stringify(sourceRefs)],
  );
  const roi = (inserted.rows[0] as Row | undefined) ?? await readRoiEntry(pool, roiEntryId);
  if (!roi) throw new Error("ROI_ENTRY_WRITE_FAILED");
  const decision = await updateDecisionCycleFormalRefs(pool, decisionCycleId, { roi_entry_id: roiEntryId }, ["ROI_FORMALIZED"]);
  return { roi, decision };
}

async function formalizeFieldMemory(pool: Pool, decisionCycle: Row, formalizedBy: string, formalizedAt: string, memoryStatement: Record<string, unknown>, refs: Array<Record<string, string>>): Promise<{ fieldMemory: Row; decision: Row }> {
  const decisionCycleId = text(decisionCycle.decision_cycle_id);
  const candidateId = text(decisionCycle.field_learning_candidate_id);
  const candidate = await readFieldLearningCandidate(pool, candidateId);
  if (!candidate) throw new Error("FIELD_LEARNING_CANDIDATE_NOT_FOUND");
  const fieldMemoryId = `fm_${hashPayload({ object_type: "field_memory_v1", decision_cycle_id: decisionCycleId, field_learning_candidate_id: candidateId }).slice(0, 24)}`;
  const sourceRefs = { decision_cycle_id: decisionCycleId, field_learning_candidate_id: candidateId, calibration_replay_id: decisionCycle.calibration_replay_id ?? null, forecast_error_id: decisionCycle.forecast_error_id ?? null, acceptance_id: record(decisionCycle.external_refs_json).acceptance_id ?? null, operator_workflow_v0: true };
  const statement = Object.keys(memoryStatement).length > 0 ? memoryStatement : record(candidate.learning_statement_json);
  const inserted = await pool.query(
    `INSERT INTO field_memory_v1 (memory_id,field_memory_id,decision_cycle_id,field_learning_candidate_id,tenant_id,project_id,group_id,field_id,as_of_ts,memory_status,formalized_by,formalized_at,memory_statement_json,evidence_refs_json,source_object_refs_json,model_update_created,memory_type,evidence_refs,source_type,source_id,occurred_at)
     VALUES ($1,$1,$2,$3,$4,$5,$6,$7,$8::timestamptz,$9,$10,$11::timestamptz,$12::jsonb,$13::jsonb,$14::jsonb,$15,$16,$17::jsonb,$18,$19,$11::timestamptz)
     ON CONFLICT (memory_id) DO NOTHING
     RETURNING *`,
    [fieldMemoryId, decisionCycleId, candidateId, decisionCycle.tenant_id, decisionCycle.project_id, decisionCycle.group_id, decisionCycle.field_id, decisionCycle.as_of_ts, "FORMAL_MEMORY_WRITTEN", formalizedBy, formalizedAt, JSON.stringify(statement), JSON.stringify(refs), JSON.stringify(sourceRefs), false, "FORMAL_FIELD_MEMORY", JSON.stringify(refs), "twin_kernel_operator_workflow_v0", decisionCycleId],
  );
  const fieldMemory = (inserted.rows[0] as Row | undefined) ?? await readFieldMemory(pool, fieldMemoryId);
  if (!fieldMemory) throw new Error("FIELD_MEMORY_WRITE_FAILED");
  const decision = await updateDecisionCycleFormalRefs(pool, decisionCycleId, { field_memory_id: fieldMemoryId }, ["MEMORY_CANDIDATE_CREATED", "FORMAL_MEMORY_WRITTEN"]);
  return { fieldMemory, decision };
}

export function registerTwinKernelOperatorWorkflowRoutes(app: FastifyInstance, pool: Pool): void {
  app.get("/api/v1/twin-kernel/operator-workflow/decision-cycles", async (req: any, reply) => {
    const rawLimit = Number(queryText(req, "limit") || 25);
    const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(100, Math.floor(rawLimit))) : 25;
    const result = await pool.query(
      `SELECT * FROM decision_cycle_v1
       WHERE cycle_status = 'DECISION_CYCLE_READY'
         AND external_refs_json->>'acceptance_id' IS NOT NULL
         AND ((external_refs_json->>'roi_entry_id') IS NULL OR (external_refs_json->>'field_memory_id') IS NULL)
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit],
    );
    return reply.send({ ok: true, object_type: "operator_decision_queue_v0", read_only: true, write_ready: false, decision_cycles: result.rows.map((row) => exposeDecisionCycleQueueRow(row as Row)) });
  });

  app.post("/api/v1/twin-kernel/operator-workflow/sessions", async (req, reply) => {
    const input = body(req);
    const decisionCycleId = bodyText(input, "decision_cycle_id", "decisionCycleId");
    const operatorId = bodyText(input, "operator_id", "operatorId");
    const openedAtRaw = bodyText(input, "opened_at", "openedAt");
    if (!decisionCycleId) return reply.code(400).send({ ok: false, error: "DECISION_CYCLE_ID_REQUIRED" });
    if (!operatorId) return reply.code(400).send({ ok: false, error: "OPERATOR_ID_REQUIRED" });
    const openedAt = openedAtRaw ? parseTs(openedAtRaw, "INVALID_OPENED_AT") : new Date().toISOString();
    const decisionCycle = await readDecisionCycle(pool, decisionCycleId);
    if (!decisionCycle) return reply.code(404).send({ ok: false, error: "DECISION_CYCLE_NOT_FOUND" });
    const operatorSessionId = `op_sess_${hashPayload({ object_type: "operator_session_v0", decision_cycle_id: decisionCycleId, operator_id: operatorId, opened_at: openedAt }).slice(0, 24)}`;
    const traceRef = { decision_cycle_id: decisionCycleId, trace_endpoint: `/api/v1/twin-kernel/traces/${decisionCycleId}` };
    const result = await pool.query(
      `INSERT INTO operator_session_v0 (operator_session_id,decision_cycle_id,tenant_id,project_id,group_id,field_id,as_of_ts,operator_id,session_status,opened_at,trace_ref_json,boundary_flags_json)
       VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz,$8,$9,$10::timestamptz,$11::jsonb,$12::jsonb)
       ON CONFLICT (operator_session_id) DO NOTHING
       RETURNING *`,
      [operatorSessionId, decisionCycleId, decisionCycle.tenant_id, decisionCycle.project_id, decisionCycle.group_id, decisionCycle.field_id, decisionCycle.as_of_ts, operatorId, "OPEN", openedAt, JSON.stringify(traceRef), JSON.stringify(boundaryFlags())],
    );
    const session = (result.rows[0] as Row | undefined) ?? await readSession(pool, operatorSessionId);
    if (!session) return reply.code(500).send({ ok: false, error: "OPERATOR_SESSION_WRITE_FAILED" });
    return reply.send({ ok: true, object_type: "operator_session_v0", write_ready: true, downstream_write_ready: false, automatic_recommendation_created: false, automatic_task_created: false, operator_session: exposeSession(session), decision_cycle: exposeDecisionCycle(decisionCycle) });
  });

  app.post("/api/v1/twin-kernel/operator-workflow/reviews", async (req, reply) => {
    const input = body(req);
    const sessionId = bodyText(input, "operator_session_id", "operatorSessionId");
    const reviewedBy = bodyText(input, "reviewed_by", "reviewedBy");
    const reviewedAtRaw = bodyText(input, "reviewed_at", "reviewedAt");
    const reviewStatus = bodyText(input, "review_status", "reviewStatus") || "NEEDS_FORMALIZATION";
    if (!sessionId) return reply.code(400).send({ ok: false, error: "OPERATOR_SESSION_ID_REQUIRED" });
    if (!reviewedBy) return reply.code(400).send({ ok: false, error: "REVIEWED_BY_REQUIRED" });
    if (!reviewedAtRaw) return reply.code(400).send({ ok: false, error: "REVIEWED_AT_REQUIRED" });
    if (!["REVIEWED", "NEEDS_FORMALIZATION", "NO_ACTION"].includes(reviewStatus)) return reply.code(400).send({ ok: false, error: "INVALID_REVIEW_STATUS" });
    let reviewedAt: string;
    try { reviewedAt = parseTs(reviewedAtRaw, "INVALID_REVIEWED_AT"); } catch { return reply.code(400).send({ ok: false, error: "INVALID_REVIEWED_AT" }); }
    const session = await readSession(pool, sessionId);
    if (!session) return reply.code(404).send({ ok: false, error: "OPERATOR_SESSION_NOT_FOUND" });
    const decisionCycle = await readDecisionCycle(pool, text(session.decision_cycle_id));
    if (!decisionCycle) return reply.code(404).send({ ok: false, error: "DECISION_CYCLE_NOT_FOUND" });
    const operatorReviewId = `op_review_${hashPayload({ object_type: "operator_decision_review_v0", operator_session_id: sessionId, decision_cycle_id: session.decision_cycle_id, reviewed_by: reviewedBy, reviewed_at: reviewedAt }).slice(0, 24)}`;
    const decisionSnapshot = { decision_cycle_id: decisionCycle.decision_cycle_id, current_stage: decisionCycle.current_stage, missing_formalization: missingFormalization(decisionCycle), pointer_refs: decisionCycle.external_refs_json };
    const result = await pool.query(
      `INSERT INTO operator_decision_review_v0 (operator_review_id,operator_session_id,decision_cycle_id,tenant_id,project_id,group_id,field_id,as_of_ts,reviewed_by,reviewed_at,review_status,review_notes_json,decision_snapshot_json,boundary_flags_json)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::timestamptz,$9,$10::timestamptz,$11,$12::jsonb,$13::jsonb,$14::jsonb)
       ON CONFLICT (operator_review_id) DO NOTHING
       RETURNING *`,
      [operatorReviewId, sessionId, session.decision_cycle_id, session.tenant_id, session.project_id, session.group_id, session.field_id, session.as_of_ts, reviewedBy, reviewedAt, reviewStatus, JSON.stringify(record(input.review_notes ?? input.reviewNotes)), JSON.stringify(decisionSnapshot), JSON.stringify(boundaryFlags())],
    );
    const review = (result.rows[0] as Row | undefined) ?? await readReview(pool, operatorReviewId);
    if (!review) return reply.code(500).send({ ok: false, error: "OPERATOR_REVIEW_WRITE_FAILED" });
    return reply.send({ ok: true, object_type: "operator_decision_review_v0", write_ready: true, downstream_write_ready: false, operator_review: exposeReview(review), operator_session: exposeSession(session), decision_cycle: exposeDecisionCycle(decisionCycle) });
  });

  app.post("/api/v1/twin-kernel/operator-workflow/formalization-actions/roi", async (req, reply) => {
    const input = body(req);
    const sessionId = bodyText(input, "operator_session_id", "operatorSessionId");
    const reviewId = bodyText(input, "operator_review_id", "operatorReviewId");
    const formalizedBy = bodyText(input, "formalized_by", "formalizedBy");
    const formalizedAtRaw = bodyText(input, "formalized_at", "formalizedAt");
    if (!sessionId) return reply.code(400).send({ ok: false, error: "OPERATOR_SESSION_ID_REQUIRED" });
    if (!reviewId) return reply.code(400).send({ ok: false, error: "OPERATOR_REVIEW_ID_REQUIRED" });
    if (!formalizedBy) return reply.code(400).send({ ok: false, error: "FORMALIZED_BY_REQUIRED" });
    if (!formalizedAtRaw) return reply.code(400).send({ ok: false, error: "FORMALIZED_AT_REQUIRED" });
    let formalizedAt: string;
    try { formalizedAt = parseTs(formalizedAtRaw, "INVALID_FORMALIZED_AT"); } catch { return reply.code(400).send({ ok: false, error: "INVALID_FORMALIZED_AT" }); }
    const session = await readSession(pool, sessionId);
    if (!session) return reply.code(404).send({ ok: false, error: "OPERATOR_SESSION_NOT_FOUND" });
    const review = await readReview(pool, reviewId);
    if (!review) return reply.code(404).send({ ok: false, error: "OPERATOR_REVIEW_NOT_FOUND" });
    const mismatch = assertSessionReviewMatch(session, review);
    if (mismatch) return reply.code(400).send({ ok: false, error: mismatch });
    const decisionCycle = await readDecisionCycle(pool, text(session.decision_cycle_id));
    if (!decisionCycle) return reply.code(404).send({ ok: false, error: "DECISION_CYCLE_NOT_FOUND" });
    const refs = evidenceRefs(input.evidence_refs ?? input.evidenceRefs);
    const roiSummary = record(input.roi_summary ?? input.roiSummary);
    const formalized = await formalizeRoi(pool, decisionCycle, formalizedBy, formalizedAt, roiSummary, refs);
    const action = await insertOperatorAction(pool, { actionType: "FORMALIZE_ROI", targetObjectType: "roi_entry_v1", targetObjectId: text(formalized.roi.roi_entry_id), session, review, requestedBy: formalizedBy, requestedAt: formalizedAt, payload: roiSummary, refs });
    return reply.send({ ok: true, object_type: "operator_formalization_action_v0", write_ready: true, downstream_write_ready: false, automatic_roi_created: false, automatic_task_created: false, operator_action: exposeAction(action), roi_entry: exposeRoiEntry(formalized.roi), decision_cycle: exposeDecisionCycle(formalized.decision) });
  });

  app.post("/api/v1/twin-kernel/operator-workflow/formalization-actions/field-memory", async (req, reply) => {
    const input = body(req);
    const sessionId = bodyText(input, "operator_session_id", "operatorSessionId");
    const reviewId = bodyText(input, "operator_review_id", "operatorReviewId");
    const formalizedBy = bodyText(input, "formalized_by", "formalizedBy");
    const formalizedAtRaw = bodyText(input, "formalized_at", "formalizedAt");
    if (!sessionId) return reply.code(400).send({ ok: false, error: "OPERATOR_SESSION_ID_REQUIRED" });
    if (!reviewId) return reply.code(400).send({ ok: false, error: "OPERATOR_REVIEW_ID_REQUIRED" });
    if (!formalizedBy) return reply.code(400).send({ ok: false, error: "FORMALIZED_BY_REQUIRED" });
    if (!formalizedAtRaw) return reply.code(400).send({ ok: false, error: "FORMALIZED_AT_REQUIRED" });
    let formalizedAt: string;
    try { formalizedAt = parseTs(formalizedAtRaw, "INVALID_FORMORMALIZED_AT"); } catch { return reply.code(400).send({ ok: false, error: "INVALID_FORMALIZED_AT" }); }
    const session = await readSession(pool, sessionId);
    if (!session) return reply.code(404).send({ ok: false, error: "OPERATOR_SESSION_NOT_FOUND" });
    const review = await readReview(pool, reviewId);
    if (!review) return reply.code(404).send({ ok: false, error: "OPERATOR_REVIEW_NOT_FOUND" });
    const mismatch = assertSessionReviewMatch(session, review);
    if (mismatch) return reply.code(400).send({ ok: false, error: mismatch });
    const decisionCycle = await readDecisionCycle(pool, text(session.decision_cycle_id));
    if (!decisionCycle) return reply.code(404).send({ ok: false, error: "DECISION_CYCLE_NOT_FOUND" });
    const refs = evidenceRefs(input.evidence_refs ?? input.evidenceRefs);
    const memoryStatement = record(input.memory_statement ?? input.memoryStatement);
    const formalized = await formalizeFieldMemory(pool, decisionCycle, formalizedBy, formalizedAt, memoryStatement, refs);
    const action = await insertOperatorAction(pool, { actionType: "FORMALIZE_FIELD_MEMORY", targetObjectType: "field_memory_v1", targetObjectId: text(formalized.fieldMemory.field_memory_id ?? formalized.fieldMemory.memory_id), session, review, requestedBy: formalizedBy, requestedAt: formalizedAt, payload: memoryStatement, refs });
    return reply.send({ ok: true, object_type: "operator_formalization_action_v0", write_ready: true, downstream_write_ready: false, automatic_field_memory_created: false, model_update_created: false, automatic_task_created: false, operator_action: exposeAction(action), field_memory: exposeFieldMemory(formalized.fieldMemory), decision_cycle: exposeDecisionCycle(formalized.decision) });
  });
}

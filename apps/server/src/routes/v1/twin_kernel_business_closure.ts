// apps/server/src/routes/v1/twin_kernel_business_closure.ts
// Purpose: expose a read-only TK18 execution-to-learning closure readback for one decision_cycle_v1.
// Boundary: readback only; no write query is executed by this route.

import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

type Row = Record<string, unknown>;

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Row) : {};
}

function iso(value: unknown): unknown {
  return value instanceof Date ? value.toISOString() : value;
}

function hasRef(value: unknown): boolean {
  return text(value).length > 0;
}

async function one(pool: Pool, sql: string, values: unknown[]): Promise<Row | null> {
  const result = await pool.query(sql, values);
  return (result.rows[0] as Row | undefined) ?? null;
}

async function many(pool: Pool, sql: string, values: unknown[]): Promise<Row[]> {
  const result = await pool.query(sql, values);
  return result.rows as Row[];
}

function exposeDecision(row: Row): Row {
  return { decision_cycle_id: row.decision_cycle_id, field_learning_candidate_id: row.field_learning_candidate_id, tenant_id: row.tenant_id, project_id: row.project_id, group_id: row.group_id, field_id: row.field_id, as_of_ts: iso(row.as_of_ts), cycle_status: row.cycle_status, current_stage: row.current_stage, external_refs_json: row.external_refs_json, boundary_flags_json: row.boundary_flags_json, determinism_hash: row.determinism_hash, created_at: iso(row.created_at) };
}

function exposeEvent(row: Row): Row {
  return { production_ingestion_event_id: row.production_ingestion_event_id, source_contract_version: row.source_contract_version, source_system: row.source_system, source_event_id: row.source_event_id, decision_cycle_id: row.decision_cycle_id, raw_source_refs_json: row.raw_source_refs_json, mapped_external_refs_json: row.mapped_external_refs_json, boundary_flags_json: row.boundary_flags_json, created_at: iso(row.created_at) };
}

function exposeSession(row: Row): Row {
  return { operator_session_id: row.operator_session_id, decision_cycle_id: row.decision_cycle_id, operator_id: row.operator_id, session_status: row.session_status, opened_at: iso(row.opened_at), closed_at: iso(row.closed_at), boundary_flags_json: row.boundary_flags_json, created_at: iso(row.created_at) };
}

function exposeReview(row: Row): Row {
  return { operator_review_id: row.operator_review_id, operator_session_id: row.operator_session_id, decision_cycle_id: row.decision_cycle_id, reviewed_by: row.reviewed_by, reviewed_at: iso(row.reviewed_at), review_status: row.review_status, decision_snapshot_json: row.decision_snapshot_json, boundary_flags_json: row.boundary_flags_json, created_at: iso(row.created_at) };
}

function exposeAction(row: Row): Row {
  return { operator_action_id: row.operator_action_id, operator_session_id: row.operator_session_id, operator_review_id: row.operator_review_id, decision_cycle_id: row.decision_cycle_id, action_type: row.action_type, target_object_type: row.target_object_type, target_object_id: row.target_object_id, boundary_flags_json: row.boundary_flags_json, created_at: iso(row.created_at) };
}

function exposeRoi(row: Row | null): Row | null {
  if (!row) return null;
  return { roi_entry_id: row.roi_entry_id, decision_cycle_id: row.decision_cycle_id, roi_status: row.roi_status, formalized_by: row.formalized_by, formalized_at: iso(row.formalized_at), evidence_refs_json: row.evidence_refs_json, created_at: iso(row.created_at) };
}

function exposeMemory(row: Row | null): Row | null {
  if (!row) return null;
  return { field_memory_id: row.field_memory_id ?? row.memory_id, memory_id: row.memory_id ?? row.field_memory_id, decision_cycle_id: row.decision_cycle_id, memory_status: row.memory_status, formalized_by: row.formalized_by, formalized_at: iso(row.formalized_at), model_update_created: row.model_update_created, evidence_refs_json: row.evidence_refs_json, created_at: iso(row.created_at) };
}

function closureStatus(args: { decision: Row; candidate: Row | null; events: Row[]; sessions: Row[]; reviews: Row[]; actions: Row[]; roi: Row | null; memory: Row | null }): Row {
  const refs = record(args.decision.external_refs_json);
  const flags = record(args.decision.boundary_flags_json);
  const gate = record(args.candidate?.h58_gate_status_json);
  const actionTypes = new Set(args.actions.map((row) => text(row.action_type)));
  const executionRefsPresent = ["recommendation_id", "approval_id", "operation_plan_id", "act_task_id", "receipt_id", "as_executed_id", "acceptance_id", "post_irrigation_verification_id"].every((key) => hasRef(refs[key]));
  const roiDone = hasRef(refs.roi_entry_id) && args.roi !== null && actionTypes.has("FORMALIZE_ROI");
  const memoryDone = hasRef(refs.field_memory_id) && args.memory !== null && actionTypes.has("FORMALIZE_FIELD_MEMORY");
  const noAutoWrites = flags.automatic_recommendation_created === false && flags.automatic_approval_created === false && flags.automatic_task_created === false && flags.automatic_receipt_created === false && flags.automatic_acceptance_created === false && flags.automatic_roi_created === false && flags.automatic_field_memory_created === false && flags.model_updated === false;
  return { production_ingestion_present: args.events.length > 0, execution_pointer_chain_present: executionRefsPresent, operator_session_present: args.sessions.length > 0, operator_review_present: args.reviews.length > 0, roi_formalized_by_operator_action: roiDone, field_memory_written_by_operator_action: memoryDone, trace_reaches_calibrated: args.decision.current_stage === "CALIBRATED", h58_not_created_by_twin_kernel: gate.formal_field_memory_write_created === false, model_update_created: args.memory?.model_update_created === true || flags.model_updated === true, forbidden_auto_writes_absent: noAutoWrites, business_closure_complete: args.events.length > 0 && executionRefsPresent && args.sessions.length > 0 && args.reviews.length > 0 && roiDone && memoryDone && args.decision.current_stage === "CALIBRATED" && noAutoWrites };
}

export function registerTwinKernelBusinessClosureRoutes(app: FastifyInstance, pool: Pool): void {
  app.get("/api/v1/twin-kernel/business-closures/:decision_cycle_id", async (req: any, reply) => {
    const decisionCycleId = text(req?.params?.decision_cycle_id);
    if (!decisionCycleId) return reply.code(400).send({ ok: false, error: "DECISION_CYCLE_ID_REQUIRED" });
    const decision = await one(pool, "SELECT * FROM decision_cycle_v1 WHERE decision_cycle_id = $1 LIMIT 1", [decisionCycleId]);
    if (!decision) return reply.code(404).send({ ok: false, error: "DECISION_CYCLE_NOT_FOUND" });
    const refs = record(decision.external_refs_json);
    const candidate = await one(pool, "SELECT * FROM field_learning_candidate_v1 WHERE field_learning_candidate_id = $1 LIMIT 1", [text(decision.field_learning_candidate_id)]);
    const events = await many(pool, "SELECT * FROM production_ingestion_event_v0 WHERE decision_cycle_id = $1 ORDER BY created_at DESC", [decisionCycleId]);
    const sessions = await many(pool, "SELECT * FROM operator_session_v0 WHERE decision_cycle_id = $1 ORDER BY created_at DESC", [decisionCycleId]);
    const reviews = await many(pool, "SELECT * FROM operator_decision_review_v0 WHERE decision_cycle_id = $1 ORDER BY created_at DESC", [decisionCycleId]);
    const actions = await many(pool, "SELECT * FROM operator_formalization_action_v0 WHERE decision_cycle_id = $1 ORDER BY created_at DESC", [decisionCycleId]);
    const roi = hasRef(refs.roi_entry_id) ? await one(pool, "SELECT * FROM roi_entry_v1 WHERE roi_entry_id = $1 LIMIT 1", [text(refs.roi_entry_id)]) : null;
    const memory = hasRef(refs.field_memory_id) ? await one(pool, "SELECT * FROM field_memory_v1 WHERE memory_id = $1 OR field_memory_id = $1 LIMIT 1", [text(refs.field_memory_id)]) : null;
    return reply.send({ ok: true, object_type: "execution_to_learning_business_closure_v0", decision_cycle_id: decisionCycleId, read_only: true, write_ready: false, downstream_write_ready: false, automatic_business_decision_created: false, automatic_recommendation_created: false, automatic_approval_created: false, automatic_task_created: false, automatic_receipt_created: false, automatic_acceptance_created: false, automatic_roi_created: false, automatic_field_memory_created: false, model_update_created: false, business_closure: { closure_status: closureStatus({ decision, candidate, events, sessions, reviews, actions, roi, memory }), decision_cycle: exposeDecision(decision), production_ingestion_events: events.map(exposeEvent), operator_sessions: sessions.map(exposeSession), operator_reviews: reviews.map(exposeReview), operator_formalization_actions: actions.map(exposeAction), roi_entry: exposeRoi(roi), field_memory: exposeMemory(memory) } });
  });
}

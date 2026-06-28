// apps/server/src/routes/v1/twin_kernel_formalization.ts
// Purpose: expose explicit ROI and Field Memory formalization routes for an existing decision_cycle_v1.
// Boundary: these routes require explicit caller input; they do not create recommendations, approvals, operation plans, AO-ACT tasks, receipts, acceptance records, automatic downstream actions, or model updates.

import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

type Row = Record<string, unknown>;

type FormalizationBody = {
  decision_cycle_id?: unknown;
  decisionCycleId?: unknown;
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

function iso(rowValue: unknown): unknown {
  return rowValue instanceof Date ? rowValue.toISOString() : rowValue;
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

function body(req: any): FormalizationBody {
  return req?.body && typeof req.body === "object" ? (req.body as FormalizationBody) : {};
}

function bodyText(input: FormalizationBody, snake: keyof FormalizationBody, camel: keyof FormalizationBody): string {
  return text(input[snake] ?? input[camel]);
}

function evidenceRefs(input: unknown): Array<Record<string, string>> {
  return recordArray(input).map((item) => ({ kind: text(item.kind), ref_id: text(item.ref_id) })).filter((item) => item.kind && item.ref_id);
}

function parseFormalizedAt(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("INVALID_FORMALIZED_AT");
  return date.toISOString();
}

async function queryOne(pool: Pool, sql: string, values: unknown[]): Promise<Row | null> {
  const result = await pool.query(sql, values);
  return (result.rows[0] as Row | undefined) ?? null;
}

async function readDecisionCycle(pool: Pool, decisionCycleId: string): Promise<Row | null> {
  return queryOne(pool, "SELECT * FROM decision_cycle_v1 WHERE decision_cycle_id = $1 LIMIT 1", [decisionCycleId]);
}

async function readFieldLearningCandidate(pool: Pool, candidateId: string): Promise<Row | null> {
  return queryOne(pool, "SELECT * FROM field_learning_candidate_v1 WHERE field_learning_candidate_id = $1 LIMIT 1", [candidateId]);
}

async function readRoiEntry(pool: Pool, roiEntryId: string): Promise<Row | null> {
  return queryOne(pool, "SELECT * FROM roi_entry_v1 WHERE roi_entry_id = $1 LIMIT 1", [roiEntryId]);
}

async function readFieldMemory(pool: Pool, fieldMemoryId: string): Promise<Row | null> {
  return queryOne(pool, "SELECT * FROM field_memory_v1 WHERE field_memory_id = $1 LIMIT 1", [fieldMemoryId]);
}

function exposeDecisionCycle(row: Row): Row {
  return { decision_cycle_id: row.decision_cycle_id, current_stage: row.current_stage, external_refs_json: row.external_refs_json, state_machine_json: row.state_machine_json, boundary_flags_json: row.boundary_flags_json };
}

function exposeRoiEntry(row: Row): Row {
  return { roi_entry_id: row.roi_entry_id, decision_cycle_id: row.decision_cycle_id, tenant_id: row.tenant_id, project_id: row.project_id, group_id: row.group_id, field_id: row.field_id, as_of_ts: iso(row.as_of_ts), roi_status: row.roi_status, formalized_by: row.formalized_by, formalized_at: iso(row.formalized_at), roi_summary_json: row.roi_summary_json, evidence_refs_json: row.evidence_refs_json, source_object_refs_json: row.source_object_refs_json, created_at: iso(row.created_at) };
}

function exposeFieldMemory(row: Row): Row {
  return { field_memory_id: row.field_memory_id, decision_cycle_id: row.decision_cycle_id, field_learning_candidate_id: row.field_learning_candidate_id, tenant_id: row.tenant_id, project_id: row.project_id, group_id: row.group_id, field_id: row.field_id, as_of_ts: iso(row.as_of_ts), memory_status: row.memory_status, formalized_by: row.formalized_by, formalized_at: iso(row.formalized_at), memory_statement_json: row.memory_statement_json, evidence_refs_json: row.evidence_refs_json, source_object_refs_json: row.source_object_refs_json, model_update_created: row.model_update_created, created_at: iso(row.created_at) };
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

export function registerTwinKernelFormalizationRoutes(app: FastifyInstance, pool: Pool): void {
  app.post("/api/v1/twin-kernel/formalizations/roi", async (req, reply) => {
    const input = body(req);
    const decisionCycleId = bodyText(input, "decision_cycle_id", "decisionCycleId");
    const formalizedBy = bodyText(input, "formalized_by", "formalizedBy");
    const formalizedAtRaw = bodyText(input, "formalized_at", "formalizedAt");
    if (!decisionCycleId) return reply.code(400).send({ ok: false, error: "DECISION_CYCLE_ID_REQUIRED" });
    if (!formalizedBy) return reply.code(400).send({ ok: false, error: "FORMALIZED_BY_REQUIRED" });
    if (!formalizedAtRaw) return reply.code(400).send({ ok: false, error: "FORMALIZED_AT_REQUIRED" });
    let formalizedAt: string;
    try { formalizedAt = parseFormalizedAt(formalizedAtRaw); } catch { return reply.code(400).send({ ok: false, error: "INVALID_FORMALIZED_AT" }); }
    const decisionCycle = await readDecisionCycle(pool, decisionCycleId);
    if (!decisionCycle) return reply.code(404).send({ ok: false, error: "DECISION_CYCLE_NOT_FOUND" });
    const roiEntryId = `roi_${hashPayload({ object_type: "roi_entry_v1", decision_cycle_id: decisionCycleId }).slice(0, 24)}`;
    const sourceRefs = { decision_cycle_id: decisionCycleId, acceptance_id: record(decisionCycle.external_refs_json).acceptance_id ?? null, post_irrigation_verification_id: record(decisionCycle.external_refs_json).post_irrigation_verification_id ?? null };
    const roiSummary = record(input.roi_summary ?? input.roiSummary);
    const refs = evidenceRefs(input.evidence_refs ?? input.evidenceRefs);
    const inserted = await pool.query(
      `INSERT INTO roi_entry_v1 (roi_entry_id,decision_cycle_id,tenant_id,project_id,group_id,field_id,as_of_ts,roi_status,formalized_by,formalized_at,roi_summary_json,evidence_refs_json,source_object_refs_json)
       VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz,$8,$9,$10::timestamptz,$11::jsonb,$12::jsonb,$13::jsonb)
       ON CONFLICT (roi_entry_id) DO NOTHING
       RETURNING *`,
      [roiEntryId, decisionCycleId, decisionCycle.tenant_id, decisionCycle.project_id, decisionCycle.group_id, decisionCycle.field_id, decisionCycle.as_of_ts, "ROI_FORMALIZED", formalizedBy, formalizedAt, JSON.stringify(roiSummary), JSON.stringify(refs), JSON.stringify(sourceRefs)],
    );
    const roiRow = (inserted.rows[0] as Row | undefined) ?? await readRoiEntry(pool, roiEntryId);
    if (!roiRow) return reply.code(500).send({ ok: false, error: "ROI_ENTRY_WRITE_FAILED" });
    const updatedDecision = await updateDecisionCycleFormalRefs(pool, decisionCycleId, { roi_entry_id: roiEntryId }, ["ROI_FORMALIZED"]);
    return reply.send({ ok: true, object_type: "roi_entry_v1", write_ready: true, downstream_write_ready: false, automatic_roi_created: false, roi_entry: exposeRoiEntry(roiRow), decision_cycle: exposeDecisionCycle(updatedDecision) });
  });

  app.post("/api/v1/twin-kernel/formalizations/field-memory", async (req, reply) => {
    const input = body(req);
    const decisionCycleId = bodyText(input, "decision_cycle_id", "decisionCycleId");
    const formalizedBy = bodyText(input, "formalized_by", "formalizedBy");
    const formalizedAtRaw = bodyText(input, "formalized_at", "formalizedAt");
    if (!decisionCycleId) return reply.code(400).send({ ok: false, error: "DECISION_CYCLE_ID_REQUIRED" });
    if (!formalizedBy) return reply.code(400).send({ ok: false, error: "FORMALIZED_BY_REQUIRED" });
    if (!formalizedAtRaw) return reply.code(400).send({ ok: false, error: "FORMALIZED_AT_REQUIRED" });
    let formalizedAt: string;
    try { formalizedAt = parseFormalizedAt(formalizedAtRaw); } catch { return reply.code(400).send({ ok: false, error: "INVALID_FORMALIZED_AT" }); }
    const decisionCycle = await readDecisionCycle(pool, decisionCycleId);
    if (!decisionCycle) return reply.code(404).send({ ok: false, error: "DECISION_CYCLE_NOT_FOUND" });
    const candidateId = text(decisionCycle.field_learning_candidate_id);
    const candidate = await readFieldLearningCandidate(pool, candidateId);
    if (!candidate) return reply.code(404).send({ ok: false, error: "FIELD_LEARNING_CANDIDATE_NOT_FOUND" });
    const fieldMemoryId = `fm_${hashPayload({ object_type: "field_memory_v1", decision_cycle_id: decisionCycleId, field_learning_candidate_id: candidateId }).slice(0, 24)}`;
    const sourceRefs = { decision_cycle_id: decisionCycleId, field_learning_candidate_id: candidateId, calibration_replay_id: decisionCycle.calibration_replay_id ?? null, forecast_error_id: decisionCycle.forecast_error_id ?? null, acceptance_id: record(decisionCycle.external_refs_json).acceptance_id ?? null };
    const memoryStatement = Object.keys(record(input.memory_statement ?? input.memoryStatement)).length > 0 ? record(input.memory_statement ?? input.memoryStatement) : record(candidate.learning_statement_json);
    const refs = evidenceRefs(input.evidence_refs ?? input.evidenceRefs);
    const inserted = await pool.query(
      `INSERT INTO field_memory_v1 (field_memory_id,decision_cycle_id,field_learning_candidate_id,tenant_id,project_id,group_id,field_id,as_of_ts,memory_status,formalized_by,formalized_at,memory_statement_json,evidence_refs_json,source_object_refs_json,model_update_created)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::timestamptz,$9,$10,$11::timestamptz,$12::jsonb,$13::jsonb,$14::jsonb,$15)
       ON CONFLICT (field_memory_id) DO NOTHING
       RETURNING *`,
      [fieldMemoryId, decisionCycleId, candidateId, decisionCycle.tenant_id, decisionCycle.project_id, decisionCycle.group_id, decisionCycle.field_id, decisionCycle.as_of_ts, "FORMAL_MEMORY_WRITTEN", formalizedBy, formalizedAt, JSON.stringify(memoryStatement), JSON.stringify(refs), JSON.stringify(sourceRefs), false],
    );
    const memoryRow = (inserted.rows[0] as Row | undefined) ?? await readFieldMemory(pool, fieldMemoryId);
    if (!memoryRow) return reply.code(500).send({ ok: false, error: "FIELD_MEMORY_WRITE_FAILED" });
    const updatedDecision = await updateDecisionCycleFormalRefs(pool, decisionCycleId, { field_memory_id: fieldMemoryId }, ["MEMORY_CANDIDATE_CREATED", "FORMAL_MEMORY_WRITTEN"]);
    return reply.send({ ok: true, object_type: "field_memory_v1", write_ready: true, downstream_write_ready: false, automatic_field_memory_created: false, model_update_created: false, field_memory: exposeFieldMemory(memoryRow), decision_cycle: exposeDecisionCycle(updatedDecision) });
  });
}

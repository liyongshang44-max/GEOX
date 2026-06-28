// apps/server/src/routes/v1/twin_kernel_production_ingestion.ts
// Purpose: expose TK15 production-shaped source ref ingestion and map those refs into a Twin Kernel decision_cycle_v1.
// Boundary: this route stores source refs and creates only a decision-cycle mapping object; it does not create recommendations, approvals, operation plans, AO-ACT tasks, receipts, acceptance records, ROI entries, Field Memory entries, automatic downstream actions, production policy, or model updates.

import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { buildDecisionCycleV1, type DecisionCalibrationReplayRowV1, type DecisionExternalRefsV1, type DecisionFieldLearningCandidateRowV1, type DecisionForecastErrorRowV1, type DecisionForecastRunRowV1, type DecisionScenarioSetRowV1 } from "../../domain/twin_kernel/decision_cycle_v1.js";

type Row = Record<string, unknown>;

type ProductionIngestionBody = {
  field_learning_candidate_id?: unknown;
  fieldLearningCandidateId?: unknown;
  source_system?: unknown;
  sourceSystem?: unknown;
  source_event_id?: unknown;
  sourceEventId?: unknown;
  occurred_at?: unknown;
  occurredAt?: unknown;
  ingested_by?: unknown;
  ingestedBy?: unknown;
  ingested_at?: unknown;
  ingestedAt?: unknown;
  source_refs?: unknown;
  sourceRefs?: unknown;
  production_source_refs?: unknown;
  productionSourceRefs?: unknown;
};

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const candidate = text(value);
    if (candidate) return candidate;
  }
  return "";
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
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

function body(req: any): ProductionIngestionBody {
  return req?.body && typeof req.body === "object" ? (req.body as ProductionIngestionBody) : {};
}

function bodyText(input: ProductionIngestionBody, snake: keyof ProductionIngestionBody, camel: keyof ProductionIngestionBody): string {
  return text(input[snake] ?? input[camel]);
}

function parseTs(value: string, errorCode: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error(errorCode);
  return date.toISOString();
}

function sourceRefs(input: ProductionIngestionBody): Record<string, unknown> {
  return record(input.source_refs ?? input.sourceRefs ?? input.production_source_refs ?? input.productionSourceRefs);
}

function refText(refs: Record<string, unknown>, ...keys: string[]): string {
  return firstText(...keys.map((key) => refs[key]));
}

function mapProductionRefs(refs: Record<string, unknown>): DecisionExternalRefsV1 {
  return {
    recommendation_id: refText(refs, "recommendation_ref_id", "recommendationRefId", "recommendation_id", "recommendationId"),
    approval_id: refText(refs, "approval_ref_id", "approvalRefId", "approval_id", "approvalId"),
    operation_plan_id: refText(refs, "operation_plan_ref_id", "operationPlanRefId", "operation_plan_id", "operationPlanId"),
    act_task_id: refText(refs, "task_ref_id", "taskRefId", "act_task_id", "actTaskId"),
    receipt_id: refText(refs, "receipt_ref_id", "receiptRefId", "receipt_id", "receiptId"),
    as_executed_id: firstText(refText(refs, "as_executed_ref_id", "asExecutedRefId", "as_executed_id", "asExecutedId"), refText(refs, "observation_ref_id", "observationRefId", "observation_id", "observationId")),
    acceptance_id: refText(refs, "acceptance_ref_id", "acceptanceRefId", "acceptance_id", "acceptanceId"),
    post_irrigation_verification_id: refText(refs, "verification_ref_id", "verificationRefId", "post_irrigation_verification_id", "postIrrigationVerificationId"),
  };
}

function cleanMappedRefs(refs: DecisionExternalRefsV1): Record<string, string | null> {
  return {
    recommendation_id: text(refs.recommendation_id) || null,
    approval_id: text(refs.approval_id) || null,
    operation_plan_id: text(refs.operation_plan_id) || null,
    act_task_id: text(refs.act_task_id) || null,
    receipt_id: text(refs.receipt_id) || null,
    as_executed_id: text(refs.as_executed_id) || null,
    acceptance_id: text(refs.acceptance_id) || null,
    post_irrigation_verification_id: text(refs.post_irrigation_verification_id) || null,
    roi_entry_id: null,
    field_memory_id: null,
  };
}

function boundaryFlags(): Record<string, boolean> {
  return {
    production_ingestion_only: true,
    automatic_recommendation_created: false,
    automatic_approval_created: false,
    automatic_task_created: false,
    automatic_receipt_created: false,
    automatic_acceptance_created: false,
    automatic_roi_created: false,
    automatic_field_memory_created: false,
    model_updated: false,
  };
}

async function queryOne(pool: Pool, sql: string, values: unknown[]): Promise<Row | null> {
  const result = await pool.query(sql, values);
  return (result.rows[0] as Row | undefined) ?? null;
}

async function readForecastRun(pool: Pool, forecastRunId: string): Promise<Row | null> {
  return queryOne(pool, "SELECT * FROM forecast_run_v1 WHERE forecast_run_id = $1 LIMIT 1", [forecastRunId]);
}

async function readScenarioSet(pool: Pool, scenarioSetId: string): Promise<Row | null> {
  return queryOne(pool, "SELECT * FROM scenario_set_v1 WHERE scenario_set_id = $1 LIMIT 1", [scenarioSetId]);
}

async function readCalibrationReplay(pool: Pool, replayId: string): Promise<Row | null> {
  return queryOne(pool, "SELECT * FROM calibration_replay_v1 WHERE calibration_replay_id = $1 LIMIT 1", [replayId]);
}

async function readForecastError(pool: Pool, errorId: string): Promise<Row | null> {
  return queryOne(pool, "SELECT * FROM forecast_error_v1 WHERE forecast_error_id = $1 LIMIT 1", [errorId]);
}

async function readFieldLearningCandidate(pool: Pool, candidateId: string): Promise<Row | null> {
  return queryOne(pool, "SELECT * FROM field_learning_candidate_v1 WHERE field_learning_candidate_id = $1 LIMIT 1", [candidateId]);
}

async function readDecisionCycle(pool: Pool, decisionCycleId: string): Promise<Row | null> {
  return queryOne(pool, "SELECT * FROM decision_cycle_v1 WHERE decision_cycle_id = $1 LIMIT 1", [decisionCycleId]);
}

async function readProductionIngestionEvent(pool: Pool, eventId: string): Promise<Row | null> {
  return queryOne(pool, "SELECT * FROM production_ingestion_event_v0 WHERE production_ingestion_event_id = $1 LIMIT 1", [eventId]);
}

function toDecisionForecastRunRow(row: Row): DecisionForecastRunRowV1 {
  return { forecast_run_id: text(row.forecast_run_id), snapshot_id: text(row.snapshot_id), tenant_id: text(row.tenant_id), project_id: text(row.project_id), group_id: text(row.group_id), field_id: text(row.field_id), as_of_ts: row.as_of_ts instanceof Date ? row.as_of_ts.toISOString() : text(row.as_of_ts), status: text(row.status), determinism_hash: text(row.determinism_hash) };
}

function toDecisionScenarioSetRow(row: Row): DecisionScenarioSetRowV1 {
  return { scenario_set_id: text(row.scenario_set_id), forecast_run_id: text(row.forecast_run_id), tenant_id: text(row.tenant_id), project_id: text(row.project_id), group_id: text(row.group_id), field_id: text(row.field_id), as_of_ts: row.as_of_ts instanceof Date ? row.as_of_ts.toISOString() : text(row.as_of_ts), status: text(row.status), determinism_hash: text(row.determinism_hash) };
}

function toDecisionCalibrationReplayRow(row: Row): DecisionCalibrationReplayRowV1 {
  return { calibration_replay_id: text(row.calibration_replay_id), forecast_run_id: text(row.forecast_run_id), scenario_set_id: text(row.scenario_set_id), tenant_id: text(row.tenant_id), project_id: text(row.project_id), group_id: text(row.group_id), field_id: text(row.field_id), as_of_ts: row.as_of_ts instanceof Date ? row.as_of_ts.toISOString() : text(row.as_of_ts), status: text(row.status), determinism_hash: text(row.determinism_hash) };
}

function toDecisionForecastErrorRow(row: Row): DecisionForecastErrorRowV1 {
  return { forecast_error_id: text(row.forecast_error_id), calibration_replay_id: text(row.calibration_replay_id), forecast_run_id: text(row.forecast_run_id), scenario_set_id: text(row.scenario_set_id), tenant_id: text(row.tenant_id), project_id: text(row.project_id), group_id: text(row.group_id), field_id: text(row.field_id), as_of_ts: row.as_of_ts instanceof Date ? row.as_of_ts.toISOString() : text(row.as_of_ts), error_direction: text(row.error_direction), determinism_hash: text(row.determinism_hash) };
}

function toDecisionFieldLearningCandidateRow(row: Row): DecisionFieldLearningCandidateRowV1 {
  return { field_learning_candidate_id: text(row.field_learning_candidate_id), calibration_replay_id: text(row.calibration_replay_id), forecast_error_id: text(row.forecast_error_id), tenant_id: text(row.tenant_id), project_id: text(row.project_id), group_id: text(row.group_id), field_id: text(row.field_id), as_of_ts: row.as_of_ts instanceof Date ? row.as_of_ts.toISOString() : text(row.as_of_ts), candidate_status: text(row.candidate_status), determinism_hash: text(row.determinism_hash) };
}

function exposeDecisionCycle(row: Row): Row {
  return { decision_cycle_id: row.decision_cycle_id, cycle_status: row.cycle_status, current_stage: row.current_stage, external_refs_json: row.external_refs_json, boundary_flags_json: row.boundary_flags_json, blocking_reasons_json: row.blocking_reasons_json, determinism_hash: row.determinism_hash };
}

function exposeProductionIngestionEvent(row: Row): Row {
  return { production_ingestion_event_id: row.production_ingestion_event_id, source_contract_version: row.source_contract_version, source_system: row.source_system, source_event_id: row.source_event_id, field_learning_candidate_id: row.field_learning_candidate_id, decision_cycle_id: row.decision_cycle_id, tenant_id: row.tenant_id, project_id: row.project_id, group_id: row.group_id, field_id: row.field_id, as_of_ts: iso(row.as_of_ts), occurred_at: iso(row.occurred_at), ingested_by: row.ingested_by, ingested_at: iso(row.ingested_at), raw_source_refs_json: row.raw_source_refs_json, mapped_external_refs_json: row.mapped_external_refs_json, boundary_flags_json: row.boundary_flags_json, created_at: iso(row.created_at) };
}

async function insertDecisionCycle(pool: Pool, decisionCycle: ReturnType<typeof buildDecisionCycleV1>): Promise<Row> {
  const result = await pool.query(
    `INSERT INTO decision_cycle_v1 (decision_cycle_id,snapshot_id,forecast_run_id,scenario_set_id,calibration_replay_id,forecast_error_id,field_learning_candidate_id,tenant_id,project_id,group_id,field_id,as_of_ts,cycle_status,current_stage,external_refs_json,state_machine_json,human_gate_json,boundary_flags_json,blocking_reasons_json,determinism_hash)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::timestamptz,$13,$14,$15::jsonb,$16::jsonb,$17::jsonb,$18::jsonb,$19::jsonb,$20)
     ON CONFLICT (decision_cycle_id) DO NOTHING
     RETURNING *`,
    [decisionCycle.decision_cycle_id, decisionCycle.snapshot_id, decisionCycle.forecast_run_id, decisionCycle.scenario_set_id, decisionCycle.calibration_replay_id, decisionCycle.forecast_error_id, decisionCycle.field_learning_candidate_id, decisionCycle.tenant_id, decisionCycle.project_id, decisionCycle.group_id, decisionCycle.field_id, decisionCycle.as_of_ts, decisionCycle.cycle_status, decisionCycle.current_stage, JSON.stringify(decisionCycle.external_refs_json), JSON.stringify(decisionCycle.state_machine_json), JSON.stringify(decisionCycle.human_gate_json), JSON.stringify(decisionCycle.boundary_flags_json), JSON.stringify(decisionCycle.blocking_reasons_json), decisionCycle.determinism_hash],
  );
  if (result.rows[0]) return result.rows[0] as Row;
  const existing = await readDecisionCycle(pool, decisionCycle.decision_cycle_id);
  if (!existing) throw new Error("DECISION_CYCLE_INSERT_FAILED");
  return existing;
}

async function insertProductionIngestionEvent(pool: Pool, input: { eventId: string; sourceSystem: string; sourceEventId: string; candidate: Row; occurredAt: string | null; ingestedBy: string; ingestedAt: string; rawRefs: Record<string, unknown>; mappedRefs: Record<string, string | null> }): Promise<Row> {
  const result = await pool.query(
    `INSERT INTO production_ingestion_event_v0 (production_ingestion_event_id,source_system,source_event_id,field_learning_candidate_id,tenant_id,project_id,group_id,field_id,as_of_ts,occurred_at,ingested_by,ingested_at,raw_source_refs_json,mapped_external_refs_json,boundary_flags_json)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::timestamptz,$10::timestamptz,$11,$12::timestamptz,$13::jsonb,$14::jsonb,$15::jsonb)
     ON CONFLICT (production_ingestion_event_id) DO NOTHING
     RETURNING *`,
    [input.eventId, input.sourceSystem, input.sourceEventId, input.candidate.field_learning_candidate_id, input.candidate.tenant_id, input.candidate.project_id, input.candidate.group_id, input.candidate.field_id, input.candidate.as_of_ts, input.occurredAt, input.ingestedBy, input.ingestedAt, JSON.stringify(input.rawRefs), JSON.stringify(input.mappedRefs), JSON.stringify(boundaryFlags())],
  );
  const event = (result.rows[0] as Row | undefined) ?? await readProductionIngestionEvent(pool, input.eventId);
  if (!event) throw new Error("PRODUCTION_INGESTION_EVENT_WRITE_FAILED");
  return event;
}

async function updateIngestionDecisionCycle(pool: Pool, eventId: string, decisionCycleId: string): Promise<Row> {
  const result = await pool.query(
    `UPDATE production_ingestion_event_v0
     SET decision_cycle_id = $2
     WHERE production_ingestion_event_id = $1
     RETURNING *`,
    [eventId, decisionCycleId],
  );
  const event = result.rows[0] as Row | undefined;
  if (!event) throw new Error("PRODUCTION_INGESTION_EVENT_LINK_FAILED");
  return event;
}

export function registerTwinKernelProductionIngestionRoutes(app: FastifyInstance, pool: Pool): void {
  app.post("/api/v1/twin-kernel/production-ingestion/source-refs", async (req, reply) => {
    const input = body(req);
    const candidateId = bodyText(input, "field_learning_candidate_id", "fieldLearningCandidateId");
    const sourceSystem = bodyText(input, "source_system", "sourceSystem");
    const sourceEventIdRaw = bodyText(input, "source_event_id", "sourceEventId");
    const ingestedBy = bodyText(input, "ingested_by", "ingestedBy");
    const ingestedAtRaw = bodyText(input, "ingested_at", "ingestedAt");
    const occurredAtRaw = bodyText(input, "occurred_at", "occurredAt");
    if (!candidateId) return reply.code(400).send({ ok: false, error: "FIELD_LEARNING_CANDIDATE_ID_REQUIRED" });
    if (!sourceSystem) return reply.code(400).send({ ok: false, error: "SOURCE_SYSTEM_REQUIRED" });
    if (!ingestedBy) return reply.code(400).send({ ok: false, error: "INGESTED_BY_REQUIRED" });
    if (!ingestedAtRaw) return reply.code(400).send({ ok: false, error: "INGESTED_AT_REQUIRED" });
    let ingestedAt: string;
    let occurredAt: string | null = null;
    try { ingestedAt = parseTs(ingestedAtRaw, "INVALID_INGESTED_AT"); } catch { return reply.code(400).send({ ok: false, error: "INVALID_INGESTED_AT" }); }
    if (occurredAtRaw) {
      try { occurredAt = parseTs(occurredAtRaw, "INVALID_OCCURRED_AT"); } catch { return reply.code(400).send({ ok: false, error: "INVALID_OCCURRED_AT" }); }
    }
    const rawRefs = sourceRefs(input);
    const decisionRefs = mapProductionRefs(rawRefs);
    const mappedRefs = cleanMappedRefs(decisionRefs);
    const candidate = await readFieldLearningCandidate(pool, candidateId);
    if (!candidate) return reply.code(404).send({ ok: false, error: "FIELD_LEARNING_CANDIDATE_NOT_FOUND" });
    const forecastError = await readForecastError(pool, text(candidate.forecast_error_id));
    if (!forecastError) return reply.code(404).send({ ok: false, error: "FORECAST_ERROR_NOT_FOUND" });
    const calibrationReplay = await readCalibrationReplay(pool, text(candidate.calibration_replay_id));
    if (!calibrationReplay) return reply.code(404).send({ ok: false, error: "CALIBRATION_REPLAY_NOT_FOUND" });
    const scenarioSet = await readScenarioSet(pool, text(calibrationReplay.scenario_set_id));
    if (!scenarioSet) return reply.code(404).send({ ok: false, error: "SCENARIO_SET_NOT_FOUND" });
    const forecastRun = await readForecastRun(pool, text(forecastError.forecast_run_id));
    if (!forecastRun) return reply.code(404).send({ ok: false, error: "FORECAST_RUN_NOT_FOUND" });
    const sourceEventId = sourceEventIdRaw || `prod_evt_${hashPayload({ source_system: sourceSystem, field_learning_candidate_id: candidateId, source_refs: rawRefs, ingested_at: ingestedAt }).slice(0, 24)}`;
    const eventId = `ping_${hashPayload({ object_type: "production_ingestion_event_v0", source_system: sourceSystem, source_event_id: sourceEventId }).slice(0, 24)}`;
    const ingestionEvent = await insertProductionIngestionEvent(pool, { eventId, sourceSystem, sourceEventId, candidate, occurredAt, ingestedBy, ingestedAt, rawRefs, mappedRefs });
    const decisionCycle = buildDecisionCycleV1({ forecastRun: toDecisionForecastRunRow(forecastRun), scenarioSet: toDecisionScenarioSetRow(scenarioSet), calibrationReplay: toDecisionCalibrationReplayRow(calibrationReplay), forecastError: toDecisionForecastErrorRow(forecastError), fieldLearningCandidate: toDecisionFieldLearningCandidateRow(candidate), external_refs: decisionRefs });
    const decisionCycleRow = await insertDecisionCycle(pool, decisionCycle);
    const linkedEvent = await updateIngestionDecisionCycle(pool, eventId, text(decisionCycleRow.decision_cycle_id));
    return reply.send({ ok: true, object_type: "production_ingestion_event_v0", companion_object_type: "decision_cycle_v1", write_ready: true, downstream_write_ready: false, automatic_business_decision_created: false, automatic_recommendation_created: false, automatic_approval_created: false, automatic_task_created: false, automatic_receipt_created: false, automatic_acceptance_created: false, automatic_roi_created: false, automatic_field_memory_created: false, model_update_created: false, production_ingestion_event: exposeProductionIngestionEvent(linkedEvent), decision_cycle: exposeDecisionCycle(decisionCycleRow) });
  });
}

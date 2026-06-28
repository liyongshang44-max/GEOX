// apps/server/src/routes/v1/twin_kernel.ts
// Purpose: expose minimal Twin Kernel write/read routes from state snapshot through TK6 decision cycle.
// Boundary: these routes do not write recommendations, approvals, tasks, receipts, acceptance, ROI, Field Memory, model parameters, or downstream operations.

import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { buildFieldStateSnapshotV1, type FieldStateSnapshotScopeV1 } from "../../domain/twin_kernel/field_state_snapshot_v1.js";
import { buildForecastRunV1, type ForecastRunSnapshotRowV1 } from "../../domain/twin_kernel/forecast_run_v1.js";
import { buildScenarioSetV1, type ScenarioSetForecastRunRowV1 } from "../../domain/twin_kernel/scenario_set_v1.js";
import { buildCalibrationReplayAndForecastErrorV1, type CalibrationForecastRunRowV1, type CalibrationObservedPayloadV1, type CalibrationScenarioSetRowV1 } from "../../domain/twin_kernel/calibration_replay_v1.js";
import { buildFieldLearningCandidateV1, type FieldLearningCalibrationReplayRowV1, type FieldLearningForecastErrorRowV1, type FieldLearningFormalGateRefsV1 } from "../../domain/twin_kernel/field_learning_candidate_v1.js";
import { buildDecisionCycleV1, type DecisionCalibrationReplayRowV1, type DecisionExternalRefsV1, type DecisionFieldLearningCandidateRowV1, type DecisionForecastErrorRowV1, type DecisionForecastRunRowV1, type DecisionScenarioSetRowV1 } from "../../domain/twin_kernel/decision_cycle_v1.js";

type Row = Record<string, unknown>;

type SnapshotRequestBody = {
  tenant_id?: unknown;
  tenantId?: unknown;
  project_id?: unknown;
  projectId?: unknown;
  group_id?: unknown;
  groupId?: unknown;
  field_id?: unknown;
  fieldId?: unknown;
  season_id?: unknown;
  seasonId?: unknown;
  as_of_ts?: unknown;
  asOfTs?: unknown;
};

type TwinKernelRequestBody = SnapshotRequestBody & {
  snapshot_id?: unknown;
  snapshotId?: unknown;
  forecast_run_id?: unknown;
  forecastRunId?: unknown;
  scenario_set_id?: unknown;
  scenarioSetId?: unknown;
  calibration_replay_id?: unknown;
  calibrationReplayId?: unknown;
  forecast_error_id?: unknown;
  forecastErrorId?: unknown;
  field_learning_candidate_id?: unknown;
  fieldLearningCandidateId?: unknown;
  decision_cycle_id?: unknown;
  decisionCycleId?: unknown;
  selected_option_id?: unknown;
  selectedOptionId?: unknown;
  model_version?: unknown;
  modelVersion?: unknown;
  scenario_model_version?: unknown;
  scenarioModelVersion?: unknown;
  observed?: unknown;
  observed_at?: unknown;
  observedAt?: unknown;
  post_soil_moisture_percent?: unknown;
  postSoilMoisturePercent?: unknown;
  observed_water_state?: unknown;
  observedWaterState?: unknown;
  verification_ref_id?: unknown;
  verificationRefId?: unknown;
  evidence_refs?: unknown;
  evidenceRefs?: unknown;
  formal_gate_refs?: unknown;
  formalGateRefs?: unknown;
  acceptance_id?: unknown;
  acceptanceId?: unknown;
  post_irrigation_verification_id?: unknown;
  postIrrigationVerificationId?: unknown;
  formal_evidence_ref_id?: unknown;
  formalEvidenceRefId?: unknown;
  external_refs?: unknown;
  externalRefs?: unknown;
  recommendation_id?: unknown;
  recommendationId?: unknown;
  approval_id?: unknown;
  approvalId?: unknown;
  operation_plan_id?: unknown;
  operationPlanId?: unknown;
  act_task_id?: unknown;
  actTaskId?: unknown;
  receipt_id?: unknown;
  receiptId?: unknown;
  as_executed_id?: unknown;
  asExecutedId?: unknown;
  roi_entry_id?: unknown;
  roiEntryId?: unknown;
  field_memory_id?: unknown;
  fieldMemoryId?: unknown;
};

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const raw = text(value);
    if (raw) return raw;
  }
  return "";
}

function numberOrUndefined(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function recordArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? (value.filter((item) => item && typeof item === "object") as Array<Record<string, unknown>>) : [];
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => text(item)).filter(Boolean) : [];
}

function evidenceArray(value: unknown): Array<Record<string, string>> {
  return Array.isArray(value) ? (value.filter((item) => item && typeof item === "object") as Array<Record<string, string>>) : [];
}

function queryValue(req: any, key: string): unknown {
  return req?.query?.[key] ?? req?.query?.[key.replace(/_([a-z])/g, (_match: string, letter: string) => letter.toUpperCase())];
}

function headerValue(req: any, key: string): unknown {
  return req?.headers?.[key] ?? req?.headers?.[key.toLowerCase()];
}

function bodyValue(body: SnapshotRequestBody, snakeKey: keyof SnapshotRequestBody, camelKey: keyof SnapshotRequestBody): unknown {
  return body[snakeKey] ?? body[camelKey];
}

function extractBody(req: any): TwinKernelRequestBody {
  return req?.body && typeof req.body === "object" ? (req.body as TwinKernelRequestBody) : {};
}

function extractScope(req: any): FieldStateSnapshotScopeV1 | null {
  const body = extractBody(req);
  const tenant_id = firstText(bodyValue(body, "tenant_id", "tenantId"), queryValue(req, "tenant_id"), headerValue(req, "x-tenant-id"));
  const project_id = firstText(bodyValue(body, "project_id", "projectId"), queryValue(req, "project_id"), headerValue(req, "x-project-id"));
  const group_id = firstText(bodyValue(body, "group_id", "groupId"), queryValue(req, "group_id"), headerValue(req, "x-group-id"));
  const field_id = firstText(bodyValue(body, "field_id", "fieldId"), queryValue(req, "field_id"));
  if (!tenant_id || !project_id || !group_id || !field_id) return null;
  return { tenant_id, project_id, group_id, field_id };
}

function extractAsOfTs(req: any): string {
  const body = extractBody(req);
  const raw = firstText(bodyValue(body, "as_of_ts", "asOfTs"), queryValue(req, "as_of_ts"));
  const date = raw ? new Date(raw) : new Date();
  if (!Number.isFinite(date.getTime())) throw new Error("INVALID_AS_OF_TS");
  return date.toISOString();
}

function extractSeasonId(req: any): string | null {
  const body = extractBody(req);
  return firstText(bodyValue(body, "season_id", "seasonId"), queryValue(req, "season_id")) || null;
}

function extractSnapshotId(req: any): string {
  const body = extractBody(req);
  return firstText(body.snapshot_id, body.snapshotId, queryValue(req, "snapshot_id"));
}

function extractForecastRunId(req: any): string {
  const body = extractBody(req);
  return firstText(body.forecast_run_id, body.forecastRunId, queryValue(req, "forecast_run_id"));
}

function extractScenarioSetId(req: any): string {
  const body = extractBody(req);
  return firstText(body.scenario_set_id, body.scenarioSetId, queryValue(req, "scenario_set_id"));
}

function extractSelectedOptionId(req: any): string | null {
  const body = extractBody(req);
  return firstText(body.selected_option_id, body.selectedOptionId, queryValue(req, "selected_option_id")) || null;
}

function extractForecastErrorId(req: any): string {
  const body = extractBody(req);
  return firstText(body.forecast_error_id, body.forecastErrorId, queryValue(req, "forecast_error_id"));
}

function extractFieldLearningCandidateId(req: any): string {
  const body = extractBody(req);
  return firstText(body.field_learning_candidate_id, body.fieldLearningCandidateId, queryValue(req, "field_learning_candidate_id"));
}

function extractDecisionCycleId(req: any): string {
  const body = extractBody(req);
  return firstText(body.decision_cycle_id, body.decisionCycleId, queryValue(req, "decision_cycle_id"));
}

function extractModelVersion(req: any): string | null {
  const body = extractBody(req);
  return firstText(body.model_version, body.modelVersion, queryValue(req, "model_version")) || null;
}

function extractScenarioModelVersion(req: any): string | null {
  const body = extractBody(req);
  return firstText(body.scenario_model_version, body.scenarioModelVersion, queryValue(req, "scenario_model_version")) || null;
}

function extractObservedPayload(req: any): CalibrationObservedPayloadV1 {
  const body = extractBody(req);
  const nested = record(body.observed);
  return {
    observed_at: firstText(nested.observed_at, nested.observedAt, body.observed_at, body.observedAt),
    post_soil_moisture_percent: numberOrUndefined(nested.post_soil_moisture_percent ?? nested.postSoilMoisturePercent ?? body.post_soil_moisture_percent ?? body.postSoilMoisturePercent),
    observed_water_state: firstText(nested.observed_water_state, nested.observedWaterState, body.observed_water_state, body.observedWaterState),
    verification_ref_id: firstText(nested.verification_ref_id, nested.verificationRefId, body.verification_ref_id, body.verificationRefId),
    evidence_refs: evidenceArray(nested.evidence_refs ?? nested.evidenceRefs ?? body.evidence_refs ?? body.evidenceRefs),
  };
}

function extractFormalGateRefs(req: any): FieldLearningFormalGateRefsV1 {
  const body = extractBody(req);
  const nested = record(body.formal_gate_refs ?? body.formalGateRefs);
  return {
    acceptance_id: firstText(nested.acceptance_id, nested.acceptanceId, body.acceptance_id, body.acceptanceId),
    post_irrigation_verification_id: firstText(nested.post_irrigation_verification_id, nested.postIrrigationVerificationId, body.post_irrigation_verification_id, body.postIrrigationVerificationId),
    formal_evidence_ref_id: firstText(nested.formal_evidence_ref_id, nested.formalEvidenceRefId, body.formal_evidence_ref_id, body.formalEvidenceRefId),
    field_memory_gate_route: firstText(nested.field_memory_gate_route, nested.fieldMemoryGateRoute),
    evidence_refs: evidenceArray(nested.evidence_refs ?? nested.evidenceRefs ?? body.evidence_refs ?? body.evidenceRefs),
  };
}

function extractDecisionExternalRefs(req: any): DecisionExternalRefsV1 {
  const body = extractBody(req);
  const nested = record(body.external_refs ?? body.externalRefs);
  return {
    recommendation_id: firstText(nested.recommendation_id, nested.recommendationId, body.recommendation_id, body.recommendationId),
    approval_id: firstText(nested.approval_id, nested.approvalId, body.approval_id, body.approvalId),
    operation_plan_id: firstText(nested.operation_plan_id, nested.operationPlanId, body.operation_plan_id, body.operationPlanId),
    act_task_id: firstText(nested.act_task_id, nested.actTaskId, body.act_task_id, body.actTaskId),
    receipt_id: firstText(nested.receipt_id, nested.receiptId, body.receipt_id, body.receiptId),
    as_executed_id: firstText(nested.as_executed_id, nested.asExecutedId, body.as_executed_id, body.asExecutedId),
    acceptance_id: firstText(nested.acceptance_id, nested.acceptanceId, body.acceptance_id, body.acceptanceId),
    post_irrigation_verification_id: firstText(nested.post_irrigation_verification_id, nested.postIrrigationVerificationId, body.post_irrigation_verification_id, body.postIrrigationVerificationId),
    roi_entry_id: firstText(nested.roi_entry_id, nested.roiEntryId, body.roi_entry_id, body.roiEntryId),
    field_memory_id: firstText(nested.field_memory_id, nested.fieldMemoryId, body.field_memory_id, body.fieldMemoryId),
  };
}

async function queryOne(pool: Pool, sql: string, values: unknown[]): Promise<Row | null> {
  const result = await pool.query(sql, values).catch(() => ({ rows: [] as Row[] }));
  return result.rows[0] ?? null;
}

async function readFieldRow(pool: Pool, scope: FieldStateSnapshotScopeV1): Promise<Row | null> {
  return queryOne(pool, `SELECT * FROM field_index_v1 WHERE tenant_id = $1 AND project_id = $2 AND group_id = $3 AND field_id = $4 LIMIT 1`, [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id]);
}

async function readWaterRow(pool: Pool, scope: FieldStateSnapshotScopeV1): Promise<Row | null> {
  return queryOne(pool, `SELECT * FROM water_state_estimate_index_v1 WHERE tenant_id = $1 AND project_id = $2 AND group_id = $3 AND field_id = $4 ORDER BY computed_at DESC NULLS LAST LIMIT 1`, [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id]);
}

async function readSensingRow(pool: Pool, scope: FieldStateSnapshotScopeV1): Promise<Row | null> {
  return queryOne(pool, `SELECT * FROM soil_moisture_sensing_window_index_v1 WHERE tenant_id = $1 AND project_id = $2 AND group_id = $3 AND field_id = $4 ORDER BY updated_at DESC NULLS LAST, window_end DESC NULLS LAST, created_at DESC NULLS LAST LIMIT 1`, [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id]);
}

async function readWeatherRow(pool: Pool, scope: FieldStateSnapshotScopeV1): Promise<Row | null> {
  return queryOne(pool, `SELECT * FROM weather_forecast_index_v1 WHERE tenant_id = $1 AND project_id = $2 AND group_id = $3 AND field_id = $4 ORDER BY generated_at DESC NULLS LAST LIMIT 1`, [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id]);
}

async function readSnapshotRow(pool: Pool, snapshotId: string): Promise<Row | null> {
  return queryOne(pool, "SELECT * FROM field_state_snapshot_v1 WHERE snapshot_id = $1 LIMIT 1", [snapshotId]);
}

async function readForecastRunRow(pool: Pool, forecastRunId: string): Promise<Row | null> {
  return queryOne(pool, "SELECT * FROM forecast_run_v1 WHERE forecast_run_id = $1 LIMIT 1", [forecastRunId]);
}

async function readScenarioSetRow(pool: Pool, scenarioSetId: string): Promise<Row | null> {
  return queryOne(pool, "SELECT * FROM scenario_set_v1 WHERE scenario_set_id = $1 LIMIT 1", [scenarioSetId]);
}

async function readCalibrationReplayRow(pool: Pool, replayId: string): Promise<Row | null> {
  return queryOne(pool, "SELECT * FROM calibration_replay_v1 WHERE calibration_replay_id = $1 LIMIT 1", [replayId]);
}

async function readForecastErrorRow(pool: Pool, errorId: string): Promise<Row | null> {
  return queryOne(pool, "SELECT * FROM forecast_error_v1 WHERE forecast_error_id = $1 LIMIT 1", [errorId]);
}

async function readFieldLearningCandidateRow(pool: Pool, candidateId: string): Promise<Row | null> {
  return queryOne(pool, "SELECT * FROM field_learning_candidate_v1 WHERE field_learning_candidate_id = $1 LIMIT 1", [candidateId]);
}

async function readDecisionCycleRow(pool: Pool, cycleId: string): Promise<Row | null> {
  return queryOne(pool, "SELECT * FROM decision_cycle_v1 WHERE decision_cycle_id = $1 LIMIT 1", [cycleId]);
}

function toForecastRunSnapshotRow(row: Row): ForecastRunSnapshotRowV1 {
  return { snapshot_id: firstText(row.snapshot_id), tenant_id: firstText(row.tenant_id), project_id: firstText(row.project_id), group_id: firstText(row.group_id), field_id: firstText(row.field_id), as_of_ts: row.as_of_ts instanceof Date ? row.as_of_ts.toISOString() : firstText(row.as_of_ts), status: firstText(row.status), state_vector_json: record(row.state_vector_json), confidence_json: record(row.confidence_json), evidence_refs_json: evidenceArray(row.evidence_refs_json), determinism_hash: firstText(row.determinism_hash) };
}

function toScenarioSetForecastRunRow(row: Row): ScenarioSetForecastRunRowV1 {
  return { forecast_run_id: firstText(row.forecast_run_id), tenant_id: firstText(row.tenant_id), project_id: firstText(row.project_id), group_id: firstText(row.group_id), field_id: firstText(row.field_id), as_of_ts: row.as_of_ts instanceof Date ? row.as_of_ts.toISOString() : firstText(row.as_of_ts), horizon_days: Number(row.horizon_days), model_version: firstText(row.model_version), status: firstText(row.status), forecast_points_json: recordArray(row.forecast_points_json), risk_timeline_json: recordArray(row.risk_timeline_json), uncertainty_json: record(row.uncertainty_json), assumptions_json: record(row.assumptions_json), determinism_hash: firstText(row.determinism_hash) };
}

function toCalibrationForecastRunRow(row: Row): CalibrationForecastRunRowV1 {
  return { forecast_run_id: firstText(row.forecast_run_id), tenant_id: firstText(row.tenant_id), project_id: firstText(row.project_id), group_id: firstText(row.group_id), field_id: firstText(row.field_id), as_of_ts: row.as_of_ts instanceof Date ? row.as_of_ts.toISOString() : firstText(row.as_of_ts), status: firstText(row.status), forecast_points_json: recordArray(row.forecast_points_json), risk_timeline_json: recordArray(row.risk_timeline_json), determinism_hash: firstText(row.determinism_hash) };
}

function toCalibrationScenarioSetRow(row: Row): CalibrationScenarioSetRowV1 {
  return { scenario_set_id: firstText(row.scenario_set_id), forecast_run_id: firstText(row.forecast_run_id), tenant_id: firstText(row.tenant_id), project_id: firstText(row.project_id), group_id: firstText(row.group_id), field_id: firstText(row.field_id), as_of_ts: row.as_of_ts instanceof Date ? row.as_of_ts.toISOString() : firstText(row.as_of_ts), status: firstText(row.status), baseline_scenario_json: record(row.baseline_scenario_json), option_scenarios_json: recordArray(row.option_scenarios_json), determinism_hash: firstText(row.determinism_hash) };
}

function toFieldLearningCalibrationReplayRow(row: Row): FieldLearningCalibrationReplayRowV1 {
  return { calibration_replay_id: firstText(row.calibration_replay_id), forecast_run_id: firstText(row.forecast_run_id), scenario_set_id: firstText(row.scenario_set_id), tenant_id: firstText(row.tenant_id), project_id: firstText(row.project_id), group_id: firstText(row.group_id), field_id: firstText(row.field_id), as_of_ts: row.as_of_ts instanceof Date ? row.as_of_ts.toISOString() : firstText(row.as_of_ts), status: firstText(row.status), selected_option_id: firstText(row.selected_option_id) || null, predicted_json: record(row.predicted_json), observed_json: record(row.observed_json), error_summary_json: record(row.error_summary_json), reason_candidates_json: recordArray(row.reason_candidates_json), evidence_refs_json: evidenceArray(row.evidence_refs_json), blocking_reasons_json: stringArray(row.blocking_reasons_json), determinism_hash: firstText(row.determinism_hash) };
}

function toFieldLearningForecastErrorRow(row: Row): FieldLearningForecastErrorRowV1 {
  return { forecast_error_id: firstText(row.forecast_error_id), calibration_replay_id: firstText(row.calibration_replay_id), forecast_run_id: firstText(row.forecast_run_id), scenario_set_id: firstText(row.scenario_set_id), tenant_id: firstText(row.tenant_id), project_id: firstText(row.project_id), group_id: firstText(row.group_id), field_id: firstText(row.field_id), as_of_ts: row.as_of_ts instanceof Date ? row.as_of_ts.toISOString() : firstText(row.as_of_ts), error_metric: firstText(row.error_metric), error_value: row.error_value === null || row.error_value === undefined ? null : Number(row.error_value), error_direction: firstText(row.error_direction), predicted_json: record(row.predicted_json), observed_json: record(row.observed_json), evidence_refs_json: evidenceArray(row.evidence_refs_json), blocking_reasons_json: stringArray(row.blocking_reasons_json), determinism_hash: firstText(row.determinism_hash) };
}

function toDecisionForecastRunRow(row: Row): DecisionForecastRunRowV1 {
  return { forecast_run_id: firstText(row.forecast_run_id), snapshot_id: firstText(row.snapshot_id), tenant_id: firstText(row.tenant_id), project_id: firstText(row.project_id), group_id: firstText(row.group_id), field_id: firstText(row.field_id), as_of_ts: row.as_of_ts instanceof Date ? row.as_of_ts.toISOString() : firstText(row.as_of_ts), status: firstText(row.status), determinism_hash: firstText(row.determinism_hash) };
}

function toDecisionScenarioSetRow(row: Row): DecisionScenarioSetRowV1 {
  return { scenario_set_id: firstText(row.scenario_set_id), forecast_run_id: firstText(row.forecast_run_id), tenant_id: firstText(row.tenant_id), project_id: firstText(row.project_id), group_id: firstText(row.group_id), field_id: firstText(row.field_id), as_of_ts: row.as_of_ts instanceof Date ? row.as_of_ts.toISOString() : firstText(row.as_of_ts), status: firstText(row.status), determinism_hash: firstText(row.determinism_hash) };
}

function toDecisionCalibrationReplayRow(row: Row): DecisionCalibrationReplayRowV1 {
  return { calibration_replay_id: firstText(row.calibration_replay_id), forecast_run_id: firstText(row.forecast_run_id), scenario_set_id: firstText(row.scenario_set_id), tenant_id: firstText(row.tenant_id), project_id: firstText(row.project_id), group_id: firstText(row.group_id), field_id: firstText(row.field_id), as_of_ts: row.as_of_ts instanceof Date ? row.as_of_ts.toISOString() : firstText(row.as_of_ts), status: firstText(row.status), determinism_hash: firstText(row.determinism_hash) };
}

function toDecisionForecastErrorRow(row: Row): DecisionForecastErrorRowV1 {
  return { forecast_error_id: firstText(row.forecast_error_id), calibration_replay_id: firstText(row.calibration_replay_id), forecast_run_id: firstText(row.forecast_run_id), scenario_set_id: firstText(row.scenario_set_id), tenant_id: firstText(row.tenant_id), project_id: firstText(row.project_id), group_id: firstText(row.group_id), field_id: firstText(row.field_id), as_of_ts: row.as_of_ts instanceof Date ? row.as_of_ts.toISOString() : firstText(row.as_of_ts), error_direction: firstText(row.error_direction), determinism_hash: firstText(row.determinism_hash) };
}

function toDecisionFieldLearningCandidateRow(row: Row): DecisionFieldLearningCandidateRowV1 {
  return { field_learning_candidate_id: firstText(row.field_learning_candidate_id), calibration_replay_id: firstText(row.calibration_replay_id), forecast_error_id: firstText(row.forecast_error_id), tenant_id: firstText(row.tenant_id), project_id: firstText(row.project_id), group_id: firstText(row.group_id), field_id: firstText(row.field_id), as_of_ts: row.as_of_ts instanceof Date ? row.as_of_ts.toISOString() : firstText(row.as_of_ts), candidate_status: firstText(row.candidate_status), determinism_hash: firstText(row.determinism_hash) };
}

async function insertSnapshot(pool: Pool, snapshot: ReturnType<typeof buildFieldStateSnapshotV1>): Promise<Row> {
  const result = await pool.query(`INSERT INTO field_state_snapshot_v1 (snapshot_id,tenant_id,project_id,group_id,field_id,season_id,as_of_ts,status,state_vector_json,confidence_json,evidence_refs_json,source_indexes_json,blocking_reasons_json,determinism_hash) VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz,$8,$9::jsonb,$10::jsonb,$11::jsonb,$12::jsonb,$13::jsonb,$14) ON CONFLICT (snapshot_id) DO NOTHING RETURNING *`, [snapshot.snapshot_id, snapshot.tenant_id, snapshot.project_id, snapshot.group_id, snapshot.field_id, snapshot.season_id, snapshot.as_of_ts, snapshot.status, JSON.stringify(snapshot.state_vector_json), JSON.stringify(snapshot.confidence_json), JSON.stringify(snapshot.evidence_refs_json), JSON.stringify(snapshot.source_indexes_json), JSON.stringify(snapshot.blocking_reasons_json), snapshot.determinism_hash]);
  if (result.rows[0]) return result.rows[0] as Row;
  const existing = await readSnapshotRow(pool, snapshot.snapshot_id);
  if (!existing) throw new Error("FIELD_STATE_SNAPSHOT_INSERT_FAILED");
  return existing;
}

async function insertForecastRun(pool: Pool, forecast: ReturnType<typeof buildForecastRunV1>): Promise<Row> {
  const result = await pool.query(`INSERT INTO forecast_run_v1 (forecast_run_id,snapshot_id,tenant_id,project_id,group_id,field_id,as_of_ts,horizon_days,model_version,status,input_refs_json,forecast_points_json,risk_timeline_json,uncertainty_json,assumptions_json,blocking_reasons_json,determinism_hash) VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz,$8,$9,$10,$11::jsonb,$12::jsonb,$13::jsonb,$14::jsonb,$15::jsonb,$16::jsonb,$17) ON CONFLICT (forecast_run_id) DO NOTHING RETURNING *`, [forecast.forecast_run_id, forecast.snapshot_id, forecast.tenant_id, forecast.project_id, forecast.group_id, forecast.field_id, forecast.as_of_ts, forecast.horizon_days, forecast.model_version, forecast.status, JSON.stringify(forecast.input_refs_json), JSON.stringify(forecast.forecast_points_json), JSON.stringify(forecast.risk_timeline_json), JSON.stringify(forecast.uncertainty_json), JSON.stringify(forecast.assumptions_json), JSON.stringify(forecast.blocking_reasons_json), forecast.determinism_hash]);
  if (result.rows[0]) return result.rows[0] as Row;
  const existing = await readForecastRunRow(pool, forecast.forecast_run_id);
  if (!existing) throw new Error("FORECAST_RUN_INSERT_FAILED");
  return existing;
}

async function insertScenarioSet(pool: Pool, scenarioSet: ReturnType<typeof buildScenarioSetV1>): Promise<Row> {
  const result = await pool.query(`INSERT INTO scenario_set_v1 (scenario_set_id,forecast_run_id,tenant_id,project_id,group_id,field_id,as_of_ts,scenario_model_version,status,input_refs_json,baseline_scenario_json,option_scenarios_json,comparison_axes_json,constraints_json,assumptions_json,blocking_reasons_json,determinism_hash) VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb,$13::jsonb,$14::jsonb,$15::jsonb,$16::jsonb,$17) ON CONFLICT (scenario_set_id) DO NOTHING RETURNING *`, [scenarioSet.scenario_set_id, scenarioSet.forecast_run_id, scenarioSet.tenant_id, scenarioSet.project_id, scenarioSet.group_id, scenarioSet.field_id, scenarioSet.as_of_ts, scenarioSet.scenario_model_version, scenarioSet.status, JSON.stringify(scenarioSet.input_refs_json), JSON.stringify(scenarioSet.baseline_scenario_json), JSON.stringify(scenarioSet.option_scenarios_json), JSON.stringify(scenarioSet.comparison_axes_json), JSON.stringify(scenarioSet.constraints_json), JSON.stringify(scenarioSet.assumptions_json), JSON.stringify(scenarioSet.blocking_reasons_json), scenarioSet.determinism_hash]);
  if (result.rows[0]) return result.rows[0] as Row;
  const existing = await readScenarioSetRow(pool, scenarioSet.scenario_set_id);
  if (!existing) throw new Error("SCENARIO_SET_INSERT_FAILED");
  return existing;
}

async function insertCalibrationReplay(pool: Pool, replay: ReturnType<typeof buildCalibrationReplayAndForecastErrorV1>["calibrationReplay"]): Promise<Row> {
  const result = await pool.query(`INSERT INTO calibration_replay_v1 (calibration_replay_id,forecast_run_id,scenario_set_id,tenant_id,project_id,group_id,field_id,as_of_ts,selected_option_id,status,input_refs_json,predicted_json,observed_json,error_summary_json,reason_candidates_json,evidence_refs_json,blocking_reasons_json,determinism_hash) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::timestamptz,$9,$10,$11::jsonb,$12::jsonb,$13::jsonb,$14::jsonb,$15::jsonb,$16::jsonb,$17::jsonb,$18) ON CONFLICT (calibration_replay_id) DO NOTHING RETURNING *`, [replay.calibration_replay_id, replay.forecast_run_id, replay.scenario_set_id, replay.tenant_id, replay.project_id, replay.group_id, replay.field_id, replay.as_of_ts, replay.selected_option_id, replay.status, JSON.stringify(replay.input_refs_json), JSON.stringify(replay.predicted_json), JSON.stringify(replay.observed_json), JSON.stringify(replay.error_summary_json), JSON.stringify(replay.reason_candidates_json), JSON.stringify(replay.evidence_refs_json), JSON.stringify(replay.blocking_reasons_json), replay.determinism_hash]);
  if (result.rows[0]) return result.rows[0] as Row;
  const existing = await readCalibrationReplayRow(pool, replay.calibration_replay_id);
  if (!existing) throw new Error("CALIBRATION_REPLAY_INSERT_FAILED");
  return existing;
}

async function insertForecastError(pool: Pool, error: ReturnType<typeof buildCalibrationReplayAndForecastErrorV1>["forecastError"]): Promise<Row> {
  const result = await pool.query(`INSERT INTO forecast_error_v1 (forecast_error_id,calibration_replay_id,forecast_run_id,scenario_set_id,tenant_id,project_id,group_id,field_id,as_of_ts,error_metric,error_value,error_direction,predicted_json,observed_json,evidence_refs_json,blocking_reasons_json,determinism_hash) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::timestamptz,$10,$11,$12,$13::jsonb,$14::jsonb,$15::jsonb,$16::jsonb,$17) ON CONFLICT (forecast_error_id) DO NOTHING RETURNING *`, [error.forecast_error_id, error.calibration_replay_id, error.forecast_run_id, error.scenario_set_id, error.tenant_id, error.project_id, error.group_id, error.field_id, error.as_of_ts, error.error_metric, error.error_value, error.error_direction, JSON.stringify(error.predicted_json), JSON.stringify(error.observed_json), JSON.stringify(error.evidence_refs_json), JSON.stringify(error.blocking_reasons_json), error.determinism_hash]);
  if (result.rows[0]) return result.rows[0] as Row;
  const existing = await readForecastErrorRow(pool, error.forecast_error_id);
  if (!existing) throw new Error("FORECAST_ERROR_INSERT_FAILED");
  return existing;
}

async function insertFieldLearningCandidate(pool: Pool, candidate: ReturnType<typeof buildFieldLearningCandidateV1>): Promise<Row> {
  const result = await pool.query(`INSERT INTO field_learning_candidate_v1 (field_learning_candidate_id,calibration_replay_id,forecast_error_id,tenant_id,project_id,group_id,field_id,as_of_ts,candidate_status,learning_scope,learning_statement_json,supporting_evidence_refs_json,counter_evidence_refs_json,confidence_json,formal_gate_refs_json,h58_gate_status_json,blocking_reasons_json,determinism_hash) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::timestamptz,$9,$10,$11::jsonb,$12::jsonb,$13::jsonb,$14::jsonb,$15::jsonb,$16::jsonb,$17::jsonb,$18) ON CONFLICT (field_learning_candidate_id) DO NOTHING RETURNING *`, [candidate.field_learning_candidate_id, candidate.calibration_replay_id, candidate.forecast_error_id, candidate.tenant_id, candidate.project_id, candidate.group_id, candidate.field_id, candidate.as_of_ts, candidate.candidate_status, candidate.learning_scope, JSON.stringify(candidate.learning_statement_json), JSON.stringify(candidate.supporting_evidence_refs_json), JSON.stringify(candidate.counter_evidence_refs_json), JSON.stringify(candidate.confidence_json), JSON.stringify(candidate.formal_gate_refs_json), JSON.stringify(candidate.h58_gate_status_json), JSON.stringify(candidate.blocking_reasons_json), candidate.determinism_hash]);
  if (result.rows[0]) return result.rows[0] as Row;
  const existing = await readFieldLearningCandidateRow(pool, candidate.field_learning_candidate_id);
  if (!existing) throw new Error("FIELD_LEARNING_CANDIDATE_INSERT_FAILED");
  return existing;
}

async function insertDecisionCycle(pool: Pool, cycle: ReturnType<typeof buildDecisionCycleV1>): Promise<Row> {
  const result = await pool.query(`INSERT INTO decision_cycle_v1 (decision_cycle_id,snapshot_id,forecast_run_id,scenario_set_id,calibration_replay_id,forecast_error_id,field_learning_candidate_id,tenant_id,project_id,group_id,field_id,as_of_ts,cycle_status,current_stage,external_refs_json,state_machine_json,human_gate_json,boundary_flags_json,blocking_reasons_json,determinism_hash) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::timestamptz,$13,$14,$15::jsonb,$16::jsonb,$17::jsonb,$18::jsonb,$19::jsonb,$20) ON CONFLICT (decision_cycle_id) DO NOTHING RETURNING *`, [cycle.decision_cycle_id, cycle.snapshot_id, cycle.forecast_run_id, cycle.scenario_set_id, cycle.calibration_replay_id, cycle.forecast_error_id, cycle.field_learning_candidate_id, cycle.tenant_id, cycle.project_id, cycle.group_id, cycle.field_id, cycle.as_of_ts, cycle.cycle_status, cycle.current_stage, JSON.stringify(cycle.external_refs_json), JSON.stringify(cycle.state_machine_json), JSON.stringify(cycle.human_gate_json), JSON.stringify(cycle.boundary_flags_json), JSON.stringify(cycle.blocking_reasons_json), cycle.determinism_hash]);
  if (result.rows[0]) return result.rows[0] as Row;
  const existing = await readDecisionCycleRow(pool, cycle.decision_cycle_id);
  if (!existing) throw new Error("DECISION_CYCLE_INSERT_FAILED");
  return existing;
}

function iso(rowValue: unknown): unknown {
  return rowValue instanceof Date ? rowValue.toISOString() : rowValue;
}

function exposeSnapshotRow(row: Row): Row {
  return { snapshot_id: row.snapshot_id, tenant_id: row.tenant_id, project_id: row.project_id, group_id: row.group_id, field_id: row.field_id, season_id: row.season_id ?? null, as_of_ts: iso(row.as_of_ts), status: row.status, state_vector_json: row.state_vector_json, confidence_json: row.confidence_json, evidence_refs_json: row.evidence_refs_json, source_indexes_json: row.source_indexes_json, blocking_reasons_json: row.blocking_reasons_json, determinism_hash: row.determinism_hash, created_at: iso(row.created_at) };
}

function exposeForecastRunRow(row: Row): Row {
  return { forecast_run_id: row.forecast_run_id, snapshot_id: row.snapshot_id, tenant_id: row.tenant_id, project_id: row.project_id, group_id: row.group_id, field_id: row.field_id, as_of_ts: iso(row.as_of_ts), horizon_days: row.horizon_days, model_version: row.model_version, status: row.status, input_refs_json: row.input_refs_json, forecast_points_json: row.forecast_points_json, risk_timeline_json: row.risk_timeline_json, uncertainty_json: row.uncertainty_json, assumptions_json: row.assumptions_json, blocking_reasons_json: row.blocking_reasons_json, determinism_hash: row.determinism_hash, created_at: iso(row.created_at) };
}

function exposeScenarioSetRow(row: Row): Row {
  return { scenario_set_id: row.scenario_set_id, forecast_run_id: row.forecast_run_id, tenant_id: row.tenant_id, project_id: row.project_id, group_id: row.group_id, field_id: row.field_id, as_of_ts: iso(row.as_of_ts), scenario_model_version: row.scenario_model_version, status: row.status, input_refs_json: row.input_refs_json, baseline_scenario_json: row.baseline_scenario_json, option_scenarios_json: row.option_scenarios_json, comparison_axes_json: row.comparison_axes_json, constraints_json: row.constraints_json, assumptions_json: row.assumptions_json, blocking_reasons_json: row.blocking_reasons_json, determinism_hash: row.determinism_hash, created_at: iso(row.created_at) };
}

function exposeCalibrationReplayRow(row: Row): Row {
  return { calibration_replay_id: row.calibration_replay_id, forecast_run_id: row.forecast_run_id, scenario_set_id: row.scenario_set_id, tenant_id: row.tenant_id, project_id: row.project_id, group_id: row.group_id, field_id: row.field_id, as_of_ts: iso(row.as_of_ts), selected_option_id: row.selected_option_id ?? null, status: row.status, input_refs_json: row.input_refs_json, predicted_json: row.predicted_json, observed_json: row.observed_json, error_summary_json: row.error_summary_json, reason_candidates_json: row.reason_candidates_json, evidence_refs_json: row.evidence_refs_json, blocking_reasons_json: row.blocking_reasons_json, determinism_hash: row.determinism_hash, created_at: iso(row.created_at) };
}

function exposeForecastErrorRow(row: Row): Row {
  return { forecast_error_id: row.forecast_error_id, calibration_replay_id: row.calibration_replay_id, forecast_run_id: row.forecast_run_id, scenario_set_id: row.scenario_set_id, tenant_id: row.tenant_id, project_id: row.project_id, group_id: row.group_id, field_id: row.field_id, as_of_ts: iso(row.as_of_ts), error_metric: row.error_metric, error_value: row.error_value, error_direction: row.error_direction, predicted_json: row.predicted_json, observed_json: row.observed_json, evidence_refs_json: row.evidence_refs_json, blocking_reasons_json: row.blocking_reasons_json, determinism_hash: row.determinism_hash, created_at: iso(row.created_at) };
}

function exposeFieldLearningCandidateRow(row: Row): Row {
  return { field_learning_candidate_id: row.field_learning_candidate_id, calibration_replay_id: row.calibration_replay_id, forecast_error_id: row.forecast_error_id, tenant_id: row.tenant_id, project_id: row.project_id, group_id: row.group_id, field_id: row.field_id, as_of_ts: iso(row.as_of_ts), candidate_status: row.candidate_status, learning_scope: row.learning_scope, learning_statement_json: row.learning_statement_json, supporting_evidence_refs_json: row.supporting_evidence_refs_json, counter_evidence_refs_json: row.counter_evidence_refs_json, confidence_json: row.confidence_json, formal_gate_refs_json: row.formal_gate_refs_json, h58_gate_status_json: row.h58_gate_status_json, blocking_reasons_json: row.blocking_reasons_json, determinism_hash: row.determinism_hash, created_at: iso(row.created_at) };
}

function exposeDecisionCycleRow(row: Row): Row {
  return { decision_cycle_id: row.decision_cycle_id, snapshot_id: row.snapshot_id, forecast_run_id: row.forecast_run_id, scenario_set_id: row.scenario_set_id, calibration_replay_id: row.calibration_replay_id, forecast_error_id: row.forecast_error_id, field_learning_candidate_id: row.field_learning_candidate_id, tenant_id: row.tenant_id, project_id: row.project_id, group_id: row.group_id, field_id: row.field_id, as_of_ts: iso(row.as_of_ts), cycle_status: row.cycle_status, current_stage: row.current_stage, external_refs_json: row.external_refs_json, state_machine_json: row.state_machine_json, human_gate_json: row.human_gate_json, boundary_flags_json: row.boundary_flags_json, blocking_reasons_json: row.blocking_reasons_json, determinism_hash: row.determinism_hash, created_at: iso(row.created_at) };
}

export function registerTwinKernelV1Routes(app: FastifyInstance, pool: Pool): void {
  app.post("/api/v1/twin-kernel/field-state-snapshots", async (req, reply) => {
    const scope = extractScope(req);
    if (!scope) return reply.code(400).send({ ok: false, error: "TENANT_PROJECT_GROUP_FIELD_SCOPE_REQUIRED" });
    let asOfTs: string;
    try { asOfTs = extractAsOfTs(req); } catch { return reply.code(400).send({ ok: false, error: "INVALID_AS_OF_TS" }); }
    const seasonId = extractSeasonId(req);
    const sources = { field: await readFieldRow(pool, scope), water: await readWaterRow(pool, scope), sensing: await readSensingRow(pool, scope), weather: await readWeatherRow(pool, scope) };
    const snapshot = buildFieldStateSnapshotV1({ scope, season_id: seasonId, as_of_ts: asOfTs, sources });
    const row = await insertSnapshot(pool, snapshot);
    return reply.send({ ok: true, object_type: "field_state_snapshot_v1", write_ready: true, downstream_write_ready: false, snapshot: exposeSnapshotRow(row) });
  });

  app.get("/api/v1/twin-kernel/field-state-snapshots/:snapshot_id", async (req: any, reply) => {
    const snapshotId = firstText(req?.params?.snapshot_id);
    if (!snapshotId) return reply.code(400).send({ ok: false, error: "SNAPSHOT_ID_REQUIRED" });
    const row = await readSnapshotRow(pool, snapshotId);
    if (!row) return reply.code(404).send({ ok: false, error: "FIELD_STATE_SNAPSHOT_NOT_FOUND" });
    return reply.send({ ok: true, object_type: "field_state_snapshot_v1", snapshot: exposeSnapshotRow(row) });
  });

  app.post("/api/v1/twin-kernel/forecast-runs", async (req, reply) => {
    const snapshotId = extractSnapshotId(req);
    if (!snapshotId) return reply.code(400).send({ ok: false, error: "SNAPSHOT_ID_REQUIRED" });
    const snapshotRow = await readSnapshotRow(pool, snapshotId);
    if (!snapshotRow) return reply.code(404).send({ ok: false, error: "FIELD_STATE_SNAPSHOT_NOT_FOUND" });
    const modelVersion = extractModelVersion(req) || undefined;
    const forecast = buildForecastRunV1({ snapshot: toForecastRunSnapshotRow(snapshotRow), model_version: modelVersion });
    const row = await insertForecastRun(pool, forecast);
    return reply.send({ ok: true, object_type: "forecast_run_v1", write_ready: true, downstream_write_ready: false, forecast_run: exposeForecastRunRow(row) });
  });

  app.get("/api/v1/twin-kernel/forecast-runs/:forecast_run_id", async (req: any, reply) => {
    const forecastRunId = firstText(req?.params?.forecast_run_id);
    if (!forecastRunId) return reply.code(400).send({ ok: false, error: "FORECAST_RUN_ID_REQUIRED" });
    const row = await readForecastRunRow(pool, forecastRunId);
    if (!row) return reply.code(404).send({ ok: false, error: "FORECAST_RUN_NOT_FOUND" });
    return reply.send({ ok: true, object_type: "forecast_run_v1", forecast_run: exposeForecastRunRow(row) });
  });

  app.post("/api/v1/twin-kernel/scenario-sets", async (req, reply) => {
    const forecastRunId = extractForecastRunId(req);
    if (!forecastRunId) return reply.code(400).send({ ok: false, error: "FORECAST_RUN_ID_REQUIRED" });
    const forecastRunRow = await readForecastRunRow(pool, forecastRunId);
    if (!forecastRunRow) return reply.code(404).send({ ok: false, error: "FORECAST_RUN_NOT_FOUND" });
    const scenarioModelVersion = extractScenarioModelVersion(req) || undefined;
    const scenarioSet = buildScenarioSetV1({ forecastRun: toScenarioSetForecastRunRow(forecastRunRow), scenario_model_version: scenarioModelVersion });
    const row = await insertScenarioSet(pool, scenarioSet);
    return reply.send({ ok: true, object_type: "scenario_set_v1", write_ready: true, downstream_write_ready: false, scenario_set: exposeScenarioSetRow(row) });
  });

  app.get("/api/v1/twin-kernel/scenario-sets/:scenario_set_id", async (req: any, reply) => {
    const scenarioSetId = firstText(req?.params?.scenario_set_id);
    if (!scenarioSetId) return reply.code(400).send({ ok: false, error: "SCENARIO_SET_ID_REQUIRED" });
    const row = await readScenarioSetRow(pool, scenarioSetId);
    if (!row) return reply.code(404).send({ ok: false, error: "SCENARIO_SET_NOT_FOUND" });
    return reply.send({ ok: true, object_type: "scenario_set_v1", scenario_set: exposeScenarioSetRow(row) });
  });

  app.post("/api/v1/twin-kernel/calibration-replays", async (req, reply) => {
    const scenarioSetId = extractScenarioSetId(req);
    if (!scenarioSetId) return reply.code(400).send({ ok: false, error: "SCENARIO_SET_ID_REQUIRED" });
    const scenarioSetRow = await readScenarioSetRow(pool, scenarioSetId);
    if (!scenarioSetRow) return reply.code(404).send({ ok: false, error: "SCENARIO_SET_NOT_FOUND" });
    const forecastRunId = firstText(scenarioSetRow.forecast_run_id);
    const forecastRunRow = await readForecastRunRow(pool, forecastRunId);
    if (!forecastRunRow) return reply.code(404).send({ ok: false, error: "FORECAST_RUN_NOT_FOUND" });
    const built = buildCalibrationReplayAndForecastErrorV1({ scenarioSet: toCalibrationScenarioSetRow(scenarioSetRow), forecastRun: toCalibrationForecastRunRow(forecastRunRow), observed: extractObservedPayload(req), selected_option_id: extractSelectedOptionId(req) });
    const replayRow = await insertCalibrationReplay(pool, built.calibrationReplay);
    const errorRow = await insertForecastError(pool, built.forecastError);
    return reply.send({ ok: true, object_type: "calibration_replay_v1", companion_object_type: "forecast_error_v1", write_ready: true, downstream_write_ready: false, calibration_replay: exposeCalibrationReplayRow(replayRow), forecast_error: exposeForecastErrorRow(errorRow) });
  });

  app.get("/api/v1/twin-kernel/calibration-replays/:calibration_replay_id", async (req: any, reply) => {
    const replayId = firstText(req?.params?.calibration_replay_id);
    if (!replayId) return reply.code(400).send({ ok: false, error: "CALIBRATION_REPLAY_ID_REQUIRED" });
    const row = await readCalibrationReplayRow(pool, replayId);
    if (!row) return reply.code(404).send({ ok: false, error: "CALIBRATION_REPLAY_NOT_FOUND" });
    return reply.send({ ok: true, object_type: "calibration_replay_v1", calibration_replay: exposeCalibrationReplayRow(row) });
  });

  app.get("/api/v1/twin-kernel/forecast-errors/:forecast_error_id", async (req: any, reply) => {
    const errorId = firstText(req?.params?.forecast_error_id);
    if (!errorId) return reply.code(400).send({ ok: false, error: "FORECAST_ERROR_ID_REQUIRED" });
    const row = await readForecastErrorRow(pool, errorId);
    if (!row) return reply.code(404).send({ ok: false, error: "FORECAST_ERROR_NOT_FOUND" });
    return reply.send({ ok: true, object_type: "forecast_error_v1", forecast_error: exposeForecastErrorRow(row) });
  });

  app.post("/api/v1/twin-kernel/field-learning-candidates", async (req, reply) => {
    const errorId = extractForecastErrorId(req);
    if (!errorId) return reply.code(400).send({ ok: false, error: "FORECAST_ERROR_ID_REQUIRED" });
    const errorRow = await readForecastErrorRow(pool, errorId);
    if (!errorRow) return reply.code(404).send({ ok: false, error: "FORECAST_ERROR_NOT_FOUND" });
    const replayId = firstText(errorRow.calibration_replay_id);
    const replayRow = await readCalibrationReplayRow(pool, replayId);
    if (!replayRow) return reply.code(404).send({ ok: false, error: "CALIBRATION_REPLAY_NOT_FOUND" });
    const candidate = buildFieldLearningCandidateV1({ calibrationReplay: toFieldLearningCalibrationReplayRow(replayRow), forecastError: toFieldLearningForecastErrorRow(errorRow), formal_gate_refs: extractFormalGateRefs(req) });
    const row = await insertFieldLearningCandidate(pool, candidate);
    return reply.send({ ok: true, object_type: "field_learning_candidate_v1", write_ready: true, downstream_write_ready: false, formal_field_memory_write_created: false, field_learning_candidate: exposeFieldLearningCandidateRow(row) });
  });

  app.get("/api/v1/twin-kernel/field-learning-candidates/:field_learning_candidate_id", async (req: any, reply) => {
    const candidateId = firstText(req?.params?.field_learning_candidate_id);
    if (!candidateId) return reply.code(400).send({ ok: false, error: "FIELD_LEARNING_CANDIDATE_ID_REQUIRED" });
    const row = await readFieldLearningCandidateRow(pool, candidateId);
    if (!row) return reply.code(404).send({ ok: false, error: "FIELD_LEARNING_CANDIDATE_NOT_FOUND" });
    return reply.send({ ok: true, object_type: "field_learning_candidate_v1", field_learning_candidate: exposeFieldLearningCandidateRow(row) });
  });

  app.post("/api/v1/twin-kernel/decision-cycles", async (req, reply) => {
    const candidateId = extractFieldLearningCandidateId(req);
    if (!candidateId) return reply.code(400).send({ ok: false, error: "FIELD_LEARNING_CANDIDATE_ID_REQUIRED" });
    const candidateRow = await readFieldLearningCandidateRow(pool, candidateId);
    if (!candidateRow) return reply.code(404).send({ ok: false, error: "FIELD_LEARNING_CANDIDATE_NOT_FOUND" });
    const errorId = firstText(candidateRow.forecast_error_id);
    const errorRow = await readForecastErrorRow(pool, errorId);
    if (!errorRow) return reply.code(404).send({ ok: false, error: "FORECAST_ERROR_NOT_FOUND" });
    const replayId = firstText(candidateRow.calibration_replay_id);
    const replayRow = await readCalibrationReplayRow(pool, replayId);
    if (!replayRow) return reply.code(404).send({ ok: false, error: "CALIBRATION_REPLAY_NOT_FOUND" });
    const scenarioSetId = firstText(replayRow.scenario_set_id);
    const scenarioSetRow = await readScenarioSetRow(pool, scenarioSetId);
    if (!scenarioSetRow) return reply.code(404).send({ ok: false, error: "SCENARIO_SET_NOT_FOUND" });
    const forecastRunId = firstText(errorRow.forecast_run_id);
    const forecastRunRow = await readForecastRunRow(pool, forecastRunId);
    if (!forecastRunRow) return reply.code(404).send({ ok: false, error: "FORECAST_RUN_NOT_FOUND" });
    const cycle = buildDecisionCycleV1({ forecastRun: toDecisionForecastRunRow(forecastRunRow), scenarioSet: toDecisionScenarioSetRow(scenarioSetRow), calibrationReplay: toDecisionCalibrationReplayRow(replayRow), forecastError: toDecisionForecastErrorRow(errorRow), fieldLearningCandidate: toDecisionFieldLearningCandidateRow(candidateRow), external_refs: extractDecisionExternalRefs(req) });
    const row = await insertDecisionCycle(pool, cycle);
    return reply.send({ ok: true, object_type: "decision_cycle_v1", write_ready: true, downstream_write_ready: false, automatic_task_created: false, decision_cycle: exposeDecisionCycleRow(row) });
  });

  app.get("/api/v1/twin-kernel/decision-cycles/:decision_cycle_id", async (req: any, reply) => {
    const cycleId = firstText(req?.params?.decision_cycle_id) || extractDecisionCycleId(req);
    if (!cycleId) return reply.code(400).send({ ok: false, error: "DECISION_CYCLE_ID_REQUIRED" });
    const row = await readDecisionCycleRow(pool, cycleId);
    if (!row) return reply.code(404).send({ ok: false, error: "DECISION_CYCLE_NOT_FOUND" });
    return reply.send({ ok: true, object_type: "decision_cycle_v1", decision_cycle: exposeDecisionCycleRow(row) });
  });
}
